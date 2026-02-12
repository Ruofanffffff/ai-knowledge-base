const fs = require('fs');
const path = require('path');
const fileHashService = require('./fileHashService');

describe('FileHashService Integration with Upload Flow', () => {
  const testDir = path.join(__dirname, '../test-uploads');
  const testFilePath = path.join(testDir, 'test-file.txt');

  beforeAll(() => {
    // 创建测试目录
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    // 清理测试文件
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
    if (fs.existsSync(testDir)) {
      fs.rmdirSync(testDir);
    }
  });

  test('应该成功计算小文件的 hash', async () => {
    // 创建测试文件
    const content = 'This is a test file for hash calculation';
    fs.writeFileSync(testFilePath, content);

    // 计算 hash
    const hash = await fileHashService.calculateHash(testFilePath);

    // 验证
    expect(hash).not.toBeNull();
    expect(hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 产生 64 个十六进制字符
    expect(hash).toBe(hash.toLowerCase()); // 确保是小写
  });

  test('应该对相同内容产生相同的 hash', async () => {
    // 创建测试文件
    const content = 'Consistent content for hash testing';
    fs.writeFileSync(testFilePath, content);

    // 计算两次 hash
    const hash1 = await fileHashService.calculateHash(testFilePath);
    const hash2 = await fileHashService.calculateHash(testFilePath);

    // 验证一致性
    expect(hash1).toBe(hash2);
  });

  test('应该对不同内容产生不同的 hash', async () => {
    // 创建第一个文件
    fs.writeFileSync(testFilePath, 'Content A');
    const hash1 = await fileHashService.calculateHash(testFilePath);

    // 修改文件内容
    fs.writeFileSync(testFilePath, 'Content B');
    const hash2 = await fileHashService.calculateHash(testFilePath);

    // 验证不同
    expect(hash1).not.toBe(hash2);
  });

  test('应该在文件不存在时返回 null', async () => {
    const nonExistentPath = path.join(testDir, 'non-existent-file.txt');
    const hash = await fileHashService.calculateHash(nonExistentPath);

    expect(hash).toBeNull();
  });

  test('应该对大文件使用流式处理', async () => {
    // 创建一个超过 10MB 的测试文件
    const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
    const largeFilePath = path.join(testDir, 'large-file.txt');
    fs.writeFileSync(largeFilePath, largeContent);

    try {
      // 计算 hash
      const hash = await fileHashService.calculateHash(largeFilePath);

      // 验证
      expect(hash).not.toBeNull();
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      // 清理大文件
      if (fs.existsSync(largeFilePath)) {
        fs.unlinkSync(largeFilePath);
      }
    }
  });

  test('应该优雅处理 hash 计算失败', async () => {
    // 模拟一个会导致错误的场景
    const invalidPath = '/invalid/path/to/file.txt';
    const hash = await fileHashService.calculateHash(invalidPath);

    // 应该返回 null 而不是抛出异常
    expect(hash).toBeNull();
  });
});
