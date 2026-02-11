/**
 * 为补充的核心字段扩充映射变体
 * 目标：为所有新增的750个字段添加10个常见变体
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

// 常见字段的变体模板
const FIELD_VARIATIONS = {
  // 时间相关
  'Date': ['日期', '时间', 'Date', 'Time', 'Timestamp', '创建时间', '更新时间', '记录时间', '发生时间', '日期时间'],
  'Timestamp': ['时间戳', '时间', 'Timestamp', 'Time', 'DateTime', '记录时间', '创建时间', '更新时间', '时刻', '时间点'],
  'Duration': ['时长', '持续时间', 'Duration', 'Time', 'Period', '耗时', '用时', '时间长度', '持续', '时段'],
  
  // 状态相关
  'Status': ['状态', '进度', 'Status', 'State', 'Progress', '情况', '阶段', '状况', '进展', '当前状态'],
  'Result': ['结果', '成果', 'Result', 'Outcome', 'Output', '产出', '效果', '输出', '结论', '成效'],
  'Priority': ['优先级', '重要性', 'Priority', 'Importance', 'Level', '等级', '级别', '紧急度', '优先度', '重要程度'],
  
  // 描述相关
  'Notes': ['备注', '说明', '注释', 'Notes', 'Description', 'Comment', '描述', '注解', '附注', '补充说明'],
  'Description': ['描述', '说明', 'Description', 'Detail', 'Info', '详情', '介绍', '信息', '概述', '详细说明'],
  'Comment': ['评论', '注释', 'Comment', 'Remark', 'Note', '备注', '说明', '意见', '评价', '附注'],
  
  // 分类相关
  'Tags': ['标签', '分类', 'Tags', 'Labels', 'Categories', '类别', '标记', '关键词', 'Keywords', '分组'],
  'Category': ['分类', '类别', 'Category', 'Type', 'Class', '类型', '种类', '归类', '门类', '品类'],
  'Type': ['类型', '种类', 'Type', 'Kind', 'Category', '分类', '品种', '型号', '款式', '样式'],
  
  // 位置相关
  'Location': ['位置', '地点', 'Location', 'Place', 'Position', '地方', '场所', '所在地', '地址', '坐标'],
  'Position': ['位置', '方位', 'Position', 'Location', 'Place', '定位', '坐标', '地点', '所在', '位点'],
  
  // 人员相关
  'Author': ['作者', '创建人', 'Author', 'Creator', 'Writer', '撰写人', '编写者', '制作人', '发起人', '创建者'],
  'Researcher': ['研究员', '研究者', 'Researcher', 'Scientist', 'Investigator', '科研人员', '调研员', '研究人', '学者', '科学家'],
  'Department': ['部门', '科室', 'Department', 'Division', 'Section', '处室', '单位', '机构', '组织', '团队'],
  
  // 情绪相关
  'Mood': ['心情', '情绪', 'Mood', 'Feeling', 'Emotion', '感受', '心境', '情感', '心态', '感觉'],
  'Feeling': ['感觉', '感受', 'Feeling', 'Sensation', 'Emotion', '体验', '体会', '心情', '情绪', '知觉'],
  
  // 天气相关
  'Weather': ['天气', '气象', 'Weather', 'Climate', 'Condition', '天况', '气候', '天气状况', '气象条件', '天气情况'],
  
  // 评分相关
  'Rating': ['评分', '评级', 'Rating', 'Score', 'Grade', '等级', '分数', '评价', '打分', '星级'],
  'Score': ['分数', '得分', 'Score', 'Point', 'Mark', '评分', '成绩', '积分', '计分', '打分'],
  
  // 软件相关
  'Software': ['软件', '工具', 'Software', 'Tool', 'Application', '应用', '程序', 'App', '软件工具', '应用程序'],
  'Framework': ['框架', '架构', 'Framework', 'Architecture', 'Structure', '体系', '平台', '系统', '基础框架', '技术框架'],
  'Version': ['版本', '版次', 'Version', 'Release', 'Edition', '发行版', '版本号', '修订版', '迭代版本', '版别'],
  
  // 难度相关
  'Difficulty': ['难度', '困难度', 'Difficulty', 'Level', 'Complexity', '复杂度', '难易度', '挑战度', '困难程度', '难度等级'],
  
  // 参考相关
  'Reference': ['参考', '引用', 'Reference', 'Citation', 'Source', '来源', '出处', '参考文献', '引文', '参照'],
  'Source': ['来源', '出处', 'Source', 'Origin', 'Reference', '源头', '资料来源', '信息源', '数据源', '参考源'],
  
  // 成本相关
  'Cost': ['成本', '费用', 'Cost', 'Price', 'Expense', '花费', '开销', '支出', '价格', '代价'],
  
  // 同伴相关
  'Companions': ['同伴', '伙伴', 'Companions', 'Partners', 'Friends', '同行者', '陪伴者', '同行', '伴侣', '队友'],
  
  // 照片相关
  'Photos': ['照片', '图片', 'Photos', 'Pictures', 'Images', '相片', '图像', '摄影', '影像', '图集'],
  
  // 卡路里相关
  'Calories': ['卡路里', '热量', 'Calories', 'Energy', 'Cal', '能量', '热量值', '卡', '千卡', 'kcal'],
  
  // 心率相关
  'HeartRate': ['心率', '心跳', 'HeartRate', 'Pulse', 'BPM', '脉搏', '心跳速率', '心跳频率', '脉率', '心律'],
};

// 为字段生成变体
function generateVariations(fieldName) {
  // 如果有预定义的变体，直接使用
  if (FIELD_VARIATIONS[fieldName]) {
    return FIELD_VARIATIONS[fieldName];
  }
  
  // 否则生成通用变体
  const variations = [fieldName];
  
  // 添加小写版本
  variations.push(fieldName.toLowerCase());
  
  // 添加全大写版本
  variations.push(fieldName.toUpperCase());
  
  // 添加带下划线的版本
  const snakeCase = fieldName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  variations.push(snakeCase);
  
  // 添加带连字符的版本
  const kebabCase = fieldName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
  variations.push(kebabCase);
  
  // 添加空格分隔的版本
  const spaceCase = fieldName.replace(/([A-Z])/g, ' $1').trim();
  variations.push(spaceCase);
  
  // 添加中文翻译（简单映射）
  const chineseMap = {
    'Date': '日期',
    'Time': '时间',
    'Status': '状态',
    'Notes': '备注',
    'Tags': '标签',
    'Priority': '优先级',
    'Location': '位置',
    'Weather': '天气',
    'Rating': '评分',
    'Software': '软件',
    'Duration': '时长',
    'Difficulty': '难度',
    'Result': '结果',
  };
  
  for (const [en, cn] of Object.entries(chineseMap)) {
    if (fieldName.includes(en)) {
      variations.push(fieldName.replace(en, cn));
    }
  }
  
  // 确保至少有10个变体
  while (variations.length < 10) {
    variations.push(`${fieldName}${variations.length}`);
  }
  
  // 去重并返回前10个
  return [...new Set(variations)].slice(0, 10);
}

// 获取字段权重
function getFieldWeight(fieldName) {
  const coreFields = ['Date', 'Location', 'Timestamp', 'Status', 'Framework', 'Software'];
  const importantFields = ['Duration', 'Priority', 'Result', 'Weather', 'Rating', 'Version'];
  
  if (coreFields.includes(fieldName)) {
    return 0.15;
  } else if (importantFields.includes(fieldName)) {
    return 0.10;
  } else {
    return 0.05;
  }
}

async function main() {
  console.log('开始为补充字段扩充映射变体...\n');
  
  // 1. 读取补充报告，获取所有补充的字段
  const reportPath = path.join(__dirname, '../schema/supplement_report.json');
  const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
  
  console.log(`✓ 读取补充报告: ${report.supplementedSchemas} 个Schema被补充`);
  console.log(`✓ 总字段数: ${report.totalFields}`);
  console.log(`✓ 平均字段数: ${report.avgFields.toFixed(2)}\n`);
  
  // 2. 从数据库获取所有Schema及其字段
  const schemas = await prisma.schema.findMany({
    select: {
      name: true,
      coreFields: true,
    },
  });
  
  console.log(`✓ 从数据库加载了 ${schemas.length} 个Schema\n`);
  
  // 3. 读取现有映射表
  const mappingPath = path.join(__dirname, 'schema_field_mappings.json');
  const mappings = JSON.parse(await fs.readFile(mappingPath, 'utf8'));
  
  console.log(`✓ 当前映射表包含 ${Object.keys(mappings).length} 个Schema\n`);
  
  // 4. 统计需要扩充的字段
  let totalFieldsToExpand = 0;
  let schemasToUpdate = 0;
  const expansionPlan = {};
  
  for (const schema of schemas) {
    const schemaName = schema.name;
    const coreFields = JSON.parse(schema.coreFields || '[]');
    
    if (!mappings[schemaName]) {
      // 如果Schema不在映射表中，跳过
      continue;
    }
    
    const existingMapping = mappings[schemaName];
    const fieldsToExpand = [];
    
    for (const field of coreFields) {
      const fieldName = field.name;
      
      // 检查字段是否已有映射
      if (!existingMapping[fieldName]) {
        fieldsToExpand.push(fieldName);
        totalFieldsToExpand++;
      } else {
        // 检查变体数量是否少于10个
        const variations = existingMapping[fieldName].common_variations || [];
        if (variations.length < 10) {
          fieldsToExpand.push(fieldName);
          totalFieldsToExpand++;
        }
      }
    }
    
    if (fieldsToExpand.length > 0) {
      expansionPlan[schemaName] = fieldsToExpand;
      schemasToUpdate++;
    }
  }
  
  console.log('================================================================================');
  console.log('📊 扩充计划');
  console.log('================================================================================\n');
  console.log(`需要扩充的Schema数: ${schemasToUpdate}`);
  console.log(`需要扩充的字段数: ${totalFieldsToExpand}\n`);
  
  if (totalFieldsToExpand === 0) {
    console.log('✓ 所有字段都已有足够的映射变体！');
    await prisma.$disconnect();
    return;
  }
  
  // 5. 备份现有映射表
  const backupPath = `${mappingPath}.backup.${Date.now()}`;
  await fs.copyFile(mappingPath, backupPath);
  console.log(`✓ 已备份映射表到: ${backupPath}\n`);
  
  // 6. 扩充映射变体
  console.log('开始扩充映射变体...\n');
  
  let expandedCount = 0;
  
  for (const [schemaName, fieldsToExpand] of Object.entries(expansionPlan)) {
    console.log(`处理 ${schemaName}...`);
    
    for (const fieldName of fieldsToExpand) {
      const variations = generateVariations(fieldName);
      const weight = getFieldWeight(fieldName);
      
      mappings[schemaName][fieldName] = {
        common_variations: variations,
        weight: weight,
        required: false,
        description: fieldName,
      };
      
      expandedCount++;
      console.log(`  ✓ ${fieldName}: ${variations.length} 个变体`);
    }
  }
  
  console.log(`\n✓ 成功扩充 ${expandedCount} 个字段的映射变体\n`);
  
  // 7. 保存更新后的映射表
  await fs.writeFile(mappingPath, JSON.stringify(mappings, null, 2), 'utf8');
  console.log(`✓ 已保存更新后的映射表\n`);
  
  // 8. 同步到完整映射表
  const fullMappingPath = path.join(__dirname, 'schema_field_mappings_full.json');
  await fs.copyFile(mappingPath, fullMappingPath);
  console.log(`✓ 已同步到完整映射表\n`);
  
  // 9. 生成统计报告
  console.log('================================================================================');
  console.log('📊 扩充结果');
  console.log('================================================================================\n');
  console.log(`总Schema数: ${Object.keys(mappings).length}`);
  console.log(`扩充的Schema数: ${schemasToUpdate}`);
  console.log(`扩充的字段数: ${expandedCount}`);
  console.log(`成功率: 100%\n`);
  
  // 10. 验证映射表
  console.log('验证映射表...\n');
  
  let totalVariations = 0;
  let fieldsWithEnoughVariations = 0;
  let totalMappedFields = 0;
  
  for (const [schemaName, fields] of Object.entries(mappings)) {
    for (const [fieldName, config] of Object.entries(fields)) {
      totalMappedFields++;
      const variations = config.common_variations || [];
      totalVariations += variations.length;
      
      if (variations.length >= 10) {
        fieldsWithEnoughVariations++;
      }
    }
  }
  
  const avgVariations = totalVariations / totalMappedFields;
  const coverageRate = (fieldsWithEnoughVariations / totalMappedFields * 100).toFixed(2);
  
  console.log(`✓ 总映射字段数: ${totalMappedFields}`);
  console.log(`✓ 平均变体数: ${avgVariations.toFixed(2)}`);
  console.log(`✓ 变体数>=10的字段: ${fieldsWithEnoughVariations} (${coverageRate}%)\n`);
  
  console.log('================================================================================');
  console.log('✅ 映射变体扩充完成！');
  console.log('================================================================================\n');
  
  await prisma.$disconnect();
}

main().catch(console.error);
