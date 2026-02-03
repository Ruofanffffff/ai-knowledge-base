/**
 * Synonym Generator - LLM-powered synonym dictionary generation
 * 
 * 使用 LLM 生成覆盖多领域的同义词词典，支持：
 * - 初始化生成（覆盖工作、科研、生活、旅行、政务、网信工作等领域）
 * - 领域扩展生成（针对特定领域生成专业术语）
 * - 自动学习和扩充（从未映射字段和 LLM 映射结果中学习）
 * - 质量评估和优化
 */

const { createQwenClient } = require('../utils/qwen_client');
const fs = require('fs').promises;
const path = require('path');

class SynonymGenerator {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.QWEN_API_KEY;
    this.client = createQwenClient(this.apiKey);
    this.dictPath = options.dictPath || path.join(__dirname, 'synonym_dict.json');
    this.dict = null;
  }

  /**
   * 加载现有词典
   */
  async loadDict() {
    try {
      const content = await fs.readFile(this.dictPath, 'utf-8');
      this.dict = JSON.parse(content);
      return this.dict;
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.dict = {};
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
  }

  /**
   * 初始化生成同义词词典
   * 覆盖工作、科研、生活、旅行、政务、网信工作等领域
   */
  async generateInitialDict() {
    console.log('Starting initial synonym dictionary generation...');
    const startTime = Date.now();

    const domains = [
      '工作(会议、任务、项目、汇报)',
      '科研(实验、数据、指标、论文)',
      '生活(健康、饮食、运动、娱乐)',
      '旅行(景点、酒店、交通、美食)',
      '政务(政策、文件、审批、监管)',
      '中国网信工作(网络安全、数据治理、舆情、等保)'
    ];

    const standardFields = [
      '时间', '区域', '数值', '单位', '指标', '实体', '描述', '类型', '状态', '结果',
      '名称', '内容', '来源', '作者', '标签', '评分', '价格', '数量', '持续时间', '频率'
    ];

    const prompt = `你是一个同义词词典生成专家。请为以下标准字段生成同义词，覆盖多个领域。

领域: ${domains.join(', ')}

标准字段: ${standardFields.join(', ')}

要求:
1. 每个标准字段生成 8-12 个同义词
2. 包含正式术语和口语化表达
3. 包含中英文混合表达
4. 包含缩写和全称
5. 包含领域特定术语
6. 确保覆盖 90% 以上的实际使用场景

输出 JSON 格式:
{
  "标准字段": {
    "synonyms": ["同义词1", "同义词2", ...],
    "domain": ["适用领域1", "领域2"],
    "confidence": 1.0,
    "usage_count": 0
  }
}

请直接输出 JSON，不要包含任何其他文字。`;

    try {
      const response = await this.client.callJSON(prompt, {
        temperature: 0.7,
        maxTokens: 4000,
        systemPrompt: '你是一个专业的同义词词典生成专家，擅长识别不同领域的同义表达。'
      });

      // 合并到现有词典
      await this.loadDict();
      for (const [standard, data] of Object.entries(response)) {
        if (!this.dict[standard]) {
          this.dict[standard] = data;
        } else {
          // 合并同义词，去重
          const existingSynonyms = new Set(this.dict[standard].synonyms || []);
          const newSynonyms = data.synonyms || [];
          newSynonyms.forEach(syn => existingSynonyms.add(syn));
          this.dict[standard].synonyms = Array.from(existingSynonyms);
          
          // 合并领域
          const existingDomains = new Set(this.dict[standard].domain || []);
          const newDomains = data.domain || [];
          newDomains.forEach(dom => existingDomains.add(dom));
          this.dict[standard].domain = Array.from(existingDomains);
        }
      }

      await this.saveDict();

      const totalTime = Date.now() - startTime;
      const totalFields = Object.keys(this.dict).length;
      const totalSynonyms = Object.values(this.dict).reduce(
        (sum, data) => sum + (data.synonyms?.length || 0),
        0
      );

      console.log(`Initial dictionary generation completed in ${totalTime}ms`);
      console.log(`Generated ${totalFields} standard fields with ${totalSynonyms} synonyms`);

      return {
        success: true,
        totalFields,
        totalSynonyms,
        totalTime,
        tokens: response._meta?.tokens
      };
    } catch (error) {
      console.error('Failed to generate initial dictionary:', error);
      throw error;
    }
  }

  /**
   * 领域扩展生成 (Task 23.2)
   * 针对特定领域生成专业术语
   * 
   * 要求:
   * - 包含领域特定表达
   * - 包含口语化、缩写、中英文混合
   * - 覆盖该领域 95% 以上的常见表达
   * 
   * @param {string} domain - 领域名称
   * @param {Object} options - 扩展选项
   * @returns {Promise<Object>} 扩展结果
   */
  async expandDomainSynonyms(domain, options = {}) {
    const {
      includeColloquial = true,  // 包含口语化表达
      includeAbbreviations = true,  // 包含缩写
      includeMixedLanguage = true,  // 包含中英文混合
      minSynonymsPerField = 5,  // 每个字段最少同义词数
      maxSynonymsPerField = 15  // 每个字段最多同义词数
    } = options;

    console.log(`Expanding synonyms for domain: ${domain}`);
    console.log(`Options: colloquial=${includeColloquial}, abbr=${includeAbbreviations}, mixed=${includeMixedLanguage}`);
    const startTime = Date.now();

    await this.loadDict();

    // 构建详细的 prompt
    const requirements = [];
    if (includeColloquial) requirements.push('口语化表达');
    if (includeAbbreviations) requirements.push('缩写形式');
    if (includeMixedLanguage) requirements.push('中英文混合表达');

    const prompt = `扩展同义词词典，专注于 ${domain} 领域。

现有标准字段: ${Object.keys(this.dict).slice(0, 15).join(', ')}

任务:
1. 为现有标准字段添加 ${domain} 领域的专业术语
2. 识别 ${domain} 领域特有的字段，生成新的标准字段和同义词
3. 每个字段生成 ${minSynonymsPerField}-${maxSynonymsPerField} 个同义词
4. 必须包含: ${requirements.join('、')}
5. 确保覆盖该领域 95% 以上的常见表达

示例 (${domain} 领域):
${this._getDomainExamples(domain)}

输出 JSON 格式(仅包含新增或更新的字段):
{
  "标准字段": {
    "synonyms": ["专业术语1", "口语化表达", "缩写", "中英混合", ...],
    "domain": ["${domain}"],
    "confidence": 0.9,
    "usage_count": 0,
    "expression_types": ["formal", "colloquial", "abbreviation", "mixed"]
  }
}

请直接输出 JSON，不要包含任何其他文字。`;

    try {
      const response = await this.client.callJSON(prompt, {
        temperature: 0.6,
        maxTokens: 3500,
        systemPrompt: `你是一个 ${domain} 领域的专家，熟悉该领域的专业术语、口语表达、缩写和常见表达方式。`
      });

      // 合并到现有词典
      let addedFields = 0;
      let addedSynonyms = 0;
      let updatedFields = 0;
      const details = {
        colloquial: 0,
        abbreviations: 0,
        mixed: 0,
        formal: 0
      };

      for (const [standard, data] of Object.entries(response)) {
        if (!this.dict[standard]) {
          // 新增字段
          this.dict[standard] = {
            synonyms: data.synonyms || [],
            domain: data.domain || [domain],
            confidence: data.confidence || 0.9,
            usage_count: 0,
            expression_types: data.expression_types || []
          };
          addedFields++;
          addedSynonyms += data.synonyms?.length || 0;
        } else {
          // 更新现有字段
          const existingSynonyms = new Set(this.dict[standard].synonyms || []);
          const beforeCount = existingSynonyms.size;
          const newSynonyms = data.synonyms || [];
          newSynonyms.forEach(syn => existingSynonyms.add(syn));
          this.dict[standard].synonyms = Array.from(existingSynonyms);
          const added = existingSynonyms.size - beforeCount;
          if (added > 0) {
            addedSynonyms += added;
            updatedFields++;
          }
          
          // 合并领域
          const existingDomains = new Set(this.dict[standard].domain || []);
          const newDomains = data.domain || [domain];
          newDomains.forEach(dom => existingDomains.add(dom));
          this.dict[standard].domain = Array.from(existingDomains);

          // 合并表达类型
          if (data.expression_types) {
            const existingTypes = new Set(this.dict[standard].expression_types || []);
            data.expression_types.forEach(type => existingTypes.add(type));
            this.dict[standard].expression_types = Array.from(existingTypes);
          }
        }

        // 统计表达类型
        if (data.expression_types) {
          data.expression_types.forEach(type => {
            if (type === 'colloquial') details.colloquial++;
            else if (type === 'abbreviation') details.abbreviations++;
            else if (type === 'mixed') details.mixed++;
            else if (type === 'formal') details.formal++;
          });
        }
      }

      await this.saveDict();

      const totalTime = Date.now() - startTime;
      console.log(`Domain expansion completed in ${totalTime}ms`);
      console.log(`Added ${addedFields} new fields, updated ${updatedFields} fields`);
      console.log(`Added ${addedSynonyms} synonyms for ${domain}`);
      console.log(`Expression types: formal=${details.formal}, colloquial=${details.colloquial}, abbr=${details.abbreviations}, mixed=${details.mixed}`);

      return {
        success: true,
        domain,
        addedFields,
        updatedFields,
        addedSynonyms,
        expressionTypes: details,
        totalTime,
        tokens: response._meta?.tokens
      };
    } catch (error) {
      console.error(`Failed to expand domain ${domain}:`, error);
      throw error;
    }
  }

  /**
   * 获取领域示例
   * 为不同领域提供具体的示例，帮助 LLM 更好地理解需求
   */
  _getDomainExamples(domain) {
    const examples = {
      '医疗': `
- 标准字段: 时间
  专业术语: 就诊时间、诊疗时间、入院时间
  口语化: 看病时间、去医院的时候
  缩写: 就诊时、入院时
  中英混合: check-in时间、admission时间`,
      
      '金融': `
- 标准字段: 数值
  专业术语: 交易金额、账户余额、投资额度
  口语化: 多少钱、余额、投了多少
  缩写: 金额、余额
  中英混合: amount、balance`,
      
      '教育': `
- 标准字段: 评分
  专业术语: 学业成绩、考试分数、综合评价
  口语化: 考了多少分、成绩怎么样
  缩写: 成绩、分数
  中英混合: score、grade`,
      
      '电商': `
- 标准字段: 价格
  专业术语: 商品价格、销售价格、优惠价格
  口语化: 多少钱、卖多少、打折价
  缩写: 价、售价
  中英混合: price、售价`,
      
      '物流': `
- 标准字段: 区域
  专业术语: 配送区域、收货地址、派送范围
  口语化: 送到哪、收货地方
  缩写: 配送地、收货地
  中英混合: delivery地址、shipping区域`
    };

    return examples[domain] || `请根据 ${domain} 领域的特点，生成相应的专业术语、口语化表达、缩写和中英文混合表达。`;
  }

  /**
   * 从未映射字段中学习
   * 批量生成新同义词
   */
  async learnFromUnmappedFields(unmappedFields) {
    if (!unmappedFields || unmappedFields.length === 0) {
      console.log('No unmapped fields to learn from');
      return { success: true, mappings: [], newStandards: [] };
    }

    console.log(`Learning from ${unmappedFields.length} unmapped fields...`);
    const startTime = Date.now();

    await this.loadDict();

    const prompt = `分析以下未映射的字段名称，判断它们应该映射到哪些标准字段，或者是否需要创建新的标准字段。

未映射字段: ${unmappedFields.slice(0, 50).join(', ')}

现有标准字段: ${Object.keys(this.dict).join(', ')}

任务:
1. 将未映射字段归类到现有标准字段（如果语义相近）
2. 识别需要新增的标准字段（如果是新的概念）
3. 生成映射关系和置信度

输出 JSON 格式:
{
  "mappings": [
    {"raw": "原始字段", "standard": "标准字段", "confidence": 0.85}
  ],
  "new_standards": [
    {
      "name": "新标准字段",
      "synonyms": ["同义词1", "同义词2", ...],
      "domain": ["领域"],
      "confidence": 0.9
    }
  ]
}

请直接输出 JSON，不要包含任何其他文字。`;

    try {
      const response = await this.client.callJSON(prompt, {
        temperature: 0.5,
        maxTokens: 2000,
        systemPrompt: '你是一个字段映射专家，擅长识别字段之间的语义关系。'
      });

      let learnedMappings = 0;
      let newStandards = 0;

      // 应用映射学习
      if (response.mappings && Array.isArray(response.mappings)) {
        for (const mapping of response.mappings) {
          if (mapping.confidence >= 0.8 && this.dict[mapping.standard]) {
            // 添加到同义词列表
            if (!this.dict[mapping.standard].synonyms) {
              this.dict[mapping.standard].synonyms = [];
            }
            if (!this.dict[mapping.standard].synonyms.includes(mapping.raw)) {
              this.dict[mapping.standard].synonyms.push(mapping.raw);
              learnedMappings++;
            }
          }
        }
      }

      // 添加新标准字段
      if (response.new_standards && Array.isArray(response.new_standards)) {
        for (const newStandard of response.new_standards) {
          if (!this.dict[newStandard.name]) {
            this.dict[newStandard.name] = {
              synonyms: newStandard.synonyms || [],
              domain: newStandard.domain || ['通用'],
              confidence: newStandard.confidence || 0.9,
              usage_count: 0
            };
            newStandards++;
          }
        }
      }

      await this.saveDict();

      const totalTime = Date.now() - startTime;
      console.log(`Learning completed in ${totalTime}ms`);
      console.log(`Learned ${learnedMappings} mappings and added ${newStandards} new standards`);

      return {
        success: true,
        learnedMappings,
        newStandards,
        totalTime,
        tokens: response._meta?.tokens,
        mappings: response.mappings || [],
        new_standards: response.new_standards || []
      };
    } catch (error) {
      console.error('Failed to learn from unmapped fields:', error);
      throw error;
    }
  }

  /**
   * 质量评估
   * 使用测试集评估覆盖率
   */
  async evaluateQuality(testSet) {
    console.log(`Evaluating dictionary quality with ${testSet.length} test cases...`);
    
    await this.loadDict();

    let covered = 0;
    let total = testSet.length;
    const uncoveredFields = [];

    for (const testCase of testSet) {
      const { fieldName, expectedStandard } = testCase;
      
      // 检查是否能映射
      let found = false;
      for (const [standard, data] of Object.entries(this.dict)) {
        if (standard === fieldName || (data.synonyms && data.synonyms.includes(fieldName))) {
          if (!expectedStandard || standard === expectedStandard) {
            found = true;
            covered++;
            break;
          }
        }
      }

      if (!found) {
        uncoveredFields.push(testCase);
      }
    }

    const coverageRate = covered / total;
    const passed = coverageRate >= 0.9;

    console.log(`Coverage rate: ${(coverageRate * 100).toFixed(1)}% (${covered}/${total})`);
    console.log(`Quality check: ${passed ? 'PASSED' : 'FAILED'}`);

    if (!passed) {
      console.warn(`Coverage rate ${(coverageRate * 100).toFixed(1)}% is below target 90%`);
      console.log(`Uncovered fields: ${uncoveredFields.length}`);
    }

    return {
      coverageRate,
      covered,
      total,
      passed,
      uncoveredFields
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
    const avgSynonymsPerField = totalSynonyms / totalFields;

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

    // 使用频率统计
    const usageStats = {
      high: 0,  // > 100
      medium: 0,  // 10-100
      low: 0,  // 1-10
      unused: 0  // 0
    };

    for (const data of Object.values(this.dict)) {
      const count = data.usage_count || 0;
      if (count > 100) usageStats.high++;
      else if (count >= 10) usageStats.medium++;
      else if (count >= 1) usageStats.low++;
      else usageStats.unused++;
    }

    return {
      totalFields,
      totalSynonyms,
      avgSynonymsPerField: avgSynonymsPerField.toFixed(2),
      domainStats,
      usageStats
    };
  }

  /**
   * 增加字段使用计数
   */
  async incrementUsage(standardField) {
    await this.loadDict();
    
    if (this.dict[standardField]) {
      this.dict[standardField].usage_count = (this.dict[standardField].usage_count || 0) + 1;
      await this.saveDict();
    }
  }
}

module.exports = SynonymGenerator;
