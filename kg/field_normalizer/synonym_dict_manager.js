/**
 * Synonym Dictionary Manager
 * 
 * 管理同义词词典的版本控制、导入导出、冲突消歧等功能
 * 
 * Requirements: 20.11, 20.12, 20.13, 20.14, 20.15, 20.16
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class SynonymDictManager {
  constructor(options = {}) {
    this.dictPath = options.dictPath || path.join(__dirname, 'synonym_dict.json');
    this.versionsDir = options.versionsDir || path.join(__dirname, '.dict_versions');
    this.maxVersions = options.maxVersions || 10;  // Keep last 10 versions
    this.dict = null;
    this.currentVersion = null;
  }

  /**
   * 加载词典
   */
  async loadDict() {
    try {
      const content = await fs.readFile(this.dictPath, 'utf-8');
      this.dict = JSON.parse(content);
      this.currentVersion = this._calculateVersion(this.dict);
      return this.dict;
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.dict = {};
        this.currentVersion = null;
        return this.dict;
      }
      throw error;
    }
  }

  /**
   * 保存词典
   */
  async saveDict() {
    await fs.writeFile(
      this.dictPath,
      JSON.stringify(this.dict, null, 2),
      'utf-8'
    );
    this.currentVersion = this._calculateVersion(this.dict);
  }

  /**
   * 创建版本快照 (Requirement 20.11)
   * 保存当前词典状态到版本历史
   */
  async createVersion(description = '') {
    await this.loadDict();

    // 确保版本目录存在
    try {
      await fs.mkdir(this.versionsDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }

    const timestamp = new Date().toISOString();
    const version = this._calculateVersion(this.dict);
    const versionData = {
      version,
      timestamp,
      description,
      dict: this.dict,
      stats: {
        totalFields: Object.keys(this.dict).length,
        totalSynonyms: Object.values(this.dict).reduce(
          (sum, data) => sum + (data.synonyms?.length || 0),
          0
        )
      }
    };

    const versionFile = path.join(this.versionsDir, `${timestamp.replace(/:/g, '-')}_${version.substring(0, 8)}.json`);
    await fs.writeFile(versionFile, JSON.stringify(versionData, null, 2), 'utf-8');

    // 清理旧版本
    await this._cleanupOldVersions();

    return {
      version,
      timestamp,
      file: versionFile
    };
  }

  /**
   * 列出所有版本 (Requirement 20.11)
   */
  async listVersions() {
    try {
      const files = await fs.readdir(this.versionsDir);
      const versions = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.versionsDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const versionData = JSON.parse(content);
          versions.push({
            version: versionData.version,
            timestamp: versionData.timestamp,
            description: versionData.description,
            stats: versionData.stats,
            file: filePath
          });
        }
      }

      // 按时间倒序排列
      versions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return versions;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * 回退到指定版本 (Requirement 20.11)
   */
  async rollbackToVersion(version) {
    const versions = await this.listVersions();
    const targetVersion = versions.find(v => v.version === version || v.version.startsWith(version));

    if (!targetVersion) {
      throw new Error(`Version ${version} not found`);
    }

    // 在回退前创建当前版本快照
    await this.createVersion(`Backup before rollback to ${version}`);

    // 加载目标版本
    const content = await fs.readFile(targetVersion.file, 'utf-8');
    const versionData = JSON.parse(content);

    // 恢复词典
    this.dict = versionData.dict;
    await this.saveDict();

    return {
      success: true,
      version: targetVersion.version,
      timestamp: targetVersion.timestamp,
      stats: targetVersion.stats
    };
  }

  /**
   * 按领域筛选词典 (Requirement 20.13)
   */
  async filterByDomain(domain) {
    await this.loadDict();

    const filtered = {};
    for (const [standard, data] of Object.entries(this.dict)) {
      if (data.domain && data.domain.includes(domain)) {
        filtered[standard] = data;
      }
    }

    return {
      domain,
      totalFields: Object.keys(filtered).length,
      totalSynonyms: Object.values(filtered).reduce(
        (sum, data) => sum + (data.synonyms?.length || 0),
        0
      ),
      dict: filtered
    };
  }

  /**
   * 导出词典为 JSON (Requirement 20.14)
   */
  async exportDict(options = {}) {
    const {
      domain = null,  // 按领域筛选
      outputPath = null,  // 输出路径
      includeMetadata = true  // 包含元数据
    } = options;

    await this.loadDict();

    let exportData = this.dict;

    // 按领域筛选
    if (domain) {
      const filtered = await this.filterByDomain(domain);
      exportData = filtered.dict;
    }

    // 构建导出数据
    const output = includeMetadata ? {
      version: this.currentVersion,
      exportTime: new Date().toISOString(),
      domain: domain || 'all',
      stats: {
        totalFields: Object.keys(exportData).length,
        totalSynonyms: Object.values(exportData).reduce(
          (sum, data) => sum + (data.synonyms?.length || 0),
          0
        )
      },
      dict: exportData
    } : exportData;

    // 保存到文件
    if (outputPath) {
      await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    }

    return output;
  }

  /**
   * 从 JSON 导入词典 (Requirement 20.15)
   */
  async importDict(inputPath, options = {}) {
    const {
      merge = true,  // 合并到现有词典
      overwrite = false,  // 覆盖冲突项
      createBackup = true  // 导入前创建备份
    } = options;

    // 读取导入文件
    const content = await fs.readFile(inputPath, 'utf-8');
    const importData = JSON.parse(content);

    // 提取词典数据
    const importDict = importData.dict || importData;

    // 创建备份
    if (createBackup) {
      await this.createVersion(`Backup before import from ${path.basename(inputPath)}`);
    }

    await this.loadDict();

    let added = 0;
    let updated = 0;
    let skipped = 0;
    const conflicts = [];

    for (const [standard, data] of Object.entries(importDict)) {
      if (!this.dict[standard]) {
        // 新增字段
        this.dict[standard] = data;
        added++;
      } else if (merge) {
        // 合并同义词
        const existingSynonyms = new Set(this.dict[standard].synonyms || []);
        const beforeCount = existingSynonyms.size;
        const newSynonyms = data.synonyms || [];
        newSynonyms.forEach(syn => existingSynonyms.add(syn));
        this.dict[standard].synonyms = Array.from(existingSynonyms);

        // 合并领域
        const existingDomains = new Set(this.dict[standard].domain || []);
        const newDomains = data.domain || [];
        newDomains.forEach(dom => existingDomains.add(dom));
        this.dict[standard].domain = Array.from(existingDomains);

        if (existingSynonyms.size > beforeCount) {
          updated++;
        } else {
          skipped++;
        }
      } else if (overwrite) {
        // 覆盖现有字段
        this.dict[standard] = data;
        updated++;
      } else {
        // 记录冲突
        conflicts.push({
          standard,
          existing: this.dict[standard],
          imported: data
        });
        skipped++;
      }
    }

    await this.saveDict();

    return {
      success: true,
      added,
      updated,
      skipped,
      conflicts: conflicts.length,
      conflictDetails: conflicts
    };
  }

  /**
   * 冲突消歧 (Requirement 20.16)
   * 检测一个同义词是否对应多个标准字段
   */
  async detectConflicts() {
    await this.loadDict();

    const synonymMap = new Map();  // synonym -> [standard fields]
    const conflicts = [];

    // 构建反向索引
    for (const [standard, data] of Object.entries(this.dict)) {
      const synonyms = data.synonyms || [];
      for (const synonym of synonyms) {
        if (!synonymMap.has(synonym)) {
          synonymMap.set(synonym, []);
        }
        synonymMap.get(synonym).push(standard);
      }
    }

    // 检测冲突
    for (const [synonym, standards] of synonymMap.entries()) {
      if (standards.length > 1) {
        conflicts.push({
          synonym,
          standards,
          count: standards.length
        });
      }
    }

    return {
      totalConflicts: conflicts.length,
      conflicts: conflicts.sort((a, b) => b.count - a.count)
    };
  }

  /**
   * 解决冲突 (Requirement 20.16)
   * 使用上下文消歧
   */
  resolveConflict(synonym, standards, context = '') {
    if (!standards || standards.length <= 1) {
      return standards[0] || null;
    }

    // 简单的上下文消歧策略
    const contextLower = context.toLowerCase();

    // 1. 检查上下文中是否包含标准字段名称（优先匹配更长的字段名）
    const sortedStandards = [...standards].sort((a, b) => b.length - a.length);
    for (const standard of sortedStandards) {
      if (contextLower.includes(standard.toLowerCase())) {
        return standard;
      }
    }

    // 2. 检查上下文中是否包含标准字段的其他同义词
    for (const standard of standards) {
      const data = this.dict[standard];
      if (data && data.synonyms) {
        for (const syn of data.synonyms) {
          if (syn !== synonym && contextLower.includes(syn.toLowerCase())) {
            return standard;
          }
        }
      }
    }

    // 3. 检查领域相关性
    const domainKeywords = {
      '科研': ['实验', '数据', '指标', '论文', '研究'],
      '政务': ['政策', '文件', '审批', '监管', '公文'],
      '工作': ['会议', '任务', '项目', '汇报', '计划'],
      '生活': ['健康', '饮食', '运动', '娱乐', '休闲'],
      '旅行': ['景点', '酒店', '交通', '美食', '行程', '旅行']
    };

    for (const standard of standards) {
      const data = this.dict[standard];
      if (data && data.domain) {
        for (const domain of data.domain) {
          const keywords = domainKeywords[domain] || [];
          if (keywords.some(kw => contextLower.includes(kw))) {
            return standard;
          }
        }
      }
    }

    // 4. 默认返回使用频率最高的
    const usageCounts = standards.map(s => ({
      standard: s,
      usage: this.dict[s]?.usage_count || 0
    }));
    usageCounts.sort((a, b) => b.usage - a.usage);

    return usageCounts[0].standard;
  }

  /**
   * 清除映射缓存 (Requirement 20.12)
   * 当词典更新时，清除相关缓存
   */
  async clearMappingCache() {
    try {
      // 尝试清除 mapping_cache
      const mappingCache = require('./mapping_cache');
      if (mappingCache && typeof mappingCache.clear === 'function') {
        mappingCache.clear();
      }
    } catch (error) {
      // mapping_cache 可能不存在或没有 clear 方法
      console.warn('Failed to clear mapping cache:', error.message);
    }
    
    return {
      success: true,
      message: 'Mapping cache cleared'
    };
  }

  /**
   * 获取词典统计信息
   */
  async getStats() {
    await this.loadDict();

    const totalFields = Object.keys(this.dict).length;
    const totalSynonyms = Object.values(this.dict).reduce(
      (sum, data) => sum + (data.synonyms?.length || 0),
      0
    );

    // 按领域统计
    const domainStats = {};
    for (const [standard, data] of Object.entries(this.dict)) {
      const domains = data.domain || ['未分类'];
      for (const domain of domains) {
        if (!domainStats[domain]) {
          domainStats[domain] = { fields: 0, synonyms: 0 };
        }
        domainStats[domain].fields++;
        domainStats[domain].synonyms += data.synonyms?.length || 0;
      }
    }

    return {
      version: this.currentVersion,
      totalFields,
      totalSynonyms,
      avgSynonymsPerField: (totalSynonyms / totalFields).toFixed(2),
      domainStats
    };
  }

  /**
   * 计算词典版本哈希
   */
  _calculateVersion(dict) {
    const content = JSON.stringify(dict, Object.keys(dict).sort());
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * 清理旧版本
   */
  async _cleanupOldVersions() {
    const versions = await this.listVersions();
    
    if (versions.length > this.maxVersions) {
      const toDelete = versions.slice(this.maxVersions);
      for (const version of toDelete) {
        await fs.unlink(version.file);
      }
    }
  }
}

module.exports = SynonymDictManager;
