# 未完成任务完成计划

生成时间: 2026-02-09

## 概述

本计划详细列出了除 frontend-backend-integration 之外所有需要完成的任务，按优先级和依赖关系组织。

---

## 执行策略

### 原则
1. **优先完成核心功能的测试** - 确保已实现功能的质量
2. **按spec分组执行** - 每个spec独立完成，避免上下文切换
3. **先易后难** - 从单元测试开始，再到属性测试，最后是集成测试
4. **持续验证** - 每完成一个spec的任务后运行测试验证

### 执行顺序
1. document-full-processing (测试任务)
2. ckb-intelligent-chunking (可选高级功能)
3. semantic-field-extraction (测试任务)
4. llm-enhanced-entity-extraction (属性测试 + 英文文档测试)
5. human-readable-knowledge-graph (LLM推理 + 性能优化)

---

## 第一阶段: document-full-processing 测试补充

**目标**: 补充所有可选的单元测试和属性测试

### Phase 2: 文档结构分析模块测试

#### Task 3.7: 编写 Structure Analyzer 单元测试
```bash
# 文件: kg/document_processor/structure_analyzer.test.js
```
- 测试 Word 文档解析
- 测试 PDF 文档解析
- 测试 Excel 文档解析
- 测试 Markdown 文档解析
- 测试嵌套结构识别

#### Task 3.8: 编写 Property 1 测试
```bash
# 文件: kg/document_processor/structure_analyzer.property.test.js
```
- **Property 1: 文档结构单元完整识别**
- 使用 fast-check 生成随机文档
- 验证所有结构单元都被识别

### Phase 3: 内容过滤模块测试

#### Task 4.6: 编写 Content Filter 单元测试
```bash
# 文件: kg/document_processor/content_filter.test.js (补充)
```
- 测试页眉页脚过滤
- 测试短内容标记
- 测试纯标点符号过滤
- 测试重复内容检测
- 测试自定义规则

#### Task 4.7: 编写 Property 5-8 测试
```bash
# 文件: kg/document_processor/content_filter.property.test.js (补充)
```
- **Property 5: 内容过滤规则应用**
- **Property 6: 短内容标记**
- **Property 7: 低质量内容标记**
- **Property 8: 重复内容识别**

### Phase 4-8: 其他模块测试

按照相同模式补充：
- Completeness Validator 测试 (Task 5.6, 5.7)
- Validation Reporter 测试 (Task 6.7, 6.8)
- Pipeline Monitor 测试 (Task 7.8, 7.9)
- Segmented Processor 测试 (Task 8.9, 8.10)
- Alert Manager 测试 (Task 9.6)

### Phase 9-10: API 和集成测试

#### Task 10.8: 编写 API 集成测试
```bash
# 文件: kg/document_processor/api_integration.test.js
```
- 测试所有 API 端点
- 测试错误处理
- 测试响应格式

#### Task 11.5: 编写端到端测试
```bash
# 文件: kg/document_processor/e2e.test.js (补充)
```
- 测试完整的文档处理流程
- 测试分段处理流程
- 测试失败恢复流程

#### Task 11.6: 编写 Property 22-33, 37-40 测试
```bash
# 文件: kg/document_processor/e2e.property.test.js (补充)
```
- 字段抽取和 Schema 匹配相关属性
- 实体和关系相关属性
- 端到端覆盖率和可追溯性属性
- 异常处理和性能相关属性

**预计时间**: 2-3天
**验收标准**: 所有测试通过，覆盖率 ≥ 80%

---

## 第二阶段: ckb-intelligent-chunking 可选功能

**目标**: 实现可选的高级功能

### Task 6.1: 实现 Chunk 索引持久化
```bash
# 文件: kg/ckb/chunk_index_store.js
```
- 将 chunks 存储到向量数据库
- 支持快速相似度检索
- 支持增量更新

### Task 6.2: 实现智能缓存策略
```bash
# 文件: kg/ckb/intelligent_cache.js
```
- 缓存常用 chunks 的 embeddings
- 缓存相关性评分结果
- 实现 LRU 缓存淘汰

### Task 6.3: 实现多语言支持
```bash
# 文件: kg/ckb/multilingual_chunker.js
```
- 支持中英文混合文档
- 支持其他语言（日语、韩语等）
- 适配不同语言的分片策略

### Task 6.4: 实现可视化工具
```bash
# 文件: kg/ckb/visualization/
```
- 可视化 chunk 分布
- 可视化相关性评分
- 可视化 token 节省效果

**预计时间**: 3-4天
**验收标准**: 所有功能正常工作，有相应的测试

---

## 第三阶段: semantic-field-extraction 测试补充

**目标**: 补充所有可选测试任务

### 核心测试任务

#### Task 2.2-2.3: Domain Detector 测试
```bash
# 文件: kg/field_extractor/domain_detector.property.test.js
# 文件: kg/field_extractor/domain_detector.test.js (补充)
```
- Property 1: Domain Detection Accuracy
- 单元测试：空内容、旅行关键词、模糊内容、性能测试

#### Task 3.2-3.4: Strategy Selector 测试
```bash
# 文件: kg/field_extractor/strategy_selector.property.test.js
# 文件: kg/field_extractor/strategy_selector.test.js (补充)
```
- Property 2: Strategy Selection Consistency
- Property 4: Strategy Execution Completeness
- 单元测试：各种策略选择场景

#### Task 5.4-5.5: Field Extractor 增强测试
```bash
# 文件: kg/field_extractor/field_extractor.property.test.js (补充)
# 文件: kg/field_extractor/field_extractor.test.js (补充)
```
- Property 12: Backward Compatibility
- 单元测试：向后兼容性、参数验证

#### Task 6.5-6.6: Strategy Execution 测试
```bash
# 文件: kg/field_extractor/strategy_execution.property.test.js
# 文件: kg/field_extractor/strategy_execution.integration.test.js
```
- Property 3: Semantic Field Names
- 集成测试：各种策略执行场景

#### Task 7.3-7.4: LLM Extractor 测试
```bash
# 文件: kg/field_extractor/llm_extractor.property.test.js
# 文件: kg/field_extractor/llm_extractor.test.js (补充)
```
- Property 9: Semantic Prompt Selection
- 单元测试：prompt 选择逻辑

### Schema Integration 测试

#### Task 9.4-9.7: Schema 集成测试
```bash
# 文件: kg/field_extractor/schema_integration.property.test.js
# 文件: kg/field_extractor/schema_integration.test.js (补充)
```
- Property 5: Schema-Aware Prompt Construction
- Property 6: Schema Validation
- Property 7: Field Name Normalization
- 单元测试：schema 字段包含、验证、标准化

### Performance 测试

#### Task 10.4-10.7: 性能和优化测试
```bash
# 文件: kg/field_extractor/performance.property.test.js
# 文件: kg/field_extractor/performance.test.js
```
- Property 8: Token Usage Tracking
- Property 11: Cache Effectiveness
- Property 10: Batch Extraction Completeness
- 性能测试：域检测、策略选择、语义提取、token 使用

### Two-Stage Extraction 测试

#### Task 11.6-11.12: 两阶段提取测试
```bash
# 文件: kg/field_extractor/two_stage.property.test.js
# 文件: kg/field_extractor/two_stage.test.js
```
- Property 15-20: 两阶段提取相关属性
- 单元测试：算法提取、LLM 提取、schema 匹配、覆盖率计算

### End-to-End 测试

#### Task 15.1-15.5: 端到端集成测试
```bash
# 文件: kg/field_extractor/e2e_complete.test.js
```
- 真实旅行文档测试
- 多 schema 测试
- 未映射字段测试
- 批量提取测试
- 缓存行为测试

#### Task 16.1-16.2: 性能属性测试
```bash
# 文件: kg/field_extractor/performance_properties.test.js
```
- Property 13: Domain Detection Performance
- Property 14: Strategy Selection Performance

**预计时间**: 3-4天
**验收标准**: 所有测试通过，性能指标达标

---

## 第四阶段: llm-enhanced-entity-extraction 测试补充

**目标**: 补充属性测试和英文文档测试

### 属性测试补充

#### Task 8.2-8.6: LLM Extractor 属性测试
```bash
# 文件: kg/enhanced_extraction/llm_extractor.property.test.js
```
- Property 1: Semantic Entity Extraction Completeness
- Property 2: Entity Field Completeness
- Property 3: Fine-Grained Entity Independence
- Property 4: Semantic Relation Extraction
- Property 9: Batch Processing Efficiency

#### Task 9.2: Conflict Resolver 属性测试
```bash
# 文件: kg/enhanced_extraction/conflict_resolver.property.test.js
```
- Property 6: Conflict Resolution Priority

#### Task 10.2-10.3: Result Fusion 属性测试
```bash
# 文件: kg/enhanced_extraction/result_fusion.property.test.js
```
- Property 5: Algorithm Extraction Preservation
- Property 7: Extraction Source Traceability

#### Task 12.2-12.3: Quality Validator 属性测试
```bash
# 文件: kg/enhanced_extraction/quality_validator.property.test.js
```
- Property 13: Quality Metrics Reporting
- Property 17: Schema Conformance

#### Task 13.2-13.3: Error Handler 属性测试
```bash
# 文件: kg/enhanced_extraction/error_handler.property.test.js
```
- Property 14: Graceful LLM Failure Handling
- Property 15: Error Logging Completeness

#### Task 14.2-14.5: Extraction Coordinator 属性测试
```bash
# 文件: kg/enhanced_extraction/extraction_coordinator.property.test.js
```
- Property 10: Processing Time Bound
- Property 11: Metadata Completeness
- Property 12: Multilingual Support
- Property 16: Status Reporting

### 英文文档测试

#### Task 17.3: 编写英文文档测试
```bash
# 文件: kg/enhanced_extraction/english_document_validation.test.js
```
- 测试英文文档提取
- 验证实体和关系提取质量
- 对比中英文提取效果

#### Task 17.4: 编写边缘案例测试
```bash
# 文件: kg/enhanced_extraction/edge_cases.test.js
```
- 测试少于 3 个概念实体的文档
- 测试缺少必需字段的实体
- 测试低置信度关系
- 测试 token 超过阈值

### 最终验证

#### Task 19: 最终验证
```bash
# 运行完整测试套件
npm test kg/enhanced_extraction/
```
- 验证代码覆盖率（>90% 行覆盖率，>85% 分支覆盖率）
- 验证所有属性测试运行 100 次迭代
- 生成测试报告

**预计时间**: 2-3天
**验收标准**: 所有测试通过，覆盖率达标，英文文档测试成功

---

## 第五阶段: human-readable-knowledge-graph 高级功能

**目标**: 实现 LLM 推理和性能优化

### LLM Enhancement 功能

#### Task 2.6: 实现 LLM 增强
```bash
# 文件: kg/human_readable/entity_name_standardizer.js (增强)
```
- 添加 LLM 客户端集成
- 实现 prompt 构建
- 添加缓存机制

#### Task 2.7-2.8: 同义词检测和合并
```bash
# 文件: kg/human_readable/synonym_detector.js
```
- 添加语义相似度计算
- 实现实体分组逻辑
- 添加规范名称选择
- 实现属性和 CKB 合并
- Property 6: Synonym Merging 测试

#### Task 2.10: 边缘案例测试
```bash
# 文件: kg/human_readable/entity_name_standardizer.test.js (补充)
```
- 测试空上下文场景
- 测试特殊字符
- 测试超长名称
- 测试非 ASCII 字符

### Hierarchical Extraction 高级功能

#### Task 8.4: 实现 LLM 层级推理
```bash
# 文件: kg/human_readable/hierarchical_relation_extractor.js (增强)
```
- 添加 `inferHierarchicalRelations()` 方法
- 实现 prompt 构建
- 添加实体分组
- 实现验证逻辑

#### Task 8.5: LLM 推理属性测试
```bash
# 文件: kg/human_readable/hierarchical_relation_extractor.property.test.js (补充)
```
- Property 10: LLM Hierarchical Inference

#### Task 8.6: 领域知识集成
```bash
# 文件: kg/human_readable/domain_taxonomies.js
```
- 加载领域特定分类法（摄影、旅行等）
- 实现实体匹配
- 创建 is_a 关系

#### Task 8.7-8.8: 层级提取测试
```bash
# 文件: kg/human_readable/hierarchical_relation_extractor.test.js (补充)
# 文件: kg/human_readable/hierarchical_relation_extractor.property.test.js (补充)
```
- 测试各种模式类型
- 测试循环层级检测
- 测试无效实体类型组合
- Property 9: Hierarchical Relationship Type Support

### Performance Optimization

#### Task 16.1: 实现 LLM 结果缓存
```bash
# 文件: kg/human_readable/llm_result_cache.js
```
- 添加 LRU 缓存
- 实现缓存大小限制和淘汰

#### Task 16.2: 实现批量处理
```bash
# 文件: kg/human_readable/batch_processor.js
```
- 批量名称标准化
- 批量描述生成
- 批量层级推理
- 目标：5-10 项/批次

#### Task 16.3: 优化模式匹配
```bash
# 文件: kg/human_readable/pattern_matcher.js
```
- 编译 regex 模式
- 使用高效字符串匹配算法
- 实现早期终止

#### Task 16.4: 性能测试
```bash
# 文件: kg/human_readable/performance.test.js
```
- 测试处理时间增加（目标：<20%）
- 测试 LLM token 消耗（目标：<500 tokens/doc）
- 测试大文档（>10,000 字）
- 测试批量处理（100+ 文档）

**预计时间**: 4-5天
**验收标准**: 所有功能正常工作，性能指标达标

---

## 总体时间估算

| 阶段 | Spec | 预计时间 | 优先级 |
|------|------|----------|--------|
| 1 | document-full-processing | 2-3天 | 高 |
| 2 | ckb-intelligent-chunking | 3-4天 | 中 |
| 3 | semantic-field-extraction | 3-4天 | 高 |
| 4 | llm-enhanced-entity-extraction | 2-3天 | 高 |
| 5 | human-readable-knowledge-graph | 4-5天 | 中 |

**总计**: 14-19 个工作日

---

## 执行建议

### 立即开始（高优先级）
1. **document-full-processing 测试** - 确保文档处理系统质量
2. **semantic-field-extraction 测试** - 验证字段提取功能
3. **llm-enhanced-entity-extraction 测试** - 完善实体提取系统

### 近期完成（中优先级）
4. **human-readable-knowledge-graph 高级功能** - 增强知识图谱可读性
5. **ckb-intelligent-chunking 可选功能** - 优化上下文处理

### 执行方式
- **并行执行**: 可以同时进行不同 spec 的任务（如果有多个开发者）
- **串行执行**: 按优先级逐个完成（单个开发者）
- **持续集成**: 每完成一个 spec 后立即运行测试并验证

### 质量保证
- 每个阶段完成后运行完整测试套件
- 确保代码覆盖率达标
- 验证性能指标
- 更新文档

---

## 下一步行动

请确认执行计划，我将开始按照以下顺序执行：

1. **document-full-processing** - 补充所有测试
2. **semantic-field-extraction** - 补充所有测试  
3. **llm-enhanced-entity-extraction** - 补充属性测试和英文文档测试
4. **human-readable-knowledge-graph** - 实现 LLM 推理和性能优化
5. **ckb-intelligent-chunking** - 实现可选高级功能

每完成一个 spec 后会向您报告进度。
