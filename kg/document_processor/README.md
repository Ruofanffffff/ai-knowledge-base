# Document Full Processing System

## 概述

文档全处理系统是一个确保文档被完整拆解和处理的增强层，它包装了现有的 schema-driven-knowledge-graph 系统，提供完整性验证、覆盖率监控、质量评估和告警机制。

## 核心功能

### 1. 文档结构分析
- 支持 Word、PDF、Excel、Markdown 四种文档格式
- 识别所有结构单元（段落、标题、列表、表格行、代码块）
- 构建文档层级树
- 计算总结构单元数量

### 2. 内容过滤
- 5 个预定义过滤规则：页眉页脚、短内容、纯标点、纯数字、重复内容
- 支持自定义过滤规则
- 过滤统计和追溯
- 规则持久化

### 3. 完整性验证
- 覆盖率计算：(CKB_count + Skipped_count) / Total_structural_units
- 遗漏单元识别
- 低质量 CKB 识别（source_confidence < 0.5）
- 自动警告生成

### 4. 验证报告
- 详细的验证报告生成
- 质量评分计算（0-100分）
- 优化建议生成
- 报告持久化和历史查询
- JSON/CSV 格式导出

### 5. 流水线监控
- 9 个处理阶段的监控
- 处理时间和资源消耗记录
- 进度跟踪和 ETA 估算
- 瓶颈识别和优化建议
- 超时检测和告警

### 6. 分段处理
- 大文档自动分段（> 10MB 或 > 5000 单元）
- 并行处理（默认 3 个并发）
- 分段结果合并
- 失败恢复机制
- 资源自适应调整

### 7. 告警管理
- 5 种告警类型：低覆盖率、低质量、超时、高失败率、遗漏内容
- 4 个严重级别：info、warning、error、critical
- 告警历史和筛选
- 通知系统（可扩展）

## 使用方法

### 基本使用

```javascript
const { processDocumentWithFullProcessing } = require('./kg/document_processor');

// 处理文档
const result = await processDocumentWithFullProcessing(
  'doc_123',           // 文档 ID
  '/path/to/file.docx', // 文件路径
  'word'               // 文件类型
);

console.log('覆盖率:', result.validation_result.coverage_rate);
console.log('质量评分:', result.report.summary.quality_score);
console.log('CKB 数量:', result.ckbs.length);
```

### API 使用

```javascript
// 查询处理状态
GET /api/documents/:id/processing-status

// 查询验证报告
GET /api/documents/:id/validation-report

// 查询覆盖率
GET /api/documents/:id/coverage

// 重新处理文档
POST /api/documents/:id/reprocess
{
  "force": true,
  "segments_only": ["seg_1", "seg_2"]
}

// 查询批量处理状态
GET /api/batch-processing/:batchId/status

// 查询处理历史
GET /api/documents/:id/processing-history

// 查询质量评估
GET /api/documents/:id/quality-assessment
```

### 模块使用

```javascript
const {
  structureAnalyzer,
  contentFilter,
  completenessValidator,
  validationReporter,
  pipelineMonitor,
  segmentedProcessor,
  alertManager
} = require('./kg/document_processor');

// 1. 分析文档结构
const structure = await structureAnalyzer.analyzeDocument(
  'doc_123',
  '/path/to/file.docx',
  'word'
);

// 2. 过滤内容
const filterResult = contentFilter.applyFilters(structure.units);

// 3. 验证完整性
const validationResult = await completenessValidator.validate(
  'doc_123',
  structure,
  ckbs
);

// 4. 生成报告
const report = await validationReporter.generateReport(
  validationResult,
  structure
);

// 5. 检查告警
await alertManager.checkCoverageThreshold(
  validationResult.coverage_rate,
  'doc_123'
);
```

## 配置

在 `.env` 文件中配置：

```env
# 文档全处理系统配置
DOCUMENT_PROCESSING_ENABLED=true
COVERAGE_THRESHOLD_WARNING=0.95
COVERAGE_THRESHOLD_ERROR=0.90
QUALITY_SCORE_THRESHOLD=80
PROCESSING_TIMEOUT_MS=300000
SEGMENTATION_SIZE_THRESHOLD_MB=10
SEGMENTATION_UNIT_THRESHOLD=5000
SEGMENT_SIZE=1000
SEGMENT_CONCURRENCY=3
```

## 数据库表

系统使用 6 个数据库表：

1. **document_structures** - 文档结构分析结果
2. **validation_reports** - 验证报告
3. **processing_monitors** - 处理监控记录
4. **segment_processing** - 分段处理状态
5. **alerts** - 告警记录
6. **filter_rules** - 过滤规则

## 性能指标

- **覆盖率阈值**: 95% (警告), 90% (错误)
- **质量评分阈值**: 80 分
- **分段触发条件**: 文档 > 10MB 或 > 5000 单元
- **默认分段大小**: 1000 个单元
- **并发处理数**: 3 个分段
- **超时阈值**: 各阶段 30s - 5min

## 测试

运行测试：

```bash
# 运行所有测试
npm test

# 运行文档处理测试
npm test kg/document_processor

# 运行覆盖率测试
npm test -- --coverage
```

## 故障排查

### 覆盖率过低

1. 检查文档解析是否正确
2. 检查过滤规则是否过于严格
3. 查看验证报告中的遗漏单元
4. 检查 CKB 生成逻辑

### 处理超时

1. 检查文档大小，考虑启用分段处理
2. 查看瓶颈分析，优化慢速阶段
3. 增加超时阈值
4. 检查系统资源

### 质量评分低

1. 查看低质量 CKB 列表
2. 检查文档质量（OCR/ASR 准确性）
3. 调整 Schema 匹配阈值
4. 优化字段抽取规则

## 架构图

```
文档上传
    ↓
结构分析 (structure_analyzer)
    ↓
内容过滤 (content_filter)
    ↓
CKB 解析 (ckb_parser) ← 现有系统
    ↓
完整性验证 (completeness_validator)
    ↓
覆盖率计算 ≥ 95%?
    ↓ No
告警触发 (alert_manager)
    ↓
验证报告生成 (validation_reporter)
    ↓
持久化到数据库
    ↓
API 查询 / 可视化
```

## 贡献

欢迎贡献代码、报告问题或提出改进建议。

## 许可证

MIT
