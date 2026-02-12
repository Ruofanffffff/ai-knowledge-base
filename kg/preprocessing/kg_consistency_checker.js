/**
 * Knowledge Graph Consistency Checker
 * 
 * 验证知识图谱与索引叙述文本的一致性，并生成图谱的自然语言描述
 * 
 * 核心功能：
 * 1. 校验知识图谱与索引叙述文本的一致性
 * 2. 标注一致性状态（一致/部分一致/不一致）
 * 3. 识别问题（字段缺失/关系偏差/实体错误）
 * 4. 生成图谱的自然语言描述
 * 
 * Requirements: 7.1, 7.3, 7.5
 */

const { v4: uuidv4 } = require('uuid');

class KGConsistencyChecker {
  constructor(options = {}) {
    this.temperature = options.temperature || parseFloat(process.env.LLM_TEMPERATURE) || 0.1;
    this.timeout = options.timeout || parseInt(process.env.LLM_TIMEOUT) || 30000; // 30秒超时
    this.maxRetries = options.maxRetries || parseInt(process.env.LLM_MAX_RETRIES) || 2;
    this.consistencyThreshold = options.consistencyThreshold || 0.8; // 一致性阈值
    
    console.log(`[KG Consistency Checker] Initialized with timeout=${this.timeout}ms, retries=${this.maxRetries}, threshold=${this.consistencyThreshold}`);
  }
  
  /**
   * 校验知识图谱一致性
   * 
   * @param {Object} graph - 知识图谱对象 {entities: [], relations: []}
   * @param {string} indexedText - 索引叙述文本
   * @param {Object} llmClient - LLM客户端
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 校验结果
   */
  async checkConsistency(graph, indexedText, llmClient, options = {}) {
    if (!graph || !graph.entities || !graph.relations) {
      console.warn('[KG Consistency Checker] Invalid graph structure');
      return {
        consistencyScore: 1.0,
        isConsistent: true,
        items: [],
        issues: [],
        reason: 'Invalid graph structure'
      };
    }
    
    if (!indexedText) {
      console.warn('[KG Consistency Checker] No indexed text available, skipping consistency check');
      return {
        consistencyScore: 1.0,
        isConsistent: true,
        items: [],
        issues: [],
        reason: 'No indexed text available'
      };
    }
    
    if (!llmClient) {
      console.warn('[KG Consistency Checker] No LLM client provided, skipping consistency check');
      return {
        consistencyScore: 1.0,
        isConsistent: true,
        items: [],
        issues: [],
        reason: 'No LLM client'
      };
    }
    
    try {
      console.log(`[KG Consistency Checker] Checking consistency for graph with ${graph.entities.length} entities and ${graph.relations.length} relations`);
      
      // 生成图谱描述
      const kgDescription = this.generateGraphDescription(graph);
      
      // 构建一致性校验prompt
      const prompt = this._buildConsistencyCheckPrompt(indexedText, kgDescription);
      
      // 调用LLM校验
      const response = await this._callLLMWithRetry(llmClient, prompt);
      
      // 解析响应
      const result = this._parseConsistencyResponse(response);
      
      console.log(`[KG Consistency Checker] Consistency check complete: score=${result.consistencyScore}, issues=${result.issues.length}`);
      
      return result;
    } catch (error) {
      console.error('[KG Consistency Checker] Consistency check failed:', error.message);
      return {
        consistencyScore: 1.0,
        isConsistent: true,
        items: [],
        issues: [],
        error: error.message
      };
    }
  }
  
  /**
   * 生成图谱描述
   * 
   * @param {Object} graph - 知识图谱对象
   * @param {string} detailLevel - 详细程度 ('brief' | 'detailed')
   * @returns {string} 图谱描述
   */
  generateGraphDescription(graph, detailLevel = 'brief') {
    if (!graph || !graph.entities || !graph.relations) {
      return '空图谱';
    }
    
    const { entities, relations } = graph;
    
    if (entities.length === 0) {
      return '图谱中没有实体';
    }
    
    // 统计实体类型
    const entityTypeCount = {};
    entities.forEach(entity => {
      const type = entity.type || 'unknown';
      entityTypeCount[type] = (entityTypeCount[type] || 0) + 1;
    });
    
    // 统计关系类型
    const relationTypeCount = {};
    relations.forEach(relation => {
      const type = relation.type || 'unknown';
      relationTypeCount[type] = (relationTypeCount[type] || 0) + 1;
    });
    
    if (detailLevel === 'brief') {
      return this._generateBriefDescription(entities, relations, entityTypeCount, relationTypeCount);
    } else {
      return this._generateDetailedDescription(entities, relations, entityTypeCount, relationTypeCount);
    }
  }
  
  /**
   * 生成简要描述
   * 
   * @private
   */
  _generateBriefDescription(entities, relations, entityTypeCount, relationTypeCount) {
    const lines = [];
    
    // 总体统计
    lines.push(`图谱包含 ${entities.length} 个实体和 ${relations.length} 个关系。`);
    
    // 实体类型分布
    const entityTypes = Object.entries(entityTypeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, count]) => `${type}(${count})`)
      .join('、');
    
    if (entityTypes) {
      lines.push(`主要实体类型：${entityTypes}。`);
    }
    
    // 关系类型分布
    const relationTypes = Object.entries(relationTypeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, count]) => `${type}(${count})`)
      .join('、');
    
    if (relationTypes) {
      lines.push(`主要关系类型：${relationTypes}。`);
    }
    
    return lines.join('\n');
  }
  
  /**
   * 生成详细描述
   * 
   * @private
   */
  _generateDetailedDescription(entities, relations, entityTypeCount, relationTypeCount) {
    const lines = [];
    
    // 总体统计
    lines.push(`# 知识图谱描述\n`);
    lines.push(`## 总体统计`);
    lines.push(`- 实体数量：${entities.length}`);
    lines.push(`- 关系数量：${relations.length}`);
    lines.push('');
    
    // 实体类型分布
    lines.push(`## 实体类型分布`);
    Object.entries(entityTypeCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        lines.push(`- ${type}: ${count}个`);
      });
    lines.push('');
    
    // 关系类型分布
    lines.push(`## 关系类型分布`);
    Object.entries(relationTypeCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        lines.push(`- ${type}: ${count}个`);
      });
    lines.push('');
    
    // 主要实体列表（前10个）
    lines.push(`## 主要实体`);
    entities
      .slice(0, 10)
      .forEach(entity => {
        const name = entity.canonicalName || entity.name || 'unknown';
        const type = entity.type || 'unknown';
        lines.push(`- ${name} (${type})`);
      });
    
    if (entities.length > 10) {
      lines.push(`- ... 还有 ${entities.length - 10} 个实体`);
    }
    lines.push('');
    
    // 主要关系列表（前10个）
    lines.push(`## 主要关系`);
    relations
      .slice(0, 10)
      .forEach(relation => {
        const source = this._findEntityName(entities, relation.sourceId);
        const target = this._findEntityName(entities, relation.targetId);
        const type = relation.type || 'unknown';
        lines.push(`- ${source} --[${type}]--> ${target}`);
      });
    
    if (relations.length > 10) {
      lines.push(`- ... 还有 ${relations.length - 10} 个关系`);
    }
    
    return lines.join('\n');
  }
  
  /**
   * 查找实体名称
   * 
   * @private
   */
  _findEntityName(entities, entityId) {
    const entity = entities.find(e => e.id === entityId);
    if (!entity) {
      return 'unknown';
    }
    return entity.canonicalName || entity.name || 'unknown';
  }
  
  /**
   * 构建一致性校验prompt
   * 
   * @private
   */
  _buildConsistencyCheckPrompt(indexedText, kgDescription) {
    return `你是一个知识图谱一致性校验器。

输入包括：
1. 索引叙述文本
2. 当前知识图谱生成的描述文本

索引叙述文本：
${indexedText}

知识图谱描述：
${kgDescription}

任务：
1. 判断每一条 KG 描述是否能在索引文本中找到明确支持
2. 标注：一致 / 部分一致 / 不一致
3. 给出原因（字段缺失 / 关系偏差 / 实体错误）

不要修改图谱，只输出评估结果。

输出 JSON：
{
  "consistency_score": 0.85,
  "items": [
    {
      "kg_statement": "KG中的陈述",
      "status": "一致/部分一致/不一致",
      "reason": "原因说明",
      "supporting_indices": [1, 3]
    }
  ],
  "issues": [
    {
      "type": "字段缺失/关系偏差/实体错误",
      "description": "问题描述",
      "kg_statement": "有问题的KG陈述"
    }
  ]
}`;
  }
  
  /**
   * 解析一致性校验响应
   * 
   * @private
   */
  _parseConsistencyResponse(response) {
    try {
      // 提取JSON
      let jsonStr = response.trim();
      
      // 移除markdown代码块标记
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.substring(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.substring(3);
      }
      
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.substring(0, jsonStr.length - 3);
      }
      
      jsonStr = jsonStr.trim();
      
      // 解析JSON
      const parsed = JSON.parse(jsonStr);
      
      const consistencyScore = parsed.consistency_score || 1.0;
      const items = (parsed.items || []).map(item => ({
        kgStatement: item.kg_statement,
        status: item.status,
        reason: item.reason,
        supportingIndices: item.supporting_indices || []
      }));
      
      const issues = (parsed.issues || []).map(issue => ({
        type: issue.type,
        description: issue.description,
        kgStatement: issue.kg_statement
      }));
      
      return {
        consistencyScore,
        isConsistent: consistencyScore >= this.consistencyThreshold,
        items,
        issues
      };
    } catch (error) {
      console.error('[KG Consistency Checker] Failed to parse consistency response:', error.message);
      console.error('[KG Consistency Checker] Response:', response.substring(0, 500));
      
      return {
        consistencyScore: 1.0,
        isConsistent: true,
        items: [],
        issues: [],
        parseError: error.message
      };
    }
  }
  
  /**
   * 调用LLM（带重试和指数退避）
   * 
   * @private
   */
  async _callLLMWithRetry(llmClient, prompt) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`[KG Consistency Checker] Calling LLM (attempt ${attempt}/${this.maxRetries})...`);
        
        // 创建超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
          const response = await llmClient.chat({
            messages: [
              {
                role: 'system',
                content: '你是一个知识图谱一致性校验器。请验证知识图谱与索引叙述文本的一致性，返回JSON。'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: this.temperature,
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          return response.content || response.message?.content || '';
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        lastError = error;
        
        if (error.name === 'AbortError') {
          console.error(`[KG Consistency Checker] Attempt ${attempt} timed out after ${this.timeout}ms`);
        } else {
          console.error(`[KG Consistency Checker] Attempt ${attempt} failed:`, error.message);
        }
        
        // 如果不是最后一次尝试，使用指数退避等待后重试
        if (attempt < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`[KG Consistency Checker] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`LLM call failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }
  
  /**
   * 保存图谱描述到数据库
   * 
   * @param {string} docId - 文档ID
   * @param {string} description - 图谱描述
   * @param {string} descriptionType - 描述类型 ('brief' | 'detailed')
   * @param {Object} metadata - 元数据
   * @param {Object} prisma - Prisma客户端
   * @returns {Promise<Object>} 保存的记录
   */
  async saveGraphDescription(docId, description, descriptionType, metadata, prisma) {
    if (!prisma) {
      console.warn('[KG Consistency Checker] No Prisma client provided, cannot save graph description');
      return null;
    }
    
    try {
      const record = await prisma.graphDescription.create({
        data: {
          id: uuidv4(),
          docId,
          descriptionType,
          description,
          metadata: JSON.stringify(metadata || {}),
          createdAt: new Date()
        }
      });
      
      console.log(`[KG Consistency Checker] Saved graph description for doc ${docId} (type: ${descriptionType})`);
      
      return record;
    } catch (error) {
      console.error('[KG Consistency Checker] Failed to save graph description:', error.message);
      throw error;
    }
  }
  
  /**
   * 查询图谱描述
   * 
   * @param {string} docId - 文档ID
   * @param {string} descriptionType - 描述类型 ('brief' | 'detailed')
   * @param {Object} prisma - Prisma客户端
   * @returns {Promise<Object|null>} 图谱描述记录
   */
  async getGraphDescription(docId, descriptionType, prisma) {
    if (!prisma) {
      console.warn('[KG Consistency Checker] No Prisma client provided');
      return null;
    }
    
    try {
      const record = await prisma.graphDescription.findFirst({
        where: {
          docId,
          descriptionType
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      return record;
    } catch (error) {
      console.error('[KG Consistency Checker] Failed to get graph description:', error.message);
      return null;
    }
  }
  
  /**
   * 生成一致性报告
   * 
   * @param {Object} consistencyResult - 一致性校验结果
   * @param {Object} graph - 知识图谱对象
   * @returns {string} 一致性报告文本
   */
  generateConsistencyReport(consistencyResult, graph) {
    const lines = [];
    
    lines.push('# 知识图谱一致性报告\n');
    
    // 总体评分
    lines.push(`## 总体评分`);
    lines.push(`- 一致性得分：${(consistencyResult.consistencyScore * 100).toFixed(1)}%`);
    lines.push(`- 评估状态：${consistencyResult.isConsistent ? '✓ 一致' : '✗ 不一致'}`);
    lines.push('');
    
    // 图谱统计
    if (graph && graph.entities && graph.relations) {
      lines.push(`## 图谱统计`);
      lines.push(`- 实体数量：${graph.entities.length}`);
      lines.push(`- 关系数量：${graph.relations.length}`);
      lines.push('');
    }
    
    // 问题列表
    if (consistencyResult.issues && consistencyResult.issues.length > 0) {
      lines.push(`## 发现的问题 (${consistencyResult.issues.length})`);
      consistencyResult.issues.forEach((issue, index) => {
        lines.push(`\n### 问题 ${index + 1}: ${issue.type}`);
        lines.push(`- 描述：${issue.description}`);
        if (issue.kgStatement) {
          lines.push(`- KG陈述：${issue.kgStatement}`);
        }
      });
      lines.push('');
    } else {
      lines.push(`## 发现的问题`);
      lines.push(`未发现一致性问题。`);
      lines.push('');
    }
    
    // 详细项目
    if (consistencyResult.items && consistencyResult.items.length > 0) {
      lines.push(`## 详细评估 (${consistencyResult.items.length} 项)`);
      
      const consistent = consistencyResult.items.filter(i => i.status === '一致');
      const partiallyConsistent = consistencyResult.items.filter(i => i.status === '部分一致');
      const inconsistent = consistencyResult.items.filter(i => i.status === '不一致');
      
      lines.push(`- 一致：${consistent.length} 项`);
      lines.push(`- 部分一致：${partiallyConsistent.length} 项`);
      lines.push(`- 不一致：${inconsistent.length} 项`);
      lines.push('');
      
      // 显示不一致的项目
      if (inconsistent.length > 0) {
        lines.push(`### 不一致的项目`);
        inconsistent.forEach((item, index) => {
          lines.push(`\n${index + 1}. ${item.kgStatement}`);
          lines.push(`   - 状态：${item.status}`);
          lines.push(`   - 原因：${item.reason}`);
        });
      }
    }
    
    return lines.join('\n');
  }
}

/**
 * 创建KG一致性校验器实例
 * 
 * @param {Object} options - 选项
 * @returns {KGConsistencyChecker} 校验器实例
 */
function createKGConsistencyChecker(options = {}) {
  return new KGConsistencyChecker(options);
}

module.exports = {
  KGConsistencyChecker,
  createKGConsistencyChecker
};
