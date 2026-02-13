/**
 * ImageRecognitionService - 图片 AI 识别服务
 *
 * 调用多模态 LLM (qwen-vl-plus) 对 MinIO 中的图片进行内容识别，
 * 返回结构化的 ImageAnalysisResult（description, elements, theme）。
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class ImageRecognitionService {
  /**
   * @param {object} llmClient - LLM 客户端实例（llmClient.js 导出的单例）
   * @param {object} minioService - MinIO 服务实例（minioService.js 导出的单例）
   */
  constructor(llmClient, minioService) {
    this.llmClient = llmClient;
    this.minioService = minioService;
  }

  /**
   * 分析图片：从 MinIO 获取图片 → 转 base64 → 构建 prompt → 调用 LLM → 解析结果 → 存入数据库
   * @param {string} imageKey - MinIO 中的对象键
   * @param {string} [bucketName] - 存储桶名称
   * @returns {Promise<object>} ImageAnalysisResult
   */
  async analyzeImage(imageKey, bucketName) {
    try {
      // 1. 从 MinIO 获取图片
      const { body, contentType } = await this.minioService.getFile(imageKey, bucketName);

      // 2. 将 ReadableStream 转为 Buffer 再转 base64
      const chunks = [];
      for await (const chunk of body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      const base64 = buffer.toString('base64');
      const mimeType = contentType || 'image/png';
      const imageBase64 = `data:${mimeType};base64,${base64}`;

      // 3. 构建多模态 prompt
      const prompt = this.buildPrompt(imageBase64);

      // 4. 调用 LLM（使用 qwen-vl-plus 多模态模型）
      const llmResponse = await this.llmClient.call(prompt, {
        model: 'qwen-vl-plus',
        temperature: 0.3,
        maxTokens: 1000,
      });

      // 5. 解析结果
      const result = this.parseAnalysisResult(llmResponse);

      // 6. 更新数据库记录
      const updated = await prisma.imageAnalysis.updateMany({
        where: { imageKey },
        data: {
          description: result.description,
          elements: JSON.stringify(result.elements),
          theme: result.theme,
          status: 'completed',
        },
      });

      // 如果没有已有记录，创建一条新的
      if (updated.count === 0) {
        await prisma.imageAnalysis.create({
          data: {
            imageKey,
            imageUrl: `/api/images/proxy/${imageKey}`,
            description: result.description,
            elements: JSON.stringify(result.elements),
            theme: result.theme,
            status: 'completed',
          },
        });
      }

      return result;
    } catch (error) {
      console.error(`图片识别失败 [${imageKey}]:`, error.message);

      // 将状态设为 failed，记录错误信息
      try {
        await prisma.imageAnalysis.updateMany({
          where: { imageKey },
          data: {
            status: 'failed',
            error: error.message,
          },
        });
      } catch (dbError) {
        console.error('更新识别失败状态时出错:', dbError.message);
      }

      throw error;
    }
  }

  /**
   * 构建 qwen-vl-plus 多模态识别 prompt
   * @param {string} imageBase64 - base64 编码的图片（含 data URI 前缀）
   * @returns {string} 多模态 prompt
   */
  buildPrompt(imageBase64) {
    return [
      {
        type: 'image_url',
        image_url: { url: imageBase64 },
      },
      {
        type: 'text',
        text: '请仔细分析这张图片的内容，返回以下 JSON 格式的结果（只返回纯 JSON，不要包含任何其他文字或 markdown 标记）：\n{\n  "description": "用一段完整的话详细描述图片内容，包括场景、人物、物体、颜色、布局等细节",\n  "elements": ["图片中识别到的主要元素1", "元素2", "元素3"],\n  "theme": "用2-4个字概括图片主题"\n}',
      },
    ];
  }

  /**
   * 解析 LLM 文本响应为结构化的 ImageAnalysisResult
   * @param {string} llmResponse - LLM 返回的文本
   * @returns {{ description: string, elements: string[], theme: string }}
   */
  parseAnalysisResult(llmResponse) {
    const defaultResult = {
      description: '',
      elements: [],
      theme: '',
    };

    if (!llmResponse || typeof llmResponse !== 'string') {
      return defaultResult;
    }

    try {
      // 尝试从响应中提取 JSON（处理 markdown 代码块包裹的情况）
      let cleaned = llmResponse.trim();
      const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
      if (fenceMatch) {
        cleaned = fenceMatch[1].trim();
      }

      const parsed = JSON.parse(cleaned);

      return {
        description: typeof parsed.description === 'string' ? parsed.description : '',
        elements: Array.isArray(parsed.elements)
          ? parsed.elements.filter((e) => typeof e === 'string')
          : [],
        theme: typeof parsed.theme === 'string' ? parsed.theme : '',
      };
    } catch {
      // JSON 解析失败时，将整个响应作为 description
      return {
        description: llmResponse.trim(),
        elements: [],
        theme: '',
      };
    }
  }
}

// 导出类和单例工厂
module.exports = { ImageRecognitionService };

// 延迟创建单例（避免循环依赖）
let _instance = null;
module.exports.getImageRecognitionService = () => {
  if (!_instance) {
    const llmClient = require('./llmClient');
    const minioService = require('./minioService');
    _instance = new ImageRecognitionService(llmClient, minioService);
  }
  return _instance;
};
