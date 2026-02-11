# Requirements Document: CKB智能分片与上下文优化

## Introduction

本文档定义CKB（Contextual Knowledge Blocks）智能分片与上下文优化系统的需求。当前系统在LLM调用时传递完整文档文本，导致巨量token消耗和高时延。本优化通过智能分片、精准上下文提取和证据定位，在保证准确性的前提下，大幅降低token消耗（目标：减少70-85%）和时延（目标：减少60-75%）。

## Glossary

- **CKB (Contextual Knowledge Block)**: 文档的结构化知识块，包含文本内容、元数据、结构信息
- **Chunk**: CKB的文本片段，通常对应段落、句子或语义单元
- **Context Window**: LLM调用时传递的上下文文本范围
- **Evidence Locator**: 证据定位器，精准定位实体/关系在CKB中的位置
- **Relevance Score**: 相关性评分，衡量文本片段与当前任务的相关程度
- **Smart Chunking**: 智能分片，基于语义和结构的文本分割策略
- **Context Optimizer**: 上下文优化器，动态选择最相关的文本片段传递给LLM

## Requirements

### Requirement 1: CKB结构化增强

**User Story:** 作为系统开发者，我希望CKB包含结构化的文本分片信息，以便精准定位和提取相关上下文。

#### Acceptance Criteria

1. WHEN CKB被创建时，THE系统SHALL将文档文本分割为语义连贯的chunks
2. EACH chunk SHALL包含：文本内容、起始位置、结束位置、chunk类型（段落/句子/标题）、语义摘要
3. THE系统SHALL为每个chunk计算语义向量（embedding），用于相似度检索
4. THE系统SHALL记录chunks之间的结构关系（前后关系、层级关系）
5. THE CKB数据模型SHALL向后兼容，不破坏现有功能

### Requirement 2: 智能上下文提取

**User Story:** 作为系统开发者，我希望在LLM调用时只传递相关的文本片段，而不是完整文档，以减少token消耗。

#### Acceptance Criteria

1. WHEN进行字段提取时，THE系统SHALL只传递包含潜在字段信息的chunks（基于关键词和语义相似度）
2. WHEN进行实体名称生成时，THE系统SHALL只传递实体相关字段所在的chunks（±1个相邻chunk作为上下文）
3. WHEN进行关系抽取时，THE系统SHALL只传递包含相关实体的chunks
4. THE上下文窗口大小SHALL动态调整，基于任务复杂度和实体分布
5. THE系统SHALL在上下文不足时自动扩展窗口，确保准确性

### Requirement 3: 精准证据定位

**User Story:** 作为系统开发者，我希望实体和关系能精准记录其在CKB中的位置，以便快速追溯和验证。

#### Acceptance Criteria

1. WHEN实体被创建时，THE系统SHALL记录其来源chunk_ids和精确文本位置（start_offset, end_offset）
2. WHEN关系被创建时，THE系统SHALL记录evidence_text所在的chunk_id和位置
3. THE系统SHALL提供API，根据entity_id或relation_id快速检索原文片段
4. THE系统SHALL支持"查看原文"功能，高亮显示实体/关系在文档中的位置
5. THE证据定位信息SHALL存储在数据库中，支持高效查询

### Requirement 4: 分片策略优化

**User Story:** 作为系统开发者，我希望分片策略能适应不同文档类型和领域，最大化准确性和效率。

#### Acceptance Criteria

1. THE系统SHALL支持多种分片策略：段落分片、句子分片、语义分片、固定长度分片
2. THE系统SHALL根据文档类型自动选择最优分片策略（结构化文档用段落分片，长文本用语义分片）
3. THE系统SHALL支持自定义分片规则（基于正则表达式或自定义函数）
4. THE分片大小SHALL可配置，默认：段落分片（100-500字符），句子分片（20-100字符）
5. THE系统SHALL避免在句子中间分片，保持语义完整性

### Requirement 5: 相关性评分与排序

**User Story:** 作为系统开发者，我希望系统能智能评估chunk的相关性，优先传递最相关的内容给LLM。

#### Acceptance Criteria

1. THE系统SHALL为每个chunk计算相关性评分，基于：关键词匹配、语义相似度、实体密度、位置权重
2. WHEN选择上下文chunks时，THE系统SHALL按相关性评分降序排序
3. THE系统SHALL支持多种相关性算法：TF-IDF、BM25、语义向量相似度、混合算法
4. THE系统SHALL动态调整相关性阈值，确保至少包含N个chunks（N可配置，默认3-5）
5. THE相关性评分SHALL缓存，避免重复计算

### Requirement 6: 批量处理优化

**User Story:** 作为系统开发者，我希望批量处理多个CKB时能共享上下文，进一步减少token消耗。

#### Acceptance Criteria

1. WHEN批量提取字段时，THE系统SHALL识别相似的chunks，合并为单次LLM调用
2. WHEN批量抽取关系时，THE系统SHALL将相关实体所在的chunks合并传递
3. THE系统SHALL支持跨CKB的上下文共享（同一文档的多个CKB）
4. THE批量大小SHALL可配置，默认：5-10个CKB或chunks
5. THE系统SHALL在批量处理失败时自动降级到单个处理

### Requirement 7: Token消耗监控与优化

**User Story:** 作为系统管理员，我希望实时监控token消耗，并根据预算动态调整策略。

#### Acceptance Criteria

1. THE系统SHALL记录每次LLM调用的token消耗：prompt tokens、completion tokens、total tokens
2. THE系统SHALL统计优化前后的token消耗对比（baseline vs optimized）
3. THE系统SHALL在token预算不足时自动切换到更激进的优化策略（更小的上下文窗口）
4. THE系统SHALL提供token消耗报告，包括：总消耗、各模块消耗、优化效果
5. THE系统SHALL支持token预算告警，超过阈值时发送通知

### Requirement 8: 准确性验证

**User Story:** 作为系统开发者，我希望优化后的系统准确性不低于优化前，确保质量不受影响。

#### Acceptance Criteria

1. THE系统SHALL在测试集上对比优化前后的准确性：字段提取F1、实体识别F1、关系抽取F1
2. THE准确性下降SHALL不超过2%（可接受范围）
3. WHEN准确性下降超过阈值时，THE系统SHALL自动扩展上下文窗口
4. THE系统SHALL提供A/B测试功能，对比不同优化策略的效果
5. THE系统SHALL记录准确性指标到监控系统

### Requirement 9: 时延优化

**User Story:** 作为系统用户，我希望文档处理速度更快，减少等待时间。

#### Acceptance Criteria

1. THE系统SHALL减少LLM调用次数，通过批量处理和上下文共享
2. THE系统SHALL减少每次LLM调用的时延，通过减少prompt长度
3. THE系统SHALL支持并行处理多个chunks（在不同CKB或不同任务中）
4. THE端到端处理时延SHALL减少60-75%（目标）
5. THE系统SHALL提供时延监控和分析报告

### Requirement 10: 向后兼容性

**User Story:** 作为系统集成者，我希望优化后的系统与现有代码兼容，无需大规模重构。

#### Acceptance Criteria

1. THE CKB数据模型SHALL向后兼容，现有代码可继续使用`ckb.content.text`
2. THE系统SHALL提供配置开关，可启用/禁用智能分片功能
3. THE系统SHALL提供迁移工具，将现有CKB数据升级为新格式
4. THE API接口SHALL保持兼容，新增可选参数而不是修改现有参数
5. THE系统SHALL提供降级方案，在分片失败时回退到全文传递

## Performance Targets

### Token消耗优化目标

| 场景 | 优化前 | 优化后 | 减少比例 |
|------|--------|--------|----------|
| 字段提取（单CKB） | 2000-4000 tokens | 300-600 tokens | 70-85% |
| 实体名称生成 | 500-1000 tokens | 100-200 tokens | 75-80% |
| 关系抽取（单CKB） | 1500-3000 tokens | 300-600 tokens | 75-80% |
| 批量处理（10个CKB） | 20000-40000 tokens | 3000-6000 tokens | 80-85% |

### 时延优化目标

| 场景 | 优化前 | 优化后 | 减少比例 |
|------|--------|--------|----------|
| 单文档处理 | 10-15秒 | 3-5秒 | 60-70% |
| 批量处理（10文档） | 100-150秒 | 30-50秒 | 65-75% |

### 准确性保证

| 指标 | 优化前 | 优化后（最低要求） |
|------|--------|-------------------|
| 字段提取F1 | 0.85 | 0.83 (≥98%) |
| 实体识别F1 | 0.80 | 0.78 (≥98%) |
| 关系抽取F1 | 0.75 | 0.73 (≥98%) |

## Non-Functional Requirements

### Scalability
- 系统应支持处理10万+文档的CKB库
- 分片索引查询响应时间 < 100ms
- 支持水平扩展（分布式部署）

### Reliability
- 分片失败率 < 1%
- 自动降级成功率 > 99%
- 数据一致性保证（ACID）

### Maintainability
- 代码覆盖率 > 85%
- 文档完整性 > 90%
- 配置化程度 > 80%（避免硬编码）

