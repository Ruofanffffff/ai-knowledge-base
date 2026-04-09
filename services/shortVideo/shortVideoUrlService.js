const { URL } = require('url');

function extractFirstHttpUrl(text) {
  const value = String(text || '');
  const m = value.match(/https?:\/\/[^\s]+/i);
  if (!m) return '';
  let u = m[0];
  while (u && /[`"'“”‘’()<>[\]{}，。！？、；：,.;:]+$/.test(u)) u = u.slice(0, -1);
  while (u && /^[`"'“”‘’()<>[\]{}，。！？、；：,.;:]+/.test(u)) u = u.slice(1);
  return u;
}

function isAllowedHost(hostname) {
  const raw = String(process.env.SHORT_VIDEO_ALLOWED_HOSTS || '').trim();
  const defaults = ['douyin.com', 'www.douyin.com', 'v.douyin.com', 'iesdouyin.com', 'www.iesdouyin.com'];
  const list = raw
    ? raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : defaults;

  const h = String(hostname || '').toLowerCase();
  if (!h) return false;
  return list.some((item) => h === item.toLowerCase() || h.endsWith(`.${item.toLowerCase()}`));
}

function detectPlatform(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (!h) return 'unknown';
  if (h === 'v.douyin.com' || h.endsWith('.douyin.com') || h.endsWith('.iesdouyin.com')) return 'douyin';
  return 'unknown';
}

function normalizeUrl(input) {
  let raw = String(input || '').trim();
  if (!raw) throw new Error('链接不能为空');

  if (!/^https?:\/\//i.test(raw)) {
    const extracted = extractFirstHttpUrl(raw);
    if (extracted) raw = extracted;
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('链接格式不正确');
  }

  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('仅支持 http/https 链接');
  if (!isAllowedHost(url.hostname)) throw new Error('暂不支持该链接来源');

  const platform = detectPlatform(url.hostname);

  url.hash = '';
  const dropParams = new Set([
    'from',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'share_token',
    'share_app_id',
    'share_link_id',
    'timestamp',
  ]);
  for (const k of Array.from(url.searchParams.keys())) {
    if (dropParams.has(k)) url.searchParams.delete(k);
  }

  if ([...url.searchParams.keys()].length === 0) url.search = '';

  return {
    platform,
    originalUrl: raw,
    normalizedUrl: url.toString(),
  };
}

module.exports = {
  normalizeUrl,
  detectPlatform,
  isAllowedHost,
  extractFirstHttpUrl,
};
