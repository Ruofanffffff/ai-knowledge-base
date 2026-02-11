/**
 * 批量为Schema补充核心字段
 * 
 * 使用预定义的通用字段模板，快速补充所有Schema的核心字段
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

// 通用字段模板（按场景分类）
const fieldTemplates = {
  // 摄影相关
  '摄影': [
    { name: 'Location', weight: 0.1, required: false, description: '拍摄地点' },
    { name: 'Date', weight: 0.1, required: false, description: '拍摄日期' },
    { name: 'Weather', weight: 0.05, required: false, description: '天气条件' },
    { name: 'Notes', weight: 0.05, required: false, description: '备注说明' },
    { name: 'Rating', weight: 0.05, required: false, description: '评分' }
  ],
  '后期': [
    { name: 'Software', weight: 0.1, required: false, description: '使用软件' },
    { name: 'Duration', weight: 0.05, required: false, description: '处理时长' },
    { name: 'Difficulty', weight: 0.05, required: false, description: '难度等级' },
    { name: 'Notes', weight: 0.05, required: false, description: '备注说明' },
    { name: 'Result', weight: 0.1, required: false, description: '处理结果' }
  ],
  // 人工智能相关
  '人工智能': [
    { name: 'Framework', weight: 0.1, required: false, description: '使用框架' },
    { name: 'Duration', weight: 0.05, required: false, description: '执行时长' },
    { name: 'Status', weight: 0.1, required: false, description: '状态' },
    { name: 'Notes', weight: 0.05, required: false, description: '备注说明' },
    { name: 'Timestamp', weight: 0.05, required: false, description: '时间戳' }
  ],
  // 科研学术相关
  '科研': [
    { name: 'Researcher', weight: 0.1, required: false, description: '研究人员' },
    { name: 'Date', weight: 0.1, required: false, description: '日期' },
    { name: 'Status', weight: 0.05, required: false, description: '状态' },
    { name: 'Notes', weight: 0.05, required: false, description: '备注说明' },
    { name: 'Reference', weight: 0.05, required: false, description: '参考文献' }
  ],
  '学术': [
    { name: 'Author', weight: 0.1, required: false, description: '作者' },
    { name: 'Date', weight: 0.1, required: false, description: '日期' },
    { name: 'Source', weight: 0.1, required: false, description: '来源' },
    { name: 'Notes', weight: 0.05, required: false, description: '备注说明' },
    { name: 'Tags', weight: 0.05, required: false, description: '标签' }
  ],
  // 政府相关
  '政府': [
    { name: 'Department', weight: 0.1, required: false, description: '部门' },
    { name: 'Date', weight: 0.1, required: false, description: '日期' },
    { name: 'Status', weight: 0.1, required: false, description: '状态' },
    { name: 'Notes', weight: 0.05, required: false, description: '备注说明' },
    { name: 'Priority', weight: 0.05, required: false, description: '优先级' }
  ],
  // 个人生活相关
  '个人生活': [
    { name: 'Date', weight: 0.15, required: false, description: '日期' },
    { name: 'Location', weight: 0.05, required: false, description: '地点' },
    { name: 'Mood', weight: 0.05, required: false, description: '心情' },
    { name: 'Notes', weight: 0.05, required: false, description: '备注说明' },
    { name: 'Tags', weight: 0.05, required: false, description: '标签' }
  ],
  // 运动相关
  '运动': [
    { name: 'Weather', weight: 0.05, required: false, description: '天气' },
    { name: 'Feeling', weight: 0.05, required: false, description: '感受' },
    { name: 'Notes', weight: 0.05, required: false, description: '备注说明' },
    { name: 'Calories', weight: 0.05, required: false, description: '消耗卡路里' },
    { name: 'HeartRate', weight: 0.05, required: false, description: '心率' }
  ],
  // 旅行相关
  '旅行': [
    { name: 'Weather', weight: 0.05, required: false, description: '天气' },
    { name: 'Cost', weight: 0.1, required: false, description: '费用' },
    { name: 'Companions', weight: 0.05, required: false, description: '同行人' },
    { name: 'Notes', weight: 0.05, required: false, description: '备注说明' },
    { name: 'Photos', weight: 0.05, required: false, description: '照片数量' }
  ],
  // 休闲娱乐相关
  '休闲': [
    { name: 'Mood', weight: 0.1, required: false, description: '心情' },
    { name: 'Companions', weight: 0.05, required: false, description: '同伴' },
    { name: 'Cost', weight: 0.05, required: false, description: '费用' },
    { name: 'Notes', weight: 0.05, required: false, description: '备注说明' },
    { name: 'Rating', weight: 0.1, required: false, description: '评分' }
  ],
  '娱乐': [
    { name: 'Mood', weight: 0.1, required: false, description: '心情' },
    { name: 'Companions', weight: 0.05, required: false, description: '同伴' },
    { name: 'Cost', weight: 0.05, required: false, description: '费用' },
    { name: 'Notes', weight: 0.05, required: false, description: '备注说明' },
    { name: 'Rating', weight: 0.1, required: false, description: '评分' }
  ],
  // 软件开发相关
  '软件开发': [
    { name: 'Author', weight: 0.1, required: false, description: '作者' },
    { name: 'Date', weight: 0.1, required: false, description: '日期' },
    { name: 'Status', weight: 0.1, required: false, description: '状态' },
    { name: 'Notes', weight: 0.05, required: false, description: '备注说明' },
    { name: 'Version', weight: 0.05, required: false, description: '版本' }
  ],
  // 通用字段（作为后备）
  'default': [
    { name: 'Date', weight: 0.1, required: false, description: '日期' },
    { name: 'Status', weight: 0.1, required: false, description: '状态' },
    { name: 'Notes', weight: 0.05, required: false, description: '备注说明' },
    { name: 'Tags', weight: 0.05, required: false, description: '标签' },
    { name: 'Priority', weight: 0.05, required: false, description: '优先级' }
  ]
};

// 根据场景选择合适的字段模板
function selectFieldTemplate(scene) {
  if (!scene) return fieldTemplates['default'];
  
  // 尝试精确匹配
  if (fieldTemplates[scene]) {
    return fieldTemplates[scene];
  }
  
  // 尝试部分匹配
  for (const [key, template] of Object.entries(fieldTemplates)) {
    if (scene.includes(key) || key.includes(scene)) {
      return template;
    }
  }
  
  // 返回默认模板
  return fieldTemplates['default'];
}

async function supplementCoreFieldsBatch() {
  console.log('开始批量补充Schema核心字段...\n');

  try {
    // 1. 读取所有Schema
    const allSchemas = await prisma.schema.findMany({
      select: {
        id: true,
        name: true,
        scene: true,
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

    // 3. 批量补充
    let successCount = 0;
    let failedCount = 0;
    const updates = [];

    for (const schema of needSupplement) {
      try {
        // 选择合适的字段模板
        const template = selectFieldTemplate(schema.scene);
        
        // 获取现有字段名
        const existingFieldNames = new Set(schema.existingFields.map(f => f.name));
        
        // 选择不重复的字段
        const supplementFields = [];
        for (const field of template) {
          if (!existingFieldNames.has(field.name) && supplementFields.length < schema.fieldsNeeded) {
            supplementFields.push(field);
          }
        }
        
        // 如果模板字段不够，使用默认模板
        if (supplementFields.length < schema.fieldsNeeded) {
          const defaultTemplate = fieldTemplates['default'];
          for (const field of defaultTemplate) {
            if (!existingFieldNames.has(field.name) && supplementFields.length < schema.fieldsNeeded) {
              supplementFields.push(field);
            }
          }
        }
        
        // 合并字段
        const newCoreFields = [
          ...schema.existingFields,
          ...supplementFields
        ];
        
        updates.push({
          id: schema.id,
          name: schema.name,
          coreFields: JSON.stringify(newCoreFields),
          supplemented: supplementFields.length
        });
        
        successCount++;
        
      } catch (error) {
        console.error(`✗ ${schema.name}: ${error.message}`);
        failedCount++;
      }
    }

    console.log(`准备更新 ${updates.length} 个Schema...\n`);

    // 4. 批量更新数据库
    for (const update of updates) {
      await prisma.schema.update({
        where: { id: update.id },
        data: {
          coreFields: update.coreFields
        }
      });
      
      console.log(`✓ ${update.name}: 补充了 ${update.supplemented} 个字段`);
    }

    console.log('\n\n================================================================================');
    console.log('📊 补充结果');
    console.log('================================================================================\n');

    console.log(`处理的Schema数: ${needSupplement.length}`);
    console.log(`成功: ${successCount}`);
    console.log(`失败: ${failedCount}`);
    console.log(`成功率: ${(successCount / needSupplement.length * 100).toFixed(1)}%\n`);

    // 5. 验证结果
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

    // 6. 保存补充报告
    const report = {
      timestamp: new Date().toISOString(),
      totalSchemas: updatedSchemas.length,
      supplementedSchemas: successCount,
      totalFields: totalFields,
      avgFields: avgFields,
      schemasWithEnoughFields: schemasWithEnoughFields,
      updates: updates.map(u => ({
        name: u.name,
        supplemented: u.supplemented
      }))
    };

    const reportPath = path.join(__dirname, 'supplement_report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\n✓ 补充报告已保存: ${reportPath}`);

  } catch (error) {
    console.error('补充失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行补充
supplementCoreFieldsBatch();
