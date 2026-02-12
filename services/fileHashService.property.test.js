const fileHashService = require('./fileHashService');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { promisify } = require('util');
const fc = require('fast-check');

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);

/**
 * Property-Based Tests for FileHashService
 * 
 * **Validates: Requirements 3.1, 3.2**
 * 
 * These tests verify universal properties that should hold across all inputs:
 * - Property 1: Hash Calculation Consistency
 */

describe('FileHashService - Property-Based Tests', () => {
  let testDir;
  let testFiles = [];

  beforeAll(async () => {
    // 创建临时测试目录
    testDir = path.join(os.tmpdir(), 'fileHashService-property-test-' + Date.now());
    await mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    // 清理测试文件
    for (const file of testFiles) {
      try {
        await unlink(file);
      } catch (error) {
        // 忽略删除错误
      }
    }
    try {
      await promisify(fs.rmdir)(testDir);
    } catch (error) {
      // 忽略删除错误
      }
  });

  afterEach(() => {
    // 清空测试文件列表以便下一个测试
    testFiles = [];
  });

  /**
   * Property 1: Hash Calculation Consistency
   * 
   * **Validates: Requirements 3.1, 3.2**
   * 
   * For any file content, calculating its hash multiple times should produce
   * the same hash value. This property ensures deterministic hash calculation.
   */
  describe('Property 1: Hash Calculation Consistency', () => {
    test('计算同一文件的 hash 两次应该产生相同结果', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成随机文件内容（字符串）
          fc.string({ minLength: 0, maxLength: 1000 }),
          async (content) => {
            const testFile = path.join(testDir, `consistency-${Date.now()}-${Math.random()}.txt`);
            await writeFile(testFile, content);
            testFiles.push(testFile);

            // 计算 hash 两次
            const hash1 = await fileHashService.calculateHash(testFile);
            const hash2 = await fileHashService.calculateHash(testFile);

            // 验证两次计算结果相同
            expect(hash1).toBe(hash2);
            expect(hash1).not.toBeNull();
          }
        ),
        { numRuns: 20 }
      );
    });

    test('流式和非流式方法应该对相同内容产生相同的 hash', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成随机文件内容
          fc.string({ minLength: 0, maxLength: 1000 }),
          async (content) => {
            const testFile = path.join(testDir, `method-consistency-${Date.now()}-${Math.random()}.txt`);
            await writeFile(testFile, content);
            testFiles.push(testFile);

            // 使用非流式方法（设置高阈值强制使用非流式）
            const hashNormal = await fileHashService.calculateHash(testFile, 'sha256', 1024 * 1024 * 1024);
            
            // 使用流式方法
            const hashStreaming = await fileHashService.calculateHashStreaming(testFile, 'sha256');

            // 验证两种方法产生相同结果
            expect(hashNormal).toBe(hashStreaming);
            expect(hashNormal).not.toBeNull();
          }
        ),
        { numRuns: 20 }
      );
    });

    test('小文件（< 10MB）应该产生一致的 hash', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成小文件内容（< 10MB）
          fc.integer({ min: 0, max: 5 * 1024 * 1024 }).chain(size =>
            fc.tuple(
              fc.constant(size),
              fc.string({ minLength: 1, maxLength: 100 })
            )
          ),
          async ([size, pattern]) => {
            // 创建指定大小的内容
            const content = pattern.repeat(Math.ceil(size / pattern.length)).substring(0, size);
            const testFile = path.join(testDir, `small-${Date.now()}-${Math.random()}.txt`);
            await writeFile(testFile, content);
            testFiles.push(testFile);

            // 计算 hash 两次
            const hash1 = await fileHashService.calculateHash(testFile);
            const hash2 = await fileHashService.calculateHash(testFile);

            // 验证一致性
            expect(hash1).toBe(hash2);
            expect(hash1).not.toBeNull();
            expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 格式
          }
        ),
        { numRuns: 10 } // 减少运行次数因为文件较大
      );
    });

    test('大文件（> 10MB）应该产生一致的 hash', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成大文件内容（> 10MB）
          fc.integer({ min: 11 * 1024 * 1024, max: 15 * 1024 * 1024 }).chain(size =>
            fc.tuple(
              fc.constant(size),
              fc.string({ minLength: 1, maxLength: 100 })
            )
          ),
          async ([size, pattern]) => {
            // 创建指定大小的内容
            const content = pattern.repeat(Math.ceil(size / pattern.length)).substring(0, size);
            const testFile = path.join(testDir, `large-${Date.now()}-${Math.random()}.txt`);
            await writeFile(testFile, content);
            testFiles.push(testFile);

            // 计算 hash 两次（应该自动使用流式处理）
            const hash1 = await fileHashService.calculateHash(testFile);
            const hash2 = await fileHashService.calculateHash(testFile);

            // 验证一致性
            expect(hash1).toBe(hash2);
            expect(hash1).not.toBeNull();
            expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 格式
          }
        ),
        { numRuns: 5 } // 减少运行次数因为文件很大
      );
    });

    test('不同大小的文件都应该产生一致的 hash', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成各种大小的文件（从 0 到 20MB）
          fc.integer({ min: 0, max: 20 * 1024 * 1024 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (size, pattern) => {
            // 创建指定大小的内容
            const content = size === 0 ? '' : pattern.repeat(Math.ceil(size / pattern.length)).substring(0, size);
            const testFile = path.join(testDir, `mixed-size-${Date.now()}-${Math.random()}.txt`);
            await writeFile(testFile, content);
            testFiles.push(testFile);

            // 计算 hash 两次
            const hash1 = await fileHashService.calculateHash(testFile);
            const hash2 = await fileHashService.calculateHash(testFile);

            // 验证一致性
            expect(hash1).toBe(hash2);
            expect(hash1).not.toBeNull();
            
            // 验证 hash 格式（小写十六进制）
            expect(hash1).toBe(hash1.toLowerCase());
            expect(hash1).toMatch(/^[a-f0-9]{64}$/);
          }
        ),
        { numRuns: 10 } // 平衡运行次数和测试时间
      );
    });

    test('相同内容的不同文件应该产生相同的 hash', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成随机内容
          fc.string({ minLength: 0, maxLength: 1000 }),
          async (content) => {
            // 创建两个内容相同的文件
            const testFile1 = path.join(testDir, `same-content-1-${Date.now()}-${Math.random()}.txt`);
            const testFile2 = path.join(testDir, `same-content-2-${Date.now()}-${Math.random()}.txt`);
            
            await writeFile(testFile1, content);
            await writeFile(testFile2, content);
            testFiles.push(testFile1, testFile2);

            // 计算两个文件的 hash
            const hash1 = await fileHashService.calculateHash(testFile1);
            const hash2 = await fileHashService.calculateHash(testFile2);

            // 验证相同内容产生相同 hash
            expect(hash1).toBe(hash2);
            expect(hash1).not.toBeNull();
          }
        ),
        { numRuns: 20 }
      );
    });

    test('不同内容应该产生不同的 hash（极高概率）', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成两个不同的字符串
          fc.string({ minLength: 1, maxLength: 1000 }),
          fc.string({ minLength: 1, maxLength: 1000 }),
          async (content1, content2) => {
            // 只测试内容确实不同的情况
            fc.pre(content1 !== content2);

            const testFile1 = path.join(testDir, `different-1-${Date.now()}-${Math.random()}.txt`);
            const testFile2 = path.join(testDir, `different-2-${Date.now()}-${Math.random()}.txt`);
            
            await writeFile(testFile1, content1);
            await writeFile(testFile2, content2);
            testFiles.push(testFile1, testFile2);

            // 计算两个文件的 hash
            const hash1 = await fileHashService.calculateHash(testFile1);
            const hash2 = await fileHashService.calculateHash(testFile2);

            // 验证不同内容产生不同 hash
            expect(hash1).not.toBe(hash2);
            expect(hash1).not.toBeNull();
            expect(hash2).not.toBeNull();
          }
        ),
        { numRuns: 20 }
      );
    });

    test('hash 值应该始终是小写十六进制格式', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成随机内容和大小
          fc.integer({ min: 0, max: 15 * 1024 * 1024 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (size, pattern) => {
            const content = size === 0 ? '' : pattern.repeat(Math.ceil(size / pattern.length)).substring(0, size);
            const testFile = path.join(testDir, `format-${Date.now()}-${Math.random()}.txt`);
            await writeFile(testFile, content);
            testFiles.push(testFile);

            const hash = await fileHashService.calculateHash(testFile);

            // 验证格式
            expect(hash).not.toBeNull();
            expect(hash).toBe(hash.toLowerCase()); // 小写
            expect(hash).toMatch(/^[a-f0-9]{64}$/); // 十六进制，64 字符（SHA-256）
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
