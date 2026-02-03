# Requirements Document

## Introduction

本文档定义了基于 Schema 驱动的知识图谱系统的需求规格。该系统是现有个人智能知识库项目的功能扩展,采用四层架构(CKB 层、Schema & Rule 层、KG 层、推理/应用层),核心目标是最小化 LLM Token 消耗(目标减少 90%),通过规则优先、LLM 兜底的策略,构建可追溯、可推理的知识图谱。

## Glossary

- **CKB (Contextual Knowledge Block)**: 最小可引用事实单元,是文档的最小结构化片段,包含源文档位置、内容、置信度等信息
- **Schema**: 实体构造规则,定义实体类型、核心字段、完整度阈值和关系模板。Schema 是预先定义的模板,不是实体本身
- **SchemaList.md**: Schema 定义文件,包含 250 个预定义的 Schema 模板,涵盖科研、政府、个人生活、娱乐、旅行、运动、摄影等多个领域
- **Entity**: 实体,在多个 CKB 中被一组 Schema 持续、稳定描述的对象。实体是从文档内容中动态生成的,不是预先定义的
- **Relation**: 关系,连接两个实体的有向边,包含类型、权重和证据
- **Field_Extractor**: 字段抽取器,从 CKB 中提取结构化字段的模块
- **Schema_Matcher**: Schema 匹配器,计算 CKB 字段与 Schema 定义的完整度评分
- **Entity_Builder**: 实体构建器,当 Schema 完整度达到阈值时实例化实体
- **Relation_Builder**: 关系构建器,生成实体间的关系
- **Confidence_Engine**: 置信度引擎,计算和管理实体、关系的置信度
- **KG_Store**: 知识图谱存储,持久化实体和关系数据
- **Completeness_Score**: 完整度评分,衡量 CKB 字段匹配 Schema 定义的程度
- **Source_Confidence**: 源置信度,CKB 来源的可信度(OCR/ASR 等会降低置信度)
- **Canonical_Name**: 规范名称,实体的标准化名称
- **Co_occurrence_Relation**: 共现关系,基于统计的实体关系类型
- **Semantic_Relation**: 语义关系,基于 LLM 理解的实体关系类型
- **Built_in_Relation**: 内建关系,Schema 定义中预设的关系类型

## Requirements

### Requirement 1: CKB 层实现

**User Story:** 作为系统开发者,我需要实现 CKB 层,以便将文档解析为最小可引用事实单元,为后续的知识图谱构建提供基础数据。

#### Acceptance Criteria

1. WHEN 系统接收到 Word 文档 THEN THE CKB_Parser SHALL 提取标题层级、段落结构,每个结构单元生成一个 CKB,页眉页脚应被丢弃
2. WHEN 系统接收到 PDF 文档 THEN THE CKB_Parser SHALL 提取文本段落和结构信息,每个段落生成一个 CKB
3. WHEN 系统接收到 Excel 文档 THEN THE CKB_Parser SHALL 检测表头,每一行数据生成一个 CKB
4. WHEN 系统接收到图片文档 THEN THE CKB_Parser SHALL 使用 OCR 提取文本,并将 source_confidence 设置为较低值(如 0.6)
5. WHEN 系统接收到视频文档 THEN THE CKB_Parser SHALL 使用 ASR 提取文本,并记录时间范围信息
6. WHEN 生成 CKB THEN THE System SHALL 包含 ckb_id、doc_id、source_type、source_meta、structure、content、quality、timestamps 字段
7. WHEN 生成 CKB THEN THE System SHALL 确保 content.text 字段非空
8. WHEN 生成 CKB THEN THE System SHALL 根据来源类型设置合理的 source_confidence 值(手动输入 0.9-1.0,OCR 0.5-0.7,ASR 0.4-0.6)
9. WHEN CKB 被创建 THEN THE System SHALL 将其持久化到数据库,并建立与源文档的关联
10. WHEN 查询 CKB THEN THE System SHALL 支持按 doc_id、source_type、时间范围进行过滤

### Requirement 2: 字段抽取模块

**User Story:** 作为系统开发者,我需要实现字段抽取模块,以便从 CKB 中提取结构化字段,为 Schema 匹配提供输入。

#### Acceptance Criteria

1. WHEN Field_Extractor 接收到 CKB THEN THE System SHALL 提取区域、时间、数值、单位、指标、实体名称等字段类型
2. WHEN 提取字段 THEN THE System SHALL 使用规则优先策略(正则表达式、NER 模型)
3. WHEN 规则无法提取字段 THEN THE System SHALL 调用 LLM 进行字段抽取,使用 Prompt 1(CKB → 字段抽取)
4. WHEN 提取字段 THEN THE System SHALL 为每个字段标注类型(location、time、number、unit、indicator、entity)
5. WHEN 提取字段 THEN THE System SHALL 为每个字段计算置信度(0-1 之间)
6. WHEN 字段不确定 THEN THE System SHALL 标记为 candidate 类型
7. WHEN 提取完成 THEN THE System SHALL 返回字段列表,包含 name、value、type、confidence 属性
8. WHEN 使用 LLM 提取字段 THEN THE System SHALL 记录 Token 消耗量
9. WHEN 提取字段 THEN THE System SHALL 不进行推理、不合并字段、不生成实体
10. WHEN 提取时间字段 THEN THE System SHALL 标准化为 ISO 8601 格式

### Requirement 3: Schema 定义和匹配

**User Story:** 作为系统管理员,我需要定义和管理 Schema,以便系统能够识别和构建特定领域的实体。

#### Acceptance Criteria

1. WHEN 定义 Schema THEN THE System SHALL 包含 schema_name、entity_type、scene、core_fields、threshold、relations 字段
2. WHEN 定义 core_fields THEN THE System SHALL 为每个字段指定 name、weight、required 属性
3. WHEN 定义 relations THEN THE System SHALL 指定 type、target_field、direction 属性
4. WHEN Schema_Matcher 接收到字段列表 THEN THE System SHALL 计算每个 Schema 的完整度评分
5. WHEN 计算完整度评分 THEN THE System SHALL 使用公式: Completeness = Σ(字段命中次数 × 字段权重) × 来源置信度
6. WHEN 计算完整度评分 THEN THE System SHALL 识别已匹配字段和缺失字段
7. WHEN 完整度评分完成 THEN THE System SHALL 返回 schema_name、matched_fields、missing_fields、completeness 信息
8. WHEN Schema 定义存储 THEN THE System SHALL 使用 JSON 格式,支持版本控制
9. WHEN Schema 定义来源于 SchemaList.md THEN THE System SHALL 在系统启动时加载所有 250 个 Schema
10. WHEN 多个 Schema 被触发 THEN THE System SHALL 按完整度评分降序排列
11. WHEN Schema 匹配 THEN THE System SHALL 优先使用规则匹配,仅在必要时调用 LLM(Prompt 2)
12. WHEN 查询 Schema THEN THE System SHALL 支持按 scene(场景)进行分类筛选

### Requirement 4: 实体实例化(增强版)

**User Story:** 作为系统开发者,我需要实现实体实例化模块,以便在 Schema 完整度达到阈值时生成实体,并通过 LLM 增强提高实体质量和准确性。

#### Acceptance Criteria

1. WHEN Schema 完整度 ≥ threshold THEN THE Entity_Builder SHALL 触发实体实例化
2. WHEN 实例化实体 THEN THE System SHALL 生成 entity_id、entity_type、canonical_name、aliases、schemas、supported_by、attributes、llm_enriched 字段
3. WHEN 生成 canonical_name THEN THE System SHALL 优先使用规则,在名称不规范或随机采样(50%)时调用 LLM 标准化
4. WHEN LLM 标准化名称 THEN THE System SHALL 同时生成 2-3 个常见别名
5. WHEN 实例化实体 THEN THE System SHALL 记录支撑该实体的所有 CKB ID 列表
6. WHEN 实例化实体 THEN THE System SHALL 记录触发该实体的 Schema 列表及其置信度
7. WHEN 实体已存在且名称匹配(包括别名) THEN THE System SHALL 更新 supported_by 列表,而非创建新实体
8. WHEN 实体可能重复但名称不同 THEN THE System SHALL 使用 LLM 消歧(30% 概率),置信度 > 0.8 时合并
9. WHEN 实体置信度 ≥ 0.8 且 CKB 支撑数 ≥ 3 THEN THE System SHALL 使用 LLM 提取额外属性
10. WHEN 实体已存在 THEN THE System SHALL 重新计算实体置信度: Entity.confidence = Σ(CKB.confidence) / CKB 数量
11. WHEN 实体实例化 THEN THE System SHALL 将实体持久化到 KG_Store
12. WHEN 实体实例化 THEN THE System SHALL 建立实体与 CKB 的双向关联
13. WHEN 删除 CKB THEN THE System SHALL 更新相关实体的置信度,若置信度低于阈值则删除实体
14. WHEN 批量处理实体 THEN THE System SHALL 识别相似实体并批量调用 LLM 消歧,减少 API 调用次数

### Requirement 5: Schema 内建关系生成

**User Story:** 作为系统开发者,我需要实现 Schema 内建关系生成,以便根据 Schema 定义自动创建确定性关系。

#### Acceptance Criteria

1. WHEN 实体实例化完成 THEN THE Relation_Builder SHALL 检查 Schema 中定义的 relations
2. WHEN Schema 定义包含 relation THEN THE System SHALL 根据 target_field 查找目标实体
3. WHEN 目标实体存在 THEN THE System SHALL 创建关系,包含 source_id、target_id、type、confidence、evidence_ckb 字段
4. WHEN 创建内建关系 THEN THE System SHALL 设置 confidence 为 1.0(确定性关系)
5. WHEN 创建内建关系 THEN THE System SHALL 记录触发该关系的 CKB ID
6. WHEN 内建关系已存在 THEN THE System SHALL 更新 evidence_ckb 列表,而非创建新关系
7. WHEN 创建内建关系 THEN THE System SHALL 不调用 LLM(0 Token 消耗)
8. WHEN 内建关系创建 THEN THE System SHALL 将关系持久化到 KG_Store
9. WHEN 删除实体 THEN THE System SHALL 级联删除相关的内建关系
10. WHEN 查询关系 THEN THE System SHALL 支持按 type、source_id、target_id 进行过滤

### Requirement 6: 共现关系生成

**User Story:** 作为系统开发者,我需要实现共现关系生成,以便基于统计方法发现实体间的潜在关联。

#### Acceptance Criteria

1. WHEN 两个实体在同一 CKB 中被提及 THEN THE Relation_Builder SHALL 创建共现关系候选
2. WHEN 两个实体在同一段落/表行中被提及 THEN THE Relation_Builder SHALL 增加共现计数
3. WHEN 计算共现关系权重 THEN THE System SHALL 使用公式: Edge.weight = 共现次数 × 来源权重
4. WHEN 共现关系权重 ≥ 阈值(如 0.5) THEN THE System SHALL 创建共现关系
5. WHEN 创建共现关系 THEN THE System SHALL 设置 type 为 "co_occurrence"
6. WHEN 创建共现关系 THEN THE System SHALL 记录所有共现的 CKB ID 列表
7. WHEN 创建共现关系 THEN THE System SHALL 不调用 LLM(0 Token 消耗)
8. WHEN 共现关系已存在 THEN THE System SHALL 更新权重和 evidence_ckb 列表
9. WHEN 删除 CKB THEN THE System SHALL 重新计算相关共现关系的权重,若低于阈值则删除关系
10. WHEN 查询共现关系 THEN THE System SHALL 支持按权重范围进行过滤

### Requirement 7: LLM 语义关系抽取(增强版)

**User Story:** 作为系统开发者,我需要实现 LLM 语义关系抽取,以便识别 Schema 和规则无法覆盖的复杂语义关系,采用混合策略平衡准确性和成本。

#### Acceptance Criteria

1. WHEN 文本包含因果关键词("导致"、"因为"、"由于") THEN THE Relation_Builder SHALL 调用 LLM 进行语义关系抽取
2. WHEN 文本包含对比关键词("优于"、"相比"、"不同于") THEN THE Relation_Builder SHALL 调用 LLM 进行语义关系抽取
3. WHEN CKB 中实体数量 ≥ 3 THEN THE Relation_Builder SHALL 调用 LLM 进行语义关系抽取
4. WHEN 不满足高优先级条件 THEN THE System SHALL 以 20% 概率随机采样调用 LLM,发现新模式
5. WHEN 调用 LLM 抽取关系 THEN THE System SHALL 使用增强 Prompt,包含实体列表、关系类型说明、置信度要求
6. WHEN LLM 返回关系候选 THEN THE System SHALL 包含 subject、relation、object、confidence、evidence_text 字段
7. WHEN LLM 返回关系候选 THEN THE System SHALL 验证 subject 和 object 是否为已存在实体
8. WHEN LLM 返回关系候选 THEN THE System SHALL 验证 evidence_text 是否在原文中存在
9. WHEN LLM 返回关系候选 THEN THE System SHALL 验证关系方向性是否符合约束
10. WHEN 关系候选验证通过 THEN THE System SHALL 创建语义关系,设置 type 为 "semantic"
11. WHEN 创建语义关系 THEN THE System SHALL 记录 LLM 返回的 confidence 值(打折 0.9)
12. WHEN 创建语义关系 THEN THE System SHALL 记录 evidence_text 和 validation_score
13. WHEN 创建语义关系 THEN THE System SHALL 记录 Token 消耗量
14. WHEN 语义关系 confidence < 阈值(如 0.7) THEN THE System SHALL 拒绝创建该关系
15. WHEN 批量处理 CKB THEN THE System SHALL 合并多个 CKB(最多 5 个)到一个 LLM 请求,减少网络开销
16. WHEN Token 消耗超过预算 THEN THE System SHALL 降低 LLM 调用频率或暂停处理

### Requirement 8: 置信度驱动的数据质量管理

**User Story:** 作为系统管理员,我需要基于置信度管理数据质量,以便自动过滤低质量数据,提高知识图谱的可靠性。

#### Acceptance Criteria

1. WHEN 计算实体置信度 THEN THE Confidence_Engine SHALL 使用公式: Entity.confidence = Σ(CKB.confidence) / CKB 数量
2. WHEN 实体置信度 < 阈值(如 0.6) THEN THE System SHALL 标记该实体为低质量
3. WHEN 实体置信度 < 删除阈值(如 0.4) THEN THE System SHALL 自动删除该实体
4. WHEN 计算关系置信度 THEN THE System SHALL 考虑源实体和目标实体的置信度
5. WHEN 关系置信度 < 阈值(如 0.5) THEN THE System SHALL 标记该关系为低质量
6. WHEN 关系置信度 < 删除阈值(如 0.3) THEN THE System SHALL 自动删除该关系
7. WHEN 多个 CKB 支持同一实体但描述冲突 THEN THE System SHALL 优先采用高置信度 CKB 的描述
8. WHEN 实体属性冲突 THEN THE System SHALL 使用置信度加权平均或投票机制消解冲突
9. WHEN 置信度更新 THEN THE System SHALL 级联更新相关实体和关系的置信度
10. WHEN 查询知识图谱 THEN THE System SHALL 支持按置信度范围进行过滤

### Requirement 9: 知识图谱存储和查询

**User Story:** 作为系统开发者,我需要实现知识图谱存储和查询功能,以便持久化和检索实体、关系数据。

#### Acceptance Criteria

1. WHEN 系统初始化 THEN THE KG_Store SHALL 使用 SQLite 作为存储引擎
2. WHEN 存储实体 THEN THE System SHALL 创建 kg_entities 表,包含 id、type、canonical_name、schemas、supported_by、attributes、confidence、created_at、updated_at 字段
3. WHEN 存储关系 THEN THE System SHALL 创建 kg_relations 表,包含 id、source_id、target_id、type、weight、confidence、evidence_ckb、metadata、created_at、updated_at 字段
4. WHEN 存储 CKB THEN THE System SHALL 创建 ckb 表,包含 id、doc_id、source_type、source_meta、structure、content、quality、timestamps 字段
5. WHEN 存储 Schema THEN THE System SHALL 创建 schemas 表,包含 id、name、entity_type、core_fields、threshold、relations、version、created_at 字段
6. WHEN 查询实体 THEN THE System SHALL 支持按 id、type、canonical_name、置信度范围进行查询
7. WHEN 查询关系 THEN THE System SHALL 支持按 source_id、target_id、type、权重范围进行查询
8. WHEN 查询知识图谱 THEN THE System SHALL 支持图遍历查询(如查找 N 度关系)
9. WHEN 数据规模增长 THEN THE System SHALL 支持迁移到 Neo4j 或其他图数据库
10. WHEN 查询性能下降 THEN THE System SHALL 在关键字段上创建索引

### Requirement 10: 增量更新和可追溯性

**User Story:** 作为系统用户,我需要系统支持增量更新,以便在添加、修改、删除文档时自动更新知识图谱,并能追溯实体和关系的来源。

#### Acceptance Criteria

1. WHEN 新增文档 THEN THE System SHALL 解析文档生成 CKB,触发字段抽取、Schema 匹配、实体实例化流程
2. WHEN 修改文档 THEN THE System SHALL 更新相关 CKB,重新计算受影响实体和关系的置信度
3. WHEN 删除文档 THEN THE System SHALL 删除相关 CKB,更新或删除受影响的实体和关系
4. WHEN 查询实体 THEN THE System SHALL 返回 supported_by 字段,列出所有支撑该实体的 CKB ID
5. WHEN 查询关系 THEN THE System SHALL 返回 evidence_ckb 字段,列出所有支撑该关系的 CKB ID
6. WHEN 点击 CKB ID THEN THE System SHALL 跳转到源文档的具体位置(段落、表行、时间轴)
7. WHEN 实体或关系被删除 THEN THE System SHALL 记录删除原因(如"源 CKB 被删除"、"置信度低于阈值")
8. WHEN 实体或关系被更新 THEN THE System SHALL 记录更新历史(时间、原因、变更内容)
9. WHEN 系统运行 THEN THE System SHALL 定期检查孤立实体(无 CKB 支撑)并清理
10. WHEN 增量更新 THEN THE System SHALL 仅处理变更的文档,避免全量重建

### Requirement 11: Token 消耗最小化(增强版)

**User Story:** 作为系统管理员,我需要最小化 LLM Token 消耗,以便降低运营成本,同时通过 50% LLM 参与率提高准确性,目标是相比传统全 LLM 方法减少 90% Token 使用量。

#### Acceptance Criteria

1. WHEN 字段抽取 THEN THE System SHALL 优先使用正则表达式和 NER 模型,仅在必要时调用 LLM
2. WHEN Schema 匹配 THEN THE System SHALL 使用纯规则计算,不调用 LLM
3. WHEN 生成内建关系 THEN THE System SHALL 使用 Schema 定义,不调用 LLM
4. WHEN 生成共现关系 THEN THE System SHALL 使用统计方法,不调用 LLM
5. WHEN 生成实体规范名称 THEN THE System SHALL 以 50% 概率调用 LLM 标准化
6. WHEN 实体可能重复 THEN THE System SHALL 以 30% 概率调用 LLM 消歧
7. WHEN 实体置信度高且支撑充分 THEN THE System SHALL 调用 LLM 提取额外属性
8. WHEN 抽取语义关系 THEN THE System SHALL 根据优先级分层触发 LLM(高优先级 30%,随机采样 20%)
9. WHEN 调用 LLM THEN THE System SHALL 使用增强 Prompt,提供充分上下文和约束
10. WHEN 调用 LLM THEN THE System SHALL 记录每次调用的 Token 消耗(input_tokens、output_tokens、total_tokens)
11. WHEN 调用 LLM THEN THE System SHALL 缓存相似查询的结果,避免重复调用
12. WHEN 批量处理 CKB THEN THE System SHALL 合并 LLM 请求(最多 5 个/批),减少网络开销
13. WHEN 系统运行 THEN THE System SHALL 提供 Token 消耗统计报告(按模块、按时间段)
14. WHEN Token 消耗超过每日预算 THEN THE System SHALL 发出告警,并降低 LLM 调用频率
15. WHEN Token 消耗接近预算 THEN THE System SHALL 提供优化建议(如调整采样率、提高阈值)

### Requirement 12: API 接口和集成

**User Story:** 作为前端开发者,我需要清晰的 API 接口,以便集成知识图谱功能到现有的知识库系统。

#### Acceptance Criteria

1. WHEN 前端请求知识图谱数据 THEN THE System SHALL 提供 GET /api/knowledge-graph 接口,返回实体和关系列表
2. WHEN 前端请求实体详情 THEN THE System SHALL 提供 GET /api/knowledge-graph/entities/:id 接口,返回实体详细信息和支撑 CKB
3. WHEN 前端请求关系详情 THEN THE System SHALL 提供 GET /api/knowledge-graph/relations/:id 接口,返回关系详细信息和证据 CKB
4. WHEN 前端请求图遍历 THEN THE System SHALL 提供 POST /api/knowledge-graph/traverse 接口,支持指定起点、深度、关系类型
5. WHEN 前端请求重建知识图谱 THEN THE System SHALL 提供 POST /api/knowledge-graph/rebuild 接口,触发全量重建
6. WHEN 前端请求增量更新 THEN THE System SHALL 提供 POST /api/knowledge-graph/update 接口,传入 doc_id 列表
7. WHEN 前端请求 Schema 管理 THEN THE System SHALL 提供 CRUD 接口(/api/schemas)
8. WHEN 前端请求 Token 统计 THEN THE System SHALL 提供 GET /api/knowledge-graph/stats/tokens 接口
9. WHEN API 调用失败 THEN THE System SHALL 返回标准错误格式,包含 error_code、message、details 字段
10. WHEN API 调用成功 THEN THE System SHALL 返回标准响应格式,包含 success、data、metadata 字段

### Requirement 13: 可视化界面

**User Story:** 作为系统用户,我需要可视化界面,以便直观地浏览和探索知识图谱。

#### Acceptance Criteria

1. WHEN 用户访问知识图谱页面 THEN THE System SHALL 使用力导向图布局展示实体和关系
2. WHEN 展示实体节点 THEN THE System SHALL 根据 entity_type 使用不同颜色和图标
3. WHEN 展示关系边 THEN THE System SHALL 根据 type 使用不同颜色和线型(实线、虚线、箭头)
4. WHEN 展示关系边 THEN THE System SHALL 根据 weight 或 confidence 调整边的粗细
5. WHEN 用户点击实体节点 THEN THE System SHALL 显示实体详情面板,包含属性、支撑 CKB、相关关系
6. WHEN 用户点击关系边 THEN THE System SHALL 显示关系详情面板,包含类型、权重、证据 CKB
7. WHEN 用户点击 CKB 链接 THEN THE System SHALL 跳转到源文档的具体位置
8. WHEN 用户搜索实体 THEN THE System SHALL 高亮匹配的节点,并聚焦到该节点
9. WHEN 用户筛选实体 THEN THE System SHALL 支持按 type、置信度范围进行筛选
10. WHEN 用户筛选关系 THEN THE System SHALL 支持按 type、权重范围进行筛选

### Requirement 14: 系统性能和可扩展性

**User Story:** 作为系统架构师,我需要确保系统性能和可扩展性,以便支持大规模文档和知识图谱。

#### Acceptance Criteria

1. WHEN 处理单个文档 THEN THE System SHALL 在 5 秒内完成 CKB 解析和字段抽取
2. WHEN 处理单个 CKB THEN THE System SHALL 在 1 秒内完成 Schema 匹配和完整度评分
3. WHEN 实例化单个实体 THEN THE System SHALL 在 2 秒内完成(包含 LLM 调用)
4. WHEN 查询知识图谱 THEN THE System SHALL 在 1 秒内返回结果(实体数 < 10000)
5. WHEN 实体数超过 10000 THEN THE System SHALL 支持分页查询和懒加载
6. WHEN 关系数超过 50000 THEN THE System SHALL 考虑迁移到图数据库(Neo4j)
7. WHEN 并发处理文档 THEN THE System SHALL 支持多线程或异步处理
8. WHEN 系统负载高 THEN THE System SHALL 使用消息队列(如 Bull)管理任务
9. WHEN 数据库查询慢 THEN THE System SHALL 在关键字段上创建索引
10. WHEN 内存占用高 THEN THE System SHALL 使用流式处理大文件,避免一次性加载

### Requirement 15: 错误处理和日志

**User Story:** 作为系统运维人员,我需要完善的错误处理和日志记录,以便快速定位和解决问题。

#### Acceptance Criteria

1. WHEN CKB 解析失败 THEN THE System SHALL 记录错误日志,包含 doc_id、错误类型、错误消息
2. WHEN 字段抽取失败 THEN THE System SHALL 记录警告日志,继续处理其他字段
3. WHEN Schema 匹配失败 THEN THE System SHALL 记录调试日志,返回空匹配结果
4. WHEN 实体实例化失败 THEN THE System SHALL 记录错误日志,回滚数据库事务
5. WHEN LLM 调用失败 THEN THE System SHALL 记录错误日志,包含 API 响应、重试次数
6. WHEN LLM 调用超时 THEN THE System SHALL 自动重试(最多 3 次),使用指数退避策略
7. WHEN 数据库操作失败 THEN THE System SHALL 记录错误日志,返回友好的错误消息给前端
8. WHEN 系统运行 THEN THE System SHALL 记录关键操作日志(文档处理、实体创建、关系生成)
9. WHEN 日志文件过大 THEN THE System SHALL 自动轮转日志文件(按日期或大小)
10. WHEN 错误频繁发生 THEN THE System SHALL 发送告警通知(邮件或 Webhook)


### Requirement 16: 项目集成和部署

**User Story:** 作为系统架构师,我需要将知识图谱系统无缝集成到现有项目中,并支持 GitHub 部署和共享,以便团队协作和版本管理。

#### Acceptance Criteria

1. WHEN 集成知识图谱模块 THEN THE System SHALL 采用模块化设计,将 KG 代码放在独立的 `kg/` 目录下
2. WHEN 扩展数据库 THEN THE System SHALL 使用 Prisma 迁移添加 KG 相关表(ckb、schemas、kg_entities、kg_relations、kg_token_usage)
3. WHEN 注册 API 路由 THEN THE System SHALL 在 Express 服务器中添加 `/api/knowledge-graph` 路由前缀
4. WHEN 文档被创建 THEN THE System SHALL 异步触发 CKB 解析和 KG 构建,不阻塞响应
5. WHEN 文档被更新 THEN THE System SHALL 异步触发 KG 增量更新
6. WHEN 文档被删除 THEN THE System SHALL 异步触发 KG 清理,删除相关 CKB、实体和关系
7. WHEN 前端访问知识图谱页面 THEN THE System SHALL 提供 Schema 驱动的 KG 视图组件
8. WHEN 前端筛选知识图谱 THEN THE System SHALL 支持按置信度、关系类型进行过滤
9. WHEN 提交代码到 GitHub THEN THE System SHALL 遵循 Conventional Commits 规范
10. WHEN 创建 Pull Request THEN THE System SHALL 使用 PR 模板,包含变更描述、测试清单、Token 消耗说明
11. WHEN 推送代码 THEN THE System SHALL 触发 CI/CD 流程,运行单元测试和属性测试
12. WHEN 测试失败或覆盖率下降 THEN THE System SHALL 阻止合并到主分支
13. WHEN 发布新版本 THEN THE System SHALL 更新版本号、CHANGELOG、创建 Git 标签和 GitHub Release
14. WHEN 部署到生产环境 THEN THE System SHALL 确保数据库迁移已执行、环境变量已配置
15. WHEN 更新 README THEN THE System SHALL 包含知识图谱功能说明、快速开始指南、文档链接

### Requirement 17: Schema 初始化和管理(增强批量导入)

**User Story:** 作为系统管理员,我需要从 SchemaList.md 批量导入和管理 Schema,确保所有 250 个 Schema 都能正确导入到数据库,以便系统能够识别和构建多领域的实体。

#### Acceptance Criteria

1. WHEN 系统启动 THEN THE System SHALL 从 SchemaList.md 文件加载所有 250 个 Schema 定义
2. WHEN 解析 SchemaList.md THEN THE System SHALL 提取 Schema 名称、场景、核心字段、示例描述、Description 字段
3. WHEN 解析核心字段 THEN THE System SHALL 将字段字符串转换为结构化的 core_fields 数组
4. WHEN 导入 Schema THEN THE System SHALL 为每个 Schema 生成唯一的 schema_id
5. WHEN 导入 Schema THEN THE System SHALL 设置默认的 threshold 值(如 0.75)
6. WHEN Schema 已存在 THEN THE System SHALL 跳过重复导入,避免数据冲突
7. WHEN 批量导入 Schema THEN THE System SHALL 使用事务确保原子性,失败时回滚
8. WHEN 查询 Schema THEN THE System SHALL 支持按 scene(场景)进行分类筛选
9. WHEN 查询 Schema THEN THE System SHALL 支持按 schema_name 进行模糊搜索
10. WHEN 更新 Schema THEN THE System SHALL 保留旧版本,支持版本回退
11. WHEN 禁用 Schema THEN THE System SHALL 标记为 inactive,不参与匹配,但保留历史数据
12. WHEN 启用 Schema THEN THE System SHALL 标记为 active,恢复参与匹配
13. WHEN 删除 Schema THEN THE System SHALL 检查是否有实体依赖该 Schema,有依赖则拒绝删除
14. WHEN 导出 Schema THEN THE System SHALL 支持导出为 JSON 或 CSV 格式
15. WHEN SchemaList.md 更新 THEN THE System SHALL 支持增量导入,仅更新变更的 Schema
16. WHEN 导入完成 THEN THE System SHALL 验证数据库中 Schema 数量等于 SchemaList.md 中的数量(250个)
17. WHEN 导入失败 THEN THE System SHALL 记录详细错误日志,包含失败的 Schema 名称和原因
18. WHEN 导入过程中 THEN THE System SHALL 显示导入进度(已导入/总数),便于监控
19. WHEN 数据库中 Schema 数量不足 THEN THE System SHALL 触发告警,提示管理员检查导入状态
20. WHEN 系统启动时 THEN THE System SHALL 自动检查 Schema 数量,如不足 250 个则自动重新导入

### Requirement 18: 字段清洗和治理(混合策略,增强多样性支持)

**User Story:** 作为系统开发者,我需要实现字段清洗和治理模块,以便将文档中提取的字段标准化为 Schema 定义的字段,采用算法优先、LLM 兜底的混合策略,充分考虑用户众多、文档来源多样的现实情况,目标是 50% LLM 参与率。

#### Acceptance Criteria

1. WHEN 提取字段后 THEN THE Field_Normalizer SHALL 将原始字段名映射到 Schema 定义的标准字段名
2. WHEN 字段名相似度高(如"地区" vs "区域") THEN THE System SHALL 使用字符串相似度算法(编辑距离、余弦相似度)进行映射
3. WHEN 字段名包含同义词(如"时间" vs "日期") THEN THE System SHALL 使用预定义的同义词词典进行映射
4. WHEN 字段值格式不一致(如"2025-01" vs "2025年1月") THEN THE System SHALL 使用规则标准化字段值
5. WHEN 算法无法确定映射(相似度 < 阈值) THEN THE System SHALL 以 50% 概率调用 LLM 进行字段映射
6. WHEN 调用 LLM 映射字段 THEN THE System SHALL 提供原始字段名、Schema 字段列表、上下文文本
7. WHEN LLM 返回映射结果 THEN THE System SHALL 验证映射的合理性(字段类型匹配、值域合法)
8. WHEN 字段映射成功 THEN THE System SHALL 缓存映射关系,避免重复调用 LLM
9. WHEN 字段值包含噪声(如多余空格、特殊字符) THEN THE System SHALL 使用规则清洗字段值
10. WHEN 字段值缺失或不完整 THEN THE System SHALL 标记为 missing,不强制填充
11. WHEN 字段值冲突(多个 CKB 描述不一致) THEN THE System SHALL 使用置信度加权或投票机制消解冲突
12. WHEN 批量清洗字段 THEN THE System SHALL 合并多个字段映射请求到一个 LLM 调用,减少 Token 消耗
13. WHEN 清洗完成 THEN THE System SHALL 记录清洗日志(原始字段、标准字段、清洗方法、置信度)
14. WHEN Token 消耗超过预算 THEN THE System SHALL 降低 LLM 调用频率,提高算法映射阈值
15. WHEN 系统运行 THEN THE System SHALL 提供字段映射统计报告(算法映射率、LLM 映射率、失败率)
16. WHEN 遇到未见过的字段名称 THEN THE System SHALL 使用模糊匹配和语义类别推断,而非直接拒绝映射
17. WHEN 字段名称来自不同行业或领域 THEN THE System SHALL 根据文档上下文和 Schema 场景动态调整映射策略
18. WHEN 字段映射失败率超过 20% THEN THE System SHALL 触发同义词词典扩充流程,学习新的映射模式
19. WHEN 处理多样化文档来源 THEN THE System SHALL 记录字段名称分布统计,识别高频未映射字段
20. WHEN 字段多样性导致映射困难 THEN THE System SHALL 提供映射建议给用户,支持人工确认和学习

### Requirement 19: 智能字段截断策略

**User Story:** 作为系统开发者,我需要实现智能字段截断策略,以便在调用 LLM 进行字段映射时,只传递最相关的字段子集,从而减少 Token 消耗并提高映射准确性,目标是覆盖 90%+ 的实际场景。

#### Acceptance Criteria

1. WHEN 调用 LLM 映射字段 THEN THE System SHALL 使用智能截断策略选择最相关的字段子集,而非传递所有 Schema 字段
2. WHEN 计算字段重要性 THEN THE System SHALL 综合考虑字段权重、是否必需、历史频率、类型通用性四个维度
3. WHEN 计算语义相关性 THEN THE System SHALL 使用编辑距离、字符 n-gram 相似度、语义类别匹配三种方法
4. WHEN 计算上下文相关性 THEN THE System SHALL 根据原始字段的类型信息(time/location/number等)匹配 Schema 字段的语义类别
5. WHEN 选择字段子集 THEN THE System SHALL 综合重要性(30%)、语义相关性(50%)、上下文相关性(20%)计算得分
6. WHEN 选择字段子集 THEN THE System SHALL 至少包含前 3 个高分字段,最多包含 5 个字段
7. WHEN 选择字段子集 THEN THE System SHALL 包含所有得分 >= 30 的字段(在最大字段数限制内)
8. WHEN Schema 场景为"科研/政府" THEN THE System SHALL 使用更大的字段数限制(6-7个),因为该场景字段较多
9. WHEN Schema 场景为"个人生活" THEN THE System SHALL 使用较小的字段数限制(4个),因为该场景字段较少
10. WHEN Schema 场景为"摄影" THEN THE System SHALL 使用更大的字段数限制(7个)和更低的得分阈值(20),因为摄影参数多
11. WHEN 构建 LLM Prompt THEN THE System SHALL 只包含选中的字段子集,并按相关性降序排列
12. WHEN LLM 返回映射结果 THEN THE System SHALL 验证返回的字段是否在候选列表中,如不在则检查完整字段列表
13. WHEN 字段截断完成 THEN THE System SHALL 记录截断信息(总字段数、选中字段数、节省的 Token 数)
14. WHEN 使用智能截断 THEN THE System SHALL 相比无截断策略节省 40%+ 的 Prompt Token
15. WHEN 使用智能截断 THEN THE System SHALL 保持或提高映射准确率(目标 85-90%),覆盖 95%+ 的实际场景

### Requirement 20: 同义词词典智能生成和管理

**User Story:** 作为系统管理员,我需要使用大模型的生成能力构建和维护同义词词典,确保覆盖现有工作、科研、生活、旅行、政务、中国网信工作的 90% 以上场景,以提高字段映射的准确性和效率。

#### Acceptance Criteria

1. WHEN 系统初始化 THEN THE System SHALL 使用 LLM 生成覆盖工作、科研、生活、旅行、政务、网信工作等领域的同义词词典
2. WHEN 生成同义词词典 THEN THE System SHALL 为每个标准字段名生成至少 5-10 个常见同义词
3. WHEN 生成同义词词典 THEN THE System SHALL 包含领域特定术语(如科研领域的"指标"、"参数"、"度量")
4. WHEN 生成同义词词典 THEN THE System SHALL 包含口语化表达(如"啥时候" → "时间")
5. WHEN 生成同义词词典 THEN THE System SHALL 包含缩写和全称(如"ID" ↔ "标识符")
6. WHEN 生成同义词词典 THEN THE System SHALL 包含中英文混合表达(如"location" → "位置")
7. WHEN 同义词词典生成完成 THEN THE System SHALL 验证覆盖率达到 90% 以上(通过测试集验证)
8. WHEN 字段映射失败 THEN THE System SHALL 记录未映射的字段名称,用于词典扩充
9. WHEN 未映射字段累积达到阈值(如 100 个) THEN THE System SHALL 触发 LLM 批量生成新同义词
10. WHEN LLM 映射成功且置信度高(≥ 0.9) THEN THE System SHALL 自动将映射关系添加到同义词词典
11. WHEN 同义词词典更新 THEN THE System SHALL 保留更新历史,支持版本回退
12. WHEN 同义词词典更新 THEN THE System SHALL 清除相关的映射缓存,确保使用最新词典
13. WHEN 查询同义词词典 THEN THE System SHALL 支持按领域(工作/科研/生活等)筛选
14. WHEN 导出同义词词典 THEN THE System SHALL 支持导出为 JSON 格式,便于人工审核和编辑
15. WHEN 导入同义词词典 THEN THE System SHALL 支持从 JSON 文件导入,合并到现有词典
16. WHEN 同义词词典包含冲突(一个同义词对应多个标准字段) THEN THE System SHALL 使用上下文消歧
17. WHEN 评估词典质量 THEN THE System SHALL 定期运行测试集,计算映射准确率和覆盖率
18. WHEN 词典覆盖率低于 90% THEN THE System SHALL 触发告警,提示管理员扩充词典
19. WHEN 使用同义词词典映射 THEN THE System SHALL 记录命中率统计,识别高频使用的同义词
20. WHEN 同义词词典规模过大(> 10000 条) THEN THE System SHALL 使用索引优化查询性能,确保 O(1) 查找

### Requirement 21: 性能和成本约束管理

**User Story:** 作为系统架构师,我需要严格控制系统的性能和成本,确保本地处理在 1 秒内完成,Token 消耗和时延在可接受范围内,以提供良好的用户体验和可持续的运营成本。

#### Acceptance Criteria

1. WHEN 处理单个 CKB 的本地操作(字段抽取、Schema 匹配、字段清洗) THEN THE System SHALL 在 1 秒内完成
2. WHEN 本地处理时间超过 1 秒 THEN THE System SHALL 记录性能日志,标记为性能异常
3. WHEN 调用 LLM 进行字段映射 THEN THE System SHALL 设置超时时间为 5 秒,超时则使用缓存或跳过
4. WHEN 调用 LLM 进行实体增强 THEN THE System SHALL 设置超时时间为 10 秒,超时则使用基础实体
5. WHEN 单个文档处理总时延超过 30 秒 THEN THE System SHALL 触发告警,提示性能优化
6. WHEN 计算 Token 消耗 THEN THE System SHALL 记录每个模块的 Token 使用量(字段抽取、实体构建、关系抽取)
7. WHEN 单个文档 Token 消耗超过 5000 THEN THE System SHALL 触发告警,分析消耗原因
8. WHEN 每日 Token 消耗超过预算(如 100000) THEN THE System SHALL 降低 LLM 调用频率或暂停非关键处理
9. WHEN Token 消耗达到预算的 80% THEN THE System SHALL 发送预警通知
10. WHEN 系统运行 THEN THE System SHALL 提供实时性能监控面板,显示处理时延、Token 消耗、吞吐量
11. WHEN 性能下降(处理时延增加 50%) THEN THE System SHALL 自动触发性能分析,识别瓶颈
12. WHEN 数据库查询慢(> 500ms) THEN THE System SHALL 记录慢查询日志,优化索引
13. WHEN 内存占用超过阈值(如 2GB) THEN THE System SHALL 触发垃圾回收或释放缓存
14. WHEN 批量处理文档 THEN THE System SHALL 使用队列管理,避免并发过高导致性能下降
15. WHEN 队列积压超过 100 个任务 THEN THE System SHALL 触发告警,提示扩容或优化
16. WHEN 使用缓存 THEN THE System SHALL 设置合理的缓存过期时间(如 24 小时),避免内存泄漏
17. WHEN 缓存命中率低于 50% THEN THE System SHALL 分析缓存策略,优化缓存键设计
18. WHEN 系统负载高(CPU > 80%) THEN THE System SHALL 限流,拒绝新请求或降级服务
19. WHEN 评估成本效益 THEN THE System SHALL 计算每个文档的平均 Token 成本和处理时间
20. WHEN Token 成本过高 THEN THE System SHALL 提供优化建议(如提高算法映射率、减少 LLM 调用频率)
