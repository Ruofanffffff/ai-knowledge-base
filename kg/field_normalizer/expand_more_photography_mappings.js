/**
 * 扩展更多摄影Schema的中文映射
 * 
 * 为以下Schema添加中文术语映射:
 * - Aperture-Usage (光圈使用)
 * - Lens-Choice (镜头选择)
 * - Composition-Type (构图类型)
 * - Portrait-Style (人像风格)
 * - Exposure-Strategy (曝光策略)
 * - Light-Composition (光线构图)
 * - Focus-Mode (对焦模式)
 * - ISO-Usage (ISO使用)
 */

const fs = require('fs');
const path = require('path');

// 读取现有映射
const mappingPath = path.join(__dirname, 'schema_field_mappings_full.json');
const mappings = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));

// 定义新的映射扩展
const expansions = {
  'Aperture-Usage': {
    'Aperture': [
      '光圈', 'F值', 'F 值', 'f值', 'f 值', '大光圈', '小光圈',
      '光圈大小', '光圈值', '光圈设置', '开大光圈', '收小光圈'
    ],
    'DepthOfField': [
      '景深', '虚化', '背景虚化', '虚化效果', '虚化背景',
      '浅景深', '深景深', '景深效果', '虚化程度'
    ],
    'Effect': [
      '效果', '虚化效果', '景深效果', '光圈效果', '拍摄效果'
    ]
  },
  
  'Lens-Choice': {
    'LensType': [
      '镜头', '镜头类型', '定焦', '变焦', '定焦镜头', '变焦镜头',
      '长焦', '广角', '长焦镜头', '广角镜头', '标准镜头'
    ],
    'FocalLength': [
      '焦距', '焦段', '焦距范围', '焦距长度', '焦距值',
      '长焦', '广角', '标准焦距', '超广角', '中焦'
    ],
    'Purpose': [
      '用途', '拍摄用途', '适用场景', '使用场景', '拍摄目的'
    ]
  },
  
  'Composition-Type': {
    'CompositionRule': [
      '构图', '构图法', '构图技巧', '构图方法', '构图规则',
      '三分法', '黄金分割', '对称构图', '中心构图', '框架构图',
      '引导线', '对角线', '留白', '平衡', '构图平衡'
    ],
    'SubjectPlacement': [
      '主体位置', '对象位置', '人物位置', '主体放置', '对象放置',
      '画面中心', '交点', '分界线', '中轴线', '视觉中心'
    ],
    'Orientation': [
      '拍摄方向', '画面方向', '横拍', '竖拍', '垂直拍摄', '水平拍摄',
      '横向', '纵向', '竖向', '横构图', '竖构图'
    ]
  },
  
  'Portrait-Style': {
    'PortraitType': [
      '肖像', '人像', '肖像照', '人像照', '人物照', '人物肖像',
      '证件照', '纪念照', '生活照', '艺术照', '写真'
    ],
    'Framing': [
      '取景', '画面', '构图', '框架', '取景范围',
      '全身', '半身', '上半身', '特写', '近景', '远景'
    ],
    'Expression': [
      '表情', '神态', '情绪', '感染力', '表现力', '氛围'
    ]
  },
  
  'Exposure-Strategy': {
    'ExposureType': [
      '曝光', '曝光策略', '曝光方式', '曝光模式', '曝光补偿',
      '正常曝光', '过曝', '欠曝', '曝光调整', '曝光控制'
    ],
    'LightingCondition': [
      '光线', '光照', '光线条件', '光照条件', '光线强度',
      '强光', '弱光', '低光', '明亮', '昏暗', '阴天', '晴天'
    ],
    'Intent': [
      '意图', '目的', '效果', '拍摄意图', '创作意图', '表现意图'
    ]
  },
  
  'Light-Composition': {
    'LightDirection': [
      '光线方向', '光线角度', '光向', '光位',
      '逆光', '顺光', '侧光', '顶光', '底光',
      '正面光', '背面光', '侧面光', '斜光'
    ],
    'LightQuality': [
      '光线质量', '光质', '光线特性', '光线效果',
      '柔光', '硬光', '散射光', '直射光', '漫射光',
      '柔和', '强烈', '均匀', '不均匀'
    ],
    'Atmosphere': [
      '氛围', '气氛', '感觉', '情调', '意境',
      '柔和氛围', '温暖氛围', '冷色调', '暖色调'
    ]
  },
  
  'Focus-Mode': {
    'FocusType': [
      '对焦', '对焦模式', '对焦方式', '对焦类型',
      '自动对焦', '手动对焦', 'AF', 'MF',
      '单次对焦', '连续对焦', '追焦'
    ],
    'FocusPoint': [
      '对焦点', '焦点', '对焦区域', '对焦位置',
      '中心对焦', '眼部对焦', '面部对焦', '多点对焦'
    ],
    'Sharpness': [
      '清晰度', '锐度', '清晰', '模糊', '锐利', '柔和'
    ]
  },
  
  'ISO-Usage': {
    'ISO': [
      'ISO', 'ISO值', 'ISO设置', '感光度', '感光度值',
      '高ISO', '低ISO', 'ISO调整', 'ISO控制'
    ],
    'NoiseLevel': [
      '噪点', '噪声', '噪点水平', '噪声水平', '画质',
      '低噪点', '高噪点', '噪点控制', '降噪'
    ],
    'LightSensitivity': [
      '感光度', '感光性', '光敏度', '感光能力', '感光灵敏度'
    ]
  }
};

// 应用扩展
let addedCount = 0;
let updatedSchemas = [];

for (const [schemaName, fields] of Object.entries(expansions)) {
  if (!mappings[schemaName]) {
    console.log(`⚠️  Schema "${schemaName}" 不存在，跳过`);
    continue;
  }
  
  for (const [fieldName, terms] of Object.entries(fields)) {
    if (!mappings[schemaName][fieldName]) {
      console.log(`⚠️  Schema "${schemaName}" 中的字段 "${fieldName}" 不存在，跳过`);
      continue;
    }
    
    const existingTerms = new Set(mappings[schemaName][fieldName].variations || []);
    const newTerms = terms.filter(t => !existingTerms.has(t));
    
    if (newTerms.length > 0) {
      mappings[schemaName][fieldName].variations = [
        ...(mappings[schemaName][fieldName].variations || []),
        ...newTerms
      ];
      
      addedCount += newTerms.length;
      console.log(`✅ ${schemaName}.${fieldName}: 添加 ${newTerms.length} 个术语`);
      
      if (!updatedSchemas.includes(schemaName)) {
        updatedSchemas.push(schemaName);
      }
    }
  }
}

// 保存更新后的映射
fs.writeFileSync(mappingPath, JSON.stringify(mappings, null, 2), 'utf-8');

console.log('\n' + '='.repeat(80));
console.log('✅ 映射扩展完成!');
console.log('='.repeat(80));
console.log(`📊 统计:`);
console.log(`   - 更新的Schema数: ${updatedSchemas.length}`);
console.log(`   - 添加的术语总数: ${addedCount}`);
console.log(`\n📝 更新的Schema列表:`);
updatedSchemas.forEach((schema, i) => {
  console.log(`   ${i + 1}. ${schema}`);
});
console.log('='.repeat(80));
