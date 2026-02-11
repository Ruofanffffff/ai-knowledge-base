# Requirements Document

## Introduction

本文档定义了LLM增强实体提取系统的需求。该系统旨在解决当前知识图谱生成流程中的语义信息缺失问题，通过结合算法提取和LLM语义理解，提升实体提取的完整性和准确性。系统将在保持现有数值参数提取100%准确率的基础上，增加语义概念、细粒度实体和语义关系的提取能力。

## Glossary

- **System**: LLM增强实体提取系统
- **Algorithm_Extractor**: 基于规则和模式的算法提取器，用于提取数值参数
- **LLM_Extractor**: 基于大语言模型的语义提取器，用于提取概念和关系
- **Entity**: 知识图谱中的实体节点，代表具体的对象或概念
- **Semantic_Concept**: 语义概念，如"人物肖像"、"三分法构图"等抽象概念
- **Fine_Grained_Entity**: 细粒度实体，为每个具体对象创建独立实体
- **Semantic_Relation**: 语义关系，如"适用于"、"推荐用于"等有明确语义的关系
- **Numerical_Parameter**: 数值参数，如焦距、光圈、快门速度等可量化的参数
- **Hybrid_Strategy**: 混合提取策略，结合算法提取和LLM提取的方法
- **Result_Fusion**: 结果融合，将多种提取方式的结果合并为统一输出

## Requirements

### Requirement 1: 语义概念提取

**User Story:** 作为知识图谱用户，我希望系统能够提取文档中的核心语义概念，以便理解文档的主题和关键技术。

#### Acceptance Criteria

1. WHEN 处理包含摄影技术的文档 THEN THE LLM_Extractor SHALL 识别并提取核心概念实体（如"人物肖像"、"风景摄影"、"微距摄影"）
2. WHEN 处理包含拍摄技巧的文档 THEN THE LLM_Extractor SHALL 提取技巧实体（如"三分法构图"、"逆光拍摄"、"长曝光"）
3. WHEN 处理包含使用场景的文档 THEN THE LLM_Extractor SHALL 提取场景实体（如"室内拍摄"、"户外拍摄"、"弱光环境"）
4. WHEN 提取的概念实体数量少于3个 THEN THE System SHALL 记录警告信息但继续处理
5. THE LLM_Extractor SHALL 为每个概念实体生成描述性文本

### Requirement 2: 细粒度实体生成

**User Story:** 作为知识图谱用户，我希望系统为每个具体对象创建独立实体，以便精确查询和分析。

#### Acceptance Criteria

1. WHEN 文档中提到具体的镜头型号 THEN THE System SHALL 为每个型号创建独立的镜头实体
2. WHEN 创建镜头实体 THEN THE Entity SHALL 包含型号、焦距、最大光圈、描述和适用场景字段
3. WHEN 文档中提到多个同类对象 THEN THE System SHALL 避免将它们聚合为单一实体
4. WHEN 提取的实体缺少必需字段 THEN THE System SHALL 使用空值标记缺失字段
5. THE System SHALL 为每个拍摄技巧创建独立实体并包含使用方法描述

### Requirement 3: 语义关系提取

**User Story:** 作为知识图谱用户，我希望系统能够提取有明确语义的关系，以便理解实体之间的关联。

#### Acceptance Criteria

1. WHEN 文档描述镜头的适用场景 THEN THE LLM_Extractor SHALL 创建"适用于"关系连接镜头和场景
2. WHEN 文档推荐特定用途的设备 THEN THE LLM_Extractor SHALL 创建"推荐用于"关系
3. WHEN 文档描述技巧的应用对象 THEN THE LLM_Extractor SHALL 创建"应用于"关系
4. WHEN 文档描述参数对效果的影响 THEN THE LLM_Extractor SHALL 创建"影响"关系
5. THE System SHALL 为每个关系记录置信度分数（0-1之间）
6. WHEN 关系置信度低于0.5 THEN THE System SHALL 标记该关系为低置信度

### Requirement 4: 混合提取策略

**User Story:** 作为系统架构师，我希望系统结合算法提取和LLM提取的优势，以便获得最佳的提取效果。

#### Acceptance Criteria

1. THE Algorithm_Extractor SHALL 负责提取所有数值参数（焦距、光圈、快门速度、ISO）
2. THE LLM_Extractor SHALL 负责提取语义概念、描述性文本和关系
3. WHEN 算法提取和LLM提取产生冲突的数值 THEN THE System SHALL 优先使用算法提取的结果
4. WHEN 合并提取结果 THEN THE Result_Fusion SHALL 保持算法提取的100%准确率
5. THE System SHALL 记录每个字段的提取来源（算法或LLM）

### Requirement 5: 性能和成本控制

**User Story:** 作为系统运维人员，我希望系统能够控制LLM调用成本和处理时间，以便保持系统的经济性和响应速度。

#### Acceptance Criteria

1. THE System SHALL 使用缓存机制避免重复的LLM调用
2. THE System SHALL 支持批处理以减少LLM调用次数
3. WHEN 处理单个文档 THEN THE System SHALL 在5秒内完成处理（包含LLM调用）
4. THE System SHALL 记录每次处理的token使用量和成本
5. WHEN token使用量超过预设阈值 THEN THE System SHALL 触发警告
6. THE System SHALL 支持配置LLM调用的超时时间

### Requirement 6: 多语言支持

**User Story:** 作为国际用户，我希望系统能够处理中英文文档，以便在不同语言环境下使用。

#### Acceptance Criteria

1. THE System SHALL 支持中文文档的实体提取
2. THE System SHALL 支持英文文档的实体提取
3. WHEN 文档包含中英文混合内容 THEN THE System SHALL 正确处理两种语言
4. THE System SHALL 为提取的实体保留原始语言
5. THE LLM_Extractor SHALL 使用与文档语言匹配的提示词

### Requirement 7: 结果验证和质量保证

**User Story:** 作为质量保证人员，我希望系统能够验证提取结果的质量，以便确保输出的可靠性。

#### Acceptance Criteria

1. WHEN 处理测试文档"摄影课2.md" THEN THE System SHALL 提取至少4个独立的镜头实体
2. WHEN 处理测试文档"摄影课2.md" THEN THE System SHALL 提取至少3个拍摄技巧实体
3. WHEN 处理测试文档"摄影课2.md" THEN THE System SHALL 生成至少10个语义关系
4. WHEN 处理测试文档"摄影课2.md" THEN THE System SHALL 为每个镜头实体提供完整的描述信息
5. THE System SHALL 计算并报告实体提取的完整性指标
6. THE System SHALL 提供提取结果的可视化验证界面

### Requirement 8: 错误处理和降级策略

**User Story:** 作为系统开发者，我希望系统能够优雅地处理错误情况，以便保持系统的稳定性。

#### Acceptance Criteria

1. WHEN LLM调用失败 THEN THE System SHALL 回退到仅使用算法提取
2. WHEN LLM返回格式错误的结果 THEN THE System SHALL 记录错误并使用默认值
3. WHEN 网络超时 THEN THE System SHALL 重试最多3次
4. IF 重试3次后仍然失败 THEN THE System SHALL 返回部分结果并标记错误
5. THE System SHALL 记录所有错误到日志文件
6. THE System SHALL 为每次处理生成状态报告（成功、部分成功、失败）

### Requirement 9: 可扩展性和配置

**User Story:** 作为系统管理员，我希望系统提供灵活的配置选项，以便适应不同的使用场景。

#### Acceptance Criteria

1. THE System SHALL 支持通过配置文件指定LLM模型
2. THE System SHALL 支持配置提取策略的优先级
3. THE System SHALL 支持配置置信度阈值
4. THE System SHALL 支持启用或禁用特定类型的实体提取
5. THE System SHALL 支持配置批处理的批次大小
6. WHEN 配置文件不存在 THEN THE System SHALL 使用默认配置值

### Requirement 10: 集成和兼容性

**User Story:** 作为系统集成人员，我希望新系统能够与现有的知识图谱流程无缝集成，以便平滑升级。

#### Acceptance Criteria

1. THE System SHALL 与现有的universal_document_pipeline兼容
2. THE System SHALL 输出符合现有实体和关系schema的结果
3. WHEN 集成到现有流程 THEN THE System SHALL 不破坏现有的算法提取功能
4. THE System SHALL 提供独立的API接口供外部调用
5. THE System SHALL 支持作为可选模块启用或禁用
6. THE System SHALL 提供迁移指南和示例代码
