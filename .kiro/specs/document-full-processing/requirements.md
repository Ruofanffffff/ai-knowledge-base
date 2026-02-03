# Requirements Document

## Introduction

本文档定义了文档全处理（Document Full Processing）功能的需求规格。该功能是对现有 schema-driven-knowledge-graph 系统的补充和增强，核心目标是确保上传的文档被**完整拆解和处理**，不遗漏任何段落、句子或结构单元，从而保证知识图谱的完整性和覆盖率。

## Glossary

- **Document_Full_Processing**: 文档全处理，确保文档的每个结构单元都被解析为 CKB 并进行后续处理
- **Coverage_Rate**: 覆盖率，文档中被处理的结构单元占总结构单元的百分比
- **Structural_Unit**: 结构单元，文档中的最小可处理单位（段落、句子、表行、图片区域等）
- **Processing_Completeness**: 处理完整性，衡量文档处理是否遗漏内容的指标
- **CKB_Generation_Rate**: CKB 生成率，实际生成的 CKB 数量与预期结构单元数量的比率
- **Validation_Report**: 验证报告，记录文档处理过程中的覆盖率和完整性指标
- **Skipped_Content**: 跳过内容，未被处理的文档部分（需要明确标记和记录）
- **Processing_Pipeline**: 处理流水线，从文档上传到知识图谱构建的完整流程
- **Quality_Threshold**: 质量阈值，判断内容是否应该被处理的最低标准
- **Content_Filtering**: 内容过滤，基于规则排除无意义内容（页眉、页脚、空白等）

## Requirements

### Requirement 1: 文档结构完整解析

**User Story:** 作为系统用户，我需要系统完整解析文档的所有结构单元，以便确保没有任何有价值的内容被遗漏。

#### Acceptance Criteria

1. WHEN 系统解析 Word 文档 THEN THE System SHALL 识别所有段落、标题、列表项，每个非空结构单元生成一个 CKB
2. WHEN 系统解析 PDF 文档 THEN THE System SHALL 识别所有文本段落、表格、图片区域，每个非空单元生成一个 CKB
3. WHEN 系统解析 Excel 文档 THEN THE System SHALL 识别所有工作表和数据行，每个非空行生成一个 CKB
4. WHEN 系统解析 Markdown 文档 THEN THE System SHALL 识别所有段落、代码块、列表项，每个非空单元生成一个 CKB
5. WHEN 系统解析文档 THEN THE System SHALL 记录文档的总结构单元数量和实际生成的 CKB 数量
6. WHEN 系统解析文档 THEN THE System SHALL 计算覆盖率: Coverage_Rate = CKB_count / Total_structural_units
7. WHEN 覆盖率 < 95% THEN THE System SHALL 记录警告日志，标记可能遗漏的内容
8. WHEN 系统解析文档 THEN THE System SHALL 排除页眉、页脚、空白段落等无意义内容
9. WHEN 系统解析文档 THEN THE System SHALL 保留文档的层级结构信息（章节、小节、段落）
10. WHEN 系统解析文档 THEN THE System SHALL 支持嵌套结构（如列表中的子列表、表格中的嵌套表格）


### Requirement 2: CKB 生成完整性验证

**User Story:** 作为系统开发者，我需要验证 CKB 生成的完整性，以便及时发现和修复文档处理中的遗漏问题。

#### Acceptance Criteria

1. WHEN 文档解析完成 THEN THE System SHALL 生成验证报告，包含总结构单元数、CKB 数量、覆盖率
2. WHEN 验证报告生成 THEN THE System SHALL 列出所有被跳过的内容及其原因（空白、页眉页脚、格式错误等）
3. WHEN 验证报告生成 THEN THE System SHALL 标记所有低质量 CKB（source_confidence < 0.5）
4. WHEN 验证报告生成 THEN THE System SHALL 提供文档结构树视图，标记已处理和未处理的节点
5. WHEN 覆盖率 < 90% THEN THE System SHALL 触发告警，通知管理员检查
6. WHEN 系统检测到遗漏内容 THEN THE System SHALL 提供重新处理选项
7. WHEN 用户请求验证报告 THEN THE System SHALL 通过 API 返回 JSON 格式的报告
8. WHEN 验证报告包含错误 THEN THE System SHALL 提供错误详情（文件位置、错误类型、错误消息）
9. WHEN 批量处理文档 THEN THE System SHALL 生成汇总报告，统计所有文档的平均覆盖率
10. WHEN 验证报告生成 THEN THE System SHALL 持久化到数据库，支持历史查询和对比

### Requirement 3: 内容过滤规则

**User Story:** 作为系统管理员，我需要定义内容过滤规则，以便排除无意义内容，同时确保有价值内容不被误过滤。

#### Acceptance Criteria

1. WHEN 系统解析文档 THEN THE System SHALL 应用预定义的过滤规则（页眉、页脚、空白、重复内容）
2. WHEN 内容匹配过滤规则 THEN THE System SHALL 跳过该内容，但记录到验证报告中
3. WHEN 段落长度 < 10 字符 THEN THE System SHALL 标记为可能的空白内容，但不自动跳过
4. WHEN 段落仅包含标点符号或数字 THEN THE System SHALL 标记为低质量内容
5. WHEN 内容重复出现（如页眉页脚） THEN THE System SHALL 识别并仅保留第一次出现
6. WHEN 系统管理员定义自定义过滤规则 THEN THE System SHALL 支持正则表达式和关键词匹配
7. WHEN 过滤规则更新 THEN THE System SHALL 支持重新处理已上传的文档
8. WHEN 内容被过滤 THEN THE System SHALL 记录过滤原因和匹配的规则
9. WHEN 用户质疑过滤结果 THEN THE System SHALL 提供手动恢复选项
10. WHEN 过滤规则过于激进 THEN THE System SHALL 提供规则调优建议（基于统计分析）

### Requirement 4: 处理流水线监控

**User Story:** 作为系统运维人员，我需要监控文档处理流水线，以便及时发现和解决处理瓶颈或失败。

#### Acceptance Criteria

1. WHEN 文档进入处理流水线 THEN THE System SHALL 记录处理开始时间和文档元数据
2. WHEN 文档处理完成 THEN THE System SHALL 记录处理结束时间、生成的 CKB 数量、覆盖率
3. WHEN 文档处理失败 THEN THE System SHALL 记录失败阶段（解析、字段抽取、Schema 匹配等）和错误信息
4. WHEN 处理流水线运行 THEN THE System SHALL 提供实时进度查询接口
5. WHEN 处理时间超过预期 THEN THE System SHALL 发出告警（如单个文档处理超过 5 分钟）
6. WHEN 批量处理文档 THEN THE System SHALL 显示整体进度（已处理/总数、预计剩余时间）
7. WHEN 处理流水线出现瓶颈 THEN THE System SHALL 识别慢速阶段（如 LLM 调用过多）
8. WHEN 系统管理员查询处理历史 THEN THE System SHALL 提供按时间、文档类型、成功率筛选的报告
9. WHEN 处理失败率 > 10% THEN THE System SHALL 触发告警，建议检查系统配置
10. WHEN 处理流水线监控数据 THEN THE System SHALL 支持导出为 CSV 或 JSON 格式

### Requirement 5: 分段处理策略

**User Story:** 作为系统开发者，我需要实现分段处理策略，以便处理超大文档时不会因内存或性能问题导致处理失败。

#### Acceptance Criteria

1. WHEN 文档大小 > 10MB THEN THE System SHALL 采用分段处理策略，每次处理 1000 个结构单元
2. WHEN 文档包含 > 5000 个段落 THEN THE System SHALL 分批生成 CKB，避免内存溢出
3. WHEN 分段处理文档 THEN THE System SHALL 保持文档结构的连续性（章节、页码等）
4. WHEN 分段处理完成 THEN THE System SHALL 合并所有分段的验证报告
5. WHEN 分段处理失败 THEN THE System SHALL 支持从失败点恢复，而非重新处理整个文档
6. WHEN 分段处理文档 THEN THE System SHALL 记录每个分段的处理时间和资源消耗
7. WHEN 系统资源不足 THEN THE System SHALL 自动调整分段大小（减少每批处理的单元数）
8. WHEN 分段处理文档 THEN THE System SHALL 确保跨分段的实体和关系能够正确关联
9. WHEN 分段处理文档 THEN THE System SHALL 支持并行处理多个分段（如果系统资源允许）
10. WHEN 分段处理完成 THEN THE System SHALL 验证所有分段的 CKB 总数与预期结构单元数一致


### Requirement 6: 测试数据覆盖率验证

**User Story:** 作为测试工程师，我需要验证测试数据的覆盖率，以便确保测试用例能够充分验证文档全处理功能。

#### Acceptance Criteria

1. WHEN 运行测试用例 THEN THE System SHALL 使用完整的测试文档，而非仅选取"典型句子"
2. WHEN 测试文档包含 N 个段落 THEN THE System SHALL 验证生成了 N 个 CKB（排除过滤内容）
3. WHEN 测试文档包含多种结构（段落、列表、表格） THEN THE System SHALL 验证每种结构都被正确处理
4. WHEN 测试文档包含边缘情况（空段落、特殊字符、嵌套结构） THEN THE System SHALL 验证这些情况被正确处理
5. WHEN 测试完成 THEN THE System SHALL 生成测试覆盖率报告，包含处理的结构类型和数量
6. WHEN 测试覆盖率 < 100% THEN THE System SHALL 标记未覆盖的结构类型
7. WHEN 测试用例失败 THEN THE System SHALL 提供详细的失败信息（预期 CKB 数量 vs 实际数量）
8. WHEN 测试文档更新 THEN THE System SHALL 自动更新预期的 CKB 数量和结构
9. WHEN 测试数据包含多个文档 THEN THE System SHALL 验证每个文档的覆盖率都达标
10. WHEN 测试完成 THEN THE System SHALL 对比当前覆盖率与历史基线，检测回归

### Requirement 7: 字段抽取完整性

**User Story:** 作为系统开发者，我需要确保字段抽取的完整性，以便每个 CKB 都能提取到所有可能的字段。

#### Acceptance Criteria

1. WHEN 字段抽取器处理 CKB THEN THE System SHALL 尝试提取所有预定义的字段类型（时间、地点、数值、单位、指标、实体）
2. WHEN CKB 包含多个字段 THEN THE System SHALL 提取所有字段，而非仅提取第一个或最明显的字段
3. WHEN 字段抽取完成 THEN THE System SHALL 记录提取到的字段数量和类型分布
4. WHEN 字段抽取失败 THEN THE System SHALL 记录失败原因（规则不匹配、LLM 调用失败等）
5. WHEN CKB 包含复杂结构（如嵌套列表） THEN THE System SHALL 递归提取所有层级的字段
6. WHEN 字段抽取使用 LLM THEN THE System SHALL 验证 LLM 返回的字段完整性（是否遗漏明显字段）
7. WHEN 字段抽取完成 THEN THE System SHALL 计算字段抽取率: 实际提取字段数 / 预期字段数
8. WHEN 字段抽取率 < 80% THEN THE System SHALL 记录警告，标记可能的抽取问题
9. WHEN 批量处理 CKB THEN THE System SHALL 统计平均字段抽取率和字段类型分布
10. WHEN 字段抽取完成 THEN THE System SHALL 验证必需字段（如时间、地点）是否被提取

### Requirement 8: Schema 匹配覆盖率

**User Story:** 作为系统开发者，我需要监控 Schema 匹配的覆盖率，以便确保大部分 CKB 都能匹配到合适的 Schema。

#### Acceptance Criteria

1. WHEN Schema 匹配完成 THEN THE System SHALL 记录匹配到 Schema 的 CKB 数量和未匹配的 CKB 数量
2. WHEN Schema 匹配完成 THEN THE System SHALL 计算 Schema 匹配率: 匹配 CKB 数 / 总 CKB 数
3. WHEN Schema 匹配率 < 70% THEN THE System SHALL 记录警告，建议增加或调整 Schema 定义
4. WHEN CKB 未匹配到任何 Schema THEN THE System SHALL 记录该 CKB 的字段信息，用于 Schema 优化
5. WHEN CKB 匹配到多个 Schema THEN THE System SHALL 记录所有匹配的 Schema 及其完整度评分
6. WHEN Schema 匹配完成 THEN THE System SHALL 统计每个 Schema 的触发次数和平均完整度
7. WHEN 某个 Schema 从未被触发 THEN THE System SHALL 标记为"未使用 Schema"，建议审查
8. WHEN Schema 匹配完成 THEN THE System SHALL 识别高频匹配的 Schema 和低频匹配的 Schema
9. WHEN 批量处理文档 THEN THE System SHALL 生成 Schema 匹配分析报告，包含匹配率趋势
10. WHEN Schema 定义更新 THEN THE System SHALL 支持重新匹配已处理的 CKB，对比匹配率变化

### Requirement 9: 实体构建完整性

**User Story:** 作为系统开发者，我需要确保实体构建的完整性，以便所有符合条件的 CKB 都能生成实体。

#### Acceptance Criteria

1. WHEN Schema 完整度 ≥ 阈值 THEN THE System SHALL 触发实体实例化，不应跳过任何符合条件的 CKB
2. WHEN 实体构建完成 THEN THE System SHALL 记录生成的实体数量和触发实体的 CKB 数量
3. WHEN 实体构建完成 THEN THE System SHALL 计算实体生成率: 生成实体的 CKB 数 / 总 CKB 数
4. WHEN 实体生成率异常低（< 20%） THEN THE System SHALL 记录警告，建议检查 Schema 阈值设置
5. WHEN 实体构建失败 THEN THE System SHALL 记录失败的 CKB ID 和失败原因
6. WHEN 实体构建完成 THEN THE System SHALL 验证每个实体都有至少一个支撑 CKB
7. WHEN 实体构建完成 THEN THE System SHALL 统计每种实体类型的数量分布
8. WHEN 批量处理文档 THEN THE System SHALL 生成实体构建分析报告，包含实体数量趋势
9. WHEN 实体构建完成 THEN THE System SHALL 识别孤立实体（无关系连接的实体）
10. WHEN 实体构建完成 THEN THE System SHALL 验证实体的属性完整性（核心字段是否都有值）

### Requirement 10: 关系抽取完整性

**User Story:** 作为系统开发者，我需要确保关系抽取的完整性，以便构建完整的知识图谱网络。

#### Acceptance Criteria

1. WHEN 实体构建完成 THEN THE System SHALL 为所有实体生成内建关系（基于 Schema 定义）
2. WHEN 关系抽取完成 THEN THE System SHALL 记录生成的关系数量（内建、共现、语义）
3. WHEN 关系抽取完成 THEN THE System SHALL 计算关系密度: 关系数 / 实体数
4. WHEN 关系密度异常低（< 0.5） THEN THE System SHALL 记录警告，建议检查关系抽取策略
5. WHEN 关系抽取完成 THEN THE System SHALL 验证每个实体至少有一个关系（入边或出边）
6. WHEN 关系抽取完成 THEN THE System SHALL 统计每种关系类型的数量分布
7. WHEN 语义关系抽取使用 LLM THEN THE System SHALL 记录 LLM 调用次数和成功率
8. WHEN 关系抽取完成 THEN THE System SHALL 识别孤立实体（无关系的实体）并记录
9. WHEN 批量处理文档 THEN THE System SHALL 生成关系抽取分析报告，包含关系数量趋势
10. WHEN 关系抽取完成 THEN THE System SHALL 验证关系的证据完整性（每个关系都有 evidence_ckb）


### Requirement 11: 端到端处理验证

**User Story:** 作为系统测试工程师，我需要进行端到端处理验证，以便确保从文档上传到知识图谱构建的整个流程都是完整的。

#### Acceptance Criteria

1. WHEN 上传测试文档 THEN THE System SHALL 完成从 CKB 解析到实体、关系构建的完整流程
2. WHEN 端到端处理完成 THEN THE System SHALL 生成完整性报告，包含每个阶段的覆盖率
3. WHEN 端到端处理完成 THEN THE System SHALL 验证文档中的所有有效内容都被转化为知识图谱节点或边
4. WHEN 端到端处理完成 THEN THE System SHALL 计算端到端覆盖率: 最终实体/关系数 / 预期数量
5. WHEN 端到端覆盖率 < 85% THEN THE System SHALL 标记处理不完整，提供详细的缺失分析
6. WHEN 端到端处理失败 THEN THE System SHALL 记录失败的阶段和原因，支持断点恢复
7. WHEN 端到端处理完成 THEN THE System SHALL 对比处理前后的文档内容和知识图谱，验证一致性
8. WHEN 端到端处理完成 THEN THE System SHALL 生成可视化报告，展示处理流程和覆盖率
9. WHEN 批量处理多个文档 THEN THE System SHALL 生成汇总的端到端处理报告
10. WHEN 端到端处理完成 THEN THE System SHALL 提供回溯功能，从知识图谱节点追溯到原始文档位置

### Requirement 12: 处理质量评估

**User Story:** 作为系统管理员，我需要评估文档处理的质量，以便持续优化处理策略和参数。

#### Acceptance Criteria

1. WHEN 文档处理完成 THEN THE System SHALL 计算处理质量评分，综合考虑覆盖率、准确性、完整性
2. WHEN 处理质量评分 < 80 分 THEN THE System SHALL 标记为低质量处理，建议人工审查
3. WHEN 处理质量评估完成 THEN THE System SHALL 识别质量问题的根因（解析错误、字段抽取失败、Schema 不匹配等）
4. WHEN 处理质量评估完成 THEN THE System SHALL 提供优化建议（调整阈值、增加 Schema、改进规则等）
5. WHEN 批量处理文档 THEN THE System SHALL 统计平均处理质量评分和质量分布
6. WHEN 处理质量评估完成 THEN THE System SHALL 对比不同文档类型的处理质量（Word vs PDF vs Excel）
7. WHEN 处理质量评估完成 THEN THE System SHALL 识别处理质量的时间趋势（是否在改善或恶化）
8. WHEN 处理质量评估完成 THEN THE System SHALL 生成质量报告，包含详细的指标和可视化图表
9. WHEN 处理质量评估完成 THEN THE System SHALL 支持按文档类型、时间范围、质量分数筛选
10. WHEN 处理质量评估完成 THEN THE System SHALL 提供质量对比功能，对比不同版本或配置的处理质量

### Requirement 13: 异常处理和恢复

**User Story:** 作为系统运维人员，我需要完善的异常处理和恢复机制，以便在处理失败时能够快速定位和修复问题。

#### Acceptance Criteria

1. WHEN 文档解析失败 THEN THE System SHALL 记录详细的错误信息（文件路径、错误类型、堆栈跟踪）
2. WHEN 处理流水线中断 THEN THE System SHALL 保存当前处理状态，支持从中断点恢复
3. WHEN 批量处理文档时部分失败 THEN THE System SHALL 继续处理其他文档，不中断整个批次
4. WHEN 处理失败 THEN THE System SHALL 提供重试机制，支持手动或自动重试
5. WHEN 处理失败次数 > 3 THEN THE System SHALL 标记为永久失败，通知管理员
6. WHEN 处理异常 THEN THE System SHALL 记录异常上下文（文档 ID、CKB ID、处理阶段）
7. WHEN 系统资源不足导致失败 THEN THE System SHALL 自动降级处理（减少并发、跳过 LLM 调用等）
8. WHEN 处理失败 THEN THE System SHALL 提供失败分析报告，统计失败类型和频率
9. WHEN 处理失败 THEN THE System SHALL 支持部分恢复（如仅重新处理失败的 CKB）
10. WHEN 处理异常频繁发生 THEN THE System SHALL 触发告警，建议系统维护

### Requirement 14: 性能优化和监控

**User Story:** 作为系统架构师，我需要优化文档处理性能，以便支持大规模文档处理。

#### Acceptance Criteria

1. WHEN 处理单个文档 THEN THE System SHALL 在合理时间内完成（< 1 分钟/MB）
2. WHEN 处理大文档（> 100MB） THEN THE System SHALL 采用流式处理，避免内存溢出
3. WHEN 批量处理文档 THEN THE System SHALL 支持并行处理，充分利用系统资源
4. WHEN 系统负载高 THEN THE System SHALL 自动限流，避免系统崩溃
5. WHEN 处理性能下降 THEN THE System SHALL 识别性能瓶颈（解析、字段抽取、LLM 调用等）
6. WHEN 处理完成 THEN THE System SHALL 记录性能指标（处理时间、内存使用、CPU 使用）
7. WHEN 批量处理文档 THEN THE System SHALL 提供性能统计报告（平均处理时间、吞吐量）
8. WHEN 性能监控 THEN THE System SHALL 支持实时查询当前处理速度和资源使用
9. WHEN 性能异常 THEN THE System SHALL 触发告警（如处理时间超过阈值）
10. WHEN 性能优化 THEN THE System SHALL 提供性能调优建议（如增加缓存、优化规则、减少 LLM 调用）

### Requirement 15: API 接口和集成

**User Story:** 作为前端开发者，我需要清晰的 API 接口，以便集成文档全处理功能到现有系统。

#### Acceptance Criteria

1. WHEN 前端请求文档处理状态 THEN THE System SHALL 提供 GET /api/documents/:id/processing-status 接口
2. WHEN 前端请求验证报告 THEN THE System SHALL 提供 GET /api/documents/:id/validation-report 接口
3. WHEN 前端请求覆盖率统计 THEN THE System SHALL 提供 GET /api/documents/:id/coverage 接口
4. WHEN 前端请求重新处理文档 THEN THE System SHALL 提供 POST /api/documents/:id/reprocess 接口
5. WHEN 前端请求批量处理状态 THEN THE System SHALL 提供 GET /api/batch-processing/:batchId/status 接口
6. WHEN 前端请求处理历史 THEN THE System SHALL 提供 GET /api/documents/:id/processing-history 接口
7. WHEN 前端请求质量评估 THEN THE System SHALL 提供 GET /api/documents/:id/quality-assessment 接口
8. WHEN API 调用失败 THEN THE System SHALL 返回标准错误格式，包含错误代码和详细信息
9. WHEN API 调用成功 THEN THE System SHALL 返回标准响应格式，包含数据和元数据
10. WHEN API 接口 THEN THE System SHALL 提供 OpenAPI 文档，描述所有接口和参数

