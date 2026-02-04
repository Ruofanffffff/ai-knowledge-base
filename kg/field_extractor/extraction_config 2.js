/**
 * Extraction Configuration
 * 
 * 配置文件，定义领域关键词、默认策略和Prompt构建器映射
 */

/**
 * 领域关键词字典
 */
const DOMAIN_KEYWORDS = {
  travel: [
    '旅游', '景点', '攻略', '目的地', '行程', '导游', '住宿', '交通',
    '酒店', '民宿', '机票', '高铁', '自驾', '跟团', '自由行', '游玩',
    '风景', '名胜', '古镇', '山水', '海滩', '度假', '观光',
    // 新增日本旅行相关关键词
    '寺庙', '神社', '世界遗产', '参拜', '枫叶', '银杏', '樱花',
    '温泉', '和服', '抹茶', '拉面', '料理', '庭院', '禅意',
    '步行', '徒步', '打卡', '拍摄', '夜景', '日落', '夜枫',
    '古董', '市集', '伴手礼', '寄存', '导览', '门票', '特别参拜',
    // 日本地名和景点
    '京都', '奈良', '宇治', '岚山', '鞍马', '贵船', '伏见',
    '清水寺', '金阁寺', '银阁寺', '东寺', '本愿寺', '稻荷',
    '鸟居', '佛像', '石庭', '竹林', '川床', '小鹿', '五重塔',
    // 旅行活动
    '暴走', '路线', '半日', '日归', '环游', '巡礼', '喂鹿',
    '体验', '租借', '配送', '寄存柜', '投币', '预约'
  ],
  medical: [
    '医疗', '病人', '诊断', '治疗', '药物', '症状', '医院', '医生',
    '护士', '手术', '检查', '化验', '病历', '处方', '康复', '疾病',
    '健康', '体检', '门诊', '住院', '急诊'
  ],
  government: [
    '政府', '政策', '法规', '公告', '通知', '文件', '部门', '机关',
    '行政', '管理', '服务', '办理', '审批', '登记', '备案', '公示',
    '决定', '意见', '方案', '规划'
  ],
  legal: [
    '法律', '合同', '诉讼', '判决', '律师', '法院', '条款', '协议',
    '起诉', '被告', '原告', '证据', '仲裁', '调解', '执行', '赔偿',
    '违约', '侵权', '纠纷', '诉讼'
  ],
  financial: [
    '金融', '投资', '股票', '基金', '银行', '贷款', '利率', '理财',
    '证券', '债券', '期货', '保险', '融资', '信贷', '资产', '收益',
    '风险', '回报', '财务', '账户'
  ],
  general: []
};

/**
 * 默认策略配置
 */
const DEFAULT_STRATEGIES = {
  travel: 'hybrid',  // 改为hybrid策略,避免LLM超时导致完全失败
  medical: 'hybrid',
  government: 'rule-first',
  legal: 'rule-first',
  financial: 'hybrid',
  general: 'rule-first'
};

/**
 * Prompt构建器映射
 */
const PROMPT_BUILDERS = {
  travel: 'buildTravelFieldExtractionPrompt',
  medical: 'buildSemanticFieldExtractionPrompt',
  government: 'buildFieldExtractionPrompt',
  legal: 'buildFieldExtractionPrompt',
  financial: 'buildSemanticFieldExtractionPrompt',
  general: 'buildFieldExtractionPrompt'
};

/**
 * 策略配置
 */
const STRATEGY_CONFIG = {
  'semantic-only': {
    useLLM: true,
    useRules: false,
    useNER: false,
    useUniversal: false,
    forceLLM: true,
    useSemantic: true,
    maxFields: 50,
    minConfidence: 0.7
  },
  'rule-first': {
    useLLM: true,
    useRules: true,
    useNER: true,
    useUniversal: false,
    forceLLM: false,
    minFieldCount: 3,
    minConfidence: 0.7
  },
  'llm-first': {
    useLLM: true,
    useRules: true,
    useNER: true,
    useUniversal: false,
    forceLLM: false,
    llmFirst: true,
    minConfidence: 0.8
  },
  'hybrid': {
    useLLM: true,
    useRules: true,
    useNER: true,
    useUniversal: false,
    forceLLM: false,
    parallel: true,
    minConfidence: 0.7
  },
  'universal': {
    useLLM: false,
    useRules: false,
    useNER: false,
    useUniversal: true,
    forceLLM: false,
    maxFields: 100,
    minKeywordScore: 0.01,
    minConfidence: 0.5
  }
};

/**
 * 性能配置
 */
const PERFORMANCE_CONFIG = {
  domainDetectionTimeout: 10,      // ms
  strategySelectionTimeout: 5,     // ms
  extractionTimeout: 5000,         // ms
  maxTokensPerCKB: 2000
};

/**
 * 支持的领域列表
 */
const SUPPORTED_DOMAINS = Object.keys(DOMAIN_KEYWORDS);

/**
 * 支持的策略列表
 */
const SUPPORTED_STRATEGIES = Object.keys(STRATEGY_CONFIG);

module.exports = {
  DOMAIN_KEYWORDS,
  DEFAULT_STRATEGIES,
  PROMPT_BUILDERS,
  STRATEGY_CONFIG,
  PERFORMANCE_CONFIG,
  SUPPORTED_DOMAINS,
  SUPPORTED_STRATEGIES
};
