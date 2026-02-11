/**
 * Add Photography Field Mappings
 * 
 * This script adds comprehensive field mappings for photography schemas
 */

const fs = require('fs');
const path = require('path');

const mappingsPath = path.join(__dirname, 'schema_field_mappings.json');
const mappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));

// Photography Technique Schema Mappings
mappings['Photography-Technique'] = {
  "TechniqueName": {
    "common_variations": [
      "技巧名称", "技巧", "摄影技巧", "拍摄技巧", "技术",
      "TechniqueName", "Technique", "technique", "方法", "手法",
      "什么技巧", "技巧是什么", "用什么技巧", "如何拍摄",
      "三分法", "黄金分割", "对角线", "引导线", "框架构图"
    ],
    "weight": 0.4,
    "required": true,
    "description": "摄影技巧名称",
    "data_type": "text",
    "domain": "photography"
  },
  "Category": {
    "common_variations": [
      "类别", "分类", "Category", "category", "种类", "类型",
      "什么类别", "属于什么类别", "技巧类别", "技巧分类"
    ],
    "weight": 0.3,
    "required": false,
    "description": "技巧类别",
    "data_type": "text",
    "domain": "photography"
  },
  "Description": {
    "common_variations": [
      "描述", "说明", "介绍", "Description", "description",
      "详细说明", "技巧说明", "如何使用", "怎么用"
    ],
    "weight": 0.3,
    "required": false,
    "description": "技巧描述",
    "data_type": "text",
    "domain": "photography"
  }
};

// Composition Rule Schema Mappings
mappings['Composition-Rule'] = {
  "RuleName": {
    "common_variations": [
      "构图法则", "构图规则", "构图", "法则名称", "规则名称",
      "RuleName", "Rule", "rule", "构图方法", "构图技巧",
      "什么构图", "构图是什么", "用什么构图",
      "三分法", "黄金分割", "对称", "引导线", "框架"
    ],
    "weight": 0.4,
    "required": true,
    "description": "构图法则名称",
    "data_type": "text",
    "domain": "photography"
  },
  "Principle": {
    "common_variations": [
      "原理", "原则", "Principle", "principle", "理论",
      "构图原理", "构图原则", "为什么", "原理是什么"
    ],
    "weight": 0.3,
    "required": false,
    "description": "构图原理",
    "data_type": "text",
    "domain": "photography"
  },
  "Application": {
    "common_variations": [
      "应用", "应用场景", "Application", "application", "使用",
      "如何应用", "怎么用", "适用场景", "使用场景"
    ],
    "weight": 0.3,
    "required": false,
    "description": "应用场景",
    "data_type": "text",
    "domain": "photography"
  }
};

// Camera Settings Schema Mappings
mappings['Camera-Settings'] = {
  "SettingName": {
    "common_variations": [
      "设置名称", "设置", "相机设置", "参数设置", "配置",
      "SettingName", "Setting", "setting", "参数", "配置名称",
      "什么设置", "设置是什么", "如何设置"
    ],
    "weight": 0.4,
    "required": true,
    "description": "设置名称",
    "data_type": "text",
    "domain": "photography"
  },
  "Mode": {
    "common_variations": [
      "模式", "拍摄模式", "Mode", "mode", "档位",
      "什么模式", "模式是什么", "用什么模式",
      "M档", "A档", "S档", "P档", "手动", "光圈优先", "快门优先"
    ],
    "weight": 0.3,
    "required": false,
    "description": "拍摄模式",
    "data_type": "text",
    "domain": "photography"
  },
  "Parameters": {
    "common_variations": [
      "参数", "参数值", "Parameters", "parameters", "设置值",
      "参数是什么", "参数是多少", "具体参数", "详细参数"
    ],
    "weight": 0.3,
    "required": false,
    "description": "参数值",
    "data_type": "text",
    "domain": "photography"
  }
};

// Aperture Setting Schema Mappings
mappings['Aperture-Setting'] = {
  "Value": {
    "common_variations": [
      "光圈值", "光圈", "f值", "F值", "Value", "value",
      "光圈是多少", "光圈多少", "f", "F",
      "f1.4", "f1.8", "f2.0", "f2.8", "f4", "f5.6", "f8", "f11", "f16",
      "大光圈", "小光圈", "最大光圈"
    ],
    "weight": 0.4,
    "required": true,
    "description": "光圈值",
    "data_type": "text",
    "domain": "photography"
  },
  "Effect": {
    "common_variations": [
      "效果", "作用", "影响", "Effect", "effect",
      "有什么效果", "效果是什么", "作用是什么",
      "景深", "虚化", "背景虚化", "浅景深", "深景深"
    ],
    "weight": 0.3,
    "required": false,
    "description": "光圈效果",
    "data_type": "text",
    "domain": "photography"
  },
  "UseCase": {
    "common_variations": [
      "使用场景", "适用场景", "UseCase", "usecase", "应用",
      "什么时候用", "适合什么", "用在哪", "应用场景",
      "人像", "风光", "街拍", "夜景", "运动"
    ],
    "weight": 0.3,
    "required": false,
    "description": "使用场景",
    "data_type": "text",
    "domain": "photography"
  }
};

// Shutter Speed Setting Schema Mappings
mappings['Shutter-Speed-Setting'] = {
  "Speed": {
    "common_variations": [
      "快门速度", "快门", "曝光时间", "Speed", "speed",
      "快门是多少", "快门速度是多少", "曝光多久",
      "1/1000", "1/500", "1/250", "1/125", "1/60", "1/30", "1/15",
      "高速快门", "慢速快门", "长曝光", "短曝光", "秒", "s"
    ],
    "weight": 0.4,
    "required": true,
    "description": "快门速度",
    "data_type": "text",
    "domain": "photography"
  },
  "Effect": {
    "common_variations": [
      "效果", "作用", "影响", "Effect", "effect",
      "有什么效果", "效果是什么", "作用是什么",
      "凝固", "运动模糊", "拖影", "追随", "动感"
    ],
    "weight": 0.3,
    "required": false,
    "description": "快门效果",
    "data_type": "text",
    "domain": "photography"
  },
  "UseCase": {
    "common_variations": [
      "使用场景", "适用场景", "UseCase", "usecase", "应用",
      "什么时候用", "适合什么", "用在哪", "应用场景",
      "运动", "体育", "夜景", "星轨", "流水", "车流"
    ],
    "weight": 0.3,
    "required": false,
    "description": "使用场景",
    "data_type": "text",
    "domain": "photography"
  }
};

// ISO Setting Schema Mappings
mappings['ISO-Setting'] = {
  "Value": {
    "common_variations": [
      "ISO值", "ISO", "iso", "感光度", "Value", "value",
      "ISO是多少", "感光度是多少", "ISO多少",
      "ISO100", "ISO200", "ISO400", "ISO800", "ISO1600", "ISO3200",
      "低ISO", "高ISO", "自动ISO", "原生ISO"
    ],
    "weight": 0.4,
    "required": true,
    "description": "ISO值",
    "data_type": "text",
    "domain": "photography"
  },
  "NoiseLevel": {
    "common_variations": [
      "噪点水平", "噪点", "噪声", "NoiseLevel", "noise",
      "噪点多吗", "噪点大吗", "画质", "纯净度",
      "低噪点", "高噪点", "噪点控制", "降噪"
    ],
    "weight": 0.3,
    "required": false,
    "description": "噪点水平",
    "data_type": "text",
    "domain": "photography"
  },
  "UseCase": {
    "common_variations": [
      "使用场景", "适用场景", "UseCase", "usecase", "应用",
      "什么时候用", "适合什么", "用在哪", "应用场景",
      "白天", "夜晚", "室内", "室外", "弱光", "强光"
    ],
    "weight": 0.3,
    "required": false,
    "description": "使用场景",
    "data_type": "text",
    "domain": "photography"
  }
};

// Camera Body Schema Mappings
mappings['Camera-Body'] = {
  "ModelName": {
    "common_variations": [
      "相机型号", "相机", "机身", "型号", "ModelName", "model",
      "相机是什么", "用什么相机", "什么相机", "哪款相机",
      "索尼", "尼康", "佳能", "富士", "徕卡", "宾得", "松下",
      "Sony", "Nikon", "Canon", "Fuji", "Leica", "Pentax", "Panasonic",
      "A7", "A7M4", "A7R5", "D850", "Z9", "5D", "R5", "X-T5", "GFX"
    ],
    "weight": 0.4,
    "required": true,
    "description": "相机型号",
    "data_type": "text",
    "domain": "photography"
  },
  "Sensor": {
    "common_variations": [
      "传感器", "感光元件", "Sensor", "sensor", "CMOS", "CCD",
      "传感器尺寸", "画幅", "全画幅", "半画幅", "APS-C", "中画幅",
      "什么传感器", "传感器是什么", "多大画幅"
    ],
    "weight": 0.25,
    "required": false,
    "description": "传感器信息",
    "data_type": "text",
    "domain": "photography"
  },
  "Features": {
    "common_variations": [
      "特性", "功能", "特点", "Features", "features",
      "有什么功能", "特点是什么", "优势", "亮点",
      "防抖", "对焦", "连拍", "视频", "像素"
    ],
    "weight": 0.2,
    "required": false,
    "description": "相机特性",
    "data_type": "text",
    "domain": "photography"
  },
  "Price": {
    "common_variations": [
      "价格", "售价", "多少钱", "Price", "price",
      "价格是多少", "多少钱", "价钱", "费用", "成本",
      "元", "美元", "刀", "$", "¥", "RMB"
    ],
    "weight": 0.15,
    "required": false,
    "description": "价格",
    "data_type": "money",
    "domain": "photography"
  }
};

// Lens Recommendation Schema Mappings
mappings['Lens-Recommendation'] = {
  "LensName": {
    "common_variations": [
      "镜头名称", "镜头", "镜头型号", "LensName", "lens",
      "什么镜头", "用什么镜头", "镜头是什么", "哪个镜头",
      "定焦", "变焦", "广角", "长焦", "标准镜头", "微距",
      "35mm", "50mm", "85mm", "24-70", "70-200", "16-35"
    ],
    "weight": 0.4,
    "required": true,
    "description": "镜头名称",
    "data_type": "text",
    "domain": "photography"
  },
  "FocalLength": {
    "common_variations": [
      "焦距", "焦段", "FocalLength", "focal", "mm",
      "焦距是多少", "多少焦距", "焦段是什么",
      "35", "50", "85", "24", "70", "200", "16", "35mm", "50mm"
    ],
    "weight": 0.25,
    "required": false,
    "description": "焦距",
    "data_type": "text",
    "domain": "photography"
  },
  "Aperture": {
    "common_variations": [
      "光圈", "最大光圈", "Aperture", "aperture", "f值",
      "光圈是多少", "最大光圈是多少",
      "f1.4", "f1.8", "f2.0", "f2.8", "f4", "f5.6"
    ],
    "weight": 0.2,
    "required": false,
    "description": "光圈",
    "data_type": "text",
    "domain": "photography"
  },
  "UseCase": {
    "common_variations": [
      "使用场景", "适用场景", "UseCase", "usecase", "应用",
      "什么时候用", "适合什么", "用在哪", "应用场景",
      "人像", "风光", "街拍", "运动", "微距", "建筑"
    ],
    "weight": 0.15,
    "required": false,
    "description": "使用场景",
    "data_type": "text",
    "domain": "photography"
  }
};

// Exposure Triangle Schema Mappings
mappings['Exposure-Triangle'] = {
  "Setting": {
    "common_variations": [
      "曝光设置", "设置", "曝光三角", "Setting", "setting",
      "曝光参数", "参数设置", "如何设置", "设置是什么"
    ],
    "weight": 0.35,
    "required": true,
    "description": "曝光设置",
    "data_type": "text",
    "domain": "photography"
  },
  "Aperture": {
    "common_variations": [
      "光圈", "光圈值", "Aperture", "aperture", "f值",
      "光圈是多少", "光圈设置", "f", "F",
      "f2.8", "f4", "f5.6", "f8"
    ],
    "weight": 0.25,
    "required": false,
    "description": "光圈",
    "data_type": "text",
    "domain": "photography"
  },
  "ShutterSpeed": {
    "common_variations": [
      "快门速度", "快门", "ShutterSpeed", "shutter", "曝光时间",
      "快门是多少", "快门速度是多少",
      "1/125", "1/250", "1/500", "1/60"
    ],
    "weight": 0.2,
    "required": false,
    "description": "快门速度",
    "data_type": "text",
    "domain": "photography"
  },
  "ISO": {
    "common_variations": [
      "ISO", "iso", "感光度", "ISO值",
      "ISO是多少", "感光度是多少",
      "ISO400", "ISO800", "ISO1600"
    ],
    "weight": 0.2,
    "required": false,
    "description": "ISO",
    "data_type": "text",
    "domain": "photography"
  }
};

// Save updated mappings
fs.writeFileSync(mappingsPath, JSON.stringify(mappings, null, 2), 'utf8');

console.log('✅ Photography field mappings added successfully!');
console.log(`📊 Total schemas with mappings: ${Object.keys(mappings).length}`);
console.log('\n📝 Added mappings for:');
console.log('  - Photography-Technique');
console.log('  - Composition-Rule');
console.log('  - Camera-Settings');
console.log('  - Aperture-Setting');
console.log('  - Shutter-Speed-Setting');
console.log('  - ISO-Setting');
console.log('  - Camera-Body');
console.log('  - Lens-Recommendation');
console.log('  - Exposure-Triangle');
