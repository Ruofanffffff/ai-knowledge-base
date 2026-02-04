/**
 * Schema Matcher V2 - 基于映射表+LLM的Schema匹配器
 * 
 * 新流程：
 * 1. 文档 → 算法提取字段（LLM语义提取）
 * 2. 映射表判断 → 命中的字段 → 在各Schema上计数
 * 3. 未命中的字段 + 所有Schema → LLM判断 → 返回命中的Schema和字段
 * 4. 合并两个结果的计数
 * 5. 对Schema进行排名
 * 6. 选择完整度>40%的Schema进行实体合成
 */

const MappingBasedNormalizer = require('../field_normalizer/mapping_based_normalizer');
const schemaManager = require('../schema/schema_manager');
const qwenClient = require('../utils/qwen_client');

class SchemaMatcherV2 {
  constructor() {
    this.mappingNormalizer = new MappingBasedNormalizer();
    this.threshold = 0.4; // 降低阈值到40%
  }

  /**
   * 匹配Schema
   * 
   * @param {Array} extractedFields - 提取的字段
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 匹配的Schema列表
   */
  async matchSchemas(extractedFields, options = {}) {
    const {
      useLLM = true,
      threshold = this.threshold
    } = options;

    console.log(`[SchemaMatcherV2] 开始Schema匹配，共${extractedFields.length}个字段`);

    // 1. 加载所有Schema
    const schemas = await schemaManager.listSchemas();
    console.log(`[SchemaMatcherV2] 加载了${schemas.length}个Schema`);

    // 2. 初始化Schema计数器
    const schemaScores = {};
    schemas.forEach(schema => {
      const coreFields = schema.core_fields || [];
      schemaScores[schema.name] = {
        schema: schema,
        mappedFields: new Set(),
        mappedFieldDetails: [],
        totalCoreFields: coreFields.length,
        totalWeight: coreFields.reduce((sum, cf) => sum + (cf.weight || 0), 0),
        mappedWeight: 0,
        completeness: 0,
        weightedCompleteness: 0
      };
    });

    // 3. 阶段1：使用映射表进行匹配
    console.log('[SchemaMatcherV2] 阶段1: 映射表匹配...');
    const unmappedFields = [];

    for (const schema of schemas) {
      try {
        const result = await this.mappingNormalizer.normalizeFields(
          extractedFields,
          schema,
          { useLLM: false } // 只用算法，不用LLM
        );

        // 统计映射成功的字段
        const coreFieldNames = (schema.core_fields || []).map(cf => cf.name);
        result.normalizedFields.forEach(nf => {
          if (nf.mappingMethod !== 'none' && coreFieldNames.includes(nf.standardName)) {
            schemaScores[schema.name].mappedFields.add(nf.standardName);
            schemaScores[schema.name].mappedFieldDetails.push({
              fieldName: nf.standardName,
              originalName: nf.originalName,
              value: nf.value,
              method: 'mapping_table',
              confidence: nf.confidence
            });

            // 计算权重
            const coreField = schema.core_fields.find(cf => cf.name === nf.standardName);
            if (coreField) {
              schemaScores[schema.name].mappedWeight += (coreField.weight || 0);
            }
          }
        });

        // 收集未映射的字段（只需要收集一次）
        if (unmappedFields.length === 0) {
          result.unmappedFields.forEach(uf => {
            if (!unmappedFields.some(f => f.name === uf.name && f.value === uf.value)) {
              unmappedFields.push(uf);
            }
          });
        }

      } catch (error) {
        console.warn(`[SchemaMatcherV2] Schema "${schema.name}" 映射失败:`, error.message);
      }
    }

    console.log(`[SchemaMatcherV2] 映射表匹配完成，未映射字段: ${unmappedFields.length}个`);

    // 4. 阶段2：使用LLM处理未映射的字段
    if (useLLM && unmappedFields.length > 0) {
      console.log('[SchemaMatcherV2] 阶段2: LLM匹配未映射字段...');
      
      try {
        const llmMatches = await this._llmMatchFields(unmappedFields, schemas);
        
        // 合并LLM匹配结果
        llmMatches.forEach(match => {
          if (schemaScores[match.schemaName]) {
            schemaScores[match.schemaName].mappedFields.add(match.fieldName);
            schemaScores[match.schemaName].mappedFieldDetails.push({
              fieldName: match.fieldName,
              originalName: match.originalFieldName,
              value: match.value,
              method: 'llm',
              confidence: match.confidence
            });

            // 计算权重
            const schema = schemaScores[match.schemaName].schema;
            const coreField = schema.core_fields.find(cf => cf.name === match.fieldName);
            if (coreField) {
              schemaScores[match.schemaName].mappedWeight += (coreField.weight || 0);
            }
          }
        });

        console.log(`[SchemaMatcherV2] LLM匹配完成，新增${llmMatches.length}个匹配`);
      } catch (error) {
        console.warn('[SchemaMatcherV2] LLM匹配失败:', error.message);
      }
    }

    // 5. 计算完整度并排序
    const rankedSchemas = [];
    
    for (const schemaName in schemaScores) {
      const score = schemaScores[schemaName];
      
      // 计算完整度
      score.completeness = score.totalCoreFields > 0 
        ? score.mappedFields.size / score.totalCoreFields 
        : 0;
      
      // 计算加权完整度
      score.weightedCompleteness = score.totalWeight > 0 
        ? score.mappedWeight / score.totalWeight 
        : 0;

      // 只保留达到阈值的Schema
      if (score.weightedCompleteness >= threshold) {
        rankedSchemas.push(score);
      }
    }

    // 按加权完整度排序
    rankedSchemas.sort((a, b) => b.weightedCompleteness - a.weightedCompleteness);

    console.log(`[SchemaMatcherV2] 匹配完成: ${rankedSchemas.length}/${schemas.length} 个Schema达到阈值`);
    
    // 输出排名结果
    rankedSchemas.forEach((score, index) => {
      console.log(
        `[SchemaMatcherV2] #${index + 1} ${score.schema.name}: ` +
        `完整度 ${(score.completeness * 100).toFixed(1)}%, ` +
        `加权完整度 ${(score.weightedCompleteness * 100).toFixed(1)}%, ` +
        `映射字段 ${score.mappedFields.size}/${score.totalCoreFields}`
      );
    });

    return rankedSchemas;
  }

  /**
   * 使用LLM匹配未映射的字段
   * 
   * @param {Array} unmappedFields - 未映射的字段
   * @param {Array} schemas - 所有Schema
   * @returns {Promise<Array>} LLM匹配结果
   */
  async _llmMatchFields(unmappedFields, schemas) {
    // 构建Prompt
    const prompt = this._buildLLMMatchPrompt(unmappedFields, schemas);
    
    try {
      const response = await qwenClient.chat([
        {
          role: 'system',
          content: '你是一个专业的字段映射助手。你的任务是判断提取的字段在哪些Schema的哪些字段上有匹配。'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: 0.1,
        maxTokens: 2000
      });

      // 解析LLM响应
      const matches = this._parseLLMResponse(response);
      return matches;

    } catch (error) {
      console.error('[SchemaMatcherV2] LLM调用失败:', error);
      return [];
    }
  }

  /**
   * 构建LLM匹配Prompt
   */
  _buildLLMMatchPrompt(unmappedFields, schemas) {
    // 构建字段列表
    const fieldsList = unmappedFields.map((f, i) => 
      `${i + 1}. ${f.name}: ${f.value}`
    ).join('\n');

    // 构建Schema列表
    const schemasList = schemas.map(schema => {
      const coreFields = (schema.core_fields || []).map(cf => cf.name).join(', ');
      return `- ${schema.name}: [${coreFields}]`;
    }).join('\n');

    return `请判断以下提取的字段在哪些Schema的哪些字段上有匹配。

## 提取的字段
${fieldsList}

## 可用的Schema及其核心字段
${schemasList}

## 任务要求
1. 对每个提取的字段，判断它可能匹配哪个Schema的哪个字段
2. 只输出有明确匹配的结果
3. 每个字段可以匹配多个Schema
4. 给出匹配的置信度（0-1）

## 输出格式
请严格按照以下JSON格式输出：

{
  "matches": [
    {
      "originalFieldName": "提取的字段名",
      "value": "字段值",
      "schemaName": "Schema名称",
      "fieldName": "Schema中的字段名",
      "confidence": 0.9,
      "reason": "匹配理由"
    }
  ]
}

如果没有匹配，返回：
{
  "matches": []
}`;
  }

  /**
   * 解析LLM响应
   */
  _parseLLMResponse(response) {
    try {
      // 提取JSON内容
      const content = response.content || response;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        console.warn('[SchemaMatcherV2] LLM响应中未找到JSON');
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.matches || [];

    } catch (error) {
      console.error('[SchemaMatcherV2] 解析LLM响应失败:', error);
      return [];
    }
  }

  /**
   * 获取匹配统计
   */
  getMatchStats(rankedSchemas) {
    if (rankedSchemas.length === 0) {
      return {
        totalSchemas: 0,
        avgCompleteness: 0,
        avgWeightedCompleteness: 0,
        bestMatch: null
      };
    }

    return {
      totalSchemas: rankedSchemas.length,
      avgCompleteness: rankedSchemas.reduce((sum, s) => sum + s.completeness, 0) / rankedSchemas.length,
      avgWeightedCompleteness: rankedSchemas.reduce((sum, s) => sum + s.weightedCompleteness, 0) / rankedSchemas.length,
      bestMatch: {
        name: rankedSchemas[0].schema.name,
        completeness: rankedSchemas[0].completeness,
        weightedCompleteness: rankedSchemas[0].weightedCompleteness,
        mappedFields: rankedSchemas[0].mappedFields.size,
        totalFields: rankedSchemas[0].totalCoreFields
      }
    };
  }
}

module.exports = SchemaMatcherV2;
