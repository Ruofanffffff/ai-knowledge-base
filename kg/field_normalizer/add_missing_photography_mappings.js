/**
 * 为缺失的摄影Schema添加字段映射
 * 
 * 目标：将摄影Schema的映射覆盖率从35.9%提升到90%以上
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// 摄影领域常见字段的映射变体
const PHOTOGRAPHY_FIELD_VARIATIONS = {
  // 相机设置相关
  'Aperture': ['光圈', 'F值', 'F 值', 'f值', 'Aperture', 'F-stop', 'f-stop', '光圈值', '光圈大小'],
  'ShutterSpeed': ['快门速度', '快门', 'Shutter Speed', 'Shutter', '快门时间', '曝光时间', '快门值'],
  'ISO': ['ISO', 'iso', '感光度', 'ISO值', 'ISO感光度', '感光度值'],
  'FocalLength': ['焦距', 'Focal Length', '焦段', '焦距值', '镜头焦距'],
  'WhiteBalance': ['白平衡', 'White Balance', 'WB', '色温', '白平衡模式'],
  'ExposureCompensation': ['曝光补偿', 'Exposure Compensation', 'EV', 'EV值', '曝光值'],
  'MeteringMode': ['测光模式', 'Metering Mode', '测光', '测光方式'],
  'FocusMode': ['对焦模式', 'Focus Mode', '对焦', '对焦方式', 'AF模式'],
  'DriveMode': ['驱动模式', 'Drive Mode', '连拍模式', '拍摄模式'],
  
  // 镜头相关
  'LensModel': ['镜头型号', '镜头', 'Lens', 'Lens Model', '镜头名称', '镜头产品'],
  'LensName': ['镜头名称', '镜头', 'Lens', 'Lens Name', '镜头型号'],
  'LensType': ['镜头类型', 'Lens Type', '镜头种类', '定焦', '变焦'],
  'MaxAperture': ['最大光圈', 'Max Aperture', '最大F值', '光圈范围'],
  'MinFocalLength': ['最小焦距', 'Min Focal Length', '广角端', '焦距范围'],
  'MaxFocalLength': ['最大焦距', 'Max Focal Length', '长焦端', '焦距范围'],
  
  // 拍摄场景相关
  'Subject': ['拍摄主体', '主体', 'Subject', '拍摄对象', '被摄体'],
  'Scene': ['场景', 'Scene', '拍摄场景', '环境'],
  'LightingCondition': ['光线条件', 'Lighting', '光照', '光线', '照明条件'],
  'Weather': ['天气', 'Weather', '天气条件', '气候'],
  'TimeOfDay': ['时间', 'Time', '拍摄时间', '时段'],
  'Location': ['地点', 'Location', '拍摄地点', '位置'],
  
  // 构图相关
  'CompositionRule': ['构图规则', 'Composition', '构图', '构图方法'],
  'Perspective': ['视角', 'Perspective', '拍摄角度', '角度'],
  'Framing': ['取景', 'Framing', '画面', '框架'],
  
  // 后期处理相关
  'Exposure': ['曝光', 'Exposure', '曝光度', '明暗'],
  'Contrast': ['对比度', 'Contrast', '反差'],
  'Saturation': ['饱和度', 'Saturation', '色彩饱和度'],
  'Sharpness': ['锐度', 'Sharpness', '清晰度'],
  'NoiseReduction': ['降噪', 'Noise Reduction', '去噪'],
  
  // 通用字段
  'Description': ['描述', 'Description', '说明', '备注'],
  'Tips': ['技巧', 'Tips', '建议', '要点'],
  'UseCase': ['用途', 'Use Case', '使用场景', '适用场景'],
  'Recommendation': ['推荐', 'Recommendation', '建议', '推荐理由']
};

async function addMissingPhotographyMappings() {
  console.log('='.repeat(80));
  console.log('为缺失的摄影Schema添加字段映射');
  console.log('='.repeat(80));
  console.log();

  // 1. 加载现有映射
  const mappingFilePath = path.join(__dirname, 'schema_field_mappings.json');
  const existingMappings = JSON.parse(fs.readFileSync(mappingFilePath, 'utf-8'));
  console.log(`✓ 加载现有映射: ${Object.keys(existingMappings).length}个Schema`);

  // 2. 获取所有摄影Schema
  const photographySchemas = await prisma.schema.findMany({
    where: {
      OR: [
        { entityType: 'PhotographyEntity' },
        { name: { contains: 'Photography' } },
        { name: { contains: 'Camera' } },
        { name: { contains: 'Lens' } },
        { name: { contains: 'Aperture' } },
        { name: { contains: 'Shutter' } },
        { name: { contains: 'ISO' } },
        { name: { contains: 'Focus' } },
        { name: { contains: 'Exposure' } },
        { name: { contains: 'Shooting' } }
      ]
    }
  });

  console.log(`✓ 找到${photographySchemas.length}个摄影相关Schema`);

  // 3. 识别缺失映射的Schema
  const missingMappings = photographySchemas.filter(s => !existingMappings[s.name]);
  console.log(`✓ 需要添加映射的Schema: ${missingMappings.length}个`);
  console.log();

  if (missingMappings.length === 0) {
    console.log('所有摄影Schema都已有映射配置');
    await prisma.$disconnect();
    return;
  }

  // 4. 为每个Schema生成映射
  let addedCount = 0;
  const newMappings = { ...existingMappings };

  for (const schema of missingMappings) {
    console.log(`处理Schema: ${schema.name}`);
    
    const coreFields = JSON.parse(schema.coreFields || '[]');
    if (coreFields.length === 0) {
      console.log(`  ⚠️  跳过: 没有核心字段`);
      continue;
    }

    const schemaMapping = {};
    let mappedFields = 0;

    for (const coreField of coreFields) {
      const fieldName = coreField.name;
      
      // 查找匹配的变体
      let variations = PHOTOGRAPHY_FIELD_VARIATIONS[fieldName];
      
      if (!variations) {
        // 如果没有预定义的变体，生成基本变体
        variations = [
          fieldName,
          fieldName.toLowerCase(),
          fieldName.replace(/([A-Z])/g, ' $1').trim(), // CamelCase to spaces
          fieldName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '') // CamelCase to snake_case
        ];
      }

      schemaMapping[fieldName] = {
        common_variations: [...new Set(variations)], // 去重
        weight: coreField.weight || 0.5,
        required: coreField.required || false,
        description: `${fieldName}字段`,
        data_type: coreField.type || 'text',
        domain: 'photography'
      };

      mappedFields++;
    }

    newMappings[schema.name] = schemaMapping;
    addedCount++;
    
    const coverage = (mappedFields / coreFields.length * 100).toFixed(1);
    console.log(`  ✓ 添加映射: ${mappedFields}/${coreFields.length}个字段 (${coverage}%)`);
  }

  // 5. 保存更新后的映射
  if (addedCount > 0) {
    // 备份原文件
    const backupPath = mappingFilePath + '.backup.' + Date.now();
    fs.copyFileSync(mappingFilePath, backupPath);
    console.log();
    console.log(`✓ 备份原文件: ${backupPath}`);

    // 保存新映射
    fs.writeFileSync(
      mappingFilePath,
      JSON.stringify(newMappings, null, 2),
      'utf-8'
    );
    console.log(`✓ 保存新映射: ${Object.keys(newMappings).length}个Schema`);
    console.log(`✓ 新增映射: ${addedCount}个Schema`);
  }

  // 6. 统计结果
  console.log();
  console.log('='.repeat(80));
  console.log('添加完成');
  console.log('='.repeat(80));
  console.log();
  
  const totalPhotography = photographySchemas.length;
  const withMappings = photographySchemas.filter(s => newMappings[s.name]).length;
  const coverage = (withMappings / totalPhotography * 100).toFixed(1);
  
  console.log(`摄影Schema映射覆盖率: ${withMappings}/${totalPhotography} (${coverage}%)`);
  
  if (coverage >= 90) {
    console.log(`✓ 达到目标: 覆盖率 >= 90%`);
  } else {
    console.log(`⚠️  未达目标: 覆盖率 < 90%，还需添加${Math.ceil(totalPhotography * 0.9 - withMappings)}个Schema的映射`);
  }

  await prisma.$disconnect();
}

// 运行脚本
if (require.main === module) {
  addMissingPhotographyMappings()
    .then(() => {
      console.log('\n✅ 脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { addMissingPhotographyMappings };
