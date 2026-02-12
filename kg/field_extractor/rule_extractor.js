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
  ENTITY: 'entity',
  TEXT: 'text'
};

/**
 * Extract fields from text using rules
 * @param {string} text - Input text
 * @param {Array} requiredFields - Optional array of required field definitions
 *   Each field: { name, weight, required, sources }
 * @returns {Array} Array of extracted fields
 */
function extractFields(text, requiredFields = null) {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  const fields = [];
  
  // Extract generic fields (title, content) for general documents
  fields.push(...extractGenericFields(text));
  
  // Extract semantic fields (with context) - FIRST
  fields.push(...extractSemanticFields(text));
  
  // Extract time fields
  fields.push(...extractTimeFields(text));
  
  // Extract number and unit fields
  fields.push(...extractNumberFields(text));
  
  // Extract location fields
  fields.push(...extractLocationFields(text));
  
  // Extract organization fields (NEW)
  fields.push(...extractOrganizationFields(text));
  
  // Extract indicator fields
  fields.push(...extractIndicatorFields(text));
  
  // If requiredFields is provided, perform targeted extraction
  if (requiredFields && Array.isArray(requiredFields) && requiredFields.length > 0) {
    fields.push(...extractTargetedFields(text, requiredFields));
  }
  
  return fields;
}

/**
 * Extract fields using domain-specific rules
 * @param {string} text - Input text
 * @param {string} domain - Domain type: 'project', 'business', 'government'
 * @returns {Array} Domain-specific extracted fields
 */
function extractDomainSpecificFields(text, domain) {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  switch (domain) {
    case 'project':
      return extractProjectDomainFields(text);
    case 'business':
      return extractBusinessDomainFields(text);
    case 'government':
      return extractGovernmentDomainFields(text);
    default:
      return [];
  }
}

/**
 * Extract project domain-specific fields
 * Focus: project names, locations, execution units, budgets
 * @param {string} text - Input text
 * @returns {Array} Project domain fields
 */
function extractProjectDomainFields(text) {
  const fields = [];
  
  // Project name patterns (enhanced)
  const projectPatterns = [
    // Pattern: YYYY年 + 项目名称 + 项目/工程/建设
    {
      pattern: /(\d{4}年)?([^，。；！？\n]{5,80}?)(项目|工程|建设项目|改造工程|维修工程)/g,
      fieldName: '项目名称',
      confidence: 0.9
    },
    // Pattern: XX项目 (standalone)
    {
      pattern: /([^，。；！？\n]{5,50})(项目|工程)(?=[，。；！？\n])/g,
      fieldName: '项目名称',
      confidence: 0.85
    }
  ];
  
  projectPatterns.forEach(({ pattern, fieldName, confidence }) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const projectName = match[0].trim();
      if (projectName.length >= 8 && projectName.length <= 100) {
        fields.push({
          name: fieldName,
          value: projectName,
          type: FieldType.ENTITY,
          confidence: confidence,
          domain: 'project',
          raw: match[0]
        });
      }
    }
  });
  
  // Project location patterns
  const locationPatterns = [
    // Pattern: 项目地点/建设地点：XX
    {
      pattern: /(项目地点|建设地点|工程地点|施工地点)[:：]\s*([^，。；！？\n]{3,50})/g,
      fieldName: '地点',
      confidence: 0.95
    },
    // Pattern: 位于XX
    {
      pattern: /位于([^，。；！？\n]{3,30})/g,
      fieldName: '地点',
      confidence: 0.85
    }
  ];
  
  locationPatterns.forEach(({ pattern, fieldName, confidence }) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const location = (match[2] || match[1]).trim();
      fields.push({
        name: fieldName,
        value: location,
        type: FieldType.LOCATION,
        confidence: confidence,
        domain: 'project',
        raw: match[0]
      });
    }
  });
  
  // Execution unit patterns
  const executionPatterns = [
    // Pattern: 执行单位/施工单位：XX
    {
      pattern: /(执行单位|施工单位|承建单位|建设单位)[:：]\s*([^，。；！？\n]{3,50})/g,
      fieldName: '执行单位',
      confidence: 0.95
    },
    // Pattern: 由XX负责/承担/执行
    {
      pattern: /由([^，。；！？\n]{3,30})(负责|承担|执行|施工|建设)/g,
      fieldName: '执行单位',
      confidence: 0.85
    }
  ];
  
  executionPatterns.forEach(({ pattern, fieldName, confidence }) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const unit = (match[2] || match[1]).trim();
      // Filter out generic terms
      if (unit.length >= 4 && !unit.includes('本') && !unit.includes('该')) {
        fields.push({
          name: fieldName,
          value: unit,
          type: FieldType.ENTITY,
          subtype: 'organization',
          confidence: confidence,
          domain: 'project',
          raw: match[0]
        });
      }
    }
  });
  
  // Budget patterns
  const budgetPatterns = [
    // Pattern: 项目预算/工程预算：XX元
    {
      pattern: /(项目预算|工程预算|总预算|建设预算|投资额)[:：]\s*([-+]?\d+\.?\d*)\s*(元|万元|亿元)/g,
      fieldName: '预算',
      confidence: 0.95
    },
    // Pattern: 预算XX万元
    {
      pattern: /预算([-+]?\d+\.?\d*)\s*(万元|亿元)/g,
      fieldName: '预算',
      confidence: 0.9
    }
  ];
  
  budgetPatterns.forEach(({ pattern, fieldName, confidence }) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const amount = match[2] || match[1];
      const unit = match[3] || match[2];
      fields.push({
        name: fieldName,
        value: `${amount}${unit}`,
        type: FieldType.NUMBER,
        confidence: confidence,
        domain: 'project',
        raw: match[0]
      });
    }
  });
  
  return fields;
}

/**
 * Extract business domain-specific fields
 * Focus: companies, contracts, amounts, dates
 * @param {string} text - Input text
 * @returns {Array} Business domain fields
 */
function extractBusinessDomainFields(text) {
  const fields = [];
  
  // Company patterns
  const companyPatterns = [
    // Pattern: 甲方/乙方：公司名称
    {
      pattern: /(甲方|乙方|买方|卖方|供应商|采购方)[:：]\s*([^，。；！？\n]{3,50}(?:公司|企业|集团|有限公司|股份有限公司))/g,
      fieldName: '公司',
      confidence: 0.95
    },
    // Pattern: 公司名称 (standalone with company suffix)
    {
      pattern: /([^，。；！？\n]{3,30}(?:有限公司|股份有限公司|集团公司))/g,
      fieldName: '公司',
      confidence: 0.85
    }
  ];
  
  companyPatterns.forEach(({ pattern, fieldName, confidence }) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const company = (match[2] || match[1]).trim();
      if (company.length >= 5 && !company.includes('本') && !company.includes('该')) {
        fields.push({
          name: fieldName,
          value: company,
          type: FieldType.ENTITY,
          subtype: 'company',
          confidence: confidence,
          domain: 'business',
          raw: match[0]
        });
      }
    }
  });
  
  // Contract patterns
  const contractPatterns = [
    // Pattern: 合同编号：XX
    {
      pattern: /(合同编号|合同号|协议编号)[:：]\s*([A-Z0-9\-]{5,30})/g,
      fieldName: '合同编号',
      confidence: 0.95
    },
    // Pattern: 合同名称：XX
    {
      pattern: /(合同名称|协议名称)[:：]\s*([^，。；！？\n]{5,50})/g,
      fieldName: '合同名称',
      confidence: 0.9
    }
  ];
  
  contractPatterns.forEach(({ pattern, fieldName, confidence }) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const value = match[2].trim();
      fields.push({
        name: fieldName,
        value: value,
        type: 'text',
        confidence: confidence,
        domain: 'business',
        raw: match[0]
      });
    }
  });
  
  // Amount patterns
  const amountPatterns = [
    // Pattern: 合同金额/交易金额：XX元
    {
      pattern: /(合同金额|交易金额|成交金额|总金额|总价)[:：]\s*([-+]?\d+\.?\d*)\s*(元|万元|亿元)/g,
      fieldName: '金额',
      confidence: 0.95
    },
    // Pattern: 单价：XX元
    {
      pattern: /(单价|价格)[:：]\s*([-+]?\d+\.?\d*)\s*(元|万元)/g,
      fieldName: '单价',
      confidence: 0.9
    }
  ];
  
  amountPatterns.forEach(({ pattern, fieldName, confidence }) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const amount = match[2];
      const unit = match[3];
      fields.push({
        name: fieldName,
        value: `${amount}${unit}`,
        type: FieldType.NUMBER,
        confidence: confidence,
        domain: 'business',
        raw: match[0]
      });
    }
  });
  
  // Date patterns (business-specific)
  const datePatterns = [
    // Pattern: 签订日期/生效日期：XX
    {
      pattern: /(签订日期|生效日期|合同日期|交易日期)[:：]\s*(\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?)/g,
      fieldName: '日期',
      confidence: 0.95
    },
    // Pattern: 有效期：XX至XX
    {
      pattern: /(有效期|合同期限)[:：]\s*([^，。；！？\n]{5,30})/g,
      fieldName: '有效期',
      confidence: 0.9
    }
  ];
  
  datePatterns.forEach(({ pattern, fieldName, confidence }) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const date = match[2].trim();
      fields.push({
        name: fieldName,
        value: date,
        type: FieldType.TIME,
        confidence: confidence,
        domain: 'business',
        raw: match[0]
      });
    }
  });
  
  return fields;
}

/**
 * Extract government domain-specific fields
 * Focus: government agencies, policies, regulations
 * @param {string} text - Input text
 * @returns {Array} Government domain fields
 */
function extractGovernmentDomainFields(text) {
  const fields = [];
  
  // Government agency patterns
  const agencyPatterns = [
    // Pattern: XX政府/XX部门
    {
      pattern: /([^，。；！？\n]{2,15}(?:政府|市政府|区政府|县政府|人民政府))/g,
      fieldName: '政府机构',
      confidence: 0.95
    },
    // Pattern: XX局/XX委/XX厅
    {
      pattern: /([^，。；！？\n]{2,15}(?:局|委员会|办公室|厅|部|司))/g,
      fieldName: '政府部门',
      confidence: 0.85
    },
    // Pattern: 发文单位：XX
    {
      pattern: /(发文单位|发文机关|制定机关)[:：]\s*([^，。；！？\n]{3,30})/g,
      fieldName: '发文单位',
      confidence: 0.95
    }
  ];
  
  agencyPatterns.forEach(({ pattern, fieldName, confidence }) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const agency = (match[2] || match[1]).trim();
      // Filter out generic terms
      if (agency.length >= 4 && !agency.includes('本') && !agency.includes('该')) {
        fields.push({
          name: fieldName,
          value: agency,
          type: FieldType.ENTITY,
          subtype: 'government',
          confidence: confidence,
          domain: 'government',
          raw: match[0]
        });
      }
    }
  });
  
  // Policy patterns
  const policyPatterns = [
    // Pattern: 政策名称 (with policy keywords)
    {
      pattern: /([^，。；！？\n]{5,50}(?:政策|办法|规定|条例|通知|意见|方案))/g,
      fieldName: '政策',
      confidence: 0.85
    },
    // Pattern: 文件名称：XX
    {
      pattern: /(文件名称|政策名称|文件标题)[:：]\s*([^，。；！？\n]{5,50})/g,
      fieldName: '政策',
      confidence: 0.9
    }
  ];
  
  policyPatterns.forEach(({ pattern, fieldName, confidence }) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const policy = (match[2] || match[1]).trim();
      if (policy.length >= 6 && policy.length <= 80) {
        fields.push({
          name: fieldName,
          value: policy,
          type: 'text',
          confidence: confidence,
          domain: 'government',
          raw: match[0]
        });
      }
    }
  });
  
  // Regulation patterns
  const regulationPatterns = [
    // Pattern: 文号：XX
    {
      pattern: /(文号|发文字号|文件编号)[:：]\s*([^\s，。；！？\n]{5,30})/g,
      fieldName: '文号',
      confidence: 0.95
    },
    // Pattern: XX号文件
    {
      pattern: /([^\s，。；！？\n]{5,20}号)(?=文件|文|通知)/g,
      fieldName: '文号',
      confidence: 0.85
    }
  ];
  
  regulationPatterns.forEach(({ pattern, fieldName, confidence }) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const regulation = (match[2] || match[1]).trim();
      fields.push({
        name: fieldName,
        value: regulation,
        type: 'text',
        confidence: confidence,
        domain: 'government',
        raw: match[0]
      });
    }
  });
  
  // Implementation date patterns
  const implementationPatterns = [
    // Pattern: 实施日期/生效日期：XX
    {
      pattern: /(实施日期|生效日期|发布日期|印发日期)[:：]\s*(\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?)/g,
      fieldName: '实施日期',
      confidence: 0.95
    },
    // Pattern: 自XX起实施
    {
      pattern: /自(\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?)起(实施|生效|施行)/g,
      fieldName: '实施日期',
      confidence: 0.9
    }
  ];
  
  implementationPatterns.forEach(({ pattern, fieldName, confidence }) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const date = (match[2] || match[1]).trim();
      fields.push({
        name: fieldName,
        value: date,
        type: FieldType.TIME,
        confidence: confidence,
        domain: 'government',
        raw: match[0]
      });
    }
  });
  
  return fields;
}

/**
 * Extract generic fields (title, content) for general documents
 * @param {string} text - Input text
 * @returns {Array} Generic fields
 */
function extractGenericFields(text) {
  const fields = [];
  
  // Extract title from first line
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    // Use first line as title (limit to 50 chars)
    const title = firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
    fields.push({
      name: 'title',
      value: title,
      type: 'text',
      confidence: 0.9
    });
  }
  
  // Extract content (the full text)
  fields.push({
    name: 'content',
    value: text,
    type: 'text',
    confidence: 0.95
  });
  
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
    /([A-Z]\s*区)/g,
    
    // Pattern 5: 完整地址（省市区）
    /([^，。；！？\s]{2,6}省[^，。；！？\s]{2,6}市[^，。；！？\s]{2,6}[区县])/g,
    
    // Pattern 6: 省市组合
    /([^，。；！？\s]{2,6}省[^，。；！？\s]{2,6}市)/g
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const location = match[0].trim();
      
      // Avoid duplicates
      if (!fields.some(f => f.value === location)) {
        fields.push({
          name: '地点',  // 改为"地点"以匹配schema
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
 * Extract organization/company fields
 * @param {string} text - Input text
 * @returns {Array} Organization fields
 */
function extractOrganizationFields(text) {
  const fields = [];
  
  // Organization patterns
  const patterns = [
    // Pattern 1: XX公司/企业/集团
    /([^，。；！？\s]{2,20}(?:公司|企业|集团|有限公司|股份有限公司))/g,
    
    // Pattern 2: XX单位/机构/部门
    /([^，。；！？\s]{2,15}(?:单位|机构|部门|局|委员会|中心|研究所))/g,
    
    // Pattern 3: 政府机构
    /([^，。；！？\s]{2,10}(?:政府|市政府|区政府|县政府))/g
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const org = match[0].trim();
      
      // Filter out common false positives
      if (org.length < 4 || org.includes('本') || org.includes('该')) {
        continue;
      }
      
      // Avoid duplicates
      if (!fields.some(f => f.value === org)) {
        // 尝试匹配schema的字段名
        let fieldName = '实体';
        if (text.includes('执行') && text.indexOf('执行') < text.indexOf(org)) {
          fieldName = '执行单位';
        } else if (text.includes('负责') && text.indexOf('负责') < text.indexOf(org)) {
          fieldName = '负责单位';
        } else if (text.includes('参与') && text.indexOf('参与') < text.indexOf(org)) {
          fieldName = '参与单位';
        }
        
        fields.push({
          name: fieldName,
          value: org,
          type: FieldType.ENTITY,
          subtype: 'organization',
          confidence: 0.75,
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
 * Extract targeted fields based on requiredFields parameter
 * Uses specialized extraction rules for specific field types
 * @param {string} text - Input text
 * @param {Array} requiredFields - Array of required field definitions
 * @returns {Array} Extracted targeted fields
 */
function extractTargetedFields(text, requiredFields) {
  const fields = [];
  
  // Create a map of field names for quick lookup
  const requiredFieldNames = new Set(requiredFields.map(f => f.name));
  
  // Targeted extraction rules for common field types
  const targetedRules = {
    // Location-related fields
    '地点': () => extractLocationFields(text),
    '位置': () => extractLocationFields(text),
    'location': () => extractLocationFields(text),
    
    // Organization-related fields
    '执行单位': () => extractOrganizationFields(text),
    '负责单位': () => extractOrganizationFields(text),
    '参与单位': () => extractOrganizationFields(text),
    '单位': () => extractOrganizationFields(text),
    '组织': () => extractOrganizationFields(text),
    'organization': () => extractOrganizationFields(text),
    
    // Project-related fields
    '项目名称': () => extractProjectNames(text),
    '项目': () => extractProjectNames(text),
    'project': () => extractProjectNames(text),
    
    // Time-related fields
    '时间': () => extractTimeFields(text),
    '日期': () => extractTimeFields(text),
    'time': () => extractTimeFields(text),
    'date': () => extractTimeFields(text),
    
    // Person-related fields
    '负责人': () => extractPersonNames(text),
    '联系人': () => extractPersonNames(text),
    'person': () => extractPersonNames(text),
    
    // Amount-related fields
    '金额': () => extractAmounts(text),
    '预算': () => extractAmounts(text),
    'amount': () => extractAmounts(text),
    'budget': () => extractAmounts(text)
  };
  
  // Execute targeted extraction for each required field
  requiredFields.forEach(requiredField => {
    const fieldName = requiredField.name;
    
    // Check if we have a specialized rule for this field
    if (targetedRules[fieldName]) {
      const extractedFields = targetedRules[fieldName]();
      
      // Add extracted fields with the required field name
      extractedFields.forEach(field => {
        // Update field name to match the required field name
        fields.push({
          ...field,
          name: fieldName,
          targetedExtraction: true,
          requiredField: true,
          weight: requiredField.weight,
          required: requiredField.required
        });
      });
    }
  });
  
  return fields;
}

/**
 * Extract project names from text
 * @param {string} text - Input text
 * @returns {Array} Project name fields
 */
function extractProjectNames(text) {
  const fields = [];
  
  // Pattern: YYYY年 + 项目名称 + 项目/工程/建设
  const pattern = /(\d{4}年)?([^，。；！？\n]{5,80}?)(项目|工程|建设|采购)/g;
  let match;
  
  while ((match = pattern.exec(text)) !== null) {
    const year = match[1] || '';
    const name = match[2].trim();
    const suffix = match[3];
    const fullName = `${year}${name}${suffix}`.trim();
    
    // Only add if it looks like a valid project name
    if (fullName.length >= 10 && fullName.length <= 100) {
      fields.push({
        name: '项目名称',
        value: fullName,
        type: FieldType.ENTITY,
        confidence: 0.85,
        raw: match[0]
      });
    }
  }
  
  return fields;
}

/**
 * Extract person names from text
 * @param {string} text - Input text
 * @returns {Array} Person name fields
 */
function extractPersonNames(text) {
  const fields = [];
  
  // Pattern: 负责人/联系人：姓名
  const patterns = [
    /(负责人|联系人|项目经理|主管)[:：]\s*([^\s，。；！？\n]{2,4})/g,
    // Pattern: 姓名 + 职位
    /([^\s，。；！？\n]{2,4})(经理|主管|总监|负责人|联系人)/g
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[2] || match[1];
      
      // Basic validation: Chinese names are typically 2-4 characters
      if (name.length >= 2 && name.length <= 4) {
        fields.push({
          name: '负责人',
          value: name.trim(),
          type: FieldType.ENTITY,
          subtype: 'person',
          confidence: 0.7,
          raw: match[0]
        });
      }
    }
  });
  
  return fields;
}

/**
 * Extract amounts/budgets from text
 * @param {string} text - Input text
 * @returns {Array} Amount fields
 */
function extractAmounts(text) {
  const fields = [];
  
  // Pattern: 金额/预算：数值 + 单位
  const patterns = [
    /(预算金额|合同金额|总价|金额|预算)[:：]\s*([-+]?\d+\.?\d*)\s*(元|万元|亿元)?/g,
    // Pattern: 数值 + 万元/亿元
    /([-+]?\d+\.?\d*)\s*(万元|亿元)/g
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const amount = match[2] || match[1];
      const unit = match[3] || match[2];
      
      fields.push({
        name: '金额',
        value: `${amount}${unit || ''}`,
        type: FieldType.NUMBER,
        confidence: 0.9,
        raw: match[0]
      });
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
  // 注意：保留"地点"、"执行单位"、"负责单位"等关键字段
  const genericNamesToFilter = ['数值', '单位', '实体', '区域', '指标', '对象', '项目', '内容', '值', '类型', '名称', '位置', '参数', '属性'];
  
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
  extractOrganizationFields,
  extractIndicatorFields,
  extractTargetedFields,
  extractProjectNames,
  extractPersonNames,
  extractAmounts,
  deduplicateFields,
  extractDomainSpecificFields,
  extractProjectDomainFields,
  extractBusinessDomainFields,
  extractGovernmentDomainFields,
  FieldType
};
