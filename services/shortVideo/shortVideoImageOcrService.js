const { createMultimodalLLMClient } = require('../notes/llmClient');
const { createTextRecognitionPrompt } = require('../notes/prompts');
const { notesConfig } = require('../../config/notes.config');

function validateUrl(urlString) {
  try {
    const url = new URL(urlString);
    if (!['http:', 'https:'].includes(url.protocol)) return { valid: false };
    const hostname = url.hostname;
    const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
    if (isIp) {
      const parts = hostname.split('.').map(Number);
      if (parts[0] === 10) return { valid: false };
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return { valid: false };
      if (parts[0] === 192 && parts[1] === 168) return { valid: false };
      if (parts[0] === 127) return { valid: false };
      if (parts[0] === 0) return { valid: false };
      if (parts[0] === 169 && parts[1] === 254) return { valid: false };
    }
    if (hostname.toLowerCase() === 'localhost') return { valid: false };
    return { valid: true };
  } catch {
    return { valid: false };
  }
}

async function fetchImageAsDataUrl(url) {
  const v = validateUrl(url);
  if (!v.valid) throw new Error('invalid image url');

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('invalid image url');
  }

  const strategies = [
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        Referer: parsedUrl.origin + '/',
        Origin: parsedUrl.origin,
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'same-origin',
      },
    },
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    },
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        Accept: 'image/*,*/*;q=0.8',
        Referer: 'https://www.google.com/',
      },
    },
  ];

  let last = null;
  for (const s of strategies) {
    try {
      const resp = await fetch(url, { headers: s.headers, redirect: 'follow', signal: AbortSignal.timeout(15000) });
      if (!resp.ok) {
        await resp.arrayBuffer().catch(() => {});
        last = new Error(`HTTP ${resp.status}`);
        continue;
      }
      const contentType = String(resp.headers.get('content-type') || '').split(';')[0].trim();
      const buf = Buffer.from(await resp.arrayBuffer());
      if (buf.length > 8 * 1024 * 1024) throw new Error('image too large');
      const mime = contentType && contentType.startsWith('image/') ? contentType : 'image/jpeg';
      return `data:${mime};base64,${buf.toString('base64')}`;
    } catch (e) {
      last = e;
    }
  }
  throw last || new Error('fetch image failed');
}

function makeClient() {
  const mm = notesConfig.multiModalLLM || {};
  const apiKey = mm.apiKey || process.env.VOLCENGINE_API_KEY || process.env.QWEN_API_KEY;
  if (!apiKey) return null;
  return createMultimodalLLMClient({
    apiKey,
    provider: mm.provider || 'volcengine',
    model: mm.model || 'seed1.8',
    timeout: mm.timeout || 30000,
  });
}

async function ocrImages(imageUrls, { maxImages = 4 } = {}) {
  const client = makeClient();
  if (!client) return { ok: false, text: '', items: [], error: 'multimodal api key missing' };

  const list = Array.isArray(imageUrls) ? imageUrls.map((u) => String(u || '').trim()).filter(Boolean) : [];
  const chosen = list.slice(0, maxImages);
  const prompt = createTextRecognitionPrompt({ imageType: 'screenshot' });

  const items = [];
  let merged = '';
  for (const url of chosen) {
    try {
      const dataUrl = await fetchImageAsDataUrl(url);
      const res = await client.analyzeImage({ imageUrl: dataUrl, prompt, config: { temperature: 0.2, maxTokens: 1200 } });
      const text = String(res?.content || '').trim();
      items.push({ url, ok: true, text, tokens: res?.tokens || 0, provider: res?.provider, model: res?.model });
      if (text) merged += (merged ? '\n\n' : '') + text;
    } catch (e) {
      items.push({ url, ok: false, text: '', error: String(e?.message || e || 'ocr failed') });
    }
  }

  return { ok: true, text: merged.trim(), items };
}

module.exports = {
  ocrImages,
};

