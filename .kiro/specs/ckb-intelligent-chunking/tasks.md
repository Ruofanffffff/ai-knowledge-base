# Implementation Plan: CKB智能分片与上下文优化

## Overview

本实现计划将CKB智能分片与上下文优化分为5个阶段，每个阶段都可独立测试和部署。优先实现高价值、低风险的功能，逐步推进到高级优化。

## Tasks

- [x] 1. Phase 1: 基础设施搭建
  - [x] 1.1 实现Chunk Manager核心功能
    - 实现`chunkCKB()`方法，支持paragraph分片策略
    - 实现`getChunks()`和`getAdjacentChunks()`方法
    - 添加chunk数据模型和存储逻辑
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [x] 1.2 实现多种分片策略
    - 实现paragraph chunking（默认策略）
    - 实现sentence chunking（使用NLP库）
    - 实现fixed-length chunking（兜底策略）
    - 添加分片策略选择逻辑
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [x] 1.3 更新CKB数据模型
    - 在CKB模型中添加`chunks`字段
    - 在CKB模型中添加`structure`字段
    - 确保向后兼容（保留`content.text`）
    - 更新CKB Factory以支持分片
    - _Requirements: 1.5, 10.1, 10.2_
  
  - [x] 1.4 实现基础Relevance Scorer
    - 实现keyword-based scoring
    - 实现TF-IDF scoring
    - 实现hybrid scoring（keyword + TF-IDF）
    - 添加评分缓存机制
    - _Requirements: 5.1, 5.2, 5.3, 5.5_
  
  - [x] 1.5 编写单元测试
    - 测试各种分片策略
    - 测试相关性评分算法
    - 测试边界情况（空文本、超长文本）
    - _Requirements: 1.1, 4.1, 5.1_

- [x] 2. Phase 2: 上下文优化器实现
  - [x] 2.1 实现Context Optimizer核心功能
    - 实现`optimizeForFieldExtraction()`方法
    - 实现`optimizeForEntityNaming()`方法
    - 实现`optimizeForRelationExtraction()`方法
    - 添加动态窗口调整逻辑
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 2.2 集成到Field Extractor
    - 修改`llm_extractor.js`使用Context Optimizer
    - 添加配置开关（ENABLE_CONTEXT_OPTIMIZATION）
    - 记录token优化指标
    - 添加降级逻辑（优化失败时回退到全文）
    - _Requirements: 2.1, 10.2, 10.5_
  
  - [x] 2.3 A/B测试与验证
    - 在测试集上对比优化前后的token消耗
    - 验证准确性（字段提取F1）
    - 调整参数（maxTokens, minChunks, relevanceThreshold）
    - _Requirements: 7.1, 7.2, 8.1, 8.2_
  
  - [x] 2.4 编写集成测试
    - 测试端到端字段提取流程
    - 测试不同文档类型的优化效果
    - 测试降级逻辑
    - _Requirements: 2.1, 10.5_

- [-] 3. Phase 3: 证据定位系统
  - [x] 3.1 实现Evidence Locator
    - 实现`locateEntity()`方法
    - 实现`locateRelation()`方法
    - 实现`getEntityContext()`方法
    - 添加位置信息到Entity和Relation模型
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 3.2 集成到Entity Builder
    - 修改`entity_builder.js`使用Evidence Locator
    - 修改`enhanceNameWithLLM()`使用精准上下文
    - 记录entity的evidence信息
    - _Requirements: 2.2, 3.1_
  
  - [x] 3.3 集成到Relation Builder
    - 修改`semantic_relation_builder.js`使用Evidence Locator
    - 修改关系抽取逻辑使用精准上下文
    - 记录relation的evidence信息
    - _Requirements: 2.3, 3.2_
  
  - [x] 3.4 实现"查看原文"功能
    - 添加API端点：GET /api/entities/:id/context
    - 添加API端点：GET /api/relations/:id/context
    - 返回高亮显示的原文片段
    - _Requirements: 3.3, 3.4_
  
  - [x] 3.5 更新数据库Schema
    - 在Entity表添加evidence字段（JSON）
    - 在Relation表添加evidence字段（JSON）
    - 创建数据库迁移脚本
    - _Requirements: 3.5_
  
  - [x] 3.6 编写测试
    - 测试证据定位准确性
    - 测试"查看原文"API
    - 测试数据库存储和检索
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. Phase 4: 高级优化
  - [x] 4.1 实现语义相似度评分
    - 集成embedding模型（如sentence-transformers）
    - 实现`scoreBySemantic()`方法
    - 为chunks预计算embeddings
    - 添加向量索引（如FAISS或Qdrant）
    - _Requirements: 5.2, 5.3_
  
  - [x] 4.2 实现批量优化
    - 识别相似chunks，合并LLM调用
    - 实现跨CKB的上下文共享
    - 添加批量处理逻辑
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 4.3 实现语义分片策略
    - 基于语义相似度分割文本
    - 使用滑动窗口和相似度阈值
    - 优化长文本处理
    - _Requirements: 4.1, 4.5_
  
  - [x] 4.4 性能调优
    - 优化相关性评分性能（缓存、并行）
    - 优化chunk检索性能（索引）
    - 优化embedding计算（批量、GPU）
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [x] 4.5 编写性能测试
    - 测试大规模文档处理（1000+文档）
    - 测试并发处理性能
    - 测试内存和CPU使用
    - _Requirements: 9.4_

- [x] 5. Phase 5: 监控与部署
  - [x] 5.1 实现Token消耗监控
    - 记录每次LLM调用的token消耗
    - 统计优化前后的token对比
    - 实现token预算管理
    - 添加token告警机制
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [x] 5.2 实现准确性监控
    - 在测试集上持续评估准确性
    - 对比优化前后的F1分数
    - 实现自动降级（准确性下降超过阈值）
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [x] 5.3 实现时延监控
    - 记录端到端处理时延
    - 记录各模块时延
    - 识别性能瓶颈
    - _Requirements: 9.4, 9.5_
  
  - [x] 5.4 创建监控仪表板
    - 实时显示token节省率
    - 实时显示时延改善
    - 实时显示准确性指标
    - 实时显示系统健康状态
    - _Requirements: 7.4, 8.5, 9.5_
  
  - [x] 5.5 编写部署文档
    - 配置指南
    - 迁移指南（现有CKB数据升级）
    - 故障排查指南
    - 性能调优指南
    - _Requirements: 10.3, 10.4_
  
  - [x] 5.6 灰度发布
    - 10%流量测试（1周）
    - 50%流量测试（1周）
    - 100%流量上线
    - 监控和调整参数
    - _Requirements: 8.4_

- [ ] 6. 可选任务（Optional）
  - [ ] 6.1* 实现Chunk索引持久化
    - 将chunks存储到向量数据库
    - 支持快速相似度检索
    - 支持增量更新
    - _Requirements: 5.3_
  
  - [ ] 6.2* 实现智能缓存策略
    - 缓存常用chunks的embeddings
    - 缓存相关性评分结果
    - 实现LRU缓存淘汰
    - _Requirements: 5.5_
  
  - [ ] 6.3* 实现多语言支持
    - 支持中英文混合文档
    - 支持其他语言（日语、韩语等）
    - 适配不同语言的分片策略
    - _Requirements: 4.5_
  
  - [ ] 6.4* 实现可视化工具
    - 可视化chunk分布
    - 可视化相关性评分
    - 可视化token节省效果
    - _Requirements: 7.4_

## Notes

- 每个Phase都可独立测试和部署
- Phase 1-3是核心功能，必须完成
- Phase 4-5是高级优化，可根据需求调整优先级
- 可选任务可根据实际需求选择性实现
- 每个Phase完成后都应进行充分测试和验证

## Success Criteria

### Phase 1完成标准
- ✅ CKB可以成功分片（3种策略）
- ✅ 相关性评分算法工作正常
- ✅ 单元测试覆盖率 > 80%

### Phase 2完成标准
- ✅ Field Extractor集成成功
- ✅ Token消耗减少 > 70%
- ✅ 准确性下降 < 2%

### Phase 3完成标准
- ✅ 证据定位准确率 > 90%
- ✅ "查看原文"功能正常工作
- ✅ 数据库迁移成功

### Phase 4完成标准
- ✅ 语义相似度评分工作正常
- ✅ 批量优化减少LLM调用次数 > 50%
- ✅ 性能测试通过（1000+文档）

### Phase 5完成标准
- ✅ 监控系统正常运行
- ✅ 灰度发布成功
- ✅ 生产环境稳定运行1周+

