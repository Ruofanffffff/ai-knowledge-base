/**
 * Rule-Based Field Extractor
 * 
 * Extracts structured fields from text using regex patterns and rules
 * This is the primary extraction method (0 Token cost)
 */

/**
 * Field types
 */
const FieldType = {
  LOCATION: 'location',
  TIME: 'time',
  NUMBER: 'number',
  UNIT: 'unit',
  INDICATOR: 'indicator',
  ENTITY: 'entity'
};

/**
 * Extract fields from text using rules
 * @param {string} text - Input text
 * @returns {Array} Array of extracted fields
 */
function extractFields(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  const fields = [];
  
  // Extract semantic fields (with context) - FIRST
  fields.push(...extractSemanticFields(text));
  
  // Extract time fields
  fields.push(...extractTimeFields(text));
  
  // Extract number and unit fields
  fields.push(...extractNumberFields(text));
  
  // Extract location fields
  fields.push(...extractLocationFields(text));
  
  // Extract indicator fields
  fields.push(...extractIndicatorFields(text));
  
  return fields;
}

/**
 * Extract semantic fields with context
 * Captures field names with their values based on common patterns
 * @param {string} text - Input text
 * @returns {Array} Semantic fields
 */
function extractSemanticFields(text) {
  const fields = [];
  
  // Photography-specific patterns (FIRST - highest priority)
  const photographyPatterns = [
    // Pattern: 焦距：55 mm
    {
      pattern: /焦距[:：]\s*(\d+\.?\d*)\s*(mm|毫米)?/gi,
      fieldName: 'FocalLength',
      fieldType: 'photography',
      confidence: 0.98
    },
    // Pattern: F 值：1.8 or F值：1.8 or 光圈：f/1.8
    {
      pattern: /(?:F\s*值|光圈)[:：]\s*[fF]?\/?(\d+\.?\d*)/gi,
      fieldName: 'Aperture',
      fieldType: 'photography',
      confidence: 0.98
    },
    // Pattern: 快门速度：1/250 秒
    {
      pattern: /快门速度[:：]\s*(1\/\d+|\d+\.?\d*)\s*秒?/gi,
      fieldName: 'ShutterSpeed',
      fieldType: 'photography',
      confidence: 0.98
    },
    // Pattern: ISO：100 or 感光度：100
    {
      pattern: /(?:ISO|感光度)[:：]\s*(\d+)/gi,
      fieldName: 'ISO',
      fieldType: 'photography',
      confidence: 0.98
    },
    // Pattern: 镜头型号 SEL35F18F (单独出现)
    {
      pattern: /\b(SEL\d{2,3}[A-Z0-9]{2,6})\b/gi,
      fieldName: 'LensModel',
      fieldType: 'photography',
      confidence: 0.98
    },
    // Pattern: 镜头：SEL35F18F or 产品：SEL35F18F
    {
      pattern: /(?:镜头|产品)[:：]?\s*([A-Z0-9]{6,})/gi,
      fieldName: 'LensModel',
      fieldType: 'photography',
      confidence: 0.95
    },
    // Pattern: 相机模式：A 模式 or 拍摄模式：光圈优先
    {
      pattern: /(?:相机模式|拍摄模式)[:：]\s*([^\n，。；]{2,20})/gi,
      fieldName: 'ShootingMode',
      fieldType: 'photography',
      confidence: 0.9
    },
    // Pattern: 白平衡：自动 or 对焦模式：单次
    {
      pattern: /(?:白平衡|对焦模式|驱动模式)[:：]\s*([^\n，。；]{2,10})/gi,
      fieldName: 'CameraSetting',
      fieldType: 'photography',
      confidence: 0.9
    }
  ];
  
  // Extract photography fields first
  photographyPatterns.forEach(({ pattern, fieldName, fieldType, confidence }) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const fieldValue = match[1].trim();
      
      fields.push({
        name: fieldName,
        value: fieldValue,
        type: fieldType,
        confidence: confidence,
        raw: match[0]
      });
    }
  });
  
  // Common semantic patterns: "字段名：值" or "字段名: 值"
  const semanticPatterns = [
    // Pattern 1: 字段名：数值+单位
    {
      pattern: /(预算金额|合同金额|总价|单价|费用|成本|价格|报价)[:：]\s*([-+]?\d+\.?\d*)\s*(元|万元|亿元)?/g,
      fieldType: 'number',
      confidence: 0.95
    },
    // Pattern 2: 字段名：时间
    {
      pattern: /(建设周期|工期|交货期|服务期|售后服务期|质保期|有效期)[:：]\s*([^，。；！？\n]{5,50})/g,
      fieldType: 'time',
      confidence: 0.9
    },
    // Pattern 3: 字段名：地点
    {
      pattern: /(交货地点|地点|位置|地址|场所)[:：]\s*([^，。；！？\n]{5,50})/g,
      fieldType: 'location',
      confidence: 0.9
    },
    // Pattern 4: 字段名：方式
    {
      pattern: /(交货方式|付款方式|支付方式|结算方式)[:：]\s*([^，。；！？\n]{5,50})/g,
      fieldType: 'method',
      confidence: 0.9
    },
    // Pattern 5: 字段名：要求
    {
      pattern: /(质量要求|技术要求|性能要求|功能要求)[:：]\s*([^，。；！？\n]{5,100})/g,
      fieldType: 'requirement',
      confidence: 0.85
    },
    // Pattern 6: 项目名称 (longer pattern to capture full project name)
    {
      pattern: /(\d{4}年)?([^，。；！？\n]{5,80}?)(项目|工程|建设|采购)/g,
      fieldType: 'entity',
      confidence: 0.85,
      fieldName: '项目名称'
    },
    // Pattern 7: 采购人/供应商
    {
      pattern: /(采购人|供应商|投标人|中标人|招标人)[:：]\s*([^，。；！？\n]{2,50})/g,
      fieldType: 'entity',
      confidence: 0.9
    }
  ];
  
  semanticPatterns.forEach(({ pattern, fieldType, confidence, fieldName }) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // For pattern 6 (project name), construct the full name
      if (fieldName === '项目名称') {
        const year = match[1] || '';
        const name = match[2].trim();
        const suffix = match[3];
        const fullName = `${year}${name}${suffix}`.trim();
        
        // Only add if it looks like a valid project name
        if (fullName.length >= 10 && fullName.length <= 100) {
          fields.push({
            name: '项目名称',
            value: fullName,
            type: fieldType,
            confidence: confidence,
            raw: match[0]
          });
        }
      } else {
        const extractedFieldName = match[1];
        const fieldValue = match[2].trim();
        
        // Extract unit if present
        const unit = match[3];
        
        fields.push({
          name: extractedFieldName,
          value: fieldValue,
          type: fieldType,
          confidence: confidence,
          raw: match[0]
        });
        
        // If unit is present, add it as a separate field
        if (unit) {
          fields.push({
            name: '单位',
            value: unit,
            type: FieldType.UNIT,
            confidence: 1.0,
            raw: match[0]
          });
        }
      }
    }
  });
  
  return fields;
}

/**
 * Extract time-related fields
 * @param {string} text - Input text
 * @returns {Array} Time fields
 */
function extractTimeFields(text) {
  const fields = [];
  
  // Pattern 1: YYYY年MM月DD日
  const pattern1 = /(\d{4})年(\d{1,2})月(\d{1,2})日/g;
  let match;
  while ((match = pattern1.exec(text)) !== null) {
    fields.push({
      name: '时间',
      value: `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`,
      type: FieldType.TIME,
      confidence: 1.0,
      raw: match[0]
    });
  }
  
  // Pattern 2: YYYY年MM月
  const pattern2 = /(\d{4})年(\d{1,2})月/g;
  while ((match = pattern2.exec(text)) !== null) {
    fields.push({
      name: '时间',
      value: `${match[1]}-${match[2].padStart(2, '0')}`,
      type: FieldType.TIME,
      confidence: 1.0,
      raw: match[0]
    });
  }
  
  // Pattern 3: YYYY-MM-DD
  const pattern3 = /(\d{4})-(\d{1,2})-(\d{1,2})/g;
  while ((match = pattern3.exec(text)) !== null) {
    fields.push({
      name: '时间',
      value: `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`,
      type: FieldType.TIME,
      confidence: 0.95,
      raw: match[0]
    });
  }
  
  // Pattern 4: YYYY/MM/DD
  const pattern4 = /(\d{4})\/(\d{1,2})\/(\d{1,2})/g;
  while ((match = pattern4.exec(text)) !== null) {
    fields.push({
      name: '时间',
      value: `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`,
      type: FieldType.TIME,
      confidence: 0.95,
      raw: match[0]
    });
  }
  
  return fields;
}

/**
 * Extract number and unit fields
 * @param {string} text - Input text
 * @returns {Array} Number and unit fields
 */
function extractNumberFields(text) {
  const fields = [];
  
  // Common units
  const units = [
    '米', '公里', '千米', '厘米', '毫米',
    '吨', '千克', '公斤', '克', '毫克',
    '升', '毫升', '立方米',
    '元', '万元', '亿元', '美元', '欧元',
    '度', '摄氏度', '华氏度',
    '个', '件', '台', '辆', '人',
    '%', '百分比', '比例'
  ];
  
  const unitPattern = units.join('|');
  
  // Pattern: 数值 + 单位
  const pattern = new RegExp(`([-+]?\\d+\\.?\\d*)\\s*(${unitPattern})`, 'g');
  let match;
  
  while ((match = pattern.exec(text)) !== null) {
    const number = parseFloat(match[1]);
    const unit = match[2];
    
    // Add number field
    fields.push({
      name: '数值',
      value: match[1],
      type: FieldType.NUMBER,
      confidence: 1.0,
      raw: match[0]
    });
    
    // Add unit field
    fields.push({
      name: '单位',
      value: unit,
      type: FieldType.UNIT,
      confidence: 1.0,
      raw: match[0]
    });
  }
  
  // Pattern: 纯数字（可能是数值）
  const pureNumberPattern = /(?<!\d)([-+]?\d+\.?\d*)(?!\d)/g;
  while ((match = pureNumberPattern.exec(text)) !== null) {
    // Only add if not already captured with unit
    const alreadyCaptured = fields.some(f => 
      f.raw && text.indexOf(f.raw) <= match.index && 
      text.indexOf(f.raw) + f.raw.length >= match.index
    );
    
    if (!alreadyCaptured) {
      fields.push({
        name: '数值',
        value: match[1],
        type: FieldType.NUMBER,
        confidence: 0.7,
        raw: match[0]
      });
    }
  }
  
  return fields;
}

/**
 * Extract location fields
 * @param {string} text - Input text
 * @returns {Array} Location fields
 */
function extractLocationFields(text) {
  const fields = [];
  
  // Common location patterns
  const patterns = [
    // Pattern 1: XX省XX市XX区/县
    /([^，。；！？\s]{2,6}省)?([^，。；！？\s]{2,6}市)?([^，。；！？\s]{2,6}[区县])/g,
    
    // Pattern 2: XX区域/地区
    /([^，。；！？\s]{2,10}[区域地带])/g,
    
    // Pattern 3: 方位词 + 区域
    /(东|西|南|北|中|东南|东北|西南|西北)([^，。；！？\s]{1,6}[区域地带])/g,
    
    // Pattern 4: 字母+数字组合（如 A区、C区）
    /([A-Z]\s*区)/g
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const location = match[0].trim();
      
      // Avoid duplicates
      if (!fields.some(f => f.value === location)) {
        fields.push({
          name: '区域',
          value: location,
          type: FieldType.LOCATION,
          confidence: 0.8,
          raw: match[0]
        });
      }
    }
  });
  
  return fields;
}

/**
 * Extract indicator fields (metrics, measurements)
 * @param {string} text - Input text
 * @returns {Array} Indicator fields
 */
function extractIndicatorFields(text) {
  const fields = [];
  
  // Common indicators
  const indicators = [
    '水位', '温度', '湿度', '压力', '流量', '速度',
    '浓度', '密度', '强度', '频率', '电压', '电流',
    '功率', '能耗', '产量', '销量', '收入', '利润',
    '人口', '面积', '体积', '重量', '长度', '宽度',
    '高度', '深度', '厚度', '距离', '时长', '次数'
  ];
  
  indicators.forEach(indicator => {
    const pattern = new RegExp(`(${indicator})`, 'g');
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      // Avoid duplicates
      if (!fields.some(f => f.value === indicator && f.type === FieldType.INDICATOR)) {
        fields.push({
          name: '指标',
          value: indicator,
          type: FieldType.INDICATOR,
          confidence: 0.9,
          raw: match[0]
        });
      }
    }
  });
  
  return fields;
}

/**
 * Deduplicate fields based on value and type
 * Prioritizes semantic fields (with specific names) over generic fields
 * @param {Array} fields - Array of fields
 * @returns {Array} Deduplicated fields
 */
function deduplicateFields(fields) {
  // Generic field names that should be filtered out completely
  const genericNamesToFilter = ['数值', '单位', '实体', '区域', '指标', '对象', '项目', '内容', '值', '类型', '名称', '位置', '地点', '参数', '属性'];
  
  // Filter out generic field names first
  const filtered = fields.filter(field => {
    // Check if field name is in the generic list
    if (genericNamesToFilter.includes(field.name)) {
      return false;
    }
    // Check if field name is too short (likely generic)
    if (field.name.length === 1) {
      return false;
    }
    return true;
  });
  
  const seen = new Map();
  
  // Sort by confidence (higher confidence first)
  const sorted = filtered.sort((a, b) => b.confidence - a.confidence);
  
  // Deduplicate based on value and type
  return sorted.filter(field => {
    const key = `${field.type}:${field.value}`;
    if (seen.has(key)) {
      return false;
    }
    seen.set(key, field);
    return true;
  });
}

module.exports = {
  extractFields,
  extractSemanticFields,
  extractTimeFields,
  extractNumberFields,
  extractLocationFields,
  extractIndicatorFields,
  deduplicateFields,
  FieldType
};
