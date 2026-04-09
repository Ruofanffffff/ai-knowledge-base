const axios = require('axios');

function pickMeta(html, property, attr = 'property') {
  const p = String(property || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const a = String(attr || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<meta[^>]*\\s${a}=["']${p}["'][^>]*\\scontent=["']([^"']+)["'][^>]*>`, 'i');
  const m = html.match(re);
  return m ? String(m[1] || '').trim() : '';
}

function pickTitle(html) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? String(m[1] || '').trim() : '';
}

async function fetchMeta(url) {
  const resp = await axios.get(url, {
    timeout: 12000,
    maxRedirects: 5,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    responseType: 'text',
    validateStatus: () => true,
  });

  const status = Number(resp.status || 0);
  const html = typeof resp.data === 'string' ? resp.data : '';
  const finalUrl = String(resp.request?.res?.responseUrl || resp.config?.url || url);

  if (status >= 400 || !html) {
    return {
      ok: false,
      status,
      finalUrl,
      title: '',
      description: '',
      image: '',
    };
  }

  const ogTitle = pickMeta(html, 'og:title');
  const ogDesc = pickMeta(html, 'og:description');
  const ogImg = pickMeta(html, 'og:image');
  const twTitle = pickMeta(html, 'twitter:title', 'name');
  const twDesc = pickMeta(html, 'twitter:description', 'name');
  const twImg = pickMeta(html, 'twitter:image', 'name');

  const title = ogTitle || twTitle || pickTitle(html);
  const description = ogDesc || twDesc;
  const image = ogImg || twImg;

  return {
    ok: true,
    status,
    finalUrl,
    title,
    description,
    image,
  };
}

module.exports = {
  fetchMeta,
};

