function stripBom(text) {
  if (!text) return '';
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function normalizeLines(text) {
  return stripBom(String(text || ''))
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function cleanCaptionText(text) {
  const s = String(text || '')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\u200b/g, '')
    .trim();
  if (!s) return '';
  if (/^(\[.*\]|\(.*\))$/.test(s)) return '';
  if (/^♪/.test(s)) return '';
  return s;
}

function parseVttToText(vtt) {
  const lines = normalizeLines(vtt).split('\n');
  const out = [];
  let started = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!started) {
      if (/^WEBVTT/i.test(line)) {
        started = true;
        continue;
      }
      started = true;
    }
    if (!line) continue;
    if (/^\d+$/.test(line)) continue;
    if (/^\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}/.test(line)) continue;
    if (/^\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}\.\d{3}/.test(line)) continue;
    if (/^(NOTE|STYLE|REGION)\b/i.test(line)) continue;
    const cleaned = cleanCaptionText(line);
    if (cleaned) out.push(cleaned);
  }
  return out.join('\n').trim();
}

function parseSrtToText(srt) {
  const lines = normalizeLines(srt).split('\n');
  const out = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;
    if (/^\d+$/.test(line)) continue;
    if (/^\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}/.test(line)) continue;
    const cleaned = cleanCaptionText(line);
    if (cleaned) out.push(cleaned);
  }
  return out.join('\n').trim();
}

module.exports = {
  parseVttToText,
  parseSrtToText,
};

