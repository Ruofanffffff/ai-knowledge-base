# Schema 定义指南

## 1. 概述

Schema 是知识图谱系统的核心组件,定义了从文档中抽取知识的模板和规则。本指南详细说明如何定义、管理和使用 Schema。

### 1.1 什么是 Schema?

Schema 是一个结构化的模板,用于:
- 定义实体类型和核心字段
- 指定字段的权重和必需性
- 定义实体间的内建关系
- 设置实体实例化的阈值

### 1.2 Schema 的作用

- **知识抽取**: 指导系统从文档中抽取结构化知识
- **实体构建**: 定义实体的属性和结构
- **关系构建**: 定义实体间的固有关系
- **质量控制**: 通过阈值控制实体质量

### 1.3 Schema 驱动流程

```
文档 → CKB → 字段抽取 → 字段清洗 → Schema 匹配 → 实体构建 → 关系构建 → 知识图谱
```

## 2. Schema 结构

### 2.1 完整结构示例

```javascript
{
  schema_name: "地下水位变化事件",
  entity_type: "EventEntity",
  scene: "科研/政府",
  core_fields: [
    { name: "区域", weight: 0.3, required: true },
    { name: "时间", weight: 0.2, required: true },
    { name: "指标", weight: 0.2, required: true },
    { name: "数值", weight: 0.2, required: false },
    { name: "单位", weight: 0.1, required: false }
  ],
  threshold: 0.75,
  relations: [
    { type: "发生于", target_field: "区域", direction: "outgoing" },
    { type: "发生时间", target_field: "时间", direction: "outgoing" },
    { type: "影响指标", target_field: "指标", direction: "outgoing" }
  ],
  example_description: "A区2022年地下水位下降0.8米",
  description: "用于记录某个实体在某个时间点的指标数值，便于统计、趋势分析和图谱构建",
  version: "1.0.0",
  active: true
}
```

### 2.2 字段说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `schema_name` | String | 是 | Schema 唯一名称 |
| `entity_type` | String | 是 | 实体类型 |
| `scene` | String | 否 | 场景分类 (如 "科研/政府") |
| `core_fields` | Array | 是 | 核心字段列表 |
| `threshold` | Number | 是 | 实例化阈值 (0-1) |
| `relations` | Array | 否 | 内建关系定义 |
| `example_description` | String | 否 | 示例描述 |
| `description` | String | 否 | 详细说明 |
| `version` | String | 是 | 版本号 |
| `active` | Boolean | 是 | 是否启用 |

## 3. 核心字段定义

### 3.1 字段结构

每个核心字段包含三个属性:

```javascript
{
  name: "字段名称",      // 字段的标准名称
  weight: 0.3,          // 字段权重 (0-1)
  required: true        // 是否必需
}
```

### 3.2 字段命名规范

**推荐命名方式**:
- 使用中文或英文
- 简洁明确,避免歧义
- 与领域术语保持一致

**常见字段名称**:
- 时间相关: `时间`, `日期`, `开始时间`, `结束时间`
- 地点相关: `地点`, `位置`, `区域`, `地理位置`
- 数值相关: `数值`, `指标`, `单位`, `观测值`
- 人员相关: `负责人`, `参与者`, `观察者`
- 描述相关: `描述`, `内容`, `备注`, `说明`

### 3.3 字段权重设置

**权重规则**:
1. 所有字段权重之和必须等于 1.0
2. 权重范围: 0.0 - 1.0
3. 权重越高,字段越重要

**权重分配建议**:
- **核心标识字段** (0.3-0.5): 实体的主要标识,如名称、ID
- **关键属性字段** (0.2-0.3): 重要的描述性属性
- **辅助属性字段** (0.1-0.2): 补充信息
- **可选属性字段** (0.05-0.1): 次要信息

**示例**:
```javascript
core_fields: [
  { name: "项目名称", weight: 0.4, required: true },      // 核心标识
  { name: "项目负责人", weight: 0.2, required: false },  // 关键属性
  { name: "开始时间", weight: 0.2, required: false },    // 关键属性
  { name: "结束时间", weight: 0.1, required: false },    // 辅助属性
  { name: "项目状态", weight: 0.1, required: false }     // 辅助属性
]
```

### 3.4 必需字段设置

**必需字段 (required: true)**:
- 实体实例化时必须存在
- 缺失时无法创建实体
- 通常是核心标识字段

**可选字段 (required: false)**:
- 实体实例化时可以缺失
- 缺失时不影响实体创建
- 通常是辅助描述字段

**设置建议**:
- 至少设置 1-2 个必需字段
- 必需字段应该是最核心的标识信息
- 避免设置过多必需字段,影响实体创建成功率


## 4. 实体类型

### 4.1 预定义实体类型

系统支持以下实体类型:

| 实体类型 | 说明 | 适用场景 |
|---------|------|---------|
| `EventEntity` | 事件实体 | 记录发生的事件,如地下水位变化、会议、培训 |
| `LocationEntity` | 地点实体 | 记录地理位置,如区域、城市、观测点 |
| `PersonEntity` | 人员实体 | 记录人员信息,如负责人、参与者 |
| `ProjectEntity` | 项目实体 | 记录项目信息,如科研项目、工程项目 |
| `ObservationEntity` | 观测实体 | 记录观测数据,如传感器数据、实验结果 |
| `DocumentEntity` | 文档实体 | 记录文档信息,如报告、论文、政策文件 |
| `TravelEntity` | 旅行实体 | 记录旅行信息,如旅行地点、活动 |
| `PhotographyEntity` | 摄影实体 | 记录摄影信息,如拍摄参数、场景 |
| `HealthEntity` | 健康实体 | 记录健康数据,如体温、体重 |
| `FinanceEntity` | 财务实体 | 记录财务信息,如预算、支出 |

### 4.2 自定义实体类型

如果预定义类型不满足需求,可以自定义实体类型:

**命名规范**:
- 使用 PascalCase 格式
- 以 "Entity" 结尾
- 名称应该清晰表达实体的含义

**示例**:
```javascript
entity_type: "ResearchPaperEntity"  // 科研论文实体
entity_type: "EquipmentEntity"      // 设备实体
entity_type: "PolicyEntity"         // 政策实体
```

## 5. 场景分类

### 5.1 场景的作用

场景 (scene) 用于对 Schema 进行分类管理,便于:
- 按领域筛选 Schema
- 提高 Schema 匹配效率
- 优化用户体验

### 5.2 预定义场景

| 场景 | 说明 | 示例 Schema |
|------|------|------------|
| `科研/政府` | 科研和政府工作 | 地下水位变化事件、政策文件 |
| `科研/学术` | 学术研究 | 论文摘要、实验记录 |
| `政府工作` | 政府管理 | 会议纪要、任务分配 |
| `个人生活` | 个人日常 | 日记、健康记录 |
| `旅行/休闲` | 旅行和休闲 | 旅行日志、景点记录 |
| `摄影` | 摄影相关 | 拍摄参数、场景记录 |
| `后期` | 后期处理 | 后期流程、调色记录 |
| `运动` | 运动健身 | 运动记录、健身进度 |
| `娱乐` | 娱乐活动 | 电影观看、音乐收听 |
| `全场景` | 通用场景 | 元数据、文件记录 |

### 5.3 场景设置建议

- 选择最贴切的场景分类
- 可以使用 "/" 组合多个场景,如 "科研/政府"
- 通用 Schema 使用 "全场景"


## 6. 阈值设置

### 6.1 阈值的作用

阈值 (threshold) 决定了实体实例化的最低要求:
- 字段完整度 ≥ 阈值 → 创建实体
- 字段完整度 < 阈值 → 不创建实体

### 6.2 字段完整度计算

```
字段完整度 = Σ(已匹配字段的权重) / Σ(所有字段的权重)
```

**示例**:
```javascript
// Schema 定义
core_fields: [
  { name: "项目名称", weight: 0.4, required: true },
  { name: "负责人", weight: 0.3, required: false },
  { name: "开始时间", weight: 0.3, required: false }
]
threshold: 0.7

// 情况 1: 匹配了 "项目名称" 和 "负责人"
字段完整度 = (0.4 + 0.3) / 1.0 = 0.7 ≥ 0.7 → 创建实体

// 情况 2: 只匹配了 "项目名称"
字段完整度 = 0.4 / 1.0 = 0.4 < 0.7 → 不创建实体
```

### 6.3 阈值设置建议

| 阈值范围 | 适用场景 | 说明 |
|---------|---------|------|
| 0.5-0.6 | 宽松模式 | 允许较多字段缺失,适合探索性抽取 |
| 0.7-0.8 | 标准模式 | 平衡质量和数量,推荐使用 |
| 0.8-0.9 | 严格模式 | 要求高完整度,适合高质量场景 |
| 0.9-1.0 | 极严格模式 | 几乎不允许字段缺失 |

**设置原则**:
- 必需字段多 → 阈值可以适当降低
- 必需字段少 → 阈值应该适当提高
- 字段数量多 → 阈值可以适当降低
- 字段数量少 → 阈值应该适当提高

## 7. 关系定义

### 7.1 关系结构

```javascript
{
  type: "关系类型",           // 关系的名称
  target_field: "目标字段",   // 关系指向的字段
  direction: "outgoing"       // 关系方向
}
```

### 7.2 关系方向

- **outgoing**: 从当前实体指向目标实体
- **incoming**: 从目标实体指向当前实体

**示例**:
```javascript
// 地下水位变化事件 Schema
relations: [
  { 
    type: "发生于", 
    target_field: "区域", 
    direction: "outgoing" 
  }
]
// 生成关系: 地下水位变化事件 --发生于--> 区域实体
```

### 7.3 常见关系类型

| 关系类型 | 说明 | 示例 |
|---------|------|------|
| `发生于` | 事件发生的地点 | 事件 --发生于--> 地点 |
| `发生时间` | 事件发生的时间 | 事件 --发生时间--> 时间 |
| `负责人` | 项目或任务的负责人 | 项目 --负责人--> 人员 |
| `参与者` | 活动的参与者 | 会议 --参与者--> 人员 |
| `属于` | 从属关系 | 子区域 --属于--> 父区域 |
| `影响` | 影响关系 | 因素 --影响--> 结果 |
| `引用` | 引用关系 | 论文 --引用--> 论文 |
| `包含` | 包含关系 | 项目 --包含--> 任务 |

### 7.4 关系定义建议

- 只定义明确的、固有的关系
- 关系类型应该清晰表达语义
- 避免定义过多关系,保持简洁
- 复杂关系可以通过语义关系构建器自动发现


## 8. 示例 Schema

### 8.1 科研场景: 地下水位变化事件

```javascript
{
  schema_name: "地下水位变化事件",
  entity_type: "EventEntity",
  scene: "科研/政府",
  core_fields: [
    { name: "区域", weight: 0.3, required: true },
    { name: "时间", weight: 0.2, required: true },
    { name: "指标", weight: 0.2, required: true },
    { name: "数值", weight: 0.2, required: false },
    { name: "单位", weight: 0.1, required: false }
  ],
  threshold: 0.75,
  relations: [
    { type: "发生于", target_field: "区域", direction: "outgoing" },
    { type: "发生时间", target_field: "时间", direction: "outgoing" },
    { type: "影响指标", target_field: "指标", direction: "outgoing" }
  ],
  example_description: "A区2022年地下水位下降0.8米",
  description: "用于记录某个实体在某个时间点的指标数值，便于统计、趋势分析和图谱构建",
  version: "1.0.0",
  active: true
}
```

**触发示例**:
- "A区2022年地下水位下降0.8米"
- "B区2023年1月水位上升1.2米"
- "C区观测点水位为10.5米"

### 8.2 政府场景: 会议纪要

```javascript
{
  schema_name: "会议纪要",
  entity_type: "EventEntity",
  scene: "政府工作",
  core_fields: [
    { name: "会议名称", weight: 0.3, required: true },
    { name: "会议时间", weight: 0.2, required: true },
    { name: "参与者", weight: 0.2, required: false },
    { name: "会议内容", weight: 0.2, required: false },
    { name: "决策事项", weight: 0.1, required: false }
  ],
  threshold: 0.7,
  relations: [
    { type: "参与者", target_field: "参与者", direction: "outgoing" },
    { type: "发生时间", target_field: "会议时间", direction: "outgoing" }
  ],
  example_description: "水利局会议 → 2026-01-20 → 决策：增加监测频率",
  description: "记录会议内容、参与者及决策结果",
  version: "1.0.0",
  active: true
}
```

**触发示例**:
- "水利局会议于2026年1月20日召开,张三、李四参与"
- "项目评审会议决定增加监测频率"

### 8.3 个人生活场景: 旅行照片

```javascript
{
  schema_name: "旅行照片",
  entity_type: "TravelEntity",
  scene: "个人生活",
  core_fields: [
    { name: "地点", weight: 0.3, required: true },
    { name: "时间", weight: 0.2, required: true },
    { name: "场景描述", weight: 0.3, required: false },
    { name: "拍摄设备", weight: 0.1, required: false },
    { name: "心情", weight: 0.1, required: false }
  ],
  threshold: 0.6,
  relations: [
    { type: "拍摄于", target_field: "地点", direction: "outgoing" },
    { type: "拍摄时间", target_field: "时间", direction: "outgoing" }
  ],
  example_description: "青森美术馆 → 2026-01-20 → 赏雪场景",
  description: "记录旅行照片及拍摄信息",
  version: "1.0.0",
  active: true
}
```

**触发示例**:
- "青森美术馆,2026年1月20日,赏雪场景"
- "京都清水寺,2025年12月25日,赏枫"

### 8.4 摄影场景: 拍摄参数

```javascript
{
  schema_name: "拍摄参数",
  entity_type: "PhotographyEntity",
  scene: "摄影",
  core_fields: [
    { name: "相机型号", weight: 0.2, required: false },
    { name: "镜头", weight: 0.2, required: false },
    { name: "ISO", weight: 0.15, required: false },
    { name: "光圈", weight: 0.15, required: false },
    { name: "快门速度", weight: 0.15, required: false },
    { name: "焦距", weight: 0.13, required: false }
  ],
  threshold: 0.5,
  relations: [],
  example_description: "A7M4 + 35mm f1.8, ISO800",
  description: "记录照片的拍摄参数",
  version: "1.0.0",
  active: true
}
```

**触发示例**:
- "A7M4 + 35mm f1.8, ISO800, 快门1/125"
- "Canon R5, 24-70mm, f2.8, ISO400"


## 9. Schema 管理

### 9.1 创建 Schema

**方式 1: 通过 API 创建**

```bash
POST /api/knowledge-graph/schemas
Content-Type: application/json

{
  "schema_name": "新Schema名称",
  "entity_type": "EventEntity",
  "scene": "科研/政府",
  "core_fields": [
    { "name": "字段1", "weight": 0.5, "required": true },
    { "name": "字段2", "weight": 0.5, "required": false }
  ],
  "threshold": 0.7,
  "relations": [],
  "example_description": "示例描述",
  "description": "详细说明",
  "version": "1.0.0",
  "active": true
}
```

**方式 2: 在 SchemaList.md 中定义**

在 `SchemaList.md` 文件中添加一行:

```
序号  Schema名称  场景  核心字段  示例描述  Description
100   新Schema   科研  字段1,字段2  示例  详细说明
```

然后运行导入脚本:

```bash
node kg/schema/load_schemas.js
```

### 9.2 更新 Schema

```bash
PUT /api/knowledge-graph/schemas/:id
Content-Type: application/json

{
  "description": "更新后的描述",
  "active": true
}
```

**注意**: 更新 Schema 会创建新版本,旧版本保留。

### 9.3 启用/禁用 Schema

```bash
# 启用 Schema
PUT /api/knowledge-graph/schemas/:id/enable

# 禁用 Schema
PUT /api/knowledge-graph/schemas/:id/disable
```

**禁用效果**:
- Schema 不参与匹配
- 已创建的实体不受影响
- 可以随时重新启用

### 9.4 删除 Schema

```bash
DELETE /api/knowledge-graph/schemas/:id
```

**注意**: 
- 删除前会检查是否有实体依赖
- 如果有实体依赖,删除会失败
- 建议使用禁用而不是删除

### 9.5 查询 Schema

```bash
# 获取所有 Schema
GET /api/knowledge-graph/schemas

# 按场景筛选
GET /api/knowledge-graph/schemas?scene=科研

# 只获取启用的 Schema
GET /api/knowledge-graph/schemas?active=true

# 获取单个 Schema
GET /api/knowledge-graph/schemas/:id
```

### 9.6 导入/导出 Schema

```bash
# 导入 Schema (从 SchemaList.md)
POST /api/knowledge-graph/schemas/import

# 导出 Schema (JSON 格式)
GET /api/knowledge-graph/schemas/export?format=json

# 导出 Schema (CSV 格式)
GET /api/knowledge-graph/schemas/export?format=csv
```

## 10. Schema 设计最佳实践

### 10.1 字段设计原则

1. **简洁性**: 只包含核心字段,避免冗余
2. **通用性**: 字段名称应该通用,便于映射
3. **完整性**: 包含足够的字段描述实体
4. **可扩展性**: 预留扩展空间

### 10.2 权重分配原则

1. **核心优先**: 核心标识字段权重最高
2. **均衡分配**: 避免权重过于集中
3. **总和为1**: 所有权重之和必须为 1.0
4. **合理梯度**: 权重应该有明显的梯度

### 10.3 阈值设置原则

1. **质量优先**: 优先保证实体质量
2. **场景适配**: 根据场景调整阈值
3. **迭代优化**: 根据实际效果调整
4. **平衡数量**: 避免阈值过高导致实体过少

### 10.4 关系定义原则

1. **明确性**: 只定义明确的关系
2. **简洁性**: 避免定义过多关系
3. **语义清晰**: 关系类型应该清晰表达语义
4. **可扩展**: 复杂关系由系统自动发现


### 10.5 命名规范

**Schema 名称**:
- 使用中文或英文
- 简洁明确,避免歧义
- 反映实体的核心特征

**字段名称**:
- 使用领域通用术语
- 避免缩写和简写
- 保持一致性

**关系类型**:
- 使用动词或动词短语
- 清晰表达关系语义
- 避免模糊表达

### 10.6 版本管理

**版本号格式**: `主版本.次版本.修订版本`

**版本更新规则**:
- **主版本**: 不兼容的重大变更
- **次版本**: 向后兼容的功能新增
- **修订版本**: 向后兼容的问题修复

**示例**:
- `1.0.0` - 初始版本
- `1.1.0` - 添加新字段
- `1.1.1` - 修复字段权重
- `2.0.0` - 重构字段结构

## 11. Schema 验证

### 11.1 自动验证

系统会自动验证 Schema 的有效性:

**验证项**:
- ✅ `schema_name` 必须是字符串
- ✅ `entity_type` 必须是字符串
- ✅ `core_fields` 必须是非空数组
- ✅ `threshold` 必须在 0-1 之间
- ✅ 字段权重之和必须为 1.0
- ✅ 每个字段必须有 name, weight, required
- ✅ 关系必须有 type, target_field, direction

### 11.2 手动验证

**验证清单**:

- [ ] Schema 名称是否唯一?
- [ ] 实体类型是否合适?
- [ ] 场景分类是否准确?
- [ ] 核心字段是否完整?
- [ ] 字段权重是否合理?
- [ ] 必需字段是否正确?
- [ ] 阈值是否合适?
- [ ] 关系定义是否清晰?
- [ ] 示例描述是否准确?
- [ ] 详细说明是否完整?

### 11.3 测试 Schema

**测试步骤**:

1. **创建测试文档**: 包含触发 Schema 的内容
2. **运行知识图谱构建**: 观察是否正确匹配
3. **检查实体质量**: 验证实体是否符合预期
4. **检查关系质量**: 验证关系是否正确
5. **调整优化**: 根据结果调整 Schema

**测试示例**:

```javascript
// 测试文档内容
const testContent = "A区2022年地下水位下降0.8米";

// 运行 KG 构建
const result = await buildKnowledgeGraph(testContent);

// 验证结果
console.log("匹配的 Schema:", result.matched_schemas);
console.log("创建的实体:", result.entities);
console.log("创建的关系:", result.relations);
```

## 12. 常见问题

### 12.1 Schema 不匹配

**问题**: 文档内容无法匹配到 Schema

**可能原因**:
- 字段名称不匹配
- 阈值设置过高
- Schema 被禁用

**解决方案**:
1. 检查字段名称是否在同义词词典中
2. 适当降低阈值
3. 确认 Schema 处于启用状态
4. 添加更多同义词

### 12.2 实体质量低

**问题**: 创建的实体质量不符合预期

**可能原因**:
- 阈值设置过低
- 字段权重分配不合理
- 必需字段设置不当

**解决方案**:
1. 提高阈值
2. 调整字段权重,突出核心字段
3. 增加必需字段

### 12.3 字段映射失败

**问题**: 文档中的字段无法映射到 Schema 字段

**可能原因**:
- 字段名称差异过大
- 同义词词典不完整
- LLM 映射失败

**解决方案**:
1. 扩充同义词词典
2. 增加 LLM 映射频率
3. 调整字段名称使其更通用

### 12.4 关系缺失

**问题**: 实体间缺少预期的关系

**可能原因**:
- 关系定义不完整
- 目标字段未匹配
- 关系方向错误

**解决方案**:
1. 检查关系定义
2. 确认目标字段已正确映射
3. 验证关系方向设置

## 13. 参考资源

### 13.1 相关文档

- [README.md](./README.md) - KG 模块概述
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 系统架构设计
- [CONFIG.md](./CONFIG.md) - 配置说明
- [API.md](./API.md) - API 参考文档

### 13.2 示例文件

- `kg/schema/example_schemas.js` - Schema 示例代码
- `SchemaList.md` - 250+ 预定义 Schema
- `kg/schema/init_schemas.js` - Schema 初始化脚本

### 13.3 相关模块

- `kg/schema/schema_manager.js` - Schema 管理
- `kg/schema/schema_matcher.js` - Schema 匹配
- `kg/schema/schema_loader.js` - Schema 加载

---

**文档版本**: v1.0.0  
**最后更新**: 2025-02-01  
**维护者**: Schema-Driven KG Team

