/**
 * Semantic Categories for Field Classification
 * 
 * Defines semantic categories for field names to improve field matching accuracy.
 * Used by intelligent truncating strategy to calculate semantic relevance scores.
 * 
 * Design Reference: Intelligent Field Truncating Strategy
 * Validates: Requirements 19.3
 */

/**
 * Semantic categories mapping
 * Each category contains a list of field names that belong to that semantic category
 */
const SEMANTIC_CATEGORIES = {
  temporal: ['时间', '日期', '时刻', '时段', '年份', '月份', '时间点', '发生时间', '记录时间', '开始时间', '结束时间', '持续时间', '时长', 'duration', '耗时'],
  spatial: ['区域', '地区', '地点', '位置', '场所', '地域', '发生地点', '地址', '坐标', 'location', 'place'],
  quantitative: ['数值', '数量', '值', '大小', '量', '个数', '总数', '计数', 'value', 'amount'],
  unit: ['单位', '计量单位', '度量单位', 'unit'],
  identifier: ['名称', '标识', 'ID', '编号', '代码', '名字', '标题', '称呼', 'name', 'id', 'code'],
  categorical: ['类型', '种类', '分类', '类别', '类型名称', 'type', 'category'],
  descriptive: ['描述', '说明', '备注', '注释', '详细描述', '内容', '正文', '文本', '详情', 'description', 'note'],
  status: ['状态', '情况', '状况', '态势', '当前状态', '阶段', 'status', 'state'],
  result: ['结果', '成果', '产出', '输出', '最终结果', 'result', 'output'],
  source: ['来源', '出处', '源头', '引用', 'source'],
  author: ['作者', '创建者', '发布者', '撰写人', 'author', 'creator'],
  tag: ['标签', '关键词', '分类标签', 'tag', 'keyword'],
  rating: ['评分', '打分', '评价', '得分', 'rating', 'score'],
  price: ['价格', '费用', '金额', '成本', 'price', 'cost'],
  frequency: ['频率', '次数', '频次', '发生频率', 'frequency']
};

/**
 * Universal field names that are commonly used across different schemas
 * These fields get higher importance scores
 */
const UNIVERSAL_FIELDS = [
  '时间', '区域', '地点', '数值', '单位', '名称', '类型', '状态',
  '日期', '位置', '值', '描述', '标识', 'ID'
];

/**
 * Get semantic category for a field name
 * 
 * @param {string} fieldName - Field name to classify
 * @returns {string} Semantic category name or 'other' if not found
 * 
 * @example
 * getSemanticCategory('时间') // returns 'temporal'
 * getSemanticCategory('区域') // returns 'spatial'
 * getSemanticCategory('未知字段') // returns 'other'
 */
function getSemanticCategory(fieldName) {
  for (const [category, keywords] of Object.entries(SEMANTIC_CATEGORIES)) {
    if (keywords.includes(fieldName)) {
      return category;
    }
  }
  return 'other';
}

/**
 * Check if a field name is a universal field
 * 
 * @param {string} fieldName - Field name to check
 * @returns {boolean} True if field is universal
 * 
 * @example
 * isUniversalField('时间') // returns true
 * isUniversalField('备注') // returns false
 */
function isUniversalField(fieldName) {
  return UNIVERSAL_FIELDS.includes(fieldName);
}

/**
 * Get all field names in a semantic category
 * 
 * @param {string} category - Category name
 * @returns {Array<string>} Array of field names in that category
 * 
 * @example
 * getFieldsInCategory('temporal') // returns ['时间', '日期', '时刻', ...]
 */
function getFieldsInCategory(category) {
  return SEMANTIC_CATEGORIES[category] || [];
}

/**
 * Get all available semantic categories
 * 
 * @returns {Array<string>} Array of category names
 */
function getAllCategories() {
  return Object.keys(SEMANTIC_CATEGORIES);
}

module.exports = {
  SEMANTIC_CATEGORIES,
  UNIVERSAL_FIELDS,
  getSemanticCategory,
  isUniversalField,
  getFieldsInCategory,
  getAllCategories
};
