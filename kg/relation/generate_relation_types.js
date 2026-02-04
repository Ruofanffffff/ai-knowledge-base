/**
 * Generate Relation Types JSON
 * 
 * This script generates the complete relation_types.json file with all 90 relation types
 * across 6 domains (life, work, travel, shopping, government, management).
 */

const fs = require('fs');
const path = require('path');

// Life Domain - 17 types
const lifeTypes = {
  family: [
    { id: 'family_parent', name: 'parent', display: '父母', desc: '表示父母关系', source: ['PersonEntity'], target: ['PersonEntity'], dir: true, temp: false },
    { id: 'family_child', name: 'child', display: '子女', desc: '表示子女关系', source: ['PersonEntity'], target: ['PersonEntity'], dir: true, temp: false },
    { id: 'family_spouse', name: 'spouse', display: '配偶', desc: '表示配偶关系', source: ['PersonEntity'], target: ['PersonEntity'], dir: false, temp: false },
    { id: 'family_sibling', name: 'sibling', display: '兄弟姐妹', desc: '表示兄弟姐妹关系', source: ['PersonEntity'], target: ['PersonEntity'], dir: false, temp: false },
    { id: 'family_grandparent', name: 'grandparent', display: '祖父母/外祖父母', desc: '表示祖父母关系', source: ['PersonEntity'], target: ['PersonEntity'], dir: true, temp: false },
    { id: 'family_grandchild', name: 'grandchild', display: '孙子女/外孙子女', desc: '表示孙子女关系', source: ['PersonEntity'], target: ['PersonEntity'], dir: true, temp: false }
  ],
  social: [
    { id: 'social_friend', name: 'friend', display: '朋友', desc: '表示朋友关系', source: ['PersonEntity'], target: ['PersonEntity'], dir: false, temp: false },
    { id: 'social_classmate', name: 'classmate', display: '同学', desc: '表示同学关系', source: ['PersonEntity'], target: ['PersonEntity'], dir: false, temp: false },
    { id: 'social_neighbor', name: 'neighbor', display: '邻居', desc: '表示邻居关系', source: ['PersonEntity'], target: ['PersonEntity'], dir: false, temp: false },
    { id: 'social_colleague', name: 'colleague', display: '同事', desc: '表示同事关系', source: ['PersonEntity'], target: ['PersonEntity'], dir: false, temp: false }
  ],
  residence: [
    { id: 'residence_live_in', name: 'live_in', display: '居住于', desc: '表示居住关系', source: ['PersonEntity'], target: ['LocationEntity'], dir: true, temp: true },
    { id: 'residence_own', name: 'own', display: '拥有', desc: '表示拥有房产关系', source: ['PersonEntity'], target: ['LocationEntity'], dir: true, temp: true },
    { id: 'residence_rent', name: 'rent', display: '租赁', desc: '表示租赁房产关系', source: ['PersonEntity'], target: ['LocationEntity'], dir: true, temp: true }
  ],
  health: [
    { id: 'health_visit', name: 'visit', display: '就诊于', desc: '表示就诊关系', source: ['PersonEntity'], target: ['OrganizationEntity'], dir: true, temp: true },
    { id: 'health_diagnose', name: 'diagnose', display: '患有', desc: '表示诊断关系', source: ['PersonEntity'], target: ['IndicatorEntity'], dir: true, temp: true },
    { id: 'health_treat', name: 'treat', display: '治疗', desc: '表示治疗关系', source: ['PersonEntity'], target: ['IndicatorEntity'], dir: true, temp: true },
    { id: 'health_prevent', name: 'prevent', display: '预防', desc: '表示预防关系', source: ['PersonEntity'], target: ['IndicatorEntity'], dir: true, temp: true }
  ]
};

// Work Domain - 15 types
const workTypes = {
  employment: [
    { id: 'work_employ', name: 'employ', display: '雇佣', desc: '表示雇佣关系', source: ['OrganizationEntity'], target: ['PersonEntity'], dir: true, temp: true },
    { id: 'work_position', name: 'position', display: '任职', desc: '表示任职关系', source: ['PersonEntity'], target: ['OrganizationEntity'], dir: true, temp: true },
    { id: 'work_part_time', name: 'part_time', display: '兼职', desc: '表示兼职关系', source: ['PersonEntity'], target: ['OrganizationEntity'], dir: true, temp: true },
    { id: 'work_resign', name: 'resign', display: '离职', desc: '表示离职关系', source: ['PersonEntity'], target: ['OrganizationEntity'], dir: true, temp: true }
  ],
  collaboration: [
    { id: 'work_cooperate', name: 'cooperate', display: '合作', desc: '表示合作关系', source: ['PersonEntity'], target: ['PersonEntity'], dir: false, temp: false },
    { id: 'work_assist', name: 'assist', display: '协助', desc: '表示协助关系', source: ['PersonEntity'], target: ['PersonEntity'], dir: true, temp: false },
    { id: 'work_mentor', name: 'mentor', display: '指导', desc: '表示指导关系', source: ['PersonEntity'], target: ['PersonEntity'], dir: true, temp: false },
    { id: 'work_consult', name: 'consult', display: '咨询', desc: '表示咨询关系', source: ['PersonEntity'], target: ['PersonEntity'], dir: true, temp: false }
  ],
  reporting: [
    { id: 'work_report_direct', name: 'report_direct', display: '直接汇报', desc: '表示直接汇报关系', source: ['PersonEntity'], target: ['PersonEntity'], dir: true, temp: false },
    { id: 'work_report_indirect', name: 'report_indirect', display: '间接汇报', desc: '表示间接汇报关系', source: ['PersonEntity'], target: ['PersonEntity'], dir: true, temp: false },
    { id: 'work_report_matrix', name: 'report_matrix', display: '矩阵汇报', desc: '表示矩阵汇报关系', source: ['PersonEntity'], target: ['PersonEntity'], dir: true, temp: false }
  ],
  project: [
    { id: 'work_participate', name: 'participate', display: '参与', desc: '表示参与项目关系', source: ['PersonEntity'], target: ['ProjectEntity'], dir: true, temp: false },
    { id: 'work_lead', name: 'lead', display: '负责', desc: '表示负责项目关系', source: ['PersonEntity'], target: ['ProjectEntity'], dir: true, temp: false },
    { id: 'work_approve', name: 'approve', display: '审批', desc: '表示审批项目关系', source: ['PersonEntity'], target: ['ProjectEntity'], dir: true, temp: false },
    { id: 'work_accept', name: 'accept', display: '验收', desc: '表示验收项目关系', source: ['PersonEntity'], target: ['ProjectEntity'], dir: true, temp: true }
  ]
};

// Travel Domain - 13 types
const travelTypes = {
  transportation: [
    { id: 'travel_take', name: 'take', display: '乘坐', desc: '表示乘坐交通工具', source: ['PersonEntity'], target: ['EquipmentEntity'], dir: true, temp: true },
    { id: 'travel_drive', name: 'drive', display: '驾驶', desc: '表示驾驶交通工具', source: ['PersonEntity'], target: ['EquipmentEntity'], dir: true, temp: true },
    { id: 'travel_transfer', name: 'transfer', display: '转乘', desc: '表示转乘关系', source: ['LocationEntity'], target: ['LocationEntity'], dir: true, temp: true },
    { id: 'travel_arrive', name: 'arrive', display: '到达', desc: '表示到达目的地', source: ['PersonEntity'], target: ['LocationEntity'], dir: true, temp: true }
  ],
  accommodation: [
    { id: 'travel_checkin', name: 'checkin', display: '入住', desc: '表示入住酒店', source: ['PersonEntity'], target: ['LocationEntity'], dir: true, temp: true },
    { id: 'travel_book', name: 'book', display: '预订', desc: '表示预订酒店', source: ['PersonEntity'], target: ['LocationEntity'], dir: true, temp: true },
    { id: 'travel_recommend_hotel', name: 'recommend_hotel', display: '推荐住宿', desc: '表示推荐住宿', source: ['PersonEntity'], target: ['LocationEntity'], dir: true, temp: false }
  ],
  attraction: [
    { id: 'travel_visit', name: 'visit', display: '游览', desc: '表示游览景点', source: ['PersonEntity'], target: ['LocationEntity'], dir: true, temp: true },
    { id: 'travel_checkin_spot', name: 'checkin_spot', display: '打卡', desc: '表示打卡景点', source: ['PersonEntity'], target: ['LocationEntity'], dir: true, temp: true },
    { id: 'travel_rate', name: 'rate', display: '评价', desc: '表示评价景点', source: ['PersonEntity'], target: ['LocationEntity'], dir: true, temp: true }
  ],
  route: [
    { id: 'travel_pass_through', name: 'pass_through', display: '途经', desc: '表示途经地点', source: ['LocationEntity'], target: ['LocationEntity'], dir: true, temp: false },
    { id: 'travel_connect', name: 'connect', display: '连接', desc: '表示地点连接', source: ['LocationEntity'], target: ['LocationEntity'], dir: false, temp: false },
    { id: 'travel_recommend_route', name: 'recommend_route', display: '推荐路线', desc: '表示推荐路线', source: ['PersonEntity'], target: ['LocationEntity'], dir: true, temp: false }
  ]
};

// Shopping Domain - 13 types
const shoppingTypes = {
  purchase: [
    { id: 'shopping_buy', name: 'buy', display: '购买', desc: '表示购买商品', source: ['PersonEntity'], target: ['ProductEntity'], dir: true, temp: true },
    { id: 'shopping_add_cart', name: 'add_cart', display: '加购', desc: '表示加入购物车', source: ['PersonEntity'], target: ['ProductEntity'], dir: true, temp: true },
    { id: 'shopping_favorite', name: 'favorite', display: '收藏', desc: '表示收藏商品', source: ['PersonEntity'], target: ['ProductEntity'], dir: true, temp: true },
    { id: 'shopping_browse', name: 'browse', display: '浏览', desc: '表示浏览商品', source: ['PersonEntity'], target: ['ProductEntity'], dir: true, temp: true }
  ],
  payment: [
    { id: 'shopping_pay', name: 'pay', display: '支付', desc: '表示支付订单', source: ['PersonEntity'], target: ['ProductEntity'], dir: true, temp: true },
    { id: 'shopping_refund', name: 'refund', display: '退款', desc: '表示退款', source: ['PersonEntity'], target: ['ProductEntity'], dir: true, temp: true },
    { id: 'shopping_discount', name: 'discount', display: '优惠', desc: '表示优惠关系', source: ['ProductEntity'], target: ['PersonEntity'], dir: true, temp: true }
  ],
  delivery: [
    { id: 'shopping_deliver', name: 'deliver', display: '配送', desc: '表示配送订单', source: ['OrganizationEntity'], target: ['PersonEntity'], dir: true, temp: true },
    { id: 'shopping_receive', name: 'receive', display: '签收', desc: '表示签收订单', source: ['PersonEntity'], target: ['ProductEntity'], dir: true, temp: true },
    { id: 'shopping_return', name: 'return', display: '退货', desc: '表示退货', source: ['PersonEntity'], target: ['ProductEntity'], dir: true, temp: true }
  ],
  review: [
    { id: 'shopping_review', name: 'review', display: '评价', desc: '表示评价商品', source: ['PersonEntity'], target: ['ProductEntity'], dir: true, temp: true },
    { id: 'shopping_like', name: 'like', display: '点赞', desc: '表示点赞商品', source: ['PersonEntity'], target: ['ProductEntity'], dir: true, temp: true },
    { id: 'shopping_complain', name: 'complain', display: '投诉', desc: '表示投诉商品', source: ['PersonEntity'], target: ['ProductEntity'], dir: true, temp: true }
  ]
};

// Government Domain - 16 types
const governmentTypes = {
  approval: [
    { id: 'gov_apply', name: 'apply', display: '申请', desc: '表示申请服务', source: ['PersonEntity'], target: ['OrganizationEntity'], dir: true, temp: true },
    { id: 'gov_review', name: 'review', display: '审批', desc: '表示审批文件', source: ['PersonEntity'], target: ['DocumentEntity'], dir: true, temp: true },
    { id: 'gov_approve', name: 'approve', display: '批准', desc: '表示批准申请', source: ['PersonEntity'], target: ['DocumentEntity'], dir: true, temp: true },
    { id: 'gov_reject', name: 'reject', display: '驳回', desc: '表示驳回申请', source: ['PersonEntity'], target: ['DocumentEntity'], dir: true, temp: true }
  ],
  supervision: [
    { id: 'gov_supervise', name: 'supervise', display: '监管', desc: '表示监管关系', source: ['OrganizationEntity'], target: ['OrganizationEntity'], dir: true, temp: false },
    { id: 'gov_inspect', name: 'inspect', display: '检查', desc: '表示检查关系', source: ['OrganizationEntity'], target: ['OrganizationEntity'], dir: true, temp: true },
    { id: 'gov_penalize', name: 'penalize', display: '处罚', desc: '表示处罚关系', source: ['OrganizationEntity'], target: ['OrganizationEntity'], dir: true, temp: true },
    { id: 'gov_rectify', name: 'rectify', display: '整改', desc: '表示整改关系', source: ['OrganizationEntity'], target: ['OrganizationEntity'], dir: true, temp: true }
  ],
  service: [
    { id: 'gov_handle', name: 'handle', display: '办理', desc: '表示办理服务', source: ['OrganizationEntity'], target: ['PersonEntity'], dir: true, temp: true },
    { id: 'gov_consult', name: 'consult', display: '咨询', desc: '表示咨询服务', source: ['PersonEntity'], target: ['OrganizationEntity'], dir: true, temp: true },
    { id: 'gov_complain', name: 'complain', display: '投诉', desc: '表示投诉', source: ['PersonEntity'], target: ['OrganizationEntity'], dir: true, temp: true },
    { id: 'gov_feedback', name: 'feedback', display: '反馈', desc: '表示反馈', source: ['PersonEntity'], target: ['OrganizationEntity'], dir: true, temp: true }
  ],
  policy: [
    { id: 'gov_formulate', name: 'formulate', display: '制定', desc: '表示制定政策', source: ['OrganizationEntity'], target: ['DocumentEntity'], dir: true, temp: true },
    { id: 'gov_publish', name: 'publish', display: '发布', desc: '表示发布政策', source: ['OrganizationEntity'], target: ['DocumentEntity'], dir: true, temp: true },
    { id: 'gov_execute', name: 'execute', display: '执行', desc: '表示执行政策', source: ['OrganizationEntity'], target: ['DocumentEntity'], dir: true, temp: true },
    { id: 'gov_abolish', name: 'abolish', display: '废止', desc: '表示废止政策', source: ['OrganizationEntity'], target: ['DocumentEntity'], dir: true, temp: true }
  ]
};

// Management Domain - 16 types
const managementTypes = {
  decision: [
    { id: 'mgmt_decide', name: 'decide', display: '决策', desc: '表示决策关系', source: ['PersonEntity'], target: ['ProjectEntity'], dir: true, temp: true },
    { id: 'mgmt_suggest', name: 'suggest', display: '建议', desc: '表示建议关系', source: ['PersonEntity'], target: ['ProjectEntity'], dir: true, temp: true },
    { id: 'mgmt_approve_decision', name: 'approve_decision', display: '批准决策', desc: '表示批准决策', source: ['PersonEntity'], target: ['ProjectEntity'], dir: true, temp: true },
    { id: 'mgmt_veto', name: 'veto', display: '否决', desc: '表示否决决策', source: ['PersonEntity'], target: ['ProjectEntity'], dir: true, temp: true }
  ],
  execution: [
    { id: 'mgmt_execute', name: 'execute', display: '执行', desc: '表示执行任务', source: ['PersonEntity'], target: ['ProjectEntity'], dir: true, temp: true },
    { id: 'mgmt_complete', name: 'complete', display: '完成', desc: '表示完成任务', source: ['PersonEntity'], target: ['ProjectEntity'], dir: true, temp: true },
    { id: 'mgmt_delay', name: 'delay', display: '延期', desc: '表示延期任务', source: ['PersonEntity'], target: ['ProjectEntity'], dir: true, temp: true },
    { id: 'mgmt_cancel', name: 'cancel', display: '取消', desc: '表示取消任务', source: ['PersonEntity'], target: ['ProjectEntity'], dir: true, temp: true }
  ],
  monitoring: [
    { id: 'mgmt_monitor', name: 'monitor', display: '监督', desc: '表示监督关系', source: ['PersonEntity'], target: ['ProjectEntity'], dir: true, temp: false },
    { id: 'mgmt_check', name: 'check', display: '检查', desc: '表示检查关系', source: ['PersonEntity'], target: ['ProjectEntity'], dir: true, temp: true },
    { id: 'mgmt_report', name: 'report', display: '报告', desc: '表示报告关系', source: ['PersonEntity'], target: ['ProjectEntity'], dir: true, temp: true },
    { id: 'mgmt_improve', name: 'improve', display: '改进', desc: '表示改进关系', source: ['PersonEntity'], target: ['ProjectEntity'], dir: true, temp: true }
  ],
  resource: [
    { id: 'mgmt_allocate', name: 'allocate', display: '分配', desc: '表示分配资源', source: ['PersonEntity'], target: ['ResourceEntity'], dir: true, temp: true },
    { id: 'mgmt_use', name: 'use', display: '使用', desc: '表示使用资源', source: ['PersonEntity'], target: ['ResourceEntity'], dir: true, temp: true },
    { id: 'mgmt_recycle', name: 'recycle', display: '回收', desc: '表示回收资源', source: ['PersonEntity'], target: ['ResourceEntity'], dir: true, temp: true },
    { id: 'mgmt_share', name: 'share', display: '共享', desc: '表示共享资源', source: ['PersonEntity'], target: ['ResourceEntity'], dir: true, temp: false }
  ]
};

function createRelationType(domain, category, type) {
  return {
    relationTypeId: type.id,
    name: type.name,
    displayName: type.display,
    description: type.desc,
    sourceEntityTypes: type.source,
    targetEntityTypes: type.target,
    isDirectional: type.dir,
    isTemporal: type.temp,
    supportsConfidence: true
  };
}

function generateJSON() {
  const data = {
    version: '1.0.0',
    description: 'Comprehensive relation type definitions for knowledge graph system - 90 types across 6 domains',
    domains: {}
  };

  // Life domain
  data.domains.life = {
    displayName: '生活领域',
    description: 'Personal life domain including family, social, residence, and health relations',
    categories: {}
  };
  for (const [category, types] of Object.entries(lifeTypes)) {
    data.domains.life.categories[category] = {
      displayName: category === 'family' ? '家庭关系' : category === 'social' ? '社交关系' : category === 'residence' ? '居住关系' : '健康关系',
      types: types.map(t => createRelationType('life', category, t))
    };
  }

  // Work domain
  data.domains.work = {
    displayName: '工作领域',
    description: 'Work domain including employment, collaboration, reporting, and project relations',
    categories: {}
  };
  for (const [category, types] of Object.entries(workTypes)) {
    data.domains.work.categories[category] = {
      displayName: category === 'employment' ? '雇佣关系' : category === 'collaboration' ? '协作关系' : category === 'reporting' ? '汇报关系' : '项目关系',
      types: types.map(t => createRelationType('work', category, t))
    };
  }

  // Travel domain
  data.domains.travel = {
    displayName: '旅行领域',
    description: 'Travel domain including transportation, accommodation, attraction, and route relations',
    categories: {}
  };
  for (const [category, types] of Object.entries(travelTypes)) {
    data.domains.travel.categories[category] = {
      displayName: category === 'transportation' ? '出行关系' : category === 'accommodation' ? '住宿关系' : category === 'attraction' ? '景点关系' : '路线关系',
      types: types.map(t => createRelationType('travel', category, t))
    };
  }

  // Shopping domain
  data.domains.shopping = {
    displayName: '购物领域',
    description: 'Shopping domain including purchase, payment, delivery, and review relations',
    categories: {}
  };
  for (const [category, types] of Object.entries(shoppingTypes)) {
    data.domains.shopping.categories[category] = {
      displayName: category === 'purchase' ? '购买关系' : category === 'payment' ? '支付关系' : category === 'delivery' ? '配送关系' : '评价关系',
      types: types.map(t => createRelationType('shopping', category, t))
    };
  }

  // Government domain
  data.domains.government = {
    displayName: '政务领域',
    description: 'Government domain including approval, supervision, service, and policy relations',
    categories: {}
  };
  for (const [category, types] of Object.entries(governmentTypes)) {
    data.domains.government.categories[category] = {
      displayName: category === 'approval' ? '审批关系' : category === 'supervision' ? '监管关系' : category === 'service' ? '服务关系' : '政策关系',
      types: types.map(t => createRelationType('government', category, t))
    };
  }

  // Management domain
  data.domains.management = {
    displayName: '管理领域',
    description: 'Management domain including decision, execution, monitoring, and resource relations',
    categories: {}
  };
  for (const [category, types] of Object.entries(managementTypes)) {
    data.domains.management.categories[category] = {
      displayName: category === 'decision' ? '决策关系' : category === 'execution' ? '执行关系' : category === 'monitoring' ? '监督关系' : '资源分配关系',
      types: types.map(t => createRelationType('management', category, t))
    };
  }

  return data;
}

// Generate and save
const data = generateJSON();
const outputPath = path.join(__dirname, 'relation_types.json');
fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');

console.log(`Generated relation_types.json with ${
  Object.values(data.domains).reduce((sum, domain) => 
    sum + Object.values(domain.categories).reduce((catSum, cat) => catSum + cat.types.length, 0), 0)
} relation types`);

module.exports = { generateJSON };
