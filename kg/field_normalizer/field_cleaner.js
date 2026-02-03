/**
 * Field Cleaner - Field Value Cleaning and Standardization
 * 
 * Cleans and standardizes field values by removing noise, normalizing formats,
 * and applying type-specific transformations.
 * 
 * Design Reference: Phase 2 - Field Normalization Module (Section 4.5)
 * Validates: Requirements 18.4, 18.9
 * 
 * Key Features:
 * - Noise removal (extra whitespace, special characters)
 * - Time standardization (multiple formats → ISO 8601)
 * - Number standardization (remove separators, normalize decimals)
 * - Unit normalization (统一单位表示)
 * - Text normalization (case, punctuation)
 */

/**
 * Clean field value
 * 
 * Main entry point for field value cleaning. Applies appropriate cleaning
 * strategies based on field type.
 * 
 * @param {Object} field - Field object with name, value, type
 * @param {Object} options - Cleaning options
 * @returns {Object} Field with cleaned value
 * 
 * @example
 * const field = {
 *   name: '时间',
 *   value: '2025年 1月',
 *   type: 'time',
 *   confidence: 0.95
 * };
 * const cleaned = cleanFieldValue(field);
 * // Returns: { ...field, value: '2025-01' }
 */
function cleanFieldValue(field, options = {}) {
  const {
    removeNoise = true,
    standardizeFormat = true,
    normalizeCase = false
  } = options;
  
  if (!field || typeof field.value !== 'string') {
    return field;
  }
  
  let value = field.value;
  
  // Step 1: Remove noise
  if (removeNoise) {
    value = removeNoiseFromValue(value);
  }
  
  // Handle empty or whitespace-only values after noise removal
  if (!value || value.trim().length === 0) {
    return {
      ...field,
      value: value.trim(),
      cleaned: true
    };
  }
  
  // Step 2: Type-specific standardization
  if (standardizeFormat) {
    switch (field.type) {
      case 'time':
      case 'date':
      case 'datetime':
        value = standardizeTime(value);
        break;
      case 'number':
      case 'numeric':
        value = standardizeNumber(value);
        break;
      case 'unit':
        value = standardizeUnit(value);
        break;
      case 'location':
      case 'spatial':
        value = standardizeLocation(value);
        break;
      default:
        // Generic text cleaning
        value = standardizeText(value);
    }
  }
  
  // Step 3: Case normalization (optional)
  if (normalizeCase && field.type !== 'time' && field.type !== 'number') {
    value = value.trim();
  }
  
  return {
    ...field,
    value: value,
    cleaned: true
  };
}

/**
 * Remove noise from value
 * 
 * Removes extra whitespace, control characters, and unwanted special characters.
 * 
 * @param {string} value - Raw value
 * @returns {string} Cleaned value
 */
function removeNoiseFromValue(value) {
  // Remove control characters
  value = value.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Normalize whitespace (multiple spaces → single space)
  value = value.replace(/\s+/g, ' ');
  
  // Trim leading/trailing whitespace
  value = value.trim();
  
  // Remove zero-width characters
  value = value.replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  return value;
}

/**
 * Standardize time format
 * 
 * Converts various time formats to ISO 8601 format.
 * Supports: Chinese format, slash format, dot format, etc.
 * 
 * @param {string} timeStr - Time string
 * @returns {string} Standardized time string (ISO 8601)
 * 
 * @example
 * standardizeTime('2025年1月') // '2025-01'
 * standardizeTime('2025/01/26') // '2025-01-26'
 * standardizeTime('2025.01.26 10:30') // '2025-01-26T10:30:00'
 */
function standardizeTime(timeStr) {
  // Remove extra whitespace
  timeStr = timeStr.trim().replace(/\s+/g, ' ');
  
  // Pattern 1: Chinese format "2025年1月" → "2025-01"
  let match = timeStr.match(/(\d{4})年\s*(\d{1,2})月(?:\s*(\d{1,2})日)?/);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    const day = match[3] ? match[3].padStart(2, '0') : null;
    return day ? `${year}-${month}-${day}` : `${year}-${month}`;
  }
  
  // Pattern 2: Slash format "2025/01/26" → "2025-01-26"
  match = timeStr.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    const hour = match[4] ? match[4].padStart(2, '0') : null;
    const minute = match[5] ? match[5].padStart(2, '0') : null;
    const second = match[6] ? match[6].padStart(2, '0') : '00';
    
    if (hour && minute) {
      return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    }
    return `${year}-${month}-${day}`;
  }
  
  // Pattern 3: Dot format "2025.01.26" → "2025-01-26"
  match = timeStr.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    const hour = match[4] ? match[4].padStart(2, '0') : null;
    const minute = match[5] ? match[5].padStart(2, '0') : null;
    const second = match[6] ? match[6].padStart(2, '0') : '00';
    
    if (hour && minute) {
      return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    }
    return `${year}-${month}-${day}`;
  }
  
  // Pattern 4: Dash format with time "2025-01-26 10:30:00"
  match = timeStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    const hour = match[4].padStart(2, '0');
    const minute = match[5].padStart(2, '0');
    const second = match[6] ? match[6].padStart(2, '0') : '00';
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  }
  
  // Pattern 5: Year-month only "2025-1" → "2025-01"
  match = timeStr.match(/^(\d{4})-(\d{1,2})$/);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    return `${year}-${month}`;
  }
  
  // Pattern 6: Relative time "3天前", "2小时前"
  match = timeStr.match(/(\d+)\s*(天|小时|分钟|秒)前/);
  if (match) {
    const amount = parseInt(match[1]);
    const unit = match[2];
    const now = new Date();
    
    switch (unit) {
      case '天':
        now.setDate(now.getDate() - amount);
        break;
      case '小时':
        now.setHours(now.getHours() - amount);
        break;
      case '分钟':
        now.setMinutes(now.getMinutes() - amount);
        break;
      case '秒':
        now.setSeconds(now.getSeconds() - amount);
        break;
    }
    
    return now.toISOString().split('T')[0];
  }
  
  // Already in ISO format or unrecognized format
  return timeStr;
}

/**
 * Standardize number format
 * 
 * Removes formatting characters and normalizes number representation.
 * 
 * @param {string} numberStr - Number string
 * @returns {string} Standardized number string
 * 
 * @example
 * standardizeNumber('1,234.56') // '1234.56'
 * standardizeNumber('- 123.45') // '-123.45'
 * standardizeNumber('1 234,56') // '1234.56' (European format)
 */
function standardizeNumber(numberStr) {
  // Handle empty or whitespace-only strings
  if (!numberStr || typeof numberStr !== 'string') {
    return numberStr;
  }
  
  const trimmed = numberStr.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }
  
  // Remove whitespace
  let cleaned = numberStr.replace(/\s/g, '');
  
  // Handle European format (comma as decimal separator)
  // Check if there's a comma after the last dot, or only comma
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  
  if (lastComma > lastDot && lastDot !== -1) {
    // European format with both dot and comma: 1.234,56 → 1234.56
    // Dot is thousands separator, comma is decimal separator
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastComma !== -1 && lastDot === -1) {
    // Only comma, could be European decimal: 1,5 → 1.5
    // Or US thousands: 1,234 → 1234
    // Heuristic: 
    // - Multiple commas → thousands (1,234,567)
    // - Single comma with exactly 3 digits after → thousands (1,234)
    // - Single comma with 1-2 digits after → decimal (1,5 or 1,25)
    const commaCount = (cleaned.match(/,/g) || []).length;
    const afterComma = cleaned.substring(cleaned.lastIndexOf(',') + 1);
    
    if (commaCount > 1 || afterComma.length === 3) {
      // US thousands separator
      cleaned = cleaned.replace(/,/g, '');
    } else {
      // European decimal separator
      cleaned = cleaned.replace(',', '.');
    }
  } else {
    // US format: 1,234.56 → 1234.56
    cleaned = cleaned.replace(/,/g, '');
  }
  
  // Handle negative sign with space
  cleaned = cleaned.replace(/^-\s+/, '-');
  
  // Validate number format
  const match = cleaned.match(/^-?\d+\.?\d*$/);
  if (match) {
    // Parse to check for NaN
    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) {
      return numberStr; // Return original if NaN
    }
    
    // Remove trailing zeros after decimal point (but preserve idempotence)
    if (cleaned.includes('.')) {
      // Only remove trailing zeros if there are digits after decimal
      const parts = cleaned.split('.');
      if (parts[1] && parts[1].length > 0) {
        // Remove trailing zeros
        parts[1] = parts[1].replace(/0+$/, '');
        // If no digits left after decimal, remove decimal point
        if (parts[1].length === 0) {
          cleaned = parts[0];
        } else {
          cleaned = parts.join('.');
        }
      }
    }
    
    return cleaned;
  }
  
  // Return original if not a valid number
  return numberStr;
}

/**
 * Standardize unit format
 * 
 * Normalizes unit representations to standard forms.
 * 
 * @param {string} unitStr - Unit string
 * @returns {string} Standardized unit string
 * 
 * @example
 * standardizeUnit('公里') // 'km'
 * standardizeUnit('千米') // 'km'
 * standardizeUnit('米') // 'm'
 */
function standardizeUnit(unitStr) {
  // Unit mapping dictionary
  const unitMap = {
    // Length
    '公里': 'km',
    '千米': 'km',
    '米': 'm',
    '厘米': 'cm',
    '毫米': 'mm',
    '英里': 'mile',
    '英尺': 'ft',
    '英寸': 'in',
    
    // Weight
    '吨': 't',
    '公斤': 'kg',
    '千克': 'kg',
    '克': 'g',
    '毫克': 'mg',
    '斤': 'jin',
    '两': 'liang',
    '磅': 'lb',
    
    // Volume
    '升': 'L',
    '毫升': 'mL',
    '立方米': 'm³',
    '加仑': 'gal',
    
    // Time
    '年': 'year',
    '月': 'month',
    '周': 'week',
    '天': 'day',
    '小时': 'hour',
    '分钟': 'minute',
    '秒': 'second',
    
    // Currency
    '元': 'CNY',
    '人民币': 'CNY',
    '美元': 'USD',
    '欧元': 'EUR',
    '英镑': 'GBP',
    '日元': 'JPY',
    
    // Other
    '个': 'unit',
    '件': 'piece',
    '台': 'set',
    '次': 'time'
  };
  
  const cleaned = unitStr.trim();
  return unitMap[cleaned] || cleaned;
}

/**
 * Standardize location format
 * 
 * Normalizes location names and removes redundant words.
 * 
 * @param {string} locationStr - Location string
 * @returns {string} Standardized location string
 * 
 * @example
 * standardizeLocation('北京市 海淀区') // '北京市海淀区'
 * standardizeLocation('阿里 C 区') // '阿里C区'
 */
function standardizeLocation(locationStr) {
  // Remove extra whitespace
  let cleaned = locationStr.trim().replace(/\s+/g, '');
  
  // Normalize common location patterns
  // Remove redundant "地区", "区域" suffixes if they appear multiple times
  cleaned = cleaned.replace(/地区$/, '');
  cleaned = cleaned.replace(/区域$/, '');
  
  return cleaned;
}

/**
 * Standardize text format
 * 
 * Generic text cleaning for non-specific field types.
 * 
 * @param {string} textStr - Text string
 * @returns {string} Standardized text string
 */
function standardizeText(textStr) {
  // Remove extra whitespace (but preserve single spaces)
  let cleaned = textStr.trim();
  
  // Normalize multiple spaces to single space
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  // Remove special characters (keep Chinese, English, numbers, basic punctuation)
  cleaned = cleaned.replace(/[^\w\s\u4e00-\u9fa5.,;:!?()（）、，。；：！？\-]/g, '');
  
  // Normalize punctuation
  cleaned = cleaned.replace(/[，]/g, ',');
  cleaned = cleaned.replace(/[。]/g, '.');
  cleaned = cleaned.replace(/[；]/g, ';');
  cleaned = cleaned.replace(/[：]/g, ':');
  cleaned = cleaned.replace(/[！]/g, '!');
  cleaned = cleaned.replace(/[？]/g, '?');
  cleaned = cleaned.replace(/[（]/g, '(');
  cleaned = cleaned.replace(/[）]/g, ')');
  
  // Final trim to ensure idempotence
  cleaned = cleaned.trim();
  
  return cleaned;
}

/**
 * Batch clean field values
 * 
 * Efficiently cleans multiple fields at once.
 * 
 * @param {Array} fields - Array of field objects
 * @param {Object} options - Cleaning options
 * @returns {Array} Array of cleaned fields
 */
function batchCleanFields(fields, options = {}) {
  if (!Array.isArray(fields)) {
    throw new Error('fields must be an array');
  }
  
  return fields.map(field => cleanFieldValue(field, options));
}

/**
 * Validate cleaned value
 * 
 * Checks if a cleaned value is valid for its type.
 * 
 * @param {Object} field - Field object with cleaned value
 * @returns {Object} Validation result
 */
function validateCleanedValue(field) {
  const { value, type } = field;
  
  // Check for empty or null value first
  if (!value || value.length === 0) {
    return {
      valid: false,
      reason: 'Empty value'
    };
  }
  
  switch (type) {
    case 'time':
    case 'date':
    case 'datetime':
      // Check ISO 8601 format
      const timeRegex = /^\d{4}-\d{2}(-\d{2})?(T\d{2}:\d{2}:\d{2})?$/;
      return {
        valid: timeRegex.test(value),
        reason: timeRegex.test(value) ? null : 'Invalid time format'
      };
      
    case 'number':
    case 'numeric':
      // Check number format
      const numberRegex = /^-?\d+\.?\d*$/;
      return {
        valid: numberRegex.test(value),
        reason: numberRegex.test(value) ? null : 'Invalid number format'
      };
      
    default:
      // Generic validation: non-empty (already checked above)
      return {
        valid: true,
        reason: null
      };
  }
}

module.exports = {
  cleanFieldValue,
  removeNoiseFromValue,
  standardizeTime,
  standardizeNumber,
  standardizeUnit,
  standardizeLocation,
  standardizeText,
  batchCleanFields,
  validateCleanedValue
};
