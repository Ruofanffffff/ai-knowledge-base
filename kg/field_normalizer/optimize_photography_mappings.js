/**
 * 优化摄影Schema字段映射
 * 目标：提高字段匹配率，特别是中文变体
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

console.log('开始优化摄影Schema映射...\n');

// 增强的摄影字段映射（添加更多中文变体）
const ENHANCED_PHOTOGRAPHY_MAPPINGS = {
  'Camera': [
    '相机', '机身', '相机型号', '相机品牌', '相机名称',
    'Camera', 'camera', '机器', '设备', '拍摄设备',
    '相机是什么', '用什么相机', '什么相机', '哪款相机',
    '索尼', '尼康', '佳能', '富士', '徕卡', '宾得', '松下',
    'Sony', 'Nikon', 'Canon', 'Fuji', 'Fujifilm', 'Leica', 'Pentax', 'Panasonic',
    'A7', 'A7M4', 'A7R5', 'D850', 'Z9', '5D', 'R5', 'X-T5', 'GFX'
  ],
  
  'Lens': [
    '镜头', '镜头型号', '镜头焦段', '焦距', '镜头名称',
    'Lens', 'lens', '光学镜头', '摄影镜头',
    '什么镜头', '用什么镜头', '镜头是什么', '哪个镜头',
    '定焦', '变焦', '广角', '长焦', '标准镜头', '微距',
    '35mm', '50mm', '85mm', '24-70', '70-200',
    'f1.4', 'f1.8', 'f2.8', 'f4', 'f5.6'
  ],
  
  'FocalLength': [
    '焦距', '焦段', 'Focal Length', 'focal length', 'FocalLength',
    '镜头焦距', '焦距值', '多少焦距', '什么焦距',
    '35mm', '50mm', '85mm', '24mm', '70mm', '200mm',
    '24-70mm', '70-200mm', '16-35mm',
    '广角', '标准', '长焦', '超广角', '中焦'
  ],
  
  'ISO': [
    'ISO', 'iso', '感光度', 'ISO值', 'ISO设置',
    'ISO是多少', '感光度是多少', 'ISO多少',
    'ISO100', 'ISO200', 'ISO400', 'ISO800', 'ISO1600', 'ISO3200',
    '低ISO', '高ISO', '自动ISO', '感光', '感光值'
  ],
  
  'Aperture': [
    '光圈', '光圈值', '光圈大小', 'Aperture', 'aperture',
    'f值', 'F值', 'F-stop', 'f-stop',
    '光圈是多少', '光圈多少', '多大光圈',
    'f1.4', 'f1.8', 'f2.0', 'f2.8', 'f4', 'f5.6', 'f8', 'f11', 'f16',
    'F1.4', 'F1.8', 'F2.8', 'F4', 'F5.6',
    '大光圈', '小光圈', '最大光圈', '最小光圈'
  ],
  
  'Shutter': [
    '快门', '快门速度', '曝光时间', 'Shutter', 'shutter',
    'ShutterSpeed', 'Shutter Speed', 'shutter speed',
    '快门是多少', '快门速度是多少', '曝光多久',
    '1/1000', '1/500', '1/250', '1/125', '1/60', '1/30', '1/15',
    '高速快门', '慢速快门', '长曝光', '短曝光', '快门值'
  ],
  
  'ShutterSpeed': [
    '快门速度', '快门', 'Shutter Speed', 'ShutterSpeed', 'shutter speed',
    '曝光时间', '快门时间', '快门值',
    '快门速度是多少', '多快的快门', '快门多少',
    '1/1000s', '1/500s', '1/250s', '1/125s', '1/60s', '1/30s',
    '高速', '慢速', '快速快门', '慢速快门'
  ],
  
  'Exposure': [
    '曝光', '曝光补偿', 'EV', '曝光值', 'Exposure', 'exposure',
    '曝光是多少', 'EV值', '曝光补偿是多少',
    '+1EV', '-1EV', '+2EV', '-2EV', '0EV',
    '过曝', '欠曝', '正常曝光', '曝光正常', '曝光度'
  ],
  
  'Focus': [
    '对焦', '对焦模式', '对焦点', 'Focus', 'focus',
    '焦点', '对焦方式', '如何对焦', '对焦在哪',
    '单次对焦', '连续对焦', '手动对焦', '自动对焦',
    'AF', 'MF', 'AF-S', 'AF-C', '中心对焦', '眼部对焦'
  ],
  
  'WhiteBalance': [
    '白平衡', 'White Balance', 'WhiteBalance', 'white balance', 'WB',
    '色温', '白平衡模式', '白平衡设置',
    '日光', '阴天', '荧光灯', '白炽灯', '闪光灯',
    '5500K', '6500K', '3200K', '自动白平衡', 'AWB'
  ],
  
  'Subject': [
    '拍摄主体', '主体', 'Subject', 'subject',
    '拍摄对象', '被摄体', '拍什么', '主题',
    '人物', '风景', '静物', '动物', '建筑'
  ],
  
  'Scene': [
    '场景', 'Scene', 'scene', '拍摄场景', '环境',
    '室内', '室外', '户外', '自然', '城市',
    '什么场景', '在哪拍', '拍摄环境'
  ],
  
  'Lighting': [
    '光线', '照明', 'Lighting', 'lighting', '光照',
    '光线条件', '照明条件', '光源',
    '自然光', '人造光', '柔光', '硬光', '侧光', '逆光', '顺光',
    '什么光线', '光线如何', '光照条件'
  ],
  
  'Composition': [
    '构图', 'Composition', 'composition', '构图方式', '构图法则',
    '三分法', '黄金分割', '对称', '引导线', '框架',
    '如何构图', '构图规则', '画面构图'
  ]
};

async function main() {
  try {
    const mappingFile = path.join(__dirname, 'schema_field_mappings.json');
    const existing = JSON.parse(fs.readFileSync(mappingFile, 'utf-8'));
    console.log(`当前映射: ${Object.keys(existing).length}个Schema\n`);

    // 获取所有摄影相关Schema
    const photographySchemas = await prisma.schema.findMany({
      where: {
        OR: [
          { entityType: 'PhotographyEntity' },
          { name: { contains: 'Photography' } },
          { name: { contains: 'Camera' } },
          { name: { contains: 'Lens' } },
          { name: { contains: 'Shooting' } },
          { name: { contains: 'Exposure' } },
          { name: { contains: 'Focus' } }
        ]
      }
    });

    console.log(`找到${photographySchemas.length}个摄影Schema\n`);

    let updatedCount = 0;
    const newMappings = { ...existing };

    console.log('优化摄影Schema映射:\n');

    for (const schema of photographySchemas) {
      if (!existing[schema.name]) {
        console.log(`  ⚠️  跳过 ${schema.name} (无现有映射)`);
        continue;
      }

      const coreFields = JSON.parse(schema.coreFields || '[]');
      if (coreFields.length === 0) continue;

      let updated = false;
      const schemaMapping = { ...existing[schema.name] };

      for (const field of coreFields) {
        const fieldName = field.name;
        const enhancedVariations = ENHANCED_PHOTOGRAPHY_MAPPINGS[fieldName];

        if (enhancedVariations) {
          const currentVariations = schemaMapping[fieldName]?.common_variations || [];
          const allVariations = [...new Set([...currentVariations, ...enhancedVariations])];

          if (allVariations.length > currentVariations.length) {
            schemaMapping[fieldName] = {
              ...schemaMapping[fieldName],
              common_variations: allVariations,
              weight: field.weight || 0.5,
              required: field.required || false,
              description: `${fieldName}字段`,
              data_type: field.type || 'text',
              domain: 'photography'
            };
            updated = true;
          }
        }
      }

      if (updated) {
        newMappings[schema.name] = schemaMapping;
        updatedCount++;
        console.log(`  ✓ ${schema.name} (优化完成)`);
      }
    }

    // 保存
    if (updatedCount > 0) {
      const backup = mappingFile + '.backup.' + Date.now();
      fs.copyFileSync(mappingFile, backup);
      console.log(`\n✓ 备份: ${backup}`);

      fs.writeFileSync(mappingFile, JSON.stringify(newMappings, null, 2));
      console.log(`✓ 保存: ${Object.keys(newMappings).length}个Schema`);
      console.log(`✓ 优化: ${updatedCount}个摄影Schema`);
    } else {
      console.log('\n所有摄影Schema映射已是最新');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('错误:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
