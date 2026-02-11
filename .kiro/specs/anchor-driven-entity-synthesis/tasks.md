# Implementation Tasks: Anchor-Driven Entity Synthesis

## Overview
实现基于锚点指纹的实体合成机制，确保知识图谱是"schema在同一语义锚点上的持续重叠"。

## Phase 1: 核心模块开发 (3天)

### 1. Schema Instance Manager
- [x] 1.1 创建SchemaInstance类定义 (`kg/schema/schema_instance.js`)
- [x] 1.2 实现createSchemaInstance函数
- [x] 1.3 实现validateSchemaInstance函数
- [x] 1.4 编写单元测试 (`kg/schema/schema_instance.test.js`)

### 2. Anchor Generator
- [x] 2.1 创建AnchorGenerator模块 (`kg/entity/anchor_generator.js`)
- [x] 2.2 实现generateAnchorFingerprint核心函数
- [x] 2.3 实现字段标准化策略 (`kg/entity/field_normalizers.js`)
  - [x] 2.3.1 time_month标准化
  - [x] 2.3.2 time_year标准化
  - [x] 2.3.3 time_day标准化
  - [x] 2.3.4 location标准化
  - [x] 2.3.5 indicator标准化
  - [x] 2.3.6 lowercase标准化
- [x] 2.4 实现inferAnchorFields函数（自动推断）
- [x] 2.5 实现锚点指纹缓存机制
- [x] 2.6 编写单元测试 (`kg/entity/anchor_generator.test.js`)
- [x] 2.7 编写属性测试 (`kg/entity/anchor_generator.property.test.js`)
  - [x] 2.7.1 Property: 确定性（相同输入→相同输出）
  - [x] 2.7.2 Property: 单射性（不同输入→不同输出）

### 3. Anchor Merger
- [x] 3.1 创建AnchorMerger模块 (`kg/entity/anchor_merger.js`)
- [x] 3.2 实现mergeInstancesByAnchor函数
- [x] 3.3 实现mergeGroupToEntity函数
- [x] 3.4 实现mergeFields字段合并策略
- [x] 3.5 实现calculateMergedConfidence置信度计算
- [x] 3.6 实现generateEntityId函数（基于锚点hash）
- [x] 3.7 实现generateCanonicalName函数
- [x] 3.8 实现extractAnchorFields函数
- [x] 3.9 编写单元测试 (`kg/entity/anchor_merger.test.js`)
- [x] 3.10 编写属性测试 (`kg/entity/anchor_merger.property.test.js`)
  - [x] 3.10.1 Property: 幂等性（多次合并结果一致）
  - [x] 3.10.2 Property: 结合律（合并顺序不影响结果）

## Phase 2: Schema配置扩展 (2天)

### 4. Schema模型更新
- [x] 4.1 更新Schema定义结构（添加anchor_fields）
- [x] 4.2 更新Schema定义结构（添加anchor_config）
- [x] 4.3 创建Schema验证工具 (`kg/schema/schema_validator.js`)
- [x] 4.4 实现anchor_fields配置验证
- [x] 4.5 编写Schema配置示例文档

### 5. Schema配置迁移
- [x] 5.1 分析现有250个Schema的字段特征
- [x] 5.2 为EventEntity类型Schema配置anchor_fields (约80个)
- [x] 5.3 为LocationEntity类型Schema配置anchor_fields (约50个)
- [x] 5.4 为TravelEntity类型Schema配置anchor_fields (约40个)
- [x] 5.5 为PhotographyEntity类型Schema配置anchor_fields (约30个)
- [x] 5.6 为其他Entity类型Schema配置anchor_fields (约50个)
- [x] 5.7 验证所有Schema配置的正确性
- [x] 5.8 创建Schema配置文档和示例

## Phase 3: Pipeline集成 (2天)

### 6. Universal Document Pipeline修改
- [x] 6.1 修改_buildEntities函数以支持锚点机制
- [x] 6.2 实现Schema实例生成步骤
- [x] 6.3 实现锚点指纹生成步骤
- [x] 6.4 实现锚点合并步骤
- [x] 6.5 集成冲突检测步骤
- [x] 6.6 更新Pipeline日志和监控

### 7. 兼容模式实现
- [x] 7.1 定义兼容模式枚举（ANCHOR_ONLY/HYBRID/LEGACY）
- [x] 7.2 实现buildEntitiesCompatible函数
- [x] 7.3 实现buildEntitiesWithAnchor函数（新模式）
- [x] 7.4 保留buildEntitiesLegacy函数（旧模式）
- [x] 7.5 添加配置开关支持
- [x] 7.6 编写兼容模式切换文档

### 8. Pipeline集成测试
- [x] 8.1 编写端到端测试 (`kg/pipeline/anchor_integration.test.js`)
- [x] 8.2 测试单schema场景
- [x] 8.3 测试多schema重叠场景
- [x] 8.4 测试锚点冲突场景
- [x] 8.5 测试兼容模式切换
- [x] 8.6 性能基准测试

## Phase 4: 冲突检测和LLM建议 (2天)

### 9. Anchor Conflict Detector
- [x] 9.1 创建AnchorConflictDetector模块 (`kg/entity/anchor_conflict_detector.js`)
- [x] 9.2 实现detectAnchorConflict函数
- [x] 9.3 实现checkTimeConsistency时间一致性检查
- [x] 9.4 实现checkValueConflicts数值冲突检查
- [x] 9.5 实现checkStateContradictions状态矛盾检查
- [x] 9.6 实现calculateConflictSeverity严重性评估
- [x] 9.7 编写单元测试 (`kg/entity/anchor_conflict_detector.test.js`)

### 10. LLM Conflict Advisor
- [x] 10.1 创建LLMConflictAdvisor模块 (`kg/entity/llm_conflict_advisor.js`)
- [x] 10.2 实现adviseMergeConflict函数
- [x] 10.3 实现buildConflictAdvisoryPrompt函数
- [x] 10.4 设计和优化LLM Prompt
- [x] 10.5 实现LLM响应解析和验证
- [x] 10.6 添加LLM调用日志和监控
- [x] 10.7 编写单元测试 (`kg/entity/llm_conflict_advisor.test.js`)
- [x] 10.8 编写集成测试（真实LLM调用）

### 11. LLM边界验证
- [x] 11.1 验证LLM不参与锚点指纹生成
- [x] 11.2 验证LLM不参与实体存在裁决
- [x] 11.3 验证LLM只提供建议而非决策
- [x] 11.4 验证所有LLM输出包含reasoning和confidence
- [x] 11.5 编写LLM边界测试 (`kg/entity/llm_boundary.test.js`)

## Phase 5: 数据库和迁移 (1天)

### 12. Prisma Schema更新
- [x] 12.1 更新KGEntity模型（添加anchorFingerprint字段）
- [x] 12.2 更新KGEntity模型（添加anchorFields字段）
- [x] 12.3 更新schemas字段结构（支持多schema信息）
- [x] 12.4 创建anchorFingerprint索引
- [x] 12.5 创建type+anchorFingerprint复合索引
- [x] 12.6 生成Prisma迁移文件

### 13. 数据迁移
- [x] 13.1 创建迁移脚本 (`prisma/migrations/add_anchor_fields.js`)
- [x] 13.2 实现inferAnchorFromEntity函数（从现有数据推断）
- [x] 13.3 实现extractAnchorFieldsFromEntity函数
- [x] 13.4 批量迁移现有实体数据
- [x] 13.5 验证迁移数据完整性
- [x] 13.6 创建回滚脚本
- [x] 13.7 编写迁移文档

## Phase 6: 测试和文档 (2天)

### 14. 综合测试
- [x] 14.1 编写E2E测试 (`kg/entity/anchor_e2e.test.js`)
- [x] 14.2 测试完整文档处理流程
- [x] 14.3 测试多文档实体链接
- [x] 14.4 测试大规模数据处理（1000+ instances）
- [x] 14.5 性能测试和优化
  - [x] 14.5.1 锚点生成性能 (目标: <10ms per instance)
  - [x] 14.5.2 合并处理性能 (目标: <100ms for 1000 instances)
  - [x] 14.5.3 整体Pipeline性能 (目标: 下降<5%)
- [x] 14.6 编写性能测试报告

### 15. 属性测试覆盖
- [x] 15.1 Property: 锚点唯一性（相同语义→相同锚点）
- [x] 15.2 Property: 合并幂等性（多次合并→相同结果）
- [x] 15.3 Property: 合并结合律（合并顺序无关）
- [x] 15.4 Property: 字段标准化确定性
- [x] 15.5 Property: 实体ID确定性

### 16. 文档编写
- [x] 16.1 编写架构设计文档 (`kg/entity/ANCHOR_ARCHITECTURE.md`)
- [x] 16.2 编写开发者指南 (`kg/entity/ANCHOR_DEVELOPER_GUIDE.md`)
- [x] 16.3 编写Schema配置指南 (`kg/schema/ANCHOR_FIELDS_GUIDE.md`)
- [x] 16.4 编写迁移指南 (`kg/entity/MIGRATION_GUIDE.md`)
- [x] 16.5 编写故障排查指南 (`kg/entity/TROUBLESHOOTING.md`)
- [x] 16.6 更新API文档
- [x] 16.7 创建示例代码和教程

## Phase 7: 部署和监控 (1天)

### 17. 部署准备
- [x] 17.1 创建部署检查清单
- [x] 17.2 准备配置文件（开发/测试/生产环境）
- [x] 17.3 准备数据库迁移脚本
- [x] 17.4 准备回滚方案
- [x] 17.5 编写部署文档

### 18. 监控和日志
- [x] 18.1 添加锚点生成监控指标
- [x] 18.2 添加合并性能监控指标
- [x] 18.3 添加冲突检测监控指标
- [x] 18.4 添加LLM调用监控指标
- [x] 18.5 配置告警规则
- [x] 18.6 创建监控仪表板

### 19. 部署和验证
- [x] 19.1 在测试环境部署
- [x] 19.2 运行完整测试套件
- [x] 19.3 验证性能指标
- [x] 19.4 验证数据正确性
- [x] 19.5 在生产环境部署（灰度发布）
- [x] 19.6 监控生产环境指标
- [x] 19.7 收集用户反馈

## 可选任务

### 20. 性能优化（可选）
- [x] 20.1 实现并行锚点生成
- [x] 20.2 实现并行实体合并
- [x]* 20.3 优化字段标准化算法
- [x]* 20.4 实现锚点指纹索引优化
- [x]* 20.5 实现批量处理优化

### 21. 高级功能（可选）
- [x]* 21.1 实现锚点指纹语义向量化
- [x]* 21.2 实现跨文档实体链接
- [x]* 21.3 实现实体演化追踪
- [x]* 21.4 实现分布式锚点合并
- [x]* 21.5 实现实体版本管理

## 验收标准

### 功能完整性
- ✅ 所有Schema实例生成锚点指纹
- ✅ 相同锚点的实例正确合并
- ✅ 冲突检测正常工作
- ✅ LLM建议准确率 > 85%

### 性能指标
- ✅ 锚点生成 < 10ms per instance
- ✅ 合并处理 < 100ms for 1000 instances
- ✅ 整体管线性能下降 < 5%

### 质量指标
- ✅ 单元测试覆盖率 > 90%
- ✅ 集成测试通过率 100%
- ✅ 属性测试无失败

### 业务指标
- ✅ 实体合并准确率 > 95%
- ✅ 错误合并率 < 2%
- ✅ Token消耗减少 > 30%

## 时间估算

- Phase 1: 核心模块开发 - 3天
- Phase 2: Schema配置扩展 - 2天
- Phase 3: Pipeline集成 - 2天
- Phase 4: 冲突检测和LLM建议 - 2天
- Phase 5: 数据库和迁移 - 1天
- Phase 6: 测试和文档 - 2天
- Phase 7: 部署和监控 - 1天

**总计**: 约13个工作日（包含测试和文档）

## 依赖关系

- Phase 1 → Phase 3 (核心模块必须先完成)
- Phase 2 → Phase 3 (Schema配置必须先完成)
- Phase 3 → Phase 4 (Pipeline集成后才能测试冲突检测)
- Phase 1-4 → Phase 5 (所有功能完成后才能迁移数据)
- Phase 1-5 → Phase 6 (所有功能完成后才能综合测试)
- Phase 1-6 → Phase 7 (测试通过后才能部署)

## 风险和缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 锚点配置错误导致过度合并 | 高 | 提供配置验证工具、详细文档、示例 |
| 现有数据迁移复杂 | 中 | 提供迁移脚本、支持双模式运行 |
| 性能下降 | 中 | 性能测试、优化算法、缓存机制 |
| LLM边界不清晰 | 高 | 明确文档、代码注释、审查机制 |
| 250个Schema配置工作量大 | 中 | 自动推断工具、批量配置脚本 |

## 注意事项

1. **确定性原则**: 锚点指纹生成必须是确定性的（相同输入→相同输出）
2. **幂等性原则**: 合并逻辑必须是幂等的（多次执行结果一致）
3. **LLM边界**: LLM永远只"建议"不"决策"
4. **向后兼容**: 支持渐进式迁移，可配置开关
5. **性能要求**: 不能显著增加整体处理时间
6. **测试优先**: 每个模块开发完成后立即编写测试
7. **文档同步**: 代码和文档同步更新
