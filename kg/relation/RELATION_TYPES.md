# 关系类型使用文档

## 概述

本文档说明知识图谱系统中的关系类型定义和使用方法。系统支持6个领域共90种关系类型，涵盖生活、工作、旅行、购物、政务、管理等场景。

## 关系类型结构

每个关系类型包含以下元数据：

```javascript
{
  relationTypeId: string,        // 唯一标识符，如 "family_parent"
  name: string,                  // 英文名称，如 "parent"
  displayName: string,           // 中文显示名称，如 "父母"
  description: string,           // 语义描述
  domain: string,                // 所属领域：life/work/travel/shopping/government/management
  category: string,              // 二级分类，如 "family"/"employment"
  sourceEntityTypes: string[],   // 允许的源实体类型
  targetEntityTypes: string[],   // 允许的目标实体类型
  isDirectional: boolean,        // 是否有方向性
  isTemporal: boolean,           // 是否具有时效性
  supportsConfidence: boolean,   // 是否支持置信度
  parentType: string | null,     // 父类型ID（用于继承）
  metadata: object,              // 扩展元数据
  version: string,               // 版本号
  active: boolean                // 是否激活
}
```

## 领域分类

### 1. 生活领域 (Life Domain)

#### 1.1 家庭关系 (Family Relations)

| 关系类型ID | 中文名称 | 源实体 | 目标实体 | 方向性 | 说明 |
|-----------|---------|--------|---------|--------|------|
| family_parent | 父母 | PersonEntity | PersonEntity | 单向 | 表示父母关系 |
| family_child | 子女 | PersonEntity | PersonEntity | 单向 | 表示子女关系 |
| family_spouse | 配偶 | PersonEntity | PersonEntity | 双向 | 表示配偶关系 |
| family_sibling | 兄弟姐妹 | PersonEntity | PersonEntity | 双向 | 表示兄弟姐妹关系 |
| family_grandparent | 祖父母/外祖父母 | PersonEntity | PersonEntity | 单向 | 表示祖辈关系 |
| family_grandchild | 孙子女/外孙子女 | PersonEntity | PersonEntity | 单向 | 表示孙辈关系 |

**使用示例：**

```javascript
// 创建父母关系
const relation = {
  source_id: 'person_john',
  target_id: 'person_alice',
  type: 'builtin',
  subtype: 'family_parent',
  confidence: 1.0,
  evidence_ckb: ['ckb_1']
};
```

#### 1.2 社交关系 (Social Relations)

| 关系类型ID | 中文名称 | 源实体 | 目标实体 | 方向性 | 说明 |
|-----------|---------|--------|---------|--------|------|
| social_friend | 朋友 | PersonEntity | PersonEntity | 双向 | 表示朋友关系 |
| social_classmate | 同学 | PersonEntity | PersonEntity | 双向 | 表示同学关系 |
| social_neighbor | 邻居 | PersonEntity | PersonEntity | 双向 | 表示邻居关系 |
| social_colleague | 同事 | PersonEntity | PersonEntity | 双向 | 表示同事关系 |

#### 1.3 居住关系 (Residence Relations)

| 关系类型ID | 中文名称 | 源实体 | 目标实体 | 方向性 | 说明 |
|-----------|---------|--------|---------|--------|------|
| residence_live_in | 居住于 | PersonEntity | LocationEntity | 单向 | 表示居住地 |
| residence_own | 拥有 | PersonEntity | LocationEntity | 单向 | 表示房产所有权 |
| residence_rent | 租赁 | PersonEntity | LocationEntity | 单向 | 表示租赁关系 |

#### 1.4 健康关系 (Health Relations)

| 关系类型ID | 中文名称 | 源实体 | 目标实体 | 方向性 | 说明 |
|-----------|---------|--------|---------|--------|------|
| health_visit | 就诊于 | PersonEntity | OrganizationEntity | 单向 | 表示就医关系 |
| health_diagnose | 患有 | PersonEntity | IndicatorEntity | 单向 | 表示疾病诊断 |
| health_treat | 治疗 | PersonEntity | IndicatorEntity | 单向 | 表示治疗关系 |
| health_prevent | 预防 | PersonEntity | IndicatorEntity | 单向 | 表示预防措施 |

### 2. 工作领域 (Work Domain)

#### 2.1 雇佣关系 (Employment Relations)

| 关系类型ID | 中文名称 | 源实体 | 目标实体 | 方向性 | 时效性 | 说明 |
|-----------|---------|--------|---------|--------|--------|------|
| work_employ | 雇佣 | OrganizationEntity | PersonEntity | 单向 | 是 | 表示雇佣关系 |
| work_position | 任职 | PersonEntity | OrganizationEntity | 单向 | 是 | 表示职位关系 |
| work_part_time | 兼职 | PersonEntity | OrganizationEntity | 单向 | 是 | 表示兼职关系 |
| work_resign | 离职 | PersonEntity | OrganizationEntity | 单向 | 是 | 表示离职关系 |

**使用示例：**

```javascript
// 创建雇佣关系
const relation = {
  source_id: 'org_company_a',
  target_id: 'person_bob',
  type: 'builtin',
  subtype: 'work_employ',
  confidence: 1.0,
  evidence_ckb: ['ckb_2'],
  metadata: {
    start_date: '2023-01-01',
    position: 'Software Engineer'
  }
};
```

#### 2.2 协作关系 (Collaboration Relations)

| 关系类型ID | 中文名称 | 源实体 | 目标实体 | 方向性 | 说明 |
|-----------|---------|--------|---------|--------|------|
| work_cooperate | 合作 | PersonEntity | PersonEntity | 双向 | 表示合作关系 |
| work_assist | 协助 | PersonEntity | PersonEntity | 单向 | 表示协助关系 |
| work_mentor | 指导 | PersonEntity | PersonEntity | 单向 | 表示指导关系 |
| work_consult | 咨询 | PersonEntity | PersonEntity | 单向 | 表示咨询关系 |

#### 2.3 汇报关系 (Reporting Relations)

| 关系类型ID | 中文名称 | 源实体 | 目标实体 | 方向性 | 说明 |
|-----------|---------|--------|---------|--------|------|
| work_report_direct | 直接汇报 | PersonEntity | PersonEntity | 单向 | 表示直接汇报关系 |
| work_report_indirect | 间接汇报 | PersonEntity | PersonEntity | 单向 | 表示间接汇报关系 |
| work_report_matrix | 矩阵汇报 | PersonEntity | PersonEntity | 单向 | 表示矩阵汇报关系 |

#### 2.4 项目关系 (Project Relations)

| 关系类型ID | 中文名称 | 源实体 | 目标实体 | 方向性 | 说明 |
|-----------|---------|--------|---------|--------|------|
| work_participate | 参与 | PersonEntity | ProjectEntity | 单向 | 表示项目参与 |
| work_lead | 负责 | PersonEntity | ProjectEntity | 单向 | 表示项目负责 |
| work_approve | 审批 | PersonEntity | ProjectEntity | 单向 | 表示项目审批 |
| work_accept | 验收 | PersonEntity | ProjectEntity | 单向 | 表示项目验收 |

### 3. 旅行领域 (Travel Domain)

#### 3.1 出行关系 (Transportation Relations)

| 关系类型ID | 中文名称 | 源实体 | 目标实体 | 方向性 | 说明 |
|-----------|---------|--------|---------|--------|------|
| travel_take | 乘坐 | PersonEntity | EquipmentEntity | 单向 | 表示乘坐交通工具 |
| travel_drive | 驾驶 | PersonEntity | EquipmentEntity | 单向 | 表示驾驶交通工具 |
| travel_transfer | 转乘 | LocationEntity | LocationEntity | 单向 | 表示换乘地点 |
| travel_arrive | 到达 | PersonEntity | LocationEntity | 单向 | 表示到达目的地 |

#### 3.2 住宿关系 (Accommodation Relations)

| 关系类型ID | 中文名称 | 源实体 | 目标实体 | 方向性 | 说明 |
|-----------|---------|--------|---------|--------|------|
| travel_checkin | 入住 | PersonEntity | LocationEntity | 单向 | 表示酒店入住 |
| travel_book | 预订 | PersonEntity | LocationEntity | 单向 | 表示酒店预订 |
| travel_recommend_hotel | 推荐住宿 | PersonEntity | LocationEntity | 单向 | 表示住宿推荐 |

#### 3.3 景点关系 (Attraction Relations)

| 关系类型ID | 中文名称 | 源实体 | 目标实体 | 方向性 | 说明 |
|-----------|---------|--------|---------|--------|------|
| travel_visit | 游览 | PersonEntity | LocationEntity | 单向 | 表示景点游览 |
| travel_checkin_spot | 打卡 | PersonEntity | LocationEntity | 单向 | 表示景点打卡 |
| travel_rate | 评价 | PersonEntity | LocationEntity | 单向 | 表示景点评价 |

#### 3.4 路线关系 (Route Relations)

| 关系类型ID | 中文名称 | 源实体 | 目标实体 | 方向性 | 说明 |
|-----------|---------|--------|---------|--------|------|
| travel_pass_through | 途经 | LocationEntity | LocationEntity | 单向 | 表示路线途经点 |
| travel_connect | 连接 | LocationEntity | LocationEntity | 单向 | 表示地点连接 |
| travel_recommend_route | 推荐路线 | PersonEntity | LocationEntity | 单向 | 表示路线推荐 |

### 4. 购物领域 (Shopping Domain)

#### 4.1 购买关系 (Purchase Relations)

| 关系类型ID | 中文名称 | 源实体 | 目标实体 | 方向性 | 说明 |
|-----------|---------|--------|---------|--------|------|
| shopping_buy | 购买 | PersonEntity | ProductEntity | 单向 | 表示购买行为 |
| shopping_add_cart | 加购 | PersonEntity | ProductEntity | 单向 | 表示加入购物车 |
| shopping_favorite | 收藏 | PersonEntity | ProductEntity | 单向 | 表示商品收藏 |
| shopping_browse | 浏览 | PersonEntity | ProductEntity | 单向 | 表示商品浏览 |

#### 4.2 支付关系 (Payment Relations)

| 关系类型ID | 中文名称 | 源实体 | 目标实体 | 方向性 | 说明 |
|-----------|---------|--------|---------|--------|------|
| shopping_pay | 支付 | PersonEntity | ProductEntity | 单向 | 表示支付行为 |
| shopping_refund | 退款 | PersonEntity | ProductEntity | 单向 | 表示退款行为 |
| shopping_discount | 优惠 | ProductEntity | PersonEntity | 单向 | 表示优惠活动 |

#### 4.3 配送关系 (Delivery Relations)

| 关系类型ID | 中文名称 | 源实体 | 目标实体 | 方向性 | 说明 |
|-----------|---------|--------|---------|--------|------|
| shopping_deliver | 配送 | OrganizationEntity | PersonEntity | 单向 | 表示配送服务 |
| shopping_receive | 签收 | PersonEntity | ProductEntity | 单向 | 表示签收行为 |
| shopping_return | 退货 | PersonEntity | ProductEntity | 单向 | 表示退货行为 |

#### 4.4 评价关系 (Review Relations)

| 关系类型ID | 中文名称 | 源实体 | 目标实体 | 方向性 | 说明 |
|-----------|---------|--------|---------|--------|------|
| shopping_review | 评价 | PersonEntity | ProductEntity | 单向 | 表示商品评价 |
| shopping_like | 点赞 | PersonEntity | ProductEntity | 单向 | 表示点赞行为 |
| shopping_complain | 投诉 | PersonEntity | ProductEntity | 单向 | 表示投诉行为 |

### 5. 政务领域 (Government Domain)

#### 5.1 审批关系 (Approval Relations)

| 关系类型ID | 中文名称 | 源实体 | 目标实体 | 方向性 | 说明 |
|-----------|---------|--------|---------|--------|------|
| gov_apply | 申请 | PersonEntity | OrganizationEntity | 单向 | 表示申请行为 |
| gov_review | 审批 | PersonEntity | DocumentEntity | 单向 | 表示审批行为 |
| gov_approve | 批准 | PersonEntity | DocumentEntity | 单向 | 表示批准行为 |
| gov_reject | 驳回 | PersonEntity | DocumentEntity | 单向 | 表示驳回行为 |

#### 5.2 监管关系 (Supervision Relations)

| 关系类型ID | 中文名称 | 源实体 | 目标实体 | 方向性 | 说明 |
|-----------|---------|--------|---------|--------|------|
| gov_supervise | 监管 | OrganizationEntity | OrganizationEntity | 单向 | 表示监管关系 |
| gov_inspect | 检查 | OrganizationEntity | OrganizationEntity | 单向 | 表示检查行为 |
| gov_penalize | 处罚 | OrganizationEntity | OrganizationEntity | 单向 | 表示处罚行为 |
| gov_rectify | 整改 | OrganizationEntity | OrganizationEntity | 单向 | 表示整改要求 |

#### 5.3 服务关系 (Service Relations)

| 关系类型ID | 中文名称 | 源实体 | 目标实体 | 方向性 | 说明 |
|-----------|---------|--------|---------|--------|------|
| gov_handle | 办理 | OrganizationEntity | PersonEntity | 单向 | 表示办理服务 |
| gov_consult | 咨询 | PersonEntity | OrganizationEntity | 单向 | 表示咨询服务 |
| gov_complain | 投诉 | PersonEntity | OrganizationEntity | 单向 | 表示投诉行为 |
| gov_feedback | 反馈 | PersonEntity | OrganizationEntity | 单向 | 表示反馈意见 |

#### 5.4 政策关系 (Policy Relations)

| 关系类型ID | 中文名称 | 源实体 | 目标实体 | 方向性 | 说明 |
|-----------|---------|--------|---------|--------|------|
| gov_formulate | 制定 | OrganizationEntity | DocumentEntity | 单向 | 表示政策制定 |
| gov_publish | 发布 | OrganizationEntity | DocumentEntity | 单向 | 表示政策发布 |
| gov_execute | 执行 | OrganizationEntity | DocumentEntity | 单向 | 表示政策执行 |
| gov_abolish | 废止 | OrganizationEntity | DocumentEntity | 单向 | 表示政策废止 |

### 6. 管理领域 (Management Domain)

#### 6.1 决策关系 (Decision Relations)

| 关系类型ID | 中文名称 | 源实体 | 目标实体 | 方向性 | 说明 |
|-----------|---------|--------|---------|--------|------|
| mgmt_decide | 决策 | PersonEntity | ProjectEntity | 单向 | 表示决策行为 |
| mgmt_suggest | 建议 | PersonEntity | ProjectEntity | 单向 | 表示建议意见 |
| mgmt_approve_decision | 批准决策 | PersonEntity | ProjectEntity | 单向 | 表示决策批准 |
| mgmt_veto | 否决 | PersonEntity | ProjectEntity | 单向 | 表示决策否决 |

#### 6.2 执行关系 (Execution Relations)

| 关系类型ID | 中文名称 | 源实体 | 目标实体 | 方向性 | 说明 |
|-----------|---------|--------|---------|--------|------|
| mgmt_execute | 执行 | PersonEntity | ProjectEntity | 单向 | 表示执行任务 |
| mgmt_complete | 完成 | PersonEntity | ProjectEntity | 单向 | 表示任务完成 |
| mgmt_delay | 延期 | PersonEntity | ProjectEntity | 单向 | 表示任务延期 |
| mgmt_cancel | 取消 | PersonEntity | ProjectEntity | 单向 | 表示任务取消 |

#### 6.3 监督关系 (Monitoring Relations)

| 关系类型ID | 中文名称 | 源实体 | 目标实体 | 方向性 | 说明 |
|-----------|---------|--------|---------|--------|------|
| mgmt_monitor | 监督 | PersonEntity | ProjectEntity | 单向 | 表示监督行为 |
| mgmt_check | 检查 | PersonEntity | ProjectEntity | 单向 | 表示检查行为 |
| mgmt_report | 报告 | PersonEntity | ProjectEntity | 单向 | 表示报告行为 |
| mgmt_improve | 改进 | PersonEntity | ProjectEntity | 单向 | 表示改进措施 |

#### 6.4 资源分配关系 (Resource Allocation Relations)

| 关系类型ID | 中文名称 | 源实体 | 目标实体 | 方向性 | 说明 |
|-----------|---------|--------|---------|--------|------|
| mgmt_allocate | 分配 | PersonEntity | ResourceEntity | 单向 | 表示资源分配 |
| mgmt_use | 使用 | PersonEntity | ResourceEntity | 单向 | 表示资源使用 |
| mgmt_recycle | 回收 | PersonEntity | ResourceEntity | 单向 | 表示资源回收 |
| mgmt_share | 共享 | PersonEntity | ResourceEntity | 单向 | 表示资源共享 |

## 最佳实践

### 1. 选择合适的关系类型

- 根据实体类型选择兼容的关系类型
- 考虑关系的方向性和时效性
- 使用语义明确的关系类型

### 2. 在Schema中定义关系

```javascript
{
  schema_name: 'PersonSchema',
  entity_type: 'PersonEntity',
  core_fields: [...],
  threshold: 0.7,
  relations: [
    {
      type: 'parent',
      relation_type_id: 'family_parent',  // 使用关系类型ID
      target_field: 'parent_name',
      direction: 'outgoing'
    }
  ]
}
```

### 3. 验证关系类型

```javascript
const relationTypeValidator = require('./relation_type_validator');
const relationType = registry.get('family_parent');

const validation = relationTypeValidator.validate(
  {
    sourceEntityType: 'PersonEntity',
    targetEntityType: 'PersonEntity',
    confidence: 0.95
  },
  relationType
);

if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

### 4. 查询关系类型

```javascript
const relationTypeQuery = require('./relation_type_query');
const query = new relationTypeQuery(registry);

// 按领域查询
const lifeTypes = query.query({ domain: 'life' });

// 按实体类型查询
const personTypes = query.getCompatibleTypes('PersonEntity', 'PersonEntity');

// 搜索关系类型
const results = query.search('父母');
```

## 扩展关系类型

### 添加新的关系类型

1. 在 `relation_types.json` 中添加定义
2. 运行初始化脚本加载到数据库
3. 在Schema中引用新的关系类型

```bash
node kg/relation/init_relation_types.js --update
```

### 自定义关系类型

```javascript
const customType = {
  relationTypeId: 'custom_relation',
  name: 'custom',
  displayName: '自定义关系',
  description: '自定义关系描述',
  domain: 'life',
  category: 'custom',
  sourceEntityTypes: ['PersonEntity'],
  targetEntityTypes: ['PersonEntity'],
  isDirectional: true,
  isTemporal: false,
  supportsConfidence: true,
  version: '1.0.0',
  active: true
};

await relationTypeStore.create(customType);
```

## 常见问题

### Q: 如何选择合适的关系类型？

A: 根据以下因素选择：
- 实体类型是否匹配
- 关系的语义是否准确
- 是否需要方向性
- 是否需要时效性

### Q: 可以修改现有关系类型吗？

A: 可以，但建议：
- 使用版本号管理变更
- 保持向后兼容性
- 更新相关文档

### Q: 如何处理遗留的关系类型？

A: 系统支持向后兼容：
- 遗留关系类型仍然有效
- 可以逐步迁移到新类型
- 使用 `active` 字段标记废弃类型

## 参考资料

- [关系类型设计文档](../../.kiro/specs/relation-type-expansion/design.md)
- [关系类型需求文档](../../.kiro/specs/relation-type-expansion/requirements.md)
- [API文档](../API.md)
