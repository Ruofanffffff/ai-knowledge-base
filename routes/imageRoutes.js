/**
 * Image Routes - 图片上传、代理和识别结果查询
 *
 * POST   /api/images/upload        → multer 接收 → MinIO 存储 → 异步触发识别 → 返回 { url, key, analysisId, analysisStatus }
 * GET    /api/images/:id/analysis  → 查询 ImageAnalysis 记录返回识别结果
 * GET    /api/images/proxy/*       → 代理 MinIO 图片访问
 *
 * Requirements: 2.3, 2.4, 3.1
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const minioService = require('../services/minioService');

const prisma = new PrismaClient();

// multer 配置：内存存储，仅接受图片，10MB 限制
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('仅支持图片文件（image/*）'), false);
    }
  },
});

/**
 * 上传图片
 * POST /api/images/upload
 *
 * 接收图片文件 → 上传至 MinIO → 创建 ImageAnalysis 记录（pending）→ 异步触发识别 → 返回结果
 *
 * Request: multipart/form-data, field name: "file"
 * Response: { url, key, analysisId, analysisStatus }
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传图片文件' });
    }

    // 1. 上传到 MinIO
    const { key, url } = await minioService.uploadFile(req.file);

    // 2. 创建 ImageAnalysis 记录（status: pending）
    const analysis = await prisma.imageAnalysis.create({
      data: {
        imageKey: key,
        imageUrl: url,
        status: 'pending',
      },
    });

    // 3. 返回结果（不触发识别，保存文档时再统一识别）
    res.status(201).json({
      url,
      key,
      analysisId: analysis.id,
      analysisStatus: analysis.status,
    });
  } catch (error) {
    console.error('图片上传失败:', error.message);

    if (error.message.includes('MinIO 存储服务不可用')) {
      return res.status(503).json({ error: '存储服务不可用' });
    }

    res.status(500).json({ error: '图片上传失败: ' + error.message });
  }
});

/**
 * 从外部 URL 抓取图片并上传到 MinIO
 * POST /api/images/upload-from-url
 *
 * 用于富文本粘贴场景：前端解析出 HTML 中的外部图片 URL，
 * 由后端代理抓取（避免 CORS）→ 上传至 MinIO → 返回代理 URL
 *
 * Request: { url: string }
 * Response: { url, key, analysisId, analysisStatus }
 */
router.post('/upload-from-url', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: '请提供图片 URL' });
    }

    // 抓取外部图片 — 多策略尝试绕过防盗链
    let parsedUrl;
    try { parsedUrl = new URL(url); } catch { return res.status(400).json({ error: '无效的 URL' }); }

    // 策略列表：不同的 Referer / headers 组合
    const strategies = [
      {
        // 策略1：使用来源站点首页作为 Referer（最常见的防盗链检查）
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': parsedUrl.origin + '/',
          'Origin': parsedUrl.origin,
          'Sec-Fetch-Dest': 'image',
          'Sec-Fetch-Mode': 'no-cors',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"macOS"',
        },
      },
      {
        // 策略2：不发送 Referer（有些站点允许空 Referer）
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      },
      {
        // 策略3：伪装为 Google 搜索引擎来源（部分站点白名单搜索引擎）
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          'Accept': 'image/*,*/*;q=0.8',
          'Referer': 'https://www.google.com/',
        },
      },
    ];

    let response = null;
    let lastError = null;

    for (let i = 0; i < strategies.length; i++) {
      try {
        const resp = await fetch(url, {
          headers: strategies[i].headers,
          signal: AbortSignal.timeout(15000),
          redirect: 'follow',
        });
        if (resp.ok) {
          response = resp;
          console.log(`[upload-from-url] 策略${i + 1} 成功: ${url.substring(0, 80)}`);
          break;
        } else {
          console.log(`[upload-from-url] 策略${i + 1} 返回 HTTP ${resp.status}: ${url.substring(0, 80)}`);
          // 消耗 body 避免内存泄漏
          await resp.arrayBuffer().catch(() => {});
          lastError = `HTTP ${resp.status}`;
        }
      } catch (err) {
        console.log(`[upload-from-url] 策略${i + 1} 异常: ${err.message}`);
        lastError = err.message;
      }
    }

    if (!response) {
      return res.status(400).json({ error: `无法获取图片（所有策略均失败）: ${lastError}` });
    }

    const contentType = response.headers.get('content-type') || '';
    // 放宽 content-type 检查：接受 image/*、application/octet-stream、空值
    const isImage = contentType.startsWith('image/') || 
                    contentType.includes('octet-stream') || 
                    !contentType;
    if (!isImage) {
      return res.status(400).json({ error: `目标 URL 不是图片资源 (content-type: ${contentType})` });
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // 构造类似 multer file 对象
    const effectiveContentType = contentType.startsWith('image/') ? contentType : 'image/png';
    const ext = effectiveContentType.split('/')[1]?.split(';')[0] || 'png';
    const fakeFile = {
      buffer,
      originalname: `pasted-${Date.now()}.${ext}`,
      mimetype: effectiveContentType.split(';')[0],
      size: buffer.length,
    };

    // 上传到 MinIO
    const { key, url: proxyUrl } = await minioService.uploadFile(fakeFile);

    // 创建 ImageAnalysis 记录
    const analysis = await prisma.imageAnalysis.create({
      data: {
        imageKey: key,
        imageUrl: proxyUrl,
        status: 'pending',
      },
    });

    res.status(201).json({
      url: proxyUrl,
      key,
      analysisId: analysis.id,
      analysisStatus: analysis.status,
    });
  } catch (error) {
    console.error('从 URL 上传图片失败:', error.message);

    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return res.status(408).json({ error: '获取图片超时' });
    }
    if (error.message.includes('MinIO 存储服务不可用')) {
      return res.status(503).json({ error: '存储服务不可用' });
    }

    res.status(500).json({ error: '从 URL 上传图片失败: ' + error.message });
  }
});

/**
 * 查询图片识别结果
 * GET /api/images/:id/analysis
 *
 * Response: ImageAnalysis 记录（含 description, elements, theme, status 等）
 */
router.get('/:id/analysis', async (req, res) => {
  try {
    const { id } = req.params;

    const analysis = await prisma.imageAnalysis.findUnique({
      where: { id },
    });

    if (!analysis) {
      return res.status(404).json({ error: '识别记录不存在' });
    }

    // elements 存储为 JSON 字符串，解析后返回
    let elements = [];
    if (analysis.elements) {
      try {
        elements = JSON.parse(analysis.elements);
      } catch {
        elements = [];
      }
    }

    res.json({
      id: analysis.id,
      imageKey: analysis.imageKey,
      imageUrl: analysis.imageUrl,
      description: analysis.description,
      elements,
      theme: analysis.theme,
      status: analysis.status,
      error: analysis.error,
      createdAt: analysis.createdAt,
      updatedAt: analysis.updatedAt,
    });
  } catch (error) {
    console.error('查询识别结果失败:', error.message);
    res.status(500).json({ error: '查询识别结果失败: ' + error.message });
  }
});

/**
 * 代理外部图片访问（用于防盗链图片的显示）
 * GET /api/images/external-proxy?url=...
 *
 * 当外部图片因防盗链无法直接在浏览器中显示时，
 * 通过服务器代理请求并流式返回给客户端。
 */
router.get('/external-proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: '缺少 url 参数' });
    }

    let parsedUrl;
    try { parsedUrl = new URL(url); } catch { return res.status(400).json({ error: '无效的 URL' }); }

    // 使用与 upload-from-url 相同的多策略抓取
    const strategies = [
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Referer': parsedUrl.origin + '/',
          'Origin': parsedUrl.origin,
        },
      },
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'image/*,*/*;q=0.8',
        },
      },
    ];

    let response = null;
    for (let i = 0; i < strategies.length; i++) {
      try {
        const resp = await fetch(url, {
          headers: strategies[i].headers,
          signal: AbortSignal.timeout(10000),
          redirect: 'follow',
        });
        if (resp.ok) {
          response = resp;
          break;
        }
        await resp.arrayBuffer().catch(() => {});
      } catch {
        // try next strategy
      }
    }

    if (!response) {
      return res.status(502).json({ error: '无法获取外部图片' });
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    // Stream the response body to client
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    console.error('外部图片代理失败:', error.message);
    res.status(502).json({ error: '外部图片代理失败' });
  }
});

/**
 * 代理 MinIO 图片访问
 * GET /api/images/proxy/*
 *
 * 从 MinIO 获取图片并以流方式返回给客户端
 * key 参数通过通配符捕获完整路径（含斜杠）
 */
router.get('/proxy/*', async (req, res) => {
  try {
    // req.params[0] 捕获通配符匹配的完整路径
    const key = req.params[0];

    if (!key) {
      return res.status(400).json({ error: '缺少图片 key 参数' });
    }

    const { body, contentType } = await minioService.getFile(key);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 缓存 1 天

    // 将 MinIO 返回的流 pipe 到响应
    body.pipe(res);
  } catch (error) {
    console.error('图片代理失败:', error.message);

    if (error.message.includes('MinIO 存储服务不可用')) {
      return res.status(503).json({ error: '存储服务不可用' });
    }

    res.status(404).json({ error: '图片不存在或无法访问' });
  }
});

// 处理 multer 错误（文件类型/大小限制）
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: '文件大小超过 10MB 限制' });
    }
    return res.status(400).json({ error: err.message });
  }

  if (err.message && err.message.includes('仅支持图片文件')) {
    return res.status(400).json({ error: err.message });
  }

  next(err);
});

module.exports = router;
