const axios = require('axios');
const cheerio = require('cheerio');

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
  const out = extractGenericMetaText(html);
  return { ok: true, status, finalUrl, ...out };
}

module.exports = {
  extractPage,
};

