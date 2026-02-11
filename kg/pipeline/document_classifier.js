/**
 * Document Classifier
 * 
 * 基于提取字段分析文档类型,用于Schema预筛选
 * 
 * 策略:
 * 1. 分析字段名称和类型的分布
 * 2. 识别关键字段模式
 * 3. 计算各领域的匹配度
 * 4. 返回最可能的文档类型
 */

class DocumentClassifier {
  constructor() {
    // 领域关键字映射
    this.domainKeywords = {
      government: {
        keywords: [
          '政府', '工作报告', '项目', '建设', '投资', '预算', '政策',
          '招标', '采购', '公告', '通知', '会议', '决策', '规划',
          '发展', '经济', '社会', '民生', '环境', '城市',
          '工程', '基础设施', '产业', '企业', '市场', '财政', '税收'
        ],
        fieldNames: [
          '项目名称', '预算金额', '建设周期', '采购人', '招标编号', '政策文件'
          // 移除过于通用的字段名: '区域', '指标', '数值', '单位', '时间'
        ],
        weight: 1.0
      },
      research: {
        keywords: [
          '研究', '实验', '论文', '学术', '科研', '数据', '分析',
          '假设', '证据', '观察', '测试', '结果', '方法', '理论',
          '模型', '算法', '技术', '创新', '发现', '结论'
        ],
        fieldNames: [
          'Entity', 'Hypothesis', 'Evidence', 'Experiment', 'Result',
          'Observation', 'Metric', 'DataPoints', 'GraphID', 'PaperID'
        ],
        weight: 1.0
      },
      personal: {
        keywords: [
          '个人', '日记', '目标', '习惯', '健康', '运动', '阅读',
          '电影', '音乐', '旅行', '照片', '食谱', '购物', '支出',
          '心情', '感受', '体验', '记录', '笔记'
        ],
        fieldNames: [
          'Date', 'Mood', 'Goal', 'Habit', 'Status', 'Rating',
          'Comment', 'Book', 'Movie', 'Track', 'Dish', 'Item'
        ],
        weight: 1.0
      },
      travel: {
        keywords: [
          '旅行', '旅游', '景点', '酒店', '航班', '行程', '游玩',
          '风景', '美食', '纪念品', '路线', '攻略', '体验', '度假',
          // 新增中文关键词
          '寺庙', '神社', '世界遗产', '参拜', '枫叶', '银杏', '樱花',
          '温泉', '和服', '抹茶', '拉面', '料理', '庭院', '禅意',
          '步行', '徒步', '观光', '打卡', '拍摄', '夜景', '日落',
          '古董', '市集', '伴手礼', '寄存', '导览', '门票',
          // 日本旅行特定词汇
          '京都', '奈良', '宇治', '岚山', '鞍马', '贵船', '伏见',
          '清水寺', '金阁寺', '银阁寺', '东寺', '本愿寺',
          '鸟居', '佛像', '石庭', '竹林', '川床', '小鹿'
        ],
        fieldNames: [
          'TripID', 'Location', 'Hotel', 'Flight', 'Scenic', 'Restaurant',
          'Activity', 'Route', 'BeachName', 'ParkName',
          // 新增字段名
          'Temple', 'Shrine', 'Spot', 'Attraction', 'Food', 'Path'
        ],
        weight: 1.0
      },
      sports: {
        keywords: [
          '运动', '健身', '锻炼', '训练', '跑步', '骑行', '游泳',
          '瑜伽', '登山', '滑雪', '攀岩', '冲浪', '距离', '时长',
          '配速', '强度', '重量', '组数'
        ],
        fieldNames: [
          'Exercise', 'Distance', 'Duration', 'Pace', 'Sets', 'Reps',
          'Weight', 'Intensity', 'Trail', 'Route', 'Pool'
        ],
        weight: 1.0
      },
      photography: {
        keywords: [
          '摄影', '拍摄', '相机', '镜头', '光圈', '快门', 'ISO',
          '曝光', '对焦', '构图', '景深', '白平衡', '测光', '防抖',
          // 新增摄影参数关键词
          '焦距', '焦段', 'mm', 'f值', 'F值', '感光度', '快门速度',
          '曝光时间', '虚化', '背景虚化', '浅景深', '深景深',
          '定焦', '变焦', '广角', '长焦', '标准镜头', '微距',
          '人像', '风光', '街拍', '夜景', '运动', '建筑',
          // 相机品牌和型号
          '索尼', '尼康', '佳能', '富士', '徕卡', '宾得', '松下',
          'Sony', 'Nikon', 'Canon', 'Fuji', 'Leica', 'Pentax', 'Panasonic',
          'A7', 'D850', 'Z9', '5D', 'R5', 'X-T5', 'GFX',
          // 摄影技巧
          '三分法', '黄金分割', '对角线', '引导线', '框架构图',
          '对称', '追随', '长曝光', '慢门', '高速快门',
          // 摄影场景
          '布光', '打光', '自然光', '人造光', '闪光灯', '反光板'
        ],
        fieldNames: [
          'Camera', 'Lens', 'ISO', 'Aperture', 'Shutter', 'Exposure',
          'Focus', 'Composition', 'Weather', 'Time', 'Scene',
          // 新增字段名
          'FocalLength', 'ShutterSpeed', 'Value', 'Speed', 'ModelName',
          'LensName', 'TechniqueName', 'RuleName', 'SettingName',
          'Effect', 'UseCase', 'NoiseLevel', 'Sensor', 'Features', 'Price'
        ],
        weight: 1.0
      },
      post_processing: {
        keywords: [
          '后期', '修图', '调色', '锐化', '降噪', '裁剪', '曲线',
          '预设', 'Lightroom', 'Photoshop', '导出', '批处理'
        ],
        fieldNames: [
          'Software', 'Preset', 'Exposure', 'Contrast', 'Highlight',
          'Shadow', 'Sharpening', 'NoiseLevel', 'Crop', 'LUT'
        ],
        weight: 1.0
      },
      entertainment: {
        keywords: [
          '娱乐', '电影', '音乐', '游戏', '演唱会', '剧场', '节日',
          '主题公园', '展览', '表演', '活动'
        ],
        fieldNames: [
          'Movie', 'Track', 'Artist', 'Game', 'Event', 'Concert',
          'Theater', 'Festival', 'ParkName'
        ],
        weight: 1.0
      },
      general: {
        keywords: [],
        fieldNames: [],
        weight: 0.5
      }
    };
  }

  /**
   * 分类文档类型
   * 
   * @param {Array} extractedFields - 提取的字段
   * @param {Object} options - 选项
   * @returns {Object} 分类结果
   */
  classify(extractedFields, options = {}) {
    const {
      topN = 3,  // 返回前N个最可能的类型
      minConfidence = 0.1  // 最小置信度阈值
    } = options;

    // 计算各领域的得分
    const domainScores = {};
    
    for (const [domain, config] of Object.entries(this.domainKeywords)) {
      domainScores[domain] = this._calculateDomainScore(
        extractedFields,
        config.keywords,
        config.fieldNames,
        config.weight
      );
    }

    // 归一化得分
    const totalScore = Object.values(domainScores).reduce((sum, score) => sum + score, 0);
    const normalizedScores = {};
    
    for (const [domain, score] of Object.entries(domainScores)) {
      normalizedScores[domain] = totalScore > 0 ? score / totalScore : 0;
    }

    // 排序并过滤
    const rankedDomains = Object.entries(normalizedScores)
      .filter(([_, confidence]) => confidence >= minConfidence)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([domain, confidence]) => ({
        domain,
        confidence: parseFloat(confidence.toFixed(3))
      }));

    // 如果没有明确的领域,返回general
    if (rankedDomains.length === 0 || rankedDomains[0].confidence < 0.2) {
      return {
        primaryDomain: 'general',
        confidence: 0.5,
        allDomains: [{ domain: 'general', confidence: 0.5 }],
        stats: {
          totalFields: extractedFields.length,
          analyzedKeywords: 0,
          analyzedFieldNames: 0
        }
      };
    }

    return {
      primaryDomain: rankedDomains[0].domain,
      confidence: rankedDomains[0].confidence,
      allDomains: rankedDomains,
      stats: {
        totalFields: extractedFields.length,
        domainScores: normalizedScores
      }
    };
  }

  /**
   * 计算领域得分
   * 
   * @private
   */
  _calculateDomainScore(fields, keywords, fieldNames, weight) {
    let score = 0;
    let keywordMatches = 0;
    let fieldNameMatches = 0;

    // 1. 检查字段值中的关键字
    for (const field of fields) {
      const fieldValue = (field.value || '').toLowerCase();
      const fieldName = (field.name || '').toLowerCase();
      
      // 关键字匹配 - 检查字段值和字段名
      for (const keyword of keywords) {
        const keywordLower = keyword.toLowerCase();
        
        // 字段值匹配
        if (fieldValue.includes(keywordLower)) {
          keywordMatches++;
          score += 2;  // 关键字匹配权重为2
          break;  // 每个字段只计算一次
        }
        
        // 字段名匹配
        if (fieldName.includes(keywordLower)) {
          keywordMatches++;
          score += 2;
          break;
        }
      }
    }

    // 2. 检查字段名称匹配
    for (const field of fields) {
      const fieldName = (field.name || '').toLowerCase();
      
      for (const targetFieldName of fieldNames) {
        const targetLower = targetFieldName.toLowerCase();
        
        // 精确匹配
        if (fieldName === targetLower) {
          fieldNameMatches++;
          score += 5;  // 精确匹配权重为5
          break;
        }
        
        // 包含匹配
        if (fieldName.includes(targetLower) || targetLower.includes(fieldName)) {
          fieldNameMatches++;
          score += 3;  // 包含匹配权重为3
          break;
        }
      }
    }

    // 3. 应用领域权重
    score *= weight;

    // 4. 考虑匹配率
    const keywordMatchRate = keywords.length > 0 ? keywordMatches / keywords.length : 0;
    const fieldNameMatchRate = fieldNames.length > 0 ? fieldNameMatches / fieldNames.length : 0;
    
    // 如果匹配率很高,给予额外加分
    if (keywordMatchRate > 0.3) score *= 1.5;
    if (fieldNameMatchRate > 0.3) score *= 1.5;

    return score;
  }

  /**
   * 获取领域对应的Schema场景
   * 
   * @param {string} domain - 领域名称
   * @returns {Array} Schema场景列表
   */
  getDomainScenes(domain) {
    const sceneMapping = {
      government: ['政府', '政府工作', '政府/生活', '政府/个人', '政府/学术', '政府/科研', '政府/采购'],
      research: ['科研', '科研/政府', '科研/学术', '科研/生活', '学术', '学术/科研'],
      personal: ['个人生活', '个人生活/学术', '生活'],
      travel: ['旅行', '旅行/休闲', '旅行/运动', '休闲/旅行'],
      sports: ['运动', '运动/休闲', '运动/旅行', '休闲/运动'],
      photography: ['摄影', '摄影教程', '摄影教程/技巧', '摄影教程/设置', '摄影教程/器材', '摄影/技巧', '摄影/设置', '摄影/器材'],
      post_processing: ['后期', '后期处理', '摄影/后期'],
      entertainment: ['娱乐', '娱乐/旅行'],
      general: ['全场景']
    };

    return sceneMapping[domain] || ['全场景'];
  }

  /**
   * 获取领域对应的实体类型
   * 
   * @param {string} domain - 领域名称
   * @returns {Array} 实体类型列表
   */
  getDomainEntityTypes(domain) {
    const entityTypeMapping = {
      government: ['GovernmentEntity', 'ProcurementEntity'],
      research: ['ResearchEntity'],
      personal: ['PersonalEntity'],
      travel: ['TravelEntity'],
      sports: ['SportsEntity'],
      photography: ['PhotographyEntity'],
      post_processing: ['PostProcessingEntity'],
      entertainment: ['EntertainmentEntity'],
      general: ['GeneralEntity']
    };

    return entityTypeMapping[domain] || ['GeneralEntity'];
  }
}

module.exports = DocumentClassifier;
