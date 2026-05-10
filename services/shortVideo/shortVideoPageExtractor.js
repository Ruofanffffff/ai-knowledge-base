const axios = require('axios');
const cheerio = require('cheerio');
const vm = require('vm');

function normalizeText(text) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchHtml(url) {
  const resp = await axios.get(url, {
    timeout: 15000,
    maxRedirects: 5,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.7',
    },
    responseType: 'text',
    validateStatus: () => true,
  });
  const status = Number(resp.status || 0);
  const html = typeof resp.data === 'string' ? resp.data : '';
  const finalUrl = String(resp.request?.res?.responseUrl || resp.config?.url || url);
  return { status, html, finalUrl };
}

function extractObjectLiteralAfter(html, marker) {
  const idx = String(html || '').indexOf(marker);
  if (idx < 0) return null;
  const start = idx + marker.length;
  const s = String(html || '');
  let i = start;
  let depth = 0;
  let inStr = false;
  let quote = '';
  let esc = false;
  let started = false;
  for (; i < s.length; i++) {
    const ch = s[i];
    if (!started) {
      if (ch === '{') {
        started = true;
        depth = 1;
        continue;
      }
      if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') continue;
      return null;
    }

    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === '\\') {
        esc = true;
        continue;
      }
      if (ch === quote) {
        inStr = false;
        quote = '';
        continue;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inStr = true;
      quote = ch;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  if (!started) return null;
  const out = s.slice(start, i).trim();
  return out || null;
}

function pickXhsImageUrl(item) {
  if (!item || typeof item !== 'object') return null;
  const tryOne = (v) => {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    if (!t) return null;
    if (!/^https?:\/\//i.test(t)) return null;
    return t;
  };
  const keys = ['urlDefault', 'url', 'urlPre', 'urlOrigin', 'urlMiddle', 'urlLarge', 'urlPreview', 'originalUrl'];
  for (const k of keys) {
    const v = tryOne(item[k]);
    if (v) return v;
  }
  if (Array.isArray(item.urlList)) {
    for (const u of item.urlList) {
      const v = tryOne(u);
      if (v) return v;
    }
  }
  if (Array.isArray(item.urls)) {
    for (const u of item.urls) {
      const v = tryOne(u);
      if (v) return v;
    }
  }
  return null;
}

function findBestXhsNoteFromState(state) {
  let best = null;
  const stack = [{ v: state, d: 0 }];
  let steps = 0;
  while (stack.length) {
    const cur = stack.pop();
    steps++;
    if (steps > 25000) break;
    const v = cur.v;
    const d = cur.d;
    if (!v || typeof v !== 'object' || d > 14) continue;

    if (Array.isArray(v)) {
      for (let i = v.length - 1; i >= 0; i--) stack.push({ v: v[i], d: d + 1 });
      continue;
    }

    if (Array.isArray(v.imageList) && v.imageList.length) {
      const urls = v.imageList.map(pickXhsImageUrl).filter(Boolean);
      if (urls.length) {
        const title = v.title || v.noteTitle || v.name || '';
        const desc = v.desc || v.description || v.content || '';
        if (!best || urls.length > best.urls.length) {
          best = { title: String(title || ''), desc: String(desc || ''), urls };
        }
      }
    }

    for (const k of Object.keys(v)) stack.push({ v: v[k], d: d + 1 });
  }
  return best;
}

function extractXhsNote(html) {
  const $ = cheerio.load(html || '');
  const fallbackTitle =
    normalizeText($('meta[property="og:title"]').attr('content')) ||
    normalizeText($('meta[name="twitter:title"]').attr('content')) ||
    normalizeText($('title').text());
  const fallbackDesc =
    normalizeText($('meta[property="og:description"]').attr('content')) ||
    normalizeText($('meta[name="description"]').attr('content')) ||
    normalizeText($('meta[name="twitter:description"]').attr('content'));

  const literal = extractObjectLiteralAfter(html, '__INITIAL_STATE__=');
  if (!literal) {
    const out = extractGenericMetaText(html);
    return { title: out.title || fallbackTitle, text: out.text || fallbackDesc, imageUrls: out.imageUrls || [] };
  }

  let state = null;
  try {
    state = vm.runInNewContext(`(${literal})`, Object.create(null), { timeout: 1200 });
  } catch {
    const out = extractGenericMetaText(html);
    return { title: out.title || fallbackTitle, text: out.text || fallbackDesc, imageUrls: out.imageUrls || [] };
  }

  const best = findBestXhsNoteFromState(state);
  if (!best) {
    const out = extractGenericMetaText(html);
    return { title: out.title || fallbackTitle, text: out.text || fallbackDesc, imageUrls: out.imageUrls || [] };
  }

  const title = normalizeText(best.title) || fallbackTitle;
  const text = normalizeText(best.desc) || fallbackDesc;
  const imageUrls = Array.from(new Set(best.urls)).filter(Boolean);
  return { title, text, imageUrls };
}

function extractWeChatArticle(html) {
  const $ = cheerio.load(html || '');
  const title = normalizeText($('#activity-name').text()) || normalizeText($('title').text());
  const contentRoot = $('#js_content');
  contentRoot.find('script,style,iframe,noscript').remove();
  const text = normalizeText(contentRoot.text());
  const imageUrls = contentRoot
    .find('img')
    .map((_, el) => $(el).attr('data-src') || $(el).attr('data-original') || $(el).attr('src'))
    .get()
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  return { title, text, imageUrls };
}

function extractGenericMetaText(html) {
  const $ = cheerio.load(html || '');
  const title =
    normalizeText($('meta[property="og:title"]').attr('content')) ||
    normalizeText($('meta[name="twitter:title"]').attr('content')) ||
    normalizeText($('title').text());
  const description =
    normalizeText($('meta[property="og:description"]').attr('content')) ||
    normalizeText($('meta[name="description"]').attr('content')) ||
    normalizeText($('meta[name="twitter:description"]').attr('content'));
  const image =
    normalizeText($('meta[property="og:image"]').attr('content')) ||
    normalizeText($('meta[name="twitter:image"]').attr('content'));
  const imageUrls = image ? [image] : [];
  return { title, text: description, imageUrls };
}

async function extractPage(url, platform) {
  const { status, html, finalUrl } = await fetchHtml(url);
  if (!html || status >= 400) {
    return { ok: false, status, finalUrl, title: '', text: '', imageUrls: [], error: `HTTP ${status || 0}` };
  }

  const p = String(platform || '').toLowerCase();
  if (p === 'weixin') {
    const out = extractWeChatArticle(html);
    return { ok: true, status, finalUrl, ...out };
  }
  if (p === 'xhs') {
    const out = extractXhsNote(html);
    return { ok: true, status, finalUrl, ...out };
  }
  const out = extractGenericMetaText(html);
  return { ok: true, status, finalUrl, ...out };
}

module.exports = {
  extractPage,
};
