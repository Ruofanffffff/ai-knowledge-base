/**
 * 为所有Schema补充核心字段
 * 
 * 使用LLM智能生成合适的补充字段，确保每个Schema至少有5个核心字段
 */

const { PrismaClient } = require('@prisma/client');
const QwenClient = require('../utils/qwen_client');

const prisma = new PrismaClient();
const qwenClient = new QwenClient();

// 生成补充字段的Prompt
function generateSupplementPrompt(schema, existingFields, fieldsNeeded) {
  return `你是一个知识图谱Schema设计专家。请为以下Schema补充${fieldsNeeded}个核心字段。

Schema信息:
- 名称: ${schema.name}
- 场景: ${schema.scene || '通用'}
- 实体类型: ${schema.entityType}
- 现有字段: ${existingFields.map(f => f.name).join(', ')}

要求:
1. 补充的字段必须与Schema的主题和场景高度相关
2. 字段名使用英文，采用PascalCase命名（如：FieldName）
3. 每个字段需要设置合理的权重（0.05-0.3之间）
4. 标记是否为必需字段（required: true/false）
5. 提供简短的中文描述
6. 补充的字段应该是该领域常见且重要的属性

请严格按照以下JSON格式返回，不要包含任何其他文字：
{
  "fields": [
    {
      "name": "字段名（英文PascalCase）",
      "weight": 0.1,
      "required": false,
      "description": "字段描述（中文）"
    }
  ]
}`;
}

async function supplementCoreFields() {
  console.log('开始为Schema补充核心字段...\n');

  try {
    // 1. 读取所有Schema
    const allSchemas = await prisma.schema.findMany({
      select: {
        id: true,
        name: true,
        scene: true,
        entityType: true,
        coreFields: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log(`✓ 数据库中共有 ${allSchemas.length} 个Schema\n`);

    // 2. 筛选需要补充字段的Schema
    const needSupplement = [];
    for (const schema of allSchemas) {
      const coreFields = schema.coreFields ? JSON.parse(schema.coreFields) : [];
      if (coreFields.length < 5) {
        needSupplement.push({
          ...schema,
          existingFields: coreFields,
          fieldsNeeded: 5 - coreFields.length
        });
      }
    }

    console.log(`需要补充字段的Schema数: ${needSupplement.length}\n`);

    // 3. 批量处理（每次处理10个）
    const batchSize = 10;
    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < needSupplement.length; i += batchSize) {
      const batch = needSupplement.slice(i, i + batchSize);
      
      console.log(`\n处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(needSupplement.length / batchSize)} (${batch.length} 个Schema)...`);

      for (const schema of batch) {
        try {
          // 生成Prompt
          const prompt = generateSupplementPrompt(
            schema,
            schema.existingFields,
            schema.fieldsNeeded
          );

          // 调用LLM
          const response = await qwenClient.call(prompt, {
            temperature: 0.7,
            max_tokens: 1000
          });

          // 解析响应
          let supplementFields;
          try {
            // 尝试直接解析JSON
            supplementFields = JSON.parse(response);
          } catch (e) {
            // 如果失败，尝试提取JSON部分
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              supplementFields = JSON.parse(jsonMatch[0]);
            } else {
              throw new Error('无法解析LLM响应');
            }
          }

          // 验证响应格式
          if (!supplementFields.fields || !Array.isArray(supplementFields.fields)) {
            throw new Error('响应格式不正确');
          }

          // 合并字段
          const newCoreFields = [
            ...schema.existingFields,
            ...supplementFields.fields.slice(0, schema.fieldsNeeded)
          ];

          // 更新数据库
          await prisma.schema.update({
            where: { id: schema.id },
            data: {
              coreFields: JSON.stringify(newCoreFields)
            }
          });

          console.log(`  ✓ ${schema.name}: 补充了 ${supplementFields.fields.length} 个字段`);
          successCount++;

        } catch (error) {
          console.error(`  ✗ ${schema.name}: ${error.message}`);
          failedCount++;
        }

        processedCount++;

        // 进度显示
        if (processedCount % 50 === 0) {
          console.log(`\n进度: ${processedCount}/${needSupplement.length} (${(processedCount / needSupplement.length * 100).toFixed(1)}%)`);
          console.log(`成功: ${successCount}, 失败: ${failedCount}\n`);
        }

        // 避免API限流
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log('\n\n================================================================================');
    console.log('📊 补充结果');
    console.log('================================================================================\n');

    console.log(`处理的Schema数: ${processedCount}`);
    console.log(`成功: ${successCount}`);
    console.log(`失败: ${failedCount}`);
    console.log(`成功率: ${(successCount / processedCount * 100).toFixed(1)}%\n`);

    // 4. 验证结果
    const updatedSchemas = await prisma.schema.findMany({
      select: {
        name: true,
        coreFields: true
      }
    });

    let totalFields = 0;
    let schemasWithEnoughFields = 0;

    for (const schema of updatedSchemas) {
      const coreFields = schema.coreFields ? JSON.parse(schema.coreFields) : [];
      totalFields += coreFields.length;
      if (coreFields.length >= 5) {
        schemasWithEnoughFields++;
      }
    }

    const avgFields = totalFields / updatedSchemas.length;

    console.log('================================================================================');
    console.log('✅ 最终验证');
    console.log('================================================================================\n');

    console.log(`总Schema数: ${updatedSchemas.length}`);
    console.log(`总字段数: ${totalFields}`);
    console.log(`平均字段数: ${avgFields.toFixed(2)}`);
    console.log(`字段数>=5的Schema: ${schemasWithEnoughFields} (${(schemasWithEnoughFields / updatedSchemas.length * 100).toFixed(1)}%)\n`);

    if (avgFields >= 5.0) {
      console.log('✅ 目标达成！平均字段数已达到5个以上');
    } else {
      console.log(`⚠️  还需要继续补充，当前平均字段数: ${avgFields.toFixed(2)}`);
    }

  } catch (error) {
    console.error('补充失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行补充
supplementCoreFields();
