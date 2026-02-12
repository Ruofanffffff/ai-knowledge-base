const fileHashService = require('./fileHashService');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { promisify } = require('util');

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);

/**
 * Unit Tests for FileHashService
 * 
 * **Validates: Requirements 3.1, 3.2, 9.5**
 * 
 * These tests verify specific examples and edge cases:
 * - Small file hash calculation
 * - Large file streaming hash calculation
 * - Error handling (file not found, read failures)
 * - Hash format (lowercase hexadecimal)
 */

describe('FileHashService - Unit Tests', () => {
  let testDir;

  beforeAll(async () => {
    // 创建临时测试目录
    testDir = path.join(os.tmpdir(), 'fileHashService-unit-test-' + Date.now());
    await mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    // 清理测试目录
    try {
      const files = await promisify(fs.readdir)(testDir);
      for (const file of files) {
        await unlink(path.join(testDir, file));
      }
      await promisify(fs.rmdir)(testDir);
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('calculateHash - 小文件测试', () => {
    test('应该正确计算小文件的 hash', async () => {
      const testFile = path.join(testDir, 'small-file.txt');
      const content = 'Hello, World!';
      await writeFile(testFile, content);

      const hash = await fileHashService.calculateHash(testFile);

      expect(hash).not.toBeNull();
      expect(hash).toBe('dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('应该正确计算空文件的 hash', async () => {
      const testFile = path.join(testDir, 'empty-file.txt');
      await writeFile(testFile, '');

      const hash = await fileHashService.calculateHash(testFile);

      expect(hash).not.toBeNull();
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('应该正确计算包含特殊字符的文件 hash', async () => {
      const testFile = path.join(testDir, 'special-chars.txt');
      const content = '你好世界！\n\t@#$%^&*()';
      await writeFile(testFile, content);

      const hash = await fileHashService.calculateHash(testFile);

      expect(hash).not.toBeNull();
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash).toBe(hash.toLowerCase());
    });

    test('应该正确计算二进制内容的 hash', async () => {
      const testFile = path.join(testDir, 'binary-file.bin');
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD]);
      await writeFile(testFile, buffer);

      const hash = await fileHashService.calculateHash(testFile);

      expect(hash).not.toBeNull();
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('calculateHash - 大文件流式测试', () => {
    test('应该使用流式处理计算大文件 hash（> 10MB）', async () => {
      const testFile = path.join(testDir, 'large-file.txt');
      // 创建一个 11MB 的文件
      const content = 'A'.repeat(11 * 1024 * 1024);
      await writeFile(testFile, content);

      const hash = await fileHashService.calculateHash(testFile);

      expect(hash).not.toBeNull();
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash).toBe(hash.toLowerCase());
    });

    test('应该正确处理恰好 10MB 的文件（边界情况）', async () => {
      const testFile = path.join(testDir, 'exactly-10mb.txt');
      const content = 'B'.repeat(10 * 1024 * 1024);
      await writeFile(testFile, content);

      const hash = await fileHashService.calculateHash(testFile);

      expect(hash).not.toBeNull();
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('calculateHashStreaming 应该正确计算小文件 hash', async () => {
      const testFile = path.join(testDir, 'small-streaming.txt');
      const content = 'Test streaming with small file';
      await writeFile(testFile, content);

      const hash = await fileHashService.calculateHashStreaming(testFile);

      expect(hash).not.toBeNull();
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash).toBe(hash.toLowerCase());
    });

    test('calculateHashStreaming 应该正确计算大文件 hash', async () => {
      const testFile = path.join(testDir, 'large-streaming.txt');
      const content = 'C'.repeat(15 * 1024 * 1024);
      await writeFile(testFile, content);

      const hash = await fileHashService.calculateHashStreaming(testFile);

      expect(hash).not.toBeNull();
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('错误处理测试', () => {
    test('文件不存在时应该返回 null', async () => {
      const nonExistentFile = path.join(testDir, 'non-existent-file.txt');

      const hash = await fileHashService.calculateHash(nonExistentFile);

      expect(hash).toBeNull();
    });

    test('calculateHashStreaming 在文件不存在时应该返回 null', async () => {
      const nonExistentFile = path.join(testDir, 'non-existent-streaming.txt');

      const hash = await fileHashService.calculateHashStreaming(nonExistentFile);

      expect(hash).toBeNull();
    });

    test('无效路径应该返回 null', async () => {
      const invalidPath = '/invalid/path/to/file.txt';

      const hash = await fileHashService.calculateHash(invalidPath);

      expect(hash).toBeNull();
    });

    test('目录路径应该返回 null', async () => {
      const hash = await fileHashService.calculateHash(testDir);

      expect(hash).toBeNull();
    });
  });

  describe('Hash 格式测试', () => {
    test('hash 应该始终是小写十六进制', async () => {
      const testFile = path.join(testDir, 'format-test.txt');
      await writeFile(testFile, 'Format test content');

      const hash = await fileHashService.calculateHash(testFile);

      expect(hash).not.toBeNull();
      expect(hash).toBe(hash.toLowerCase());
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash).not.toMatch(/[A-F]/); // 不应该包含大写字母
    });

    test('hash 长度应该是 64 个字符（SHA-256）', async () => {
      const testFile = path.join(testDir, 'length-test.txt');
      await writeFile(testFile, 'Length test');

      const hash = await fileHashService.calculateHash(testFile);

      expect(hash).not.toBeNull();
      expect(hash.length).toBe(64);
    });

    test('流式计算的 hash 也应该是小写十六进制', async () => {
      const testFile = path.join(testDir, 'streaming-format.txt');
      await writeFile(testFile, 'Streaming format test');

      const hash = await fileHashService.calculateHashStreaming(testFile);

      expect(hash).not.toBeNull();
      expect(hash).toBe(hash.toLowerCase());
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash.length).toBe(64);
    });
  });

  describe('算法参数测试', () => {
    test('应该支持不同的 hash 算法（md5）', async () => {
      const testFile = path.join(testDir, 'md5-test.txt');
      await writeFile(testFile, 'MD5 test');

      const hash = await fileHashService.calculateHash(testFile, 'md5');

      expect(hash).not.toBeNull();
      expect(hash).toMatch(/^[a-f0-9]{32}$/); // MD5 是 32 字符
      expect(hash).toBe(hash.toLowerCase());
    });

    test('应该支持不同的 hash 算法（sha512）', async () => {
      const testFile = path.join(testDir, 'sha512-test.txt');
      await writeFile(testFile, 'SHA512 test');

      const hash = await fileHashService.calculateHash(testFile, 'sha512');

      expect(hash).not.toBeNull();
      expect(hash).toMatch(/^[a-f0-9]{128}$/); // SHA-512 是 128 字符
      expect(hash).toBe(hash.toLowerCase());
    });

    test('流式方法应该支持不同的 hash 算法', async () => {
      const testFile = path.join(testDir, 'streaming-md5.txt');
      await writeFile(testFile, 'Streaming MD5 test');

      const hash = await fileHashService.calculateHashStreaming(testFile, 'md5');

      expect(hash).not.toBeNull();
      expect(hash).toMatch(/^[a-f0-9]{32}$/);
    });
  });

  describe('阈值参数测试', () => {
    test('应该根据自定义阈值选择处理方法', async () => {
      const testFile = path.join(testDir, 'threshold-test.txt');
      const content = 'X'.repeat(5 * 1024 * 1024); // 5MB
      await writeFile(testFile, content);

      // 使用低阈值（1MB）强制使用流式处理
      const hash1 = await fileHashService.calculateHash(testFile, 'sha256', 1 * 1024 * 1024);
      
      // 使用高阈值（100MB）强制使用非流式处理
      const hash2 = await fileHashService.calculateHash(testFile, 'sha256', 100 * 1024 * 1024);

      // 两种方法应该产生相同的 hash
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBeNull();
    });
  });

  describe('一致性测试', () => {
    test('多次计算同一文件应该产生相同 hash', async () => {
      const testFile = path.join(testDir, 'consistency.txt');
      await writeFile(testFile, 'Consistency test content');

      const hash1 = await fileHashService.calculateHash(testFile);
      const hash2 = await fileHashService.calculateHash(testFile);
      const hash3 = await fileHashService.calculateHash(testFile);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
      expect(hash1).not.toBeNull();
    });

    test('流式和非流式方法应该产生相同 hash', async () => {
      const testFile = path.join(testDir, 'method-consistency.txt');
      const content = 'Method consistency test';
      await writeFile(testFile, content);

      const hashNormal = await fileHashService.calculateHash(testFile, 'sha256', 1024 * 1024 * 1024);
      const hashStreaming = await fileHashService.calculateHashStreaming(testFile, 'sha256');

      expect(hashNormal).toBe(hashStreaming);
      expect(hashNormal).not.toBeNull();
    });
  });
});
