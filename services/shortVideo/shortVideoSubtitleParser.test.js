const { parseVttToText, parseSrtToText } = require('./shortVideoSubtitleParser');
const { _pickSubtitleCandidate } = require('./shortVideoTranscriptService');

test('parseVttToText removes timestamps and keeps text', () => {
  const vtt = `WEBVTT

00:00:00.000 --> 00:00:02.000
Hello world

00:00:02.000 --> 00:00:04.000
♪ music ♪
讲解开始`;
  const out = parseVttToText(vtt);
  expect(out).toContain('Hello world');
  expect(out).toContain('讲解开始');
  expect(out).not.toContain('00:00:00');
  expect(out).not.toContain('♪');
});

test('parseSrtToText removes indexes and timestamps', () => {
  const srt = `1
00:00:00,000 --> 00:00:02,000
第一句

2
00:00:02,000 --> 00:00:04,000
第二句`;
  const out = parseSrtToText(srt);
  expect(out).toBe('第一句\n第二句');
});

test('pickSubtitleCandidate prefers chinese and vtt', () => {
  const info = {
    subtitles: {
      en: [{ url: 'http://x/en.srt', ext: 'srt' }],
      zh: [{ url: 'http://x/zh.srt', ext: 'srt' }, { url: 'http://x/zh.vtt', ext: 'vtt' }],
    },
    automatic_captions: {
      zh: [{ url: 'http://x/auto.vtt', ext: 'vtt' }],
    },
  };
  const c = _pickSubtitleCandidate(info);
  expect(c.lang).toBe('zh');
  expect(c.ext).toBe('vtt');
  expect(c.source).toBe('subtitles');
});

