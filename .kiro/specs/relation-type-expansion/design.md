# Design Document: 关系类型扩充

## Overview

本设计文档描述了知识图谱系统关系类型扩充的技术方案。当前系统已有基础关系类型（如"发生于"、"发生时间"、"影响指标"等），但无法充分表达生活、工作、旅行、购物、政务、管理等多个领域的复杂关系。

本设计将：
1. 定义6个领域（生活、工作、旅行、购物、政务、管理）共50+种关系类型
2. 建立关系类型的元数据模型和分类体系
3. 实现关系类型的注册、验证和查询机制
4. 确保与现有系统的无缝集成
5. 提供扩展性支持，便于未来添加新关系类型

## Architecture

### 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Relation API │  │ Query API    │  │ Validation   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Relation Type Manager                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Type Registry│  │ Type Loader  │  │ Type Validator│     │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Type Defs    │  │ Schema Mgr   │  │ Relation Store│     │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 核心组件

1. **RelationTypeRegistry**: 关系类型注册表，管理所有关系类型定义
2. **RelationTypeLoader**: 关系类型加载器，从配置文件加载关系类型
3. **RelationTypeValidator**: 关系类型验证器，验证关系实例是否符合类型约束
4. **RelationTypeQuery**: 关系类型查询器，支持按领域、实体类型等条件查询

## Components and Interfaces

### 1. RelationTypeDefinition (关系类型定义)

关系类型的核心数据结构：

```javascript
{
  relationTypeId: string,        // 唯一标识符，如 "family_parent"
  name: string,                  // 英文名称，如 "parent"
  displayName: string,           // 中文显示名称，如 "父母"
  description: string,           // 语义描述
  domain: string,                // 所属领域：life/work/travel/shopping/government/management
  category: string,              // 二级分类，如 "family"/"employment"
  
  // 实体类型约束
  sourceEntityTypes: string[],   // 允许的源实体类型
  targetEntityTypes: string[],   // 允许的目标实体类型
  
  // 关系属性
  isDirectional: boolean,        // 是否有方向性
  isTemporal: boolean,           // 是否具有时效性
  supportsConfidence: boolean,   // 是否支持置信度
  
  // 继承和扩展
  parentType: string | null,     // 父类型ID（用于继承）
  metadata: object,              // 扩展元数据
  
  // 版本和状态
  version: string,               // 版本号
  active: boolean,               // 是否激活
  createdAt: Date,
  updatedAt: Date
}
```

### 2. RelationTypeRegistry (关系类型注册表)

```javascript
class RelationTypeRegistry {
  constructor() {
    this.types = new Map();           // relationTypeId -> RelationTypeDefinition
    this.domainIndex = new Map();     // domain -> Set<relationTypeId>
    this.categoryIndex = new Map();   // category -> Set<relationTypeId>
    this.entityTypeIndex = new Map(); // entityType -> Set<relationTypeId>
  }
  
  // 注册关系类型
  register(relationType: RelationTypeDefinition): void
  
  // 批量注册
  registerBatch(relationTypes: RelationTypeDefinition[]): void
  
  // 获取关系类型
  get(relationTypeId: string): RelationTypeDefinition | null
  
  // 按领域查询
  getByDomain(domain: string): RelationTypeDefinition[]
  
  // 按分类查询
  getByCategory(category: string): RelationTypeDefinition[]
  
  // 按实体类型查询（返回适用于该实体类型的所有关系类型）
  getByEntityType(entityType: string, role: 'source' | 'target' | 'both'): RelationTypeDefinition[]
  
  // 检查关系类型是否存在
  has(relationTypeId: string): boolean
  
  // 获取所有关系类型
  getAll(): RelationTypeDefinition[]
  
  // 获取统计信息
  getStats(): { total: number, byDomain: object, byCategory: object }
}
```

### 3. RelationTypeLoader (关系类型加载器)

```javascript
class RelationTypeLoader {
  // 从JSON文件加载关系类型定义
  loadFromFile(filePath: string): RelationTypeDefinition[]
  
  // 从对象数组加载
  loadFromArray(definitions: object[]): RelationTypeDefinition[]
  
  // 验证并规范化关系类型定义
  normalize(definition: object): RelationTypeDefinition
  
  // 解析继承关系
  resolveInheritance(definitions: RelationTypeDefinition[]): RelationTypeDefinition[]
}
```

### 4. RelationTypeValidator (关系类型验证器)

```javascript
class RelationTypeValidator {
  constructor(registry: RelationTypeRegistry)
  
  // 验证关系实例是否符合关系类型约束
  validate(relation: object, relationType: RelationTypeDefinition): ValidationResult
  
  // 验证源实体类型
  validateSourceEntity(entityType: string, relationType: RelationTypeDefinition): boolean
  
  // 验证目标实体类型
  validateTargetEntity(entityType: string, relationType: RelationTypeDefinition): boolean
  
  // 验证置信度
  validateConfidence(confidence: number, relationType: RelationTypeDefinition): boolean
  
  // 验证时间戳
  validateTimestamp(timestamp: Date, relationType: RelationTypeDefinition): boolean
  
  // 验证方向性
  validateDirection(sourceId: string, targetId: string, relationType: RelationTypeDefinition): boolean
}

// 验证结果
interface ValidationResult {
  valid: boolean,
  errors: string[],
  warnings: string[]
}
```

### 5. RelationTypeQuery (关系类型查询器)

```javascript
class RelationTypeQuery {
  constructor(registry: RelationTypeRegistry)
  
  // 查询关系类型
  query(filters: QueryFilters): RelationTypeDefinition[]
  
  // 搜索关系类型（按名称或描述）
  search(keyword: string): RelationTypeDefinition[]
  
  // 获取关系类型的层次结构
  getHierarchy(relationTypeId: string): HierarchyNode
  
  // 获取兼容的关系类型（给定源和目标实体类型）
  getCompatibleTypes(sourceEntityType: string, targetEntityType: string): RelationTypeDefinition[]
}

interface QueryFilters {
  domain?: string,
  category?: string,
  entityType?: string,
  isDirectional?: boolean,
  isTemporal?: boolean,
  active?: boolean
}
```

## Data Models

### 关系类型定义文件结构

关系类型定义存储在 `kg/relation/relation_types.json` 文件中：

```json
{
  "version": "1.0.0",
  "domains": {
    "life": {
      "displayName": "生活领域",
      "categories": {
        "family": {
          "displayName": "家庭关系",
          "types": [...]
        },
        "social": {
          "displayName": "社交关系",
          "types": [...]
        }
      }
    },
    "work": {...},
    "travel": {...},
    "shopping": {...},
    "government": {...},
    "management": {...}
  }
}
```

### 具体关系类型定义

#### 生活领域 (Life Domain)

**家庭关系 (Family Relations)**
1. `family_parent` - 父母：PersonEntity -> PersonEntity
2. `family_child` - 子女：PersonEntity -> PersonEntity
3. `family_spouse` - 配偶：PersonEntity <-> PersonEntity (双向)
4. `family_sibling` - 兄弟姐妹：PersonEntity <-> PersonEntity (双向)
5. `family_grandparent` - 祖父母/外祖父母：PersonEntity -> PersonEntity
6. `family_grandchild` - 孙子女/外孙子女：PersonEntity -> PersonEntity

**社交关系 (Social Relations)**
7. `social_friend` - 朋友：PersonEntity <-> PersonEntity (双向)
8. `social_classmate` - 同学：PersonEntity <-> PersonEntity (双向)
9. `social_neighbor` - 邻居：PersonEntity <-> PersonEntity (双向)
10. `social_colleague` - 同事：PersonEntity <-> PersonEntity (双向)

**居住关系 (Residence Relations)**
11. `residence_live_in` - 居住于：PersonEntity -> LocationEntity
12. `residence_own` - 拥有：PersonEntity -> LocationEntity
13. `residence_rent` - 租赁：PersonEntity -> LocationEntity

**健康关系 (Health Relations)**
14. `health_visit` - 就诊于：PersonEntity -> OrganizationEntity
15. `health_diagnose` - 患有：PersonEntity -> IndicatorEntity
16. `health_treat` - 治疗：PersonEntity -> IndicatorEntity
17. `health_prevent` - 预防：PersonEntity -> IndicatorEntity

#### 工作领域 (Work Domain)

**雇佣关系 (Employment Relations)**
18. `work_employ` - 雇佣：OrganizationEntity -> PersonEntity
19. `work_position` - 任职：PersonEntity -> OrganizationEntity
20. `work_part_time` - 兼职：PersonEntity -> OrganizationEntity
21. `work_resign` - 离职：PersonEntity -> OrganizationEntity (时效性)

**协作关系 (Collaboration Relations)**
22. `work_cooperate` - 合作：PersonEntity <-> PersonEntity (双向)
23. `work_assist` - 协助：PersonEntity -> PersonEntity
24. `work_mentor` - 指导：PersonEntity -> PersonEntity
25. `work_consult` - 咨询：PersonEntity -> PersonEntity

**汇报关系 (Reporting Relations)**
26. `work_report_direct` - 直接汇报：PersonEntity -> PersonEntity
27. `work_report_indirect` - 间接汇报：PersonEntity -> PersonEntity
28. `work_report_matrix` - 矩阵汇报：PersonEntity -> PersonEntity

**项目关系 (Project Relations)**
29. `work_participate` - 参与：PersonEntity -> ProjectEntity
30. `work_lead` - 负责：PersonEntity -> ProjectEntity
31. `work_approve` - 审批：PersonEntity -> ProjectEntity
32. `work_accept` - 验收：PersonEntity -> ProjectEntity

#### 旅行领域 (Travel Domain)

**出行关系 (Transportation Relations)**
33. `travel_take` - 乘坐：PersonEntity -> EquipmentEntity
34. `travel_drive` - 驾驶：PersonEntity -> EquipmentEntity
35. `travel_transfer` - 转乘：LocationEntity -> LocationEntity
36. `travel_arrive` - 到达：PersonEntity -> LocationEntity

**住宿关系 (Accommodation Relations)**
37. `travel_checkin` - 入住：PersonEntity -> LocationEntity
38. `travel_book` - 预订：PersonEntity -> LocationEntity
39. `travel_recommend_hotel` - 推荐住宿：PersonEntity -> LocationEntity

**景点关系 (Attraction Relations)**
40. `travel_visit` - 游览：PersonEntity -> LocationEntity
41. `travel_checkin_spot` - 打卡：PersonEntity -> LocationEntity
42. `travel_rate` - 评价：PersonEntity -> LocationEntity

**路线关系 (Route Relations)**
43. `travel_pass_through` - 途经：LocationEntity -> LocationEntity
44. `travel_connect` - 连接：LocationEntity -> LocationEntity
45. `travel_recommend_route` - 推荐路线：PersonEntity -> LocationEntity

#### 购物领域 (Shopping Domain)

**购买关系 (Purchase Relations)**
46. `shopping_buy` - 购买：PersonEntity -> ProductEntity
47. `shopping_add_cart` - 加购：PersonEntity -> ProductEntity
48. `shopping_favorite` - 收藏：PersonEntity -> ProductEntity
49. `shopping_browse` - 浏览：PersonEntity -> ProductEntity

**支付关系 (Payment Relations)**
50. `shopping_pay` - 支付：PersonEntity -> ProductEntity
51. `shopping_refund` - 退款：PersonEntity -> ProductEntity
52. `shopping_discount` - 优惠：ProductEntity -> PersonEntity

**配送关系 (Delivery Relations)**
53. `shopping_deliver` - 配送：OrganizationEntity -> PersonEntity
54. `shopping_receive` - 签收：PersonEntity -> ProductEntity
55. `shopping_return` - 退货：PersonEntity -> ProductEntity

**评价关系 (Review Relations)**
56. `shopping_review` - 评价：PersonEntity -> ProductEntity
57. `shopping_like` - 点赞：PersonEntity -> ProductEntity
58. `shopping_complain` - 投诉：PersonEntity -> ProductEntity

#### 政务领域 (Government Domain)

**审批关系 (Approval Relations)**
59. `gov_apply` - 申请：PersonEntity -> OrganizationEntity
60. `gov_review` - 审批：PersonEntity -> DocumentEntity
61. `gov_approve` - 批准：PersonEntity -> DocumentEntity
62. `gov_reject` - 驳回：PersonEntity -> DocumentEntity

**监管关系 (Supervision Relations)**
63. `gov_supervise` - 监管：OrganizationEntity -> OrganizationEntity
64. `gov_inspect` - 检查：OrganizationEntity -> OrganizationEntity
65. `gov_penalize` - 处罚：OrganizationEntity -> OrganizationEntity
66. `gov_rectify` - 整改：OrganizationEntity -> OrganizationEntity

**服务关系 (Service Relations)**
67. `gov_handle` - 办理：OrganizationEntity -> PersonEntity
68. `gov_consult` - 咨询：PersonEntity -> OrganizationEntity
69. `gov_complain` - 投诉：PersonEntity -> OrganizationEntity
70. `gov_feedback` - 反馈：PersonEntity -> OrganizationEntity

**政策关系 (Policy Relations)**
71. `gov_formulate` - 制定：OrganizationEntity -> DocumentEntity
72. `gov_publish` - 发布：OrganizationEntity -> DocumentEntity
73. `gov_execute` - 执行：OrganizationEntity -> DocumentEntity
74. `gov_abolish` - 废止：OrganizationEntity -> DocumentEntity

#### 管理领域 (Management Domain)

**决策关系 (Decision Relations)**
75. `mgmt_decide` - 决策：PersonEntity -> ProjectEntity
76. `mgmt_suggest` - 建议：PersonEntity -> ProjectEntity
77. `mgmt_approve_decision` - 批准决策：PersonEntity -> ProjectEntity
78. `mgmt_veto` - 否决：PersonEntity -> ProjectEntity

**执行关系 (Execution Relations)**
79. `mgmt_execute` - 执行：PersonEntity -> ProjectEntity
80. `mgmt_complete` - 完成：PersonEntity -> ProjectEntity
81. `mgmt_delay` - 延期：PersonEntity -> ProjectEntity
82. `mgmt_cancel` - 取消：PersonEntity -> ProjectEntity

**监督关系 (Monitoring Relations)**
83. `mgmt_monitor` - 监督：PersonEntity -> ProjectEntity
84. `mgmt_check` - 检查：PersonEntity -> ProjectEntity
85. `mgmt_report` - 报告：PersonEntity -> ProjectEntity
86. `mgmt_improve` - 改进：PersonEntity -> ProjectEntity

**资源分配关系 (Resource Allocation Relations)**
87. `mgmt_allocate` - 分配：PersonEntity -> ResourceEntity
88. `mgmt_use` - 使用：PersonEntity -> ResourceEntity
89. `mgmt_recycle` - 回收：PersonEntity -> ResourceEntity
90. `mgmt_share` - 共享：PersonEntity -> ResourceEntity

### 数据库Schema扩展

需要在Prisma schema中添加关系类型表：

```prisma
model RelationType {
  id                String   @id @default(cuid())
  relationTypeId    String   @unique
  name              String
  displayName       String
  description       String?
  domain            String
  category          String
  sourceEntityTypes Json     // Array of entity types
  targetEntityTypes Json     // Array of entity types
  isDirectional     Boolean  @default(true)
  isTemporal        Boolean  @default(false)
  supportsConfidence Boolean @default(true)
  parentType        String?
  metadata          Json?
  version           String   @default("1.0.0")
  active            Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([domain])
  @@index([category])
  @@index([active])
}
```

### 与现有系统集成

1. **扩展 builtin_relation_builder.js**
   - 在schema的relations字段中支持新的关系类型ID
   - 验证关系类型是否在注册表中存在

2. **扩展 relation_store.js**
   - 在保存关系时验证关系类型
   - 添加按关系类型查询的方法

3. **扩展 schema_manager.js**
   - 在schema验证时检查关系类型是否有效
   - 支持关系类型的自动补全和建议

## Correctness Properties

*属性是一个特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的形式化陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### Property 1: 关系类型元数据完整性

*For any* 关系类型定义，该定义必须包含所有必需的元数据字段（relationTypeId, name, displayName, description, domain, sourceEntityTypes, targetEntityTypes, isDirectional, isTemporal, supportsConfidence）

**Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10**

### Property 2: 关系类型ID唯一性

*For any* 两个不同的关系类型定义，它们的relationTypeId必须不同

**Validates: Requirements 7.1**

### Property 3: 领域分类一致性

*For any* 关系类型定义，其domain字段必须是以下值之一：life, work, travel, shopping, government, management

**Validates: Requirements 8.1**

### Property 4: 实体类型约束验证

*For any* 关系实例和其对应的关系类型定义，如果关系实例的源实体类型不在关系类型的sourceEntityTypes列表中，则验证应该失败

**Validates: Requirements 10.1**

### Property 5: 目标实体类型约束验证

*For any* 关系实例和其对应的关系类型定义，如果关系实例的目标实体类型不在关系类型的targetEntityTypes列表中，则验证应该失败

**Validates: Requirements 10.2**

### Property 6: 置信度范围验证

*For any* 关系实例，如果其关系类型支持置信度（supportsConfidence为true），则置信度值必须在0到1之间（包含0和1）

**Validates: Requirements 10.4**

### Property 7: 查询过滤器正确性

*For any* 领域过滤器和关系类型注册表，按该领域查询返回的所有关系类型的domain字段必须等于该领域

**Validates: Requirements 8.4**

### Property 8: 实体类型过滤器正确性

*For any* 实体类型和角色（source/target），按该实体类型查询返回的所有关系类型必须在相应的实体类型列表中包含该实体类型

**Validates: Requirements 8.5**

### Property 9: 动态注册不影响现有数据

*For any* 关系类型注册表的初始状态和新注册的关系类型，注册新类型后，之前已注册的关系类型数量和内容应该保持不变

**Validates: Requirements 9.2, 9.3**

### Property 10: 继承属性传递

*For any* 具有父类型的关系类型定义，如果父类型定义了某个属性且子类型未覆盖该属性，则子类型应该继承父类型的该属性值

**Validates: Requirements 8.3**

### Property 11: 验证错误信息清晰性

*For any* 无效的关系实例，验证失败时返回的错误信息必须包含具体的失败原因（如"源实体类型不匹配"、"置信度超出范围"等）

**Validates: Requirements 10.6**

### Property 12: 配置文件加载幂等性

*For any* 关系类型定义文件，多次加载同一文件应该产生相同的关系类型注册表状态

**Validates: Requirements 11.2**

## Error Handling

### 错误类型

1. **ValidationError**: 关系类型定义或关系实例验证失败
   - 缺少必需字段
   - 字段类型不正确
   - 约束条件不满足

2. **RegistrationError**: 关系类型注册失败
   - 重复的relationTypeId
   - 无效的domain或category
   - 父类型不存在

3. **QueryError**: 查询关系类型失败
   - 无效的过滤条件
   - 关系类型不存在

4. **IntegrationError**: 与现有系统集成失败
   - Schema中引用的关系类型不存在
   - 关系实例引用的关系类型不存在

### 错误处理策略

1. **验证失败**: 返回详细的错误信息，包括失败的字段和原因
2. **注册失败**: 回滚注册操作，保持注册表一致性
3. **查询失败**: 返回空结果或默认值，记录警告日志
4. **集成失败**: 使用降级策略，允许使用通用关系类型

### 错误恢复

1. **自动修复**: 对于可修复的错误（如缺少默认值），自动补充
2. **降级处理**: 对于不影响核心功能的错误，使用降级方案
3. **人工介入**: 对于严重错误，记录详细日志并通知管理员

## Testing Strategy

### 测试方法

本系统采用双重测试策略：

1. **单元测试 (Unit Tests)**: 验证特定示例、边界情况和错误条件
   - 测试特定关系类型的定义是否正确
   - 测试边界值（如空数组、null值）
   - 测试错误处理逻辑

2. **属性测试 (Property-Based Tests)**: 验证通用属性在所有输入下都成立
   - 使用随机生成的关系类型定义
   - 使用随机生成的关系实例
   - 验证系统的通用正确性属性

两种测试方法是互补的：单元测试捕获具体的bug，属性测试验证通用的正确性。

### 属性测试配置

- 使用 **fast-check** 库进行属性测试
- 每个属性测试运行 **最少100次迭代**
- 每个测试必须引用设计文档中的属性
- 标签格式: **Feature: relation-type-expansion, Property {number}: {property_text}**

### 测试覆盖范围

1. **关系类型定义测试**
   - 验证所有领域的关系类型数量
   - 验证关系类型元数据完整性
   - 验证关系类型ID唯一性

2. **注册和查询测试**
   - 验证注册功能
   - 验证查询过滤器
   - 验证继承机制

3. **验证器测试**
   - 验证实体类型约束
   - 验证置信度范围
   - 验证错误信息

4. **集成测试**
   - 验证与schema_manager的集成
   - 验证与relation_store的集成
   - 验证向后兼容性

### 测试示例

```javascript
// 单元测试示例
describe('RelationTypeRegistry', () => {
  it('should register a relation type', () => {
    const registry = new RelationTypeRegistry();
    const relationType = {
      relationTypeId: 'family_parent',
      name: 'parent',
      displayName: '父母',
      // ... other fields
    };
    registry.register(relationType);
    expect(registry.has('family_parent')).toBe(true);
  });
});

// 属性测试示例
// Feature: relation-type-expansion, Property 1: 关系类型元数据完整性
describe('Property: Relation Type Metadata Completeness', () => {
  it('should have all required metadata fields', () => {
    fc.assert(
      fc.property(
        relationTypeArbitrary(),
        (relationType) => {
          const requiredFields = [
            'relationTypeId', 'name', 'displayName', 'description',
            'domain', 'sourceEntityTypes', 'targetEntityTypes',
            'isDirectional', 'isTemporal', 'supportsConfidence'
          ];
          return requiredFields.every(field => 
            relationType.hasOwnProperty(field)
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### 测试数据生成

使用fast-check的arbitrary生成器创建测试数据：

```javascript
// 关系类型生成器
function relationTypeArbitrary() {
  return fc.record({
    relationTypeId: fc.string({ minLength: 5, maxLength: 50 }),
    name: fc.string({ minLength: 3, maxLength: 30 }),
    displayName: fc.string({ minLength: 2, maxLength: 20 }),
    description: fc.string({ minLength: 10, maxLength: 200 }),
    domain: fc.constantFrom('life', 'work', 'travel', 'shopping', 'government', 'management'),
    category: fc.string({ minLength: 3, maxLength: 20 }),
    sourceEntityTypes: fc.array(fc.string(), { minLength: 1, maxLength: 5 }),
    targetEntityTypes: fc.array(fc.string(), { minLength: 1, maxLength: 5 }),
    isDirectional: fc.boolean(),
    isTemporal: fc.boolean(),
    supportsConfidence: fc.boolean(),
    version: fc.constant('1.0.0'),
    active: fc.boolean()
  });
}
```
