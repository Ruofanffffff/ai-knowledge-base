/**
 * 测试数据4 - 增强版测试
 * 强制使用LLM进行深度字段提取
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { createQwenClient } = require('../utils/qwen_client');
const { buildEntity, setLLMClient } = require('../entity/entity_builder');

const prisma = new PrismaClient();

// 测试数据4内容
const testData4Content = fs.readFileSync(path.join(__dirname, '../../测试数据4.md'), 'utf-8');

async function testData4Enhanced() {
  console.log('=== 测试数据4 - 增强版LLM深度提取 ===\n');

  const startTime = Date.now();

  try {
    // 1. 初始化LLM客户端
    console.log('1. 初始化LLM客户端...');
    const apiKey = process.env.QWEN_API_KEY;
    if (!apiKey) {
      throw new Error('未配置QWEN_API_KEY');
    }
    const llmClient = createQwenClient(apiKey);
    
    // 设置EntityBuilder的LLM客户端
    setLLMClient(llmClient);
    
    console.log('✓ LLM客户端初始化完成\n');

    // 2. 强制LLM字段提取
    console.log('2. 执行LLM深度字段提取...');
    console.log(`   文档长度: ${testData4Content.length} 字符`);
    
    const extractionPrompt = `请仔细分析以下AI爬虫工具需求文档,提取所有关键信息字段。

文档内容:
${testData4Content}

请提取以下类型的字段:
1. **模块名称**: 所有提到的系统模块(如:数据采集模块、页面交互模块等)
2. **功能特性**: 所有功能点和特性(如:智能搜索、知识库、信息总结等)
3. **技术栈**: 所有提到的技术、框架、工具(如:Crawl4AI、Weaviate、DeepSeek、MCP等)
4. **架构设计**: 架构模式和设计原则(如:C/S架构、MCP架构等)
5. **业务流程**: 工作流程和业务逻辑
6. **优化点**: 需要优化的内容
7. **接口和API**: 提到的接口和API
8. **数据结构**: 数据模型和结构

请以JSON格式返回,格式如下:
\`\`\`json
{
  "modules": [{"name": "模块名", "function": "功能描述", "technology": "使用技术"}],
  "features": [{"name": "功能名", "description": "功能描述"}],
  "technologies": [{"name": "技术名", "category": "类别", "purpose": "用途"}],
  "architectures": [{"name": "架构名", "pattern": "模式", "components": "组成"}],
  "workflows": [{"name": "流程名", "steps": "步骤描述"}],
  "optimizations": [{"area": "优化领域", "description": "优化内容"}]
}
\`\`\`

要求:
- 尽可能详细和全面
- 提取所有明确提到的内容
- 保持原文的准确性`;

    const extractionStart = Date.now();
    const llmResponse = await llmClient.callJSON(extractionPrompt, {
      maxTokens: 4000,
      temperature: 0.3,
      systemPrompt: '你是一个专业的需求分析专家,擅长从需求文档中提取结构化信息。'
    });
    const extractionDuration = Date.now() - extractionStart;

    console.log(`✓ LLM提取完成 (耗时: ${extractionDuration}ms)`);
    console.log(`  Token使用: ${llmResponse._meta.tokens}`);
    console.log(`  提取结果预览:`);
    console.log(`  - 模块数: ${llmResponse.modules?.length || 0}`);
    console.log(`  - 功能数: ${llmResponse.features?.length || 0}`);
    console.log(`  - 技术数: ${llmResponse.technologies?.length || 0}`);
    console.log(`  - 架构数: ${llmResponse.architectures?.length || 0}`);
    console.log(`  - 流程数: ${llmResponse.workflows?.length || 0}`);
    console.log(`  - 优化点数: ${llmResponse.optimizations?.length || 0}\n`);

    // 3. 转换为标准字段格式
    console.log('3. 转换为标准字段格式...');
    const extractedFields = [];

    // 转换模块
    if (llmResponse.modules) {
      llmResponse.modules.forEach(module => {
        // 主字段
        extractedFields.push({
          name: 'ModuleName',
          value: module.name,
          type: 'module',
          confidence: 0.95,
          metadata: {
            function: module.function,
            technology: module.technology
          }
        });
        
        // 将metadata中的信息也作为独立字段
        if (module.function) {
          extractedFields.push({
            name: 'Function',
            value: module.function,
            type: 'module',
            confidence: 0.95,
            relatedTo: module.name
          });
        }
        
        if (module.technology) {
          extractedFields.push({
            name: 'Technology',
            value: module.technology,
            type: 'module',
            confidence: 0.95,
            relatedTo: module.name
          });
        }
      });
    }

    // 转换功能
    if (llmResponse.features) {
      llmResponse.features.forEach(feature => {
        // 主字段
        extractedFields.push({
          name: 'FeatureName',
          value: feature.name,
          type: 'feature',
          confidence: 0.95,
          metadata: {
            description: feature.description
          }
        });
        
        // Description作为独立字段
        if (feature.description) {
          extractedFields.push({
            name: 'Description',
            value: feature.description,
            type: 'feature',
            confidence: 0.95,
            relatedTo: feature.name
          });
        }
      });
    }

    // 转换技术
    if (llmResponse.technologies) {
      llmResponse.technologies.forEach(tech => {
        // 主字段
        extractedFields.push({
          name: 'TechnologyName',
          value: tech.name,
          type: 'technology',
          confidence: 0.95,
          metadata: {
            category: tech.category,
            purpose: tech.purpose
          }
        });
        
        // Category和Purpose作为独立字段
        if (tech.category) {
          extractedFields.push({
            name: 'Category',
            value: tech.category,
            type: 'technology',
            confidence: 0.95,
            relatedTo: tech.name
          });
        }
        
        if (tech.purpose) {
          extractedFields.push({
            name: 'Purpose',
            value: tech.purpose,
            type: 'technology',
            confidence: 0.95,
            relatedTo: tech.name
          });
        }
      });
    }

    // 转换架构
    if (llmResponse.architectures) {
      llmResponse.architectures.forEach(arch => {
        // 主字段
        extractedFields.push({
          name: 'ArchitectureName',
          value: arch.name,
          type: 'architecture',
          confidence: 0.95,
          metadata: {
            pattern: arch.pattern,
            components: arch.components
          }
        });
        
        // Pattern和Components作为独立字段
        if (arch.pattern) {
          extractedFields.push({
            name: 'Pattern',
            value: arch.pattern,
            type: 'architecture',
            confidence: 0.95,
            relatedTo: arch.name
          });
        }
        
        if (arch.components) {
          extractedFields.push({
            name: 'Components',
            value: arch.components,
            type: 'architecture',
            confidence: 0.95,
            relatedTo: arch.name
          });
        }
      });
    }

    console.log(`✓ 转换完成,共 ${extractedFields.length} 个字段\n`);

    // 4. Schema匹配
    console.log('4. 执行Schema匹配...');
    const allSchemas = await prisma.schema.findMany({
      where: { active: true }
    });

    // 优先匹配新创建的需求文档Schema
    const prioritySchemas = [
      'Software-Requirement',
      'System-Module',
      'Technical-Stack',
      'Feature-Specification',
      'Architecture-Design'
    ];

    console.log(`   提取的字段名称: ${[...new Set(extractedFields.map(f => f.name))].join(', ')}\n`);

    const matchedSchemas = [];
    for (const schemaName of prioritySchemas) {
      const schema = allSchemas.find(s => s.name === schemaName);
      if (schema) {
        // 解析core_fields
        const coreFields = JSON.parse(schema.coreFields);
        
        console.log(`   检查Schema: ${schemaName}`);
        console.log(`   Schema字段: ${coreFields.map(f => f.name).join(', ')}`);
        
        // 计算匹配度
        let matchedFieldCount = 0;
        const normalizedFields = [];

        coreFields.forEach(field => {
          const matchingFields = extractedFields.filter(f => f.name === field.name);
          if (matchingFields.length > 0) {
            matchedFieldCount++;
            console.log(`     ✓ 匹配字段: ${field.name} (${matchingFields.length}个)`);
            matchingFields.forEach(mf => {
              normalizedFields.push({
                name: field.name,
                originalName: mf.name,
                standardName: field.name,
                value: mf.value,
                confidence: mf.confidence,
                mappingMethod: 'llm_extraction',
                source: 'llm',
                metadata: mf.metadata
              });
            });
          }
        });

        const completeness = matchedFieldCount / coreFields.length;
        
        console.log(`   完整度: ${(completeness * 100).toFixed(1)}% (阈值: ${(schema.threshold * 100).toFixed(1)}%)\n`);
        
        if (completeness >= schema.threshold) {
          matchedSchemas.push({
            schema,
            schema_name: schema.name,
            completeness,
            matchedFields: matchedFieldCount,
            totalFields: coreFields.length,
            normalizedFields
          });
        }
      }
    }

    console.log(`✓ 匹配到 ${matchedSchemas.length} 个Schema:`);
    matchedSchemas.forEach(m => {
      console.log(`  - ${m.schema_name}: ${(m.completeness * 100).toFixed(1)}% (${m.matchedFields}/${m.totalFields})`);
    });
    console.log('');

    // 5. 实体构建
    console.log('5. 构建实体...');
    const entities = [];

    for (const matched of matchedSchemas) {
      // 使用标准EntityBuilder构建实体
      // 需要为每个Schema构建一个或多个实体
      
      // 按标识字段分组 (ModuleName, FeatureName, TechnologyName, ArchitectureName)
      const identifierFields = ['ModuleName', 'FeatureName', 'TechnologyName', 'ArchitectureName'];
      
      // 找出所有标识字段
      const identifierFieldsInData = matched.normalizedFields.filter(f => 
        identifierFields.includes(f.name)
      );
      
      if (identifierFieldsInData.length === 0) {
        console.log(`  ⚠️  Schema ${matched.schema_name} 没有找到标识字段,跳过`);
        continue;
      }
      
      // 按标识字段值分组
      const entityGroups = {};
      identifierFieldsInData.forEach(identifierField => {
        const key = identifierField.value;
        if (!entityGroups[key]) {
          entityGroups[key] = {
            identifierField: identifierField,
            fields: [identifierField] // 初始化时包含标识字段本身
          };
        }
      });
      
      // 将所有字段分配到对应的实体组
      matched.normalizedFields.forEach(field => {
        // 跳过已经添加的标识字段
        if (identifierFields.includes(field.name)) {
          return;
        }
        
        // 非标识字段,需要根据relatedTo关联到对应的实体
        if (field.relatedTo) {
          // 如果有relatedTo,添加到对应的组
          if (entityGroups[field.relatedTo]) {
            entityGroups[field.relatedTo].fields.push(field);
          }
        } else {
          // 如果没有relatedTo,添加到所有组(这是一个fallback)
          Object.values(entityGroups).forEach(group => {
            group.fields.push(field);
          });
        }
      });
      
      // 为每个实体组构建实体
      for (const [entityName, group] of Object.entries(entityGroups)) {
        // 构建CKB对象(简化版)
        const ckb = {
          ckb_id: `test_data4_${Date.now()}`,
          doc_id: 'test_data4',
          content: {
            text: testData4Content
          }
        };
        
        // 构建schemaScore对象
        const schemaScore = {
          schema: {
            ...matched.schema,
            core_fields: JSON.parse(matched.schema.coreFields), // 解析coreFields
            entity_type: matched.schema.entityType,
            schema_name: matched.schema.name
          },
          schema_name: matched.schema_name,
          completeness: matched.completeness,
          confidence: matched.completeness
        };
        
        try {
          // 使用标准buildEntity函数
          const entity = await buildEntity(
            schemaScore,
            group.fields,
            ckb,
            {
              useLLM: false, // 暂时不使用LLM增强(避免额外token消耗)
              llmProbability: 0
            }
          );
          
          // 调试输出
          console.log(`  [DEBUG] Entity:`, {
            canonical_name: entity.canonical_name,
            entity_type: entity.entity_type,
            attributes: Object.keys(entity.attributes || {})
          });
          
          entities.push({
            name: entity.canonical_name || entityName, // 使用entityName作为fallback
            type: entity.entity_type,
            schema_name: matched.schema_name,
            properties: entity.attributes,
            confidence: entity.confidence,
            aliases: entity.aliases || [],
            llm_enhanced: entity.llm_enriched || false
          });
          
          console.log(`  ✓ 构建实体: ${entity.canonical_name || entityName} (${entity.entity_type})`);
        } catch (error) {
          console.error(`  ❌ 构建实体失败 (${entityName}):`, error.message);
        }
      }
    }

    console.log(`✓ 构建了 ${entities.length} 个实体\n`);

    // 6. 保存结果
    console.log('6. 保存结果到数据库...');
    
    // 使用事务保存
    await prisma.$transaction(async (tx) => {
      // 保存实体
      for (const entity of entities) {
        await tx.entity.create({
          data: {
            name: entity.name,
            type: entity.type,
            description: `Schema: ${entity.schema_name}`,
            metadata: JSON.stringify({
              properties: entity.properties,
              confidence: entity.confidence,
              source: 'llm_extraction',
              schema_name: entity.schema_name,
              aliases: entity.aliases,
              llm_enhanced: entity.llm_enhanced
            })
          }
        });
      }
    });

    console.log(`✓ 保存完成: ${entities.length} 个实体\n`);

    // 7. 生成报告
    const totalDuration = Date.now() - startTime;
    
    const report = {
      document: {
        title: 'AI爬虫工具需求文档',
        length: testData4Content.length
      },
      extraction: {
        method: 'LLM深度提取',
        duration: extractionDuration,
        tokenUsage: llmResponse._meta.tokens,
        fieldsExtracted: extractedFields.length,
        breakdown: {
          modules: llmResponse.modules?.length || 0,
          features: llmResponse.features?.length || 0,
          technologies: llmResponse.technologies?.length || 0,
          architectures: llmResponse.architectures?.length || 0,
          workflows: llmResponse.workflows?.length || 0,
          optimizations: llmResponse.optimizations?.length || 0
        }
      },
      schemaMatching: {
        matched: matchedSchemas.length,
        schemas: matchedSchemas.map(m => ({
          name: m.schema_name,
          completeness: m.completeness,
          fields: `${m.matchedFields}/${m.totalFields}`
        }))
      },
      entities: {
        total: entities.length,
        byType: {}
      },
      performance: {
        totalDuration,
        extractionDuration
      }
    };

    // 统计实体类型
    entities.forEach(e => {
      if (!report.entities.byType[e.type]) {
        report.entities.byType[e.type] = 0;
      }
      report.entities.byType[e.type]++;
    });

    // 保存报告
    const reportPath = path.join(__dirname, 'test_result_data4_enhanced.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      report,
      fullExtraction: llmResponse,
      extractedFields,
      matchedSchemas,
      entities
    }, null, 2));

    console.log('=== 测试完成 ===\n');
    console.log('📊 结果总结:');
    console.log(`✓ 字段提取: ${extractedFields.length}个 (vs 之前的15个)`);
    console.log(`✓ Schema匹配: ${matchedSchemas.length}个`);
    console.log(`✓ 实体构建: ${entities.length}个`);
    console.log(`✓ Token使用: ${llmResponse._meta.tokens}`);
    console.log(`✓ 总耗时: ${totalDuration}ms`);
    console.log(`\n报告已保存: ${reportPath}\n`);

    return report;

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('错误堆栈:', error.stack);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
if (require.main === module) {
  testData4Enhanced()
    .then(() => {
      console.log('测试成功完成!');
      process.exit(0);
    })
    .catch(error => {
      console.error('测试失败:', error);
      process.exit(1);
    });
}

module.exports = { testData4Enhanced };
