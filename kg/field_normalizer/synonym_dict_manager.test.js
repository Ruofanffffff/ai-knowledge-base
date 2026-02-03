/**
 * Tests for Synonym Dictionary Manager
 * 
 * Requirements: 20.11, 20.12, 20.13, 20.14, 20.15, 20.16
 */

const SynonymDictManager = require('./synonym_dict_manager');
const fs = require('fs').promises;
const path = require('path');

describe('Synonym Dictionary Manager', () => {
  let manager;
  let testDictPath;
  let testVersionsDir;

  beforeEach(async () => {
    // 使用临时测试文件
    testDictPath = path.join(__dirname, '.test_synonym_dict.json');
    testVersionsDir = path.join(__dirname, '.test_dict_versions');
    
    manager = new SynonymDictManager({
      dictPath: testDictPath,
      versionsDir: testVersionsDir,
      maxVersions: 3
    });

    // 创建测试词典
    manager.dict = {
      '时间': {
        synonyms: ['时刻', '日期', '时候'],
        domain: ['通用'],
        confidence: 1.0,
        usage_count: 100
      },
      '区域': {
        synonyms: ['地区', '地方', '位置'],
        domain: ['通用', '科研'],
        confidence: 1.0,
        usage_count: 80
      },
      '指标': {
        synonyms: ['参数', '度量', 'metric'],
        domain: ['科研'],
        confidence: 0.9,
        usage_count: 50
      }
    };
    await manager.saveDict();
  });

  afterEach(async () => {
    // 清理测试文件
    try {
      await fs.unlink(testDictPath);
    } catch (error) {
      // File may not exist
    }

    // 清理版本目录
    try {
      const files = await fs.readdir(testVersionsDir);
      for (const file of files) {
        await fs.unlink(path.join(testVersionsDir, file));
      }
      await fs.rmdir(testVersionsDir);
    } catch (error) {
      // Directory may not exist
    }
  });

  describe('Version Control (Requirement 20.11)', () => {
    it('should create version snapshot', async () => {
      const result = await manager.createVersion('Test version');

      expect(result.version).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.file).toBeDefined();

      // 验证版本文件存在
      const content = await fs.readFile(result.file, 'utf-8');
      const versionData = JSON.parse(content);
      expect(versionData.description).toBe('Test version');
      expect(versionData.dict).toEqual(manager.dict);
      expect(versionData.stats.totalFields).toBe(3);
    });

    it('should list all versions', async () => {
      await manager.createVersion('Version 1');
      await new Promise(resolve => setTimeout(resolve, 10));  // 确保时间戳不同
      await manager.createVersion('Version 2');

      const versions = await manager.listVersions();

      expect(versions.length).toBe(2);
      expect(versions[0].description).toBe('Version 2');  // 最新的在前
      expect(versions[1].description).toBe('Version 1');
    });

    it('should rollback to previous version', async () => {
      // 创建初始版本
      const v1 = await manager.createVersion('Version 1');

      // 修改词典
      manager.dict['新字段'] = {
        synonyms: ['test'],
        domain: ['测试'],
        confidence: 1.0,
        usage_count: 0
      };
      await manager.saveDict();

      // 回退到 v1
      const result = await manager.rollbackToVersion(v1.version);

      expect(result.success).toBe(true);
      expect(result.version).toBe(v1.version);

      // 验证词典已恢复
      await manager.loadDict();
      expect(manager.dict['新字段']).toBeUndefined();
      expect(Object.keys(manager.dict).length).toBe(3);
    });

    it('should cleanup old versions', async () => {
      // 创建超过 maxVersions 的版本
      for (let i = 0; i < 5; i++) {
        await manager.createVersion(`Version ${i}`);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const versions = await manager.listVersions();
      expect(versions.length).toBeLessThanOrEqual(3);  // maxVersions = 3
    });

    it('should throw error when rolling back to non-existent version', async () => {
      await expect(
        manager.rollbackToVersion('non-existent-version')
      ).rejects.toThrow('Version non-existent-version not found');
    });
  });

  describe('Domain Filtering (Requirement 20.13)', () => {
    it('should filter dictionary by domain', async () => {
      const result = await manager.filterByDomain('科研');

      expect(result.domain).toBe('科研');
      expect(result.totalFields).toBe(2);  // 区域 和 指标
      expect(result.dict['区域']).toBeDefined();
      expect(result.dict['指标']).toBeDefined();
      expect(result.dict['时间']).toBeUndefined();
    });

    it('should return empty dict for non-existent domain', async () => {
      const result = await manager.filterByDomain('不存在的领域');

      expect(result.totalFields).toBe(0);
      expect(Object.keys(result.dict).length).toBe(0);
    });

    it('should calculate correct statistics for filtered domain', async () => {
      const result = await manager.filterByDomain('科研');

      expect(result.totalSynonyms).toBe(6);  // 区域3个 + 指标3个
    });
  });

  describe('Export Dictionary (Requirement 20.14)', () => {
    it('should export full dictionary with metadata', async () => {
      const result = await manager.exportDict({ includeMetadata: true });

      expect(result.version).toBeDefined();
      expect(result.exportTime).toBeDefined();
      expect(result.domain).toBe('all');
      expect(result.stats.totalFields).toBe(3);
      expect(result.dict).toEqual(manager.dict);
    });

    it('should export dictionary without metadata', async () => {
      const result = await manager.exportDict({ includeMetadata: false });

      expect(result.version).toBeUndefined();
      expect(result.exportTime).toBeUndefined();
      expect(result['时间']).toBeDefined();
      expect(result['区域']).toBeDefined();
    });

    it('should export filtered dictionary by domain', async () => {
      const result = await manager.exportDict({
        domain: '科研',
        includeMetadata: true
      });

      expect(result.domain).toBe('科研');
      expect(result.stats.totalFields).toBe(2);
      expect(result.dict['指标']).toBeDefined();
      expect(result.dict['时间']).toBeUndefined();
    });

    it('should export dictionary to file', async () => {
      const outputPath = path.join(__dirname, '.test_export.json');

      await manager.exportDict({ outputPath });

      // 验证文件存在
      const content = await fs.readFile(outputPath, 'utf-8');
      const exported = JSON.parse(content);
      expect(exported.dict).toEqual(manager.dict);

      // 清理
      await fs.unlink(outputPath);
    });
  });

  describe('Import Dictionary (Requirement 20.15)', () => {
    it('should import and merge dictionary', async () => {
      // 创建导入文件
      const importDict = {
        '时间': {
          synonyms: ['时分', '时点'],  // 新同义词
          domain: ['通用'],
          confidence: 1.0,
          usage_count: 0
        },
        '新字段': {
          synonyms: ['新同义词'],
          domain: ['测试'],
          confidence: 1.0,
          usage_count: 0
        }
      };

      const importPath = path.join(__dirname, '.test_import.json');
      await fs.writeFile(importPath, JSON.stringify(importDict, null, 2), 'utf-8');

      const result = await manager.importDict(importPath, {
        merge: true,
        createBackup: false
      });

      expect(result.success).toBe(true);
      expect(result.added).toBe(1);  // 新字段
      expect(result.updated).toBe(1);  // 时间（合并同义词）

      // 验证合并结果
      await manager.loadDict();
      expect(manager.dict['时间'].synonyms).toContain('时分');
      expect(manager.dict['时间'].synonyms).toContain('时刻');  // 原有同义词保留
      expect(manager.dict['新字段']).toBeDefined();

      // 清理
      await fs.unlink(importPath);
    });

    it('should import and overwrite dictionary', async () => {
      const importDict = {
        '时间': {
          synonyms: ['新时间同义词'],
          domain: ['新领域'],
          confidence: 0.8,
          usage_count: 10
        }
      };

      const importPath = path.join(__dirname, '.test_import.json');
      await fs.writeFile(importPath, JSON.stringify(importDict, null, 2), 'utf-8');

      const result = await manager.importDict(importPath, {
        merge: false,
        overwrite: true,
        createBackup: false
      });

      expect(result.success).toBe(true);
      expect(result.updated).toBe(1);

      // 验证覆盖结果
      await manager.loadDict();
      expect(manager.dict['时间'].synonyms).toEqual(['新时间同义词']);
      expect(manager.dict['时间'].domain).toEqual(['新领域']);

      // 清理
      await fs.unlink(importPath);
    });

    it('should detect conflicts when not merging or overwriting', async () => {
      const importDict = {
        '时间': {
          synonyms: ['冲突同义词'],
          domain: ['冲突领域'],
          confidence: 1.0,
          usage_count: 0
        }
      };

      const importPath = path.join(__dirname, '.test_import.json');
      await fs.writeFile(importPath, JSON.stringify(importDict, null, 2), 'utf-8');

      const result = await manager.importDict(importPath, {
        merge: false,
        overwrite: false,
        createBackup: false
      });

      expect(result.conflicts).toBe(1);
      expect(result.conflictDetails.length).toBe(1);
      expect(result.conflictDetails[0].standard).toBe('时间');

      // 清理
      await fs.unlink(importPath);
    });

    it('should create backup before import', async () => {
      const importDict = { '新字段': { synonyms: ['test'], domain: ['测试'], confidence: 1.0, usage_count: 0 } };
      const importPath = path.join(__dirname, '.test_import.json');
      await fs.writeFile(importPath, JSON.stringify(importDict, null, 2), 'utf-8');

      await manager.importDict(importPath, { createBackup: true });

      const versions = await manager.listVersions();
      expect(versions.length).toBeGreaterThan(0);
      expect(versions[0].description).toContain('Backup before import');

      // 清理
      await fs.unlink(importPath);
    });
  });

  describe('Conflict Detection and Resolution (Requirement 20.16)', () => {
    beforeEach(async () => {
      // 创建包含冲突的词典
      manager.dict = {
        '时间': {
          synonyms: ['时刻', '日期', '时候', '时段'],  // 时段 也在 持续时间 中
          domain: ['通用'],
          confidence: 1.0,
          usage_count: 100
        },
        '持续时间': {
          synonyms: ['时长', '时段', '期间'],  // 时段 冲突
          domain: ['通用'],
          confidence: 1.0,
          usage_count: 50
        },
        '区域': {
          synonyms: ['地区', '地方', '位置', '地点'],  // 地点 也在 地点 中
          domain: ['通用'],
          confidence: 1.0,
          usage_count: 80
        },
        '地点': {
          synonyms: ['地点', '场所', '位置'],  // 地点 和 位置 冲突
          domain: ['旅行'],
          confidence: 0.9,
          usage_count: 30
        }
      };
      await manager.saveDict();
    });

    it('should detect conflicts', async () => {
      const result = await manager.detectConflicts();

      expect(result.totalConflicts).toBeGreaterThan(0);
      expect(result.conflicts.length).toBeGreaterThan(0);

      // 验证冲突详情
      const timeConflict = result.conflicts.find(c => c.synonym === '时段');
      expect(timeConflict).toBeDefined();
      expect(timeConflict.standards).toContain('时间');
      expect(timeConflict.standards).toContain('持续时间');
    });

    it('should resolve conflict using context', async () => {
      const result = manager.resolveConflict(
        '时段',
        ['时间', '持续时间'],
        '这个实验的持续时间是多久'
      );

      expect(result).toBe('持续时间');
    });

    it('should resolve conflict using domain keywords', async () => {
      const result = manager.resolveConflict(
        '地点',
        ['区域', '地点'],
        '这次旅行的景点很多'
      );

      expect(result).toBe('地点');  // 旅行领域
    });

    it('should resolve conflict using usage count', async () => {
      const result = manager.resolveConflict(
        '位置',
        ['区域', '地点'],
        ''  // 无上下文
      );

      // 应该返回使用频率更高的
      expect(result).toBe('区域');  // usage_count = 80 > 30
    });

    it('should return null for empty standards', async () => {
      const result = manager.resolveConflict('test', []);
      expect(result).toBeNull();
    });

    it('should return single standard when no conflict', async () => {
      const result = manager.resolveConflict('test', ['时间']);
      expect(result).toBe('时间');
    });
  });

  describe('Cache Management (Requirement 20.12)', () => {
    it('should clear mapping cache', async () => {
      const result = await manager.clearMappingCache();

      expect(result.success).toBe(true);
      expect(result.message).toContain('cache cleared');
    });
  });

  describe('Statistics', () => {
    it('should get dictionary statistics', async () => {
      const stats = await manager.getStats();

      expect(stats.version).toBeDefined();
      expect(stats.totalFields).toBe(3);
      expect(stats.totalSynonyms).toBe(9);
      expect(stats.avgSynonymsPerField).toBe('3.00');
      expect(stats.domainStats['通用']).toBeDefined();
      expect(stats.domainStats['科研']).toBeDefined();
    });

    it('should calculate domain statistics correctly', async () => {
      const stats = await manager.getStats();

      expect(stats.domainStats['通用'].fields).toBe(2);  // 时间 和 区域
      expect(stats.domainStats['科研'].fields).toBe(2);  // 区域 和 指标
    });
  });

  describe('Version Calculation', () => {
    it('should calculate consistent version hash', async () => {
      const dict1 = { a: 1, b: 2 };
      const dict2 = { b: 2, a: 1 };  // 不同顺序

      const version1 = manager._calculateVersion(dict1);
      const version2 = manager._calculateVersion(dict2);

      expect(version1).toBe(version2);  // 应该相同
    });

    it('should calculate different version for different content', async () => {
      const dict1 = { a: 1 };
      const dict2 = { a: 2 };

      const version1 = manager._calculateVersion(dict1);
      const version2 = manager._calculateVersion(dict2);

      expect(version1).not.toBe(version2);
    });
  });
});
