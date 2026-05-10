const { normalizeUrl, detectPlatform } = require('./shortVideoUrlService');

test('detectPlatform works for douyin/weixin/xhs', () => {
  expect(detectPlatform('v.douyin.com')).toBe('douyin');
  expect(detectPlatform('mp.weixin.qq.com')).toBe('weixin');
  expect(detectPlatform('xhslink.com')).toBe('xhs');
  expect(detectPlatform('www.xiaohongshu.com')).toBe('xhs');
});

test('normalizeUrl rejects unsupported host', () => {
  expect(() => normalizeUrl('https://example.com/a')).toThrow();
});

