/**
 * Field Normalizers
 * 
 * 字段值标准化策略，用于锚点指纹生成。
 * 
 * 核心原则：
 * - 确定性：相同输入必须产生相同输出
 * - 标准化：将不同表达方式归一化为统一格式
 * - 可扩展：支持添加新的标准化策略
 */

/**
 * 时间标准化 - 月份
 * "2025-01-15" → "2025-01"
 * "2025年1月" → "2025-01"
 * 
 * @param {string} value - 时间值
 * @returns {string} 标准化后的月份
 */
function normalizeToMonth(value) {
  if (!value) return '';

  const str = String(value);

  // 匹配 YYYY-MM-DD 或 YYYY-MM 格式
  let match = str.match(/(\d{4})[-/](\d{1,2})/);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    return `${year}-${month}`;
  }

  // 匹配中文格式：2025年1月
  match = str.match(/(\d{4})年(\d{1,2})月?/);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    return `${year}-${month}`;
  }

  // 如果无法解析，返回原值
  return str.trim();
}

/**
 * 时间标准化 - 年份
 * "2025-01-15" → "2025"
 * "2025年" → "2025"
 * 
 * @param {string} value - 时间值
 * @returns {string} 标准化后的年份
 */
function normalizeToYear(value) {
  if (!value) return '';

  const str = String(value);

  // 匹配四位数字年份
  const match = str.match(/(\d{4})/);
  if (match) {
    return match[1];
  }

  return str.trim();
}

/**
 * 时间标准化 - 日期
 * "2025-01-15" → "2025-01-15"
 * "2025年1月15日" → "2025-01-15"
 * 
 * @param {string} value - 时间值
 * @returns {string} 标准化后的日期
 */
function normalizeToDay(value) {
  if (!value) return '';

  const str = String(value);

  // 匹配 YYYY-MM-DD 格式
  let match = str.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 匹配中文格式：2025年1月15日
  match = str.match(/(\d{4})年(\d{1,2})月(\d{1,2})日?/);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return str.trim();
}

/**
 * 地点标准化
 * "阿里C区" → "ali_c_zone"
 * "青森美术馆" → "aomori_museum"
 * 
 * @param {string} value - 地点值
 * @returns {string} 标准化后的地点
 */
function normalizeLocation(value) {
  if (!value) return '';

  let normalized = String(value)
    .toLowerCase()
    .trim();

  // 替换空格、连字符为下划线
  normalized = normalized.replace(/[\s\-]+/g, '_');

  // 中文地点词汇映射
  const locationMappings = {
    '区': '_zone',
    '域': '_area',
    '美术馆': '_museum',
    '博物馆': '_museum',
    '公园': '_park',
    '广场': '_square',
    '大厦': '_building',
    '中心': '_center'
  };

  // 应用映射
  for (const [chinese, english] of Object.entries(locationMappings)) {
    normalized = normalized.replace(new RegExp(chinese, 'g'), english);
  }

  // 移除重音符号
  normalized = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // 移除特殊字符，只保留字母、数字、下划线
  normalized = normalized.replace(/[^a-z0-9_]/g, '_');

  // 移除连续下划线
  normalized = normalized.replace(/_+/g, '_');

  // 移除首尾下划线
  normalized = normalized.replace(/^_+|_+$/g, '');

  return normalized;
}

/**
 * 指标标准化
 * "地下水位" → "groundwater_level"
 * "水位" → "water_level"
 * 
 * @param {string} value - 指标值
 * @returns {string} 标准化后的指标
 */
function normalizeIndicator(value) {
  if (!value) return '';

  const str = String(value).trim();

  // 常见指标映射表
  const indicatorMap = {
    '地下水位': 'groundwater_level',
    '水位': 'water_level',
    '温度': 'temperature',
    '湿度': 'humidity',
    '降雨量': 'rainfall',
    '降水量': 'precipitation',
    '气压': 'pressure',
    '风速': 'wind_speed',
    '能见度': 'visibility',
    '污染指数': 'pollution_index',
    'PM2.5': 'pm25',
    'PM10': 'pm10',
    '二氧化碳': 'co2',
    '氧气': 'oxygen',
    '噪音': 'noise'
  };

  // 检查是否有直接映射
  if (indicatorMap[str]) {
    return indicatorMap[str];
  }

  // 如果没有映射，转换为小写并替换空格
  return str
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * 小写标准化
 * 
 * @param {string} value - 输入值
 * @returns {string} 小写后的值
 */
function normalizeLowercase(value) {
  if (!value) return '';
  return String(value).toLowerCase().trim();
}

/**
 * 默认标准化（仅trim）
 * 
 * @param {string} value - 输入值
 * @returns {string} trim后的值
 */
function normalizeDefault(value) {
  if (!value) return '';
  return String(value).trim();
}

/**
 * 标准化策略映射表
 */
const NORMALIZATION_STRATEGIES = {
  time_month: normalizeToMonth,
  time_year: normalizeToYear,
  time_day: normalizeToDay,
  location: normalizeLocation,
  indicator: normalizeIndicator,
  lowercase: normalizeLowercase,
  default: normalizeDefault
};

/**
 * 根据策略标准化字段值
 * 
 * @param {*} value - 字段值
 * @param {string} fieldName - 字段名（用于日志）
 * @param {string} strategy - 标准化策略名称
 * @returns {string} 标准化后的值
 */
function normalizeFieldValue(value, fieldName, strategy = 'default') {
  if (value === undefined || value === null) {
    return '';
  }

  const normalizer = NORMALIZATION_STRATEGIES[strategy] || NORMALIZATION_STRATEGIES.default;

  try {
    return normalizer(value);
  } catch (error) {
    console.warn(`[FieldNormalizer] Error normalizing field ${fieldName} with strategy ${strategy}:`, error.message);
    return normalizeDefault(value);
  }
}

/**
 * 注册自定义标准化策略
 * 
 * @param {string} name - 策略名称
 * @param {Function} normalizer - 标准化函数
 */
function registerNormalizationStrategy(name, normalizer) {
  if (typeof normalizer !== 'function') {
    throw new Error('[FieldNormalizer] Normalizer must be a function');
  }

  NORMALIZATION_STRATEGIES[name] = normalizer;
}

/**
 * 获取所有可用的标准化策略名称
 * 
 * @returns {Array<string>}
 */
function getAvailableStrategies() {
  return Object.keys(NORMALIZATION_STRATEGIES);
}

module.exports = {
  normalizeToMonth,
  normalizeToYear,
  normalizeToDay,
  normalizeLocation,
  normalizeIndicator,
  normalizeLowercase,
  normalizeDefault,
  normalizeFieldValue,
  registerNormalizationStrategy,
  getAvailableStrategies,
  NORMALIZATION_STRATEGIES
};
