# Implementation Plan: Document Full Processing

## Overview

本实施计划描述了文档全处理系统的开发任务，该系统是对现有 schema-driven-knowledge-graph 系统的补充和增强。实施将分为 8 个阶段，每个阶段包含具体的开发任务和测试任务。

## Phase 1: 基础架构和数据模型 (Week 1)

- [x] 1. 项目结构搭建
  - [x] 1.1 创建 `kg/document_processor/` 目录结构
    - 创建所有子模块目录
    - _Requirements: 所有需求_
  
  - [x] 1.2 扩展 Prisma schema，添加文档处理相关表
    - 添加 DocumentStructure 表
    - 添加 ValidationReport 表
    - 添加 ProcessingMonitor 表
    - 添加 SegmentProcessing 表
    - 添加 Alert 表
    - 添加 FilterRule 表
    - _Requirements: 2.10, 4.1, 4.2, 5.5, 13.2_
  
  - [x] 1.3 运行数据库迁移
    - 执行 `npx prisma migrate dev`
    - 验证所有表创建成功
    - _Requirements: 2.10_
  
  - [x] 1.4 创建文档处理模块入口文件 `kg/document_processor/index.js`
    - 导出所有核心模块
    - _Requirements: 所有需求_

- [x] 2. 数据模型实现
  - [x] 2.1 实现 DocumentStructure 数据模型
    - 定义 StructuralUnit 接口
    - 定义 HierarchyTree 接口
    - _Requirements: 1.9, 1.10_
  
  - [x] 2.2 实现 ValidationReport 数据模型
    - 定义 ReportSummary 接口
    - 定义 SkippedContent 接口
    - 定义 LowQualityCKB 接口
    - 定义 MissingUnit 接口
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 2.3 实现 ProcessingMonitor 数据模型
    - 定义 ProcessingStage 接口
    - 定义 ProcessingProgress 接口
    - _Requirements: 4.1, 4.2, 4.3_


## Phase 2: 文档结构分析模块 (Week 2)

- [x] 3. Structure Analyzer 实现
  - [x] 3.1 实现 Word 文档结构分析 (`kg/document_processor/structure_analyzer.js`)
    - 使用 `mammoth` 或 `docx` 库提取段落、标题、列表项
    - 记录层级关系
    - 识别嵌套结构
    - _Requirements: 1.1, 1.9, 1.10_
  
  - [x] 3.2 实现 PDF 文档结构分析
    - 使用 `pdf-parse` 提取文本块、表格、图片区域
    - 识别段落边界
    - _Requirements: 1.2_
  
  - [x] 3.3 实现 Excel 文档结构分析
    - 使用 `xlsx` 库提取所有工作表和数据行
    - 识别表头
    - _Requirements: 1.3_
  
  - [x] 3.4 实现 Markdown 文档结构分析
    - 使用 `marked` 或 `remark` 解析段落、代码块、列表项
    - 保留层级结构
    - _Requirements: 1.4_
  
  - [x] 3.5 实现结构单元计数功能
    - 计算总结构单元数量
    - 排除空内容
    - _Requirements: 1.5_
  
  - [x] 3.6 实现层级树提取功能
    - 构建 HierarchyTree
    - 标记父子关系
    - _Requirements: 1.9_
  
  - [x]* 3.7 编写 Structure Analyzer 单元测试
    - 测试 Word 文档解析
    - 测试 PDF 文档解析
    - 测试 Excel 文档解析
    - 测试 Markdown 文档解析
    - 测试嵌套结构识别
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.9, 1.10_
  
  - [x]* 3.8 编写 Property 1 测试（文档结构单元完整识别）
    - **Property 1: 文档结构单元完整识别**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

## Phase 3: 内容过滤模块 (Week 3)

- [x] 4. Content Filter 实现
  - [x] 4.1 实现内容过滤主逻辑 (`kg/document_processor/content_filter.js`)
    - 实现 applyFilters 方法
    - 实现规则匹配逻辑
    - _Requirements: 3.1, 3.2_
  
  - [x] 4.2 实现预定义过滤规则
    - 页眉页脚过滤规则
    - 短内容标记规则
    - 纯标点符号过滤规则
    - 纯数字标记规则
    - 重复内容过滤规则
    - _Requirements: 1.8, 3.1, 3.3, 3.4, 3.5_
  
  - [x] 4.3 实现自定义过滤规则管理
    - 添加自定义规则
    - 删除自定义规则
    - 启用/禁用规则
    - _Requirements: 3.6, 3.7_
  
  - [x] 4.4 实现过滤统计功能
    - 记录过滤原因
    - 统计各规则的触发次数
    - _Requirements: 3.8_
  
  - [x] 4.5 实现重复内容检测
    - 使用 Set 记录已见内容
    - 识别重复内容
    - _Requirements: 3.5_
  
  - [x]* 4.6 编写 Content Filter 单元测试
    - 测试页眉页脚过滤
    - 测试短内容标记
    - 测试纯标点符号过滤
    - 测试重复内容检测
    - 测试自定义规则
    - _Requirements: 1.8, 3.1-3.9_
  
  - [x]* 4.7 编写 Property 5-8 测试
    - **Property 5: 内容过滤规则应用**
    - **Property 6: 短内容标记**
    - **Property 7: 低质量内容标记**
    - **Property 8: 重复内容识别**
    - **Validates: Requirements 3.1-3.5, 3.8**

## Phase 4: 完整性验证模块 (Week 4)

- [x] 5. Completeness Validator 实现
  - [x] 5.1 实现完整性验证主逻辑 (`kg/document_processor/completeness_validator.js`)
    - 实现 validate 方法
    - 实现覆盖率计算
    - 实现遗漏单元识别
    - _Requirements: 1.6, 2.1_
  
  - [x] 5.2 实现覆盖率计算功能
    - 实现 calculateCoverage 方法
    - 公式: (CKB_count + Skipped_count) / Total_structural_units
    - _Requirements: 1.6_
  
  - [x] 5.3 实现遗漏单元识别功能
    - 对比结构单元和 CKB
    - 识别未处理的单元
    - _Requirements: 2.1_
  
  - [x] 5.4 实现低质量 CKB 识别
    - 识别 source_confidence < 0.5 的 CKB
    - _Requirements: 2.3_
  
  - [x] 5.5 实现警告生成功能
    - 覆盖率 < 95% 生成警告
    - 低质量 CKB 生成警告
    - 遗漏单元生成警告
    - _Requirements: 1.7, 2.5_
  
  - [x]* 5.6 编写 Completeness Validator 单元测试
    - 测试覆盖率计算
    - 测试遗漏单元识别
    - 测试低质量 CKB 识别
    - 测试警告生成
    - _Requirements: 1.6, 1.7, 2.1, 2.3, 2.5_
  
  - [x]* 5.7 编写 Property 2-4, 9-10 测试
    - **Property 2: CKB 生成完整性**
    - **Property 3: 覆盖率计算正确性**
    - **Property 4: 覆盖率阈值触发**
    - **Property 9: 验证报告完整性**
    - **Property 10: 低质量 CKB 识别**
    - **Validates: Requirements 1.5-1.7, 2.1, 2.3, 2.5**

## Phase 5: 验证报告模块 (Week 5)

- [x] 6. Validation Reporter 实现
  - [x] 6.1 实现验证报告生成 (`kg/document_processor/validation_reporter.js`)
    - 实现 generateReport 方法
    - 生成报告摘要
    - 标记结构树节点
    - _Requirements: 2.1, 2.2, 2.4_
  
  - [x] 6.2 实现质量评分计算
    - 综合考虑覆盖率、低质量 CKB 率、遗漏率
    - 评分范围 0-100
    - _Requirements: 12.1_
  
  - [x] 6.3 实现优化建议生成
    - 根据验证结果生成建议
    - _Requirements: 12.4_
  
  - [x] 6.4 实现报告持久化
    - 保存到数据库
    - 支持按 report_id 查询
    - _Requirements: 2.10_
  
  - [x] 6.5 实现报告导出功能
    - 导出为 JSON 格式
    - 导出为 CSV 格式
    - _Requirements: 2.7_
  
  - [x] 6.6 实现历史报告查询
    - 按文档 ID 查询
    - 按时间范围查询
    - 支持对比
    - _Requirements: 2.10_
  
  - [x]* 6.7 编写 Validation Reporter 单元测试
    - 测试报告生成
    - 测试质量评分计算
    - 测试优化建议生成
    - 测试报告持久化
    - 测试报告导出
    - _Requirements: 2.1, 2.2, 2.4, 2.7, 2.10, 12.1, 12.4_
  
  - [x]* 6.8 编写 Property 11, 34-36 测试
    - **Property 11: 验证报告持久化**
    - **Property 34: 处理质量评分计算**
    - **Property 35: 低质量处理标记**
    - **Property 36: 质量问题根因识别**
    - **Validates: Requirements 2.10, 12.1-12.3**

## Phase 6: 处理流水线监控模块 (Week 6)

- [x] 7. Pipeline Monitor 实现
  - [x] 7.1 实现流水线监控主逻辑 (`kg/document_processor/pipeline_monitor.js`)
    - 实现 startMonitoring 方法
    - 实现 recordStage 方法
    - 实现 getProgress 方法
    - _Requirements: 4.1, 4.2, 4.4_
  
  - [x] 7.2 实现处理阶段记录
    - 记录开始时间
    - 记录结束时间
    - 计算处理时长
    - 记录元数据
    - _Requirements: 4.1, 4.2_
  
  - [x] 7.3 实现处理失败记录
    - 记录失败阶段
    - 记录错误信息
    - _Requirements: 4.3_
  
  - [x] 7.4 实现进度查询功能
    - 计算进度百分比
    - 估算剩余时间
    - _Requirements: 4.4, 4.6_
  
  - [x] 7.5 实现瓶颈识别功能
    - 识别最慢的阶段
    - 计算占比
    - 生成优化建议
    - _Requirements: 4.7_
  
  - [x] 7.6 实现超时检测
    - 检测处理时间超过阈值
    - 触发告警
    - _Requirements: 4.5_
  
  - [x] 7.7 实现监控数据导出
    - 导出为 JSON 格式
    - 导出为 CSV 格式
    - _Requirements: 4.10_
  
  - [x]* 7.8 编写 Pipeline Monitor 单元测试
    - 测试监控启动
    - 测试阶段记录
    - 测试进度查询
    - 测试瓶颈识别
    - 测试超时检测
    - _Requirements: 4.1-4.7, 4.10_
  
  - [x]* 7.9 编写 Property 12-14 测试
    - **Property 12: 处理流水线记录**
    - **Property 13: 处理超时告警**
    - **Property 14: 处理失败率监控**
    - **Validates: Requirements 4.1-4.3, 4.5, 4.9**

## Phase 7: 分段处理模块 (Week 7)

- [x] 8. Segmented Processor 实现
  - [x] 8.1 实现分段处理主逻辑 (`kg/document_processor/segmented_processor.js`)
    - 实现 shouldUseSegmentation 方法
    - 实现 segmentDocument 方法
    - 实现 processSegment 方法
    - 实现 mergeSegmentResults 方法
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [x] 8.2 实现分段触发条件判断
    - 文档大小 > 10MB
    - 结构单元数量 > 5000
    - _Requirements: 5.1, 5.2_
  
  - [x] 8.3 实现文档分段逻辑
    - 按固定大小分段（默认 1000 个单元）
    - 保持结构连续性
    - _Requirements: 5.3_
  
  - [x] 8.4 实现分段处理逻辑
    - 过滤内容
    - 生成 CKB
    - 验证完整性
    - 记录资源消耗
    - _Requirements: 5.6_
  
  - [x] 8.5 实现分段结果合并
    - 合并所有 CKB
    - 合并验证结果
    - 计算总覆盖率
    - _Requirements: 5.4, 5.10_
  
  - [x] 8.6 实现失败恢复机制
    - 保存失败状态
    - 支持从失败点恢复
    - _Requirements: 5.5_
  
  - [x] 8.7 实现并行处理
    - 配置并发数量
    - 批量处理分段
    - _Requirements: 5.9_
  
  - [x] 8.8 实现资源自适应调整
    - 监控系统资源
    - 动态调整分段大小
    - _Requirements: 5.7_
  
  - [x]* 8.9 编写 Segmented Processor 单元测试
    - 测试分段触发条件
    - 测试文档分段
    - 测试分段处理
    - 测试结果合并
    - 测试失败恢复
    - 测试并行处理
    - _Requirements: 5.1-5.10_
  
  - [x]* 8.10 编写 Property 15-21 测试
    - **Property 15: 分段处理触发条件**
    - **Property 16: 分段结构连续性**
    - **Property 17: 分段结果合并完整性**
    - **Property 18: 分段处理失败恢复**
    - **Property 19: 分段资源记录**
    - **Property 20: 资源不足自适应**
    - **Property 21: 跨分段实体关联**
    - **Validates: Requirements 5.1-5.10**

## Phase 8: 告警管理模块 (Week 8)

- [x] 9. Alert Manager 实现
  - [x] 9.1 实现告警管理主逻辑 (`kg/document_processor/alert_manager.js`)
    - 实现 trigger 方法
    - 实现 checkCoverageThreshold 方法
    - 实现 checkQualityThreshold 方法
    - 实现 checkFailureRate 方法
    - _Requirements: 1.7, 2.5, 4.5, 4.9, 12.2_
  
  - [x] 9.2 实现告警严重性判断
    - 根据告警类型和元数据确定严重性
    - _Requirements: 1.7, 2.5_
  
  - [x] 9.3 实现告警消息生成
    - 根据告警类型生成描述性消息
    - _Requirements: 1.7, 2.5, 4.5, 4.9_
  
  - [x] 9.4 实现告警通知发送
    - 发送邮件通知
    - 发送 Slack/钉钉通知
    - _Requirements: 2.5, 4.5, 4.9_
  
  - [x] 9.5 实现告警历史查询
    - 按类型筛选
    - 按严重性筛选
    - 按状态筛选
    - 按时间范围筛选
    - _Requirements: 2.5_
  
  - [x]* 9.6 编写 Alert Manager 单元测试
    - 测试告警触发
    - 测试严重性判断
    - 测试消息生成
    - 测试通知发送
    - 测试历史查询
    - _Requirements: 1.7, 2.5, 4.5, 4.9, 12.2_

## Phase 9: API 接口实现 (Week 9)

- [x] 10. Document Processing API 实现
  - [x] 10.1 实现 GET `/api/documents/:id/processing-status` 接口
    - 查询文档处理状态
    - 返回进度信息
    - _Requirements: 15.1_
  
  - [x] 10.2 实现 GET `/api/documents/:id/validation-report` 接口
    - 查询验证报告
    - 返回完整报告
    - _Requirements: 15.2_
  
  - [x] 10.3 实现 GET `/api/documents/:id/coverage` 接口
    - 查询覆盖率统计
    - 返回覆盖率指标
    - _Requirements: 15.3_
  
  - [x] 10.4 实现 POST `/api/documents/:id/reprocess` 接口
    - 重新处理文档
    - 支持强制重新处理
    - 支持仅重新处理指定分段
    - _Requirements: 15.4, 2.6_
  
  - [x] 10.5 实现 GET `/api/batch-processing/:batchId/status` 接口
    - 查询批量处理状态
    - 返回整体进度
    - _Requirements: 15.5_
  
  - [x] 10.6 实现 GET `/api/documents/:id/processing-history` 接口
    - 查询处理历史
    - 支持筛选
    - _Requirements: 15.6_
  
  - [x] 10.7 实现 GET `/api/documents/:id/quality-assessment` 接口
    - 查询质量评估
    - 返回质量评分和建议
    - _Requirements: 15.7_
  
  - [x]* 10.8 编写 API 集成测试
    - 测试所有 API 端点
    - 测试错误处理
    - 测试响应格式
    - _Requirements: 15.1-15.10_

## Phase 10: 系统集成和端到端测试 (Week 10)

- [x] 11. 系统集成
  - [x] 11.1 集成到现有 schema-driven-knowledge-graph 系统
    - 修改 `kg/index.js` 入口文件
    - 添加 processDocumentWithFullProcessing 函数
    - _Requirements: 所有需求_
  
  - [x] 11.2 集成到文档上传流程
    - 在文档上传后触发完整性验证
    - _Requirements: 所有需求_
  
  - [x] 11.3 集成到路由系统
    - 注册 documentProcessingRoutes
    - _Requirements: 15.1-15.10_
  
  - [x] 11.4 添加环境配置
    - 更新 .env.example
    - 添加文档处理相关配置
    - _Requirements: 所有需求_
  
  - [x]* 11.5 编写端到端测试
    - 测试完整的文档处理流程
    - 测试分段处理流程
    - 测试失败恢复流程
    - _Requirements: 11.1-11.10_
  
  - [ ]* 11.6 编写 Property 22-33, 37-40 测试
    - **Property 22-28**: 字段抽取和 Schema 匹配相关
    - **Property 29-31**: 实体和关系相关
    - **Property 32-33**: 端到端覆盖率和可追溯性
    - **Property 37-40**: 异常处理和性能相关
    - **Validates: Requirements 7.1-7.10, 8.1-8.10, 9.1-9.10, 10.1-10.10, 11.1-11.10, 13.1-13.10, 14.1-14.10**

## Phase 11: 测试完善和文档 (Week 11)

- [-] 12. 测试完善
  - [x] 12.1 确保单元测试覆盖率 ≥ 80%
    - 运行覆盖率报告
    - 补充缺失的测试
    - _Requirements: 所有需求_
  
  - [x] 12.2 确保所有 40 个属性测试通过
    - 验证所有属性测试实现
    - 确保每个测试至少 100 次迭代
    - _Requirements: 所有需求_
  
  - [x] 12.3 编写性能测试
    - 测试单文档处理时间
    - 测试大文档分段处理性能
    - 测试并发处理能力
    - _Requirements: 14.1-14.10_

- [x] 13. 文档编写
  - [x] 13.1 编写文档处理模块 README
    - 模块概述
    - 使用指南
    - API 文档
    - _Requirements: 所有需求_
  
  - [x] 13.2 编写部署指南
    - 环境配置
    - 数据库迁移
    - 系统启动检查
    - _Requirements: 所有需求_
  
  - [x] 13.3 更新项目主 README
    - 添加文档全处理功能说明
    - _Requirements: 所有需求_

## Notes

- 标记为 `*` 的任务是可选的测试任务，可以根据项目进度决定是否实施
- 每个任务都引用了具体的需求编号，确保可追溯性
- 属性测试必须配置为至少 100 次迭代
- 所有测试必须使用标签格式引用设计文档中的属性
