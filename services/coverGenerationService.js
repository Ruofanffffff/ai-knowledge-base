const path = require('path');

const PROMPT_TEMPLATE = `你是一名擅长为文章生成【真实世界实景摄影风格封面图】的视觉创作者。请基于以下【文章索引描述】，生成一张文章首图。该图片必须呈现为"真实相机拍摄的实景照片效果"，而不是插画、动画、手绘、水彩、油画或任何CG / 概念艺术风格。

【文章索引描述】
{indexedText}

────────────────────
【生成目标】
将文章索引中的：
- 文章主旨
- 核心概念
- 空间 / 对比 / 逻辑等关系
转译为一张具有"可读性"的封面照片，让读者一眼感知文章类型与整体气质，而不是复现具体细节或堆砌信息。

────────────────────
【画面主题要求】
- 提炼文章的"整体意象"，而非单一对象或单一场景
- 如果文章涉及空间或路径关系，画面需体现连续性、延伸感或方向感
- 避免打卡式单点构图

────────────────────
【摄影与真实感要求（必须严格遵守）】
- 媒介：真实摄影（photography）
- 场景：现实世界中真实存在、物理上合理的环境
- 光线：自然光（清晨、傍晚或阴天）
- 色彩：真实、低饱和、接近人眼所见
- 质感：可辨识的真实材质（天空层次、地面纹理、水面反射、建筑细节）
- 景深：自然景深，而非平面化画面

────────────────────
【镜头与构图】
- 镜头：广角或中远景镜头
- 视角：人眼高度或略高
- 构图：符合真实摄影逻辑，而非绘画式构图
- 画面中需保留明显留白区域，用于后期叠加文章标题
- 横版/竖版构图随机，适合作为文章封面

────────────────────
【人物与元素约束】
- 不以人物特写为主体
- 如出现人物，应为远景或背影，作为环境比例参考
- 不出现夸张、不现实或风格化的视觉符号

────────────────────
【严格限制（非常重要）】
- 禁止插画风格
- 禁止动画 / 卡通 / 手绘 / 水彩 / 油画风格
- 禁止CG、3D感、概念设计感
- 禁止商业广告画面风格
- 禁止过度修饰、过度滤镜或视觉夸张
- 禁止信息过载

────────────────────
【最终要求】
最终生成的画面应让人明确感知：这是一张"真实世界中可以被拍摄到的旅行或空间场景照片"，用于承载文章标题，而不是独立欣赏的艺术插画。`;

const DEFAULT_PIPELINE_TIMEOUT = 120000; // 2 minutes

class CoverGenerationService {
  constructor(config = {}) {
    this.jimengClient = config.jimengClient;
    this.minioService = config.minioService || require('./minioService');
    this.kgPrisma = config.kgPrisma;
    this.db = config.db;
    this.pipelineTimeout = config.pipelineTimeout || DEFAULT_PIPELINE_TIMEOUT;
  }

  /**
   * 异步生成封面图（fire-and-forget）
   * 调用 API 获取所有生成图片，全部下载存储到 MinIO，随机选一张作为封面
   * @param {number} postId - 帖子ID
   * @param {number|string} documentId - 文档ID
   */
  async generateCover(postId, documentId) {
    try {
      const mainLogic = async () => {
        // 1. 查询文档索引（docId 在 Prisma 中是 String 类型，需确保转换）
        const docIndex = await this.kgPrisma.documentIndex.findFirst({
          where: { docId: String(documentId) },
          orderBy: { version: 'desc' },
        });

        if (!docIndex || !docIndex.indexedText) {
          console.warn(`[CoverGen] 文档 ${documentId} 无索引数据，跳过封面生成`);
          return;
        }

        // 2. 构建提示词
        const prompt = this.buildPrompt(docIndex.indexedText);

        // 3. 调用即梦AI生成图片
        let images;
        try {
          images = await this.jimengClient.generateImage(prompt);
        } catch (err) {
          console.error(`[CoverGen] 即梦AI调用失败 (postId=${postId}):`, err.message);
          return;
        }

        if (!images || images.length === 0) {
          console.warn(`[CoverGen] 即梦AI返回空图片列表 (postId=${postId})`);
          return;
        }

        // 4. 下载所有图片并上传到 MinIO
        const proxyUrls = await this.downloadAndStoreAll(images);

        if (proxyUrls.length === 0) {
          console.error(`[CoverGen] 所有图片下载/上传失败 (postId=${postId})`);
          return;
        }

        // 5. 随机选一张更新帖子封面
        const selectedUrl = proxyUrls[Math.floor(Math.random() * proxyUrls.length)];
        await this.updatePostCover(postId, selectedUrl);

        console.log(`[CoverGen] 封面生成成功 (postId=${postId}), 共 ${proxyUrls.length} 张图片, 选中: ${selectedUrl}`);
      };

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('封面生成流程超时')), this.pipelineTimeout);
      });

      await Promise.race([mainLogic(), timeoutPromise]);
    } catch (err) {
      console.error(`[CoverGen] 封面生成流程异常 (postId=${postId}):`, err.message);
    }
  }

  /**
   * 构建图片生成提示词
   * @param {string} indexedText - 文档索引文本
   * @returns {string} 完整提示词
   */
  buildPrompt(indexedText) {
    return PROMPT_TEMPLATE.replace('{indexedText}', indexedText);
  }

  /**
   * 下载所有图片并上传到 MinIO
   * @param {Array<{url: string}>} images - API 返回的图片列表
   * @returns {Promise<string[]>} 所有成功上传的 MinIO 代理 URL 列表
   */
  async downloadAndStoreAll(images) {
    const proxyUrls = [];

    for (const image of images) {
      try {
        // 下载图片到 Buffer
        const response = await fetch(image.url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 从 URL 推断文件扩展名，默认 .png
        const urlPath = new URL(image.url).pathname;
        const ext = path.extname(urlPath) || '.png';
        const originalname = `cover${ext}`;

        // 推断 mimetype
        const contentType = response.headers.get('content-type') || 'image/png';

        // 构造 multer-like file 对象
        const fileObj = {
          buffer,
          originalname,
          mimetype: contentType,
        };

        // 上传到 MinIO
        const result = await this.minioService.uploadFile(fileObj);
        proxyUrls.push(result.url);
      } catch (err) {
        console.error(`[CoverGen] 图片下载/上传失败 (${image.url}):`, err.message);
        // 跳过失败的图片，继续处理下一张
      }
    }

    return proxyUrls;
  }

  /**
   * 更新帖子封面
   * @param {number} postId - 帖子ID
   * @param {string} coverUrl - MinIO 代理 URL
   * @returns {Promise<void>}
   */
  updatePostCover(postId, coverUrl) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE community_posts SET cover_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [coverUrl, postId],
        (err) => {
          if (err) {
            console.error(`[CoverGen] 更新帖子封面失败 (postId=${postId}):`, err.message);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }
}

module.exports = { CoverGenerationService };
