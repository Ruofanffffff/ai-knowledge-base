'use strict';

const axios = require('axios');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { pipeline } = require('stream/promises');

const LOG_PREFIX = '[DouyinExtractor]';

/**
 * 从抖音URL中提取 video_id
 */
function extractVideoId(url) {
  const match = url.match(/video[\/](\d+)/);
  return match ? match[1] : null;
}

/**
 * 判断是否为抖音 URL
 */
function isDouyinUrl(url) {
  return /douyin\.com|v\.douyin\.com/.test(url);
}

/**
 * 读取 Netscape 格式 cookies 文件，转为 Cookie header 字符串
 */
function loadCookiesAsHeader(cookiePath) {
  if (!fs.existsSync(cookiePath)) {
    console.warn(`${LOG_PREFIX} cookies 文件不存在: ${cookiePath}`);
    return '';
  }
  const content = fs.readFileSync(cookiePath, 'utf-8');
  const lines = content.split('\n');
  const pairs = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('\t');
    if (parts.length < 7) continue;

    const domain = parts[0];
    const name = parts[5];
    const value = parts[6];

    if (domain.includes('douyin.com')) {
      pairs.push(`${name}=${value}`);
    }
  }

  const cookieStr = pairs.join('; ');
  console.log(`${LOG_PREFIX} 已加载 ${pairs.length} 个 douyin cookies`);
  return cookieStr;
}

/**
 * 获取通用请求头
 */
function getCommonHeaders(cookieStr) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Referer': 'https://www.douyin.com/',
  };
  if (cookieStr) {
    headers['Cookie'] = cookieStr;
  }
  return headers;
}

/**
 * 获取 cookies 文件路径
 */
function getCookiePath() {
  return process.env.DOUYIN_COOKIES_PATH
    || path.join(__dirname, '../../config/douyin-cookies.txt');
}

/**
 * 解析短链，跟随重定向获取最终 URL
 */
async function resolveShortUrl(shortUrl, cookieStr) {
  console.log(`${LOG_PREFIX} 解析短链: ${shortUrl}`);
  try {
    const resp = await axios.get(shortUrl, {
      headers: getCommonHeaders(cookieStr),
      maxRedirects: 5,
      timeout: 15000,
      validateStatus: () => true,
    });
    const finalUrl = resp.request?.res?.responseUrl || resp.request?.responseURL || shortUrl;
    console.log(`${LOG_PREFIX} 短链解析结果: ${finalUrl}`);
    return finalUrl;
  } catch (err) {
    console.error(`${LOG_PREFIX} 短链解析失败: ${err.message}`);
    try {
      const headResp = await axios.head(shortUrl, {
        headers: getCommonHeaders(cookieStr),
        maxRedirects: 5,
        timeout: 15000,
        validateStatus: () => true,
      });
      return headResp.request?.res?.responseUrl || shortUrl;
    } catch (e2) {
      console.error(`${LOG_PREFIX} HEAD 请求也失败: ${e2.message}`);
      return shortUrl;
    }
  }
}

/**
 * 从页面 HTML 提取 RENDER_DATA JSON
 */
function extractRenderData(html) {
  // 方案1: <script id="RENDER_DATA" type="application/json">...</script>
  const match = html.match(/<script[^>]*id=["']RENDER_DATA["'][^>]*>([\s\S]*?)<\/script>/);
  if (match) {
    try {
      const decoded = decodeURIComponent(match[1]);
      const data = JSON.parse(decoded);
      console.log(`${LOG_PREFIX} 成功从 RENDER_DATA 提取数据，顶层keys: ${Object.keys(data).join(', ')}`);
      return data;
    } catch (err) {
      console.error(`${LOG_PREFIX} RENDER_DATA 解析失败: ${err.message}`);
    }
  }

  // 方案2: window._ROUTER_DATA
  const routerMatch = html.match(/window\._ROUTER_DATA\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/);
  if (routerMatch) {
    try {
      const data = JSON.parse(routerMatch[1]);
      console.log(`${LOG_PREFIX} 从 _ROUTER_DATA 提取数据`);
      return data;
    } catch (err) {
      console.error(`${LOG_PREFIX} _ROUTER_DATA 解析失败: ${err.message}`);
    }
  }

  // 方案3: SSR_HYDRATED_DATA
  const ssrMatch = html.match(/SSR_HYDRATED_DATA\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
  if (ssrMatch) {
    try {
      const decoded = decodeURIComponent(ssrMatch[1]);
      const data = JSON.parse(decoded);
      console.log(`${LOG_PREFIX} 从 SSR_HYDRATED_DATA 提取数据`);
      return data;
    } catch (err) {
      console.error(`${LOG_PREFIX} SSR_HYDRATED_DATA 解析失败: ${err.message}`);
    }
  }

  console.warn(`${LOG_PREFIX} 未能从页面中提取到任何结构化数据`);
  return null;
}

/**
 * 从 RENDER_DATA 中定位视频详情（数字 key 不固定，需遍历）
 */
function findAwemeDetail(renderData) {
  if (!renderData || typeof renderData !== 'object') return null;

  for (const key of Object.keys(renderData)) {
    const val = renderData[key];
    if (!val || typeof val !== 'object') continue;

    // 直接在顶层: val.aweme.detail
    if (val.aweme?.detail) {
      console.log(`${LOG_PREFIX} 在 key="${key}" 中找到 aweme.detail`);
      return val.aweme.detail;
    }

    // 嵌套在 loaderData 中
    if (val.loaderData && typeof val.loaderData === 'object') {
      for (const subKey of Object.keys(val.loaderData)) {
        const sub = val.loaderData[subKey];
        if (sub?.aweme?.detail) {
          console.log(`${LOG_PREFIX} 在 key="${key}".loaderData."${subKey}" 中找到 aweme.detail`);
          return sub.aweme.detail;
        }
      }
    }

    // 可能是 val.awemeDetail 或 val.detail
    if (val.awemeDetail) {
      console.log(`${LOG_PREFIX} 在 key="${key}" 中找到 awemeDetail`);
      return val.awemeDetail;
    }
    if (val.detail && val.detail.desc) {
      console.log(`${LOG_PREFIX} 在 key="${key}" 中找到 detail (含desc)`);
      return val.detail;
    }
  }

  // 深层递归查找
  function deepFind(obj, depth) {
    if (depth > 5 || !obj || typeof obj !== 'object') return null;
    if (obj.desc && (obj.video || obj.music)) return obj;
    for (const k of Object.keys(obj)) {
      const result = deepFind(obj[k], depth + 1);
      if (result) return result;
    }
    return null;
  }

  const deepResult = deepFind(renderData, 0);
  if (deepResult) {
    console.log(`${LOG_PREFIX} 通过深层递归找到视频详情`);
    return deepResult;
  }

  console.warn(`${LOG_PREFIX} 未在 RENDER_DATA 中找到 aweme detail`);
  return null;
}

/**
 * 从视频详情中提取可下载的音频/视频 URL
 */
function extractMediaUrl(detail) {
  const result = {
    audioUrl: null,
    videoUrl: null,
    title: detail?.desc || detail?.title || '',
    duration: null,
  };

  // 尝试获取时长
  if (detail?.video?.duration) {
    result.duration = Math.round(detail.video.duration / 1000);
  } else if (detail?.duration) {
    result.duration = detail.duration;
  }

  // 优先获取纯音频流（背景音乐）
  const music = detail?.music;
  if (music) {
    const playUrl = music.play_url?.url_list || music.playUrl?.url_list || [];
    if (playUrl.length > 0) {
      result.audioUrl = playUrl[0];
      console.log(`${LOG_PREFIX} 找到音乐播放地址: ${result.audioUrl.substring(0, 80)}...`);
    }
    if (!result.audioUrl && (music.play_url?.uri || music.playUrl?.uri)) {
      const uri = music.play_url?.uri || music.playUrl?.uri;
      result.audioUrl = `https://sf3-cdn-tos.douyinstatic.com/obj/ies-music/${uri}`;
      console.log(`${LOG_PREFIX} 从 uri 构造音频地址: ${result.audioUrl.substring(0, 80)}...`);
    }
  }

  // 获取视频播放地址（作为备选，包含音频轨道）
  const video = detail?.video;
  if (video) {
    const playAddr = video.play_addr?.url_list || video.playAddr?.url_list || [];
    if (playAddr.length > 0) {
      result.videoUrl = playAddr[0];
      console.log(`${LOG_PREFIX} 找到视频播放地址: ${result.videoUrl.substring(0, 80)}...`);
    }
    if (!result.videoUrl && video.bit_rate && Array.isArray(video.bit_rate)) {
      for (const br of video.bit_rate) {
        const urls = br.play_addr?.url_list || [];
        if (urls.length > 0) {
          result.videoUrl = urls[0];
          console.log(`${LOG_PREFIX} 从 bit_rate 找到视频地址`);
          break;
        }
      }
    }
  }

  if (!result.audioUrl && !result.videoUrl) {
    console.warn(`${LOG_PREFIX} 未能提取到音频或视频 URL`);
    console.warn(`${LOG_PREFIX} detail keys: ${detail ? Object.keys(detail).join(', ') : 'null'}`);
  }

  return result;
}

/**
 * 下载媒体文件到指定路径
 */
async function downloadMedia(mediaUrl, outputPath, retries = 2) {
  console.log(`${LOG_PREFIX} 开始下载媒体文件到: ${outputPath}`);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await axios.get(mediaUrl, {
        responseType: 'stream',
        timeout: 120000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.douyin.com/',
        },
        maxRedirects: 5,
      });

      await pipeline(resp.data, fs.createWriteStream(outputPath));

      const stat = await fsp.stat(outputPath);
      console.log(`${LOG_PREFIX} 下载完成，文件大小: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);

      if (stat.size < 1024) {
        throw new Error(`下载文件过小 (${stat.size} bytes)，可能无效`);
      }

      return outputPath;
    } catch (err) {
      console.error(`${LOG_PREFIX} 下载失败 (第${attempt + 1}次): ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
}

/**
 * 主函数：从抖音 URL 获取音频文件
 */
async function getDouyinAudio(url, targetDir) {
  console.log(`${LOG_PREFIX} ===== 开始抖音音频提取 =====`);
  console.log(`${LOG_PREFIX} URL: ${url}`);
  console.log(`${LOG_PREFIX} 目标目录: ${targetDir}`);

  try {
    // 1. 确保目标目录存在
    const mediaDir = path.join(targetDir, 'media');
    await fsp.mkdir(mediaDir, { recursive: true });

    // 2. 加载 cookies
    const cookiePath = getCookiePath();
    console.log(`${LOG_PREFIX} cookies 路径: ${cookiePath}`);
    const cookieStr = loadCookiesAsHeader(cookiePath);

    // 3. 如果是短链，先跟随重定向获取最终 URL
    let finalUrl = url;
    if (/v\.douyin\.com/.test(url)) {
      finalUrl = await resolveShortUrl(url, cookieStr);
    }

    // 提取 video_id（用于日志）
    const videoId = extractVideoId(finalUrl);
    console.log(`${LOG_PREFIX} video_id: ${videoId || '未提取到'}`);

    // 4. 获取页面 HTML
    console.log(`${LOG_PREFIX} 正在获取页面 HTML...`);
    const pageResp = await axios.get(finalUrl, {
      headers: getCommonHeaders(cookieStr),
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
    });

    const html = typeof pageResp.data === 'string' ? pageResp.data : '';
    console.log(`${LOG_PREFIX} 页面 HTML 长度: ${html.length}`);

    if (html.length < 1000) {
      console.error(`${LOG_PREFIX} 页面内容过短，可能被拦截或需要验证`);
      return { ok: false, error: '抖音页面返回内容过短，可能需要验证码或 cookies 过期' };
    }

    // 5. 提取 RENDER_DATA
    const renderData = extractRenderData(html);
    if (!renderData) {
      return { ok: false, error: '无法从页面中提取 RENDER_DATA' };
    }

    // 6. 查找 aweme detail
    const detail = findAwemeDetail(renderData);
    if (!detail) {
      return { ok: false, error: '无法在 RENDER_DATA 中定位视频详情 (aweme.detail)' };
    }

    // 7. 提取媒体 URL
    const media = extractMediaUrl(detail);
    const downloadUrl = media.audioUrl || media.videoUrl;

    if (!downloadUrl) {
      return { ok: false, error: '无法从视频详情中提取音频/视频 URL' };
    }

    // 8. 下载音频/视频文件
    const ext = media.audioUrl ? 'mp3' : 'mp4';
    const outputPath = path.join(mediaDir, `audio_raw.${ext}`);
    await downloadMedia(downloadUrl, outputPath);

    console.log(`${LOG_PREFIX} ===== 抖音音频提取成功 =====`);
    return {
      ok: true,
      audioPath: outputPath,
      title: media.title,
      duration: media.duration,
    };
  } catch (err) {
    console.error(`${LOG_PREFIX} 抖音音频提取异常: ${err.message}`);
    console.error(`${LOG_PREFIX} Stack: ${err.stack}`);
    return { ok: false, error: `抖音音频提取失败: ${err.message}` };
  }
}

/**
 * 获取抖音视频元信息（标题、时长等）
 */
async function getDouyinInfo(url) {
  console.log(`${LOG_PREFIX} 获取抖音视频信息: ${url}`);

  try {
    const cookiePath = getCookiePath();
    const cookieStr = loadCookiesAsHeader(cookiePath);

    let finalUrl = url;
    if (/v\.douyin\.com/.test(url)) {
      finalUrl = await resolveShortUrl(url, cookieStr);
    }

    const videoId = extractVideoId(finalUrl);

    const pageResp = await axios.get(finalUrl, {
      headers: getCommonHeaders(cookieStr),
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
    });

    const html = typeof pageResp.data === 'string' ? pageResp.data : '';
    if (html.length < 1000) {
      return { error: '页面内容过短', videoId, hasSubtitles: false };
    }

    const renderData = extractRenderData(html);
    if (!renderData) {
      return { error: '无法提取 RENDER_DATA', videoId, hasSubtitles: false };
    }

    const detail = findAwemeDetail(renderData);
    if (!detail) {
      return { error: '无法定位视频详情', videoId, hasSubtitles: false };
    }

    let hasSubtitles = false;
    let subtitleUrl = null;
    if (detail.interaction_stickers || detail.caption) {
      hasSubtitles = true;
    }
    if (detail.video?.subtitle) {
      const subs = detail.video.subtitle;
      if (Array.isArray(subs) && subs.length > 0) {
        hasSubtitles = true;
        subtitleUrl = subs[0]?.url || subs[0]?.Url || null;
      }
    }

    const title = detail.desc || detail.title || '';
    let duration = null;
    if (detail.video?.duration) {
      duration = Math.round(detail.video.duration / 1000);
    } else if (detail.duration) {
      duration = detail.duration;
    }

    return { title, duration, videoId, hasSubtitles, subtitleUrl };
  } catch (err) {
    console.error(`${LOG_PREFIX} 获取抖音视频信息失败: ${err.message}`);
    return { error: err.message, hasSubtitles: false };
  }
}

module.exports = {
  getDouyinAudio,
  getDouyinInfo,
  extractVideoId,
  isDouyinUrl,
};
