# Design Document: Document Full Processing System

## Overview

本设计文档描述了文档全处理（Document Full Processing）系统的技术架构和实现方案。该系统是对现有 schema-driven-knowledge-graph 系统的补充和增强，核心目标是确保上传的文档被**完整拆解和处理**，不遗漏任何段落、句子或结构单元，从而保证知识图谱的完整性和覆盖率。

### 核心设计原则

1. **完整性优先**: 确保文档的每个结构单元都被识别和处理
2. **覆盖率监控**: 实时计算和监控文档处理的覆盖率指标
3. **可追溯性**: 记录所有跳过的内容及其原因
4. **质量保证**: 通过验证报告和告警机制确保处理质量
5. **性能优化**: 支持大文档的分段处理和并行处理
6. **可恢复性**: 支持处理失败后的断点恢复

### 系统架构

```
┌────────────────────────────────────────────────────────────┐
│              文档全处理监控层                                │
│     验证报告 · 覆盖率统计 · 告警机制 · 质量评估              │
└──────────────────────┬─────────────────────────────────────┘
                       │
┌──────────────────────┴─────────────────────────────────────┐
│              文档处理增强层                                  │
│   完整性验证 · 内容过滤 · 分段处理 · 流水线监控              │
└──────────────────────┬─────────────────────────────────────┘
                       │
┌──────────────────────┴─────────────────────────────────────┐
│         Schema-Driven Knowledge Graph 系统                  │
│     CKB 解析 · 字段抽取 · Schema 匹配 · 实体构建            │
└────────────────────────────────────────────────────────────┘
```

## Architecture

### 模块划分

系统分为以下核心模块:

1. **文档结构分析模块** (`kg/document_processor/structure_analyzer.js`)
   - 识别文档的所有结构单元（段落、标题、列表、表格等）
   - 计算文档的总结构单元数量
   - 保留文档的层级结构信息

2. **完整性验证模块** (`kg/document_processor/completeness_validator.js`)
   - 验证 CKB 生成的完整性
   - 计算覆盖率指标
   - 生成验证报告

3. **内容过滤模块** (`kg/document_processor/content_filter.js`)
   - 应用预定义的过滤规则
   - 识别和排除无意义内容（页眉、页脚、空白等）
   - 支持自定义过滤规则

4. **处理流水线监控模块** (`kg/document_processor/pipeline_monitor.js`)
   - 监控文档处理流水线的各个阶段
   - 记录处理时间和资源消耗
   - 识别性能瓶颈

5. **分段处理模块** (`kg/document_processor/segmented_processor.js`)
   - 处理超大文档的分段策略
   - 支持并行处理多个分段
   - 合并分段处理结果

6. **验证报告模块** (`kg/document_processor/validation_reporter.js`)
   - 生成详细的验证报告
   - 提供文档结构树视图
   - 支持报告导出和历史查询

7. **告警管理模块** (`kg/document_processor/alert_manager.js`)
   - 监控覆盖率和质量指标
   - 触发告警通知
   - 提供优化建议

8. **API 模块** (`routes/documentProcessingRoutes.js`)
   - 提供文档处理状态查询接口
   - 提供验证报告查询接口
   - 提供重新处理接口

### 数据流

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

## Components and Interfaces

### 1. Structure Analyzer

**职责**: 分析文档结构，识别所有结构单元

**接口**:
```typescript
interface StructureAnalyzer {
  analyzeDocument(docId: string, filePath: string, fileType: string): Promise<DocumentStructure>;
  countStructuralUnits(structure: DocumentStructure): number;
  extractHierarchy(structure: DocumentStructure): HierarchyTree;
}

interface DocumentStructure {
  doc_id: string;
  file_type: string;
  total_units: number;
  units: StructuralUnit[];
  hierarchy: HierarchyTree;
}

interface StructuralUnit {
  unit_id: string;
  type: 'paragraph' | 'heading' | 'list_item' | 'table_row' | 'code_block' | 'image';
  content: string;
  level: number;  // 层级深度
  parent_id: string | null;
  is_empty: boolean;
  should_filter: boolean;
  filter_reason: string | null;
}

interface HierarchyTree {
  root: HierarchyNode;
}

interface HierarchyNode {
  unit_id: string;
  type: string;
  children: HierarchyNode[];
  processed: boolean;
}
```

**实现策略**:

- **Word**: 使用 `mammoth` 或 `docx` 库提取所有段落、标题、列表项，记录层级关系
- **PDF**: 使用 `pdf-parse` 提取所有文本块、表格、图片区域
- **Excel**: 使用 `xlsx` 库提取所有工作表和数据行
- **Markdown**: 使用 `marked` 或 `remark` 解析所有段落、代码块、列表项

**输出示例**:
```json
{
  "doc_id": "doc_123",
  "file_type": "word",
  "total_units": 150,
  "units": [
    {
      "unit_id": "unit_001",
      "type": "heading",
      "content": "第一章 概述",
      "level": 1,
      "parent_id": null,
      "is_empty": false,
      "should_filter": false,
      "filter_reason": null
    },
    {
      "unit_id": "unit_002",
      "type": "paragraph",
      "content": "本文档描述了...",
      "level": 2,
      "parent_id": "unit_001",
      "is_empty": false,
      "should_filter": false,
      "filter_reason": null
    }
  ],
  "hierarchy": {
    "root": {
      "unit_id": "root",
      "type": "document",
      "children": [
        {
          "unit_id": "unit_001",
          "type": "heading",
          "children": [
            {
              "unit_id": "unit_002",
              "type": "paragraph",
              "children": [],
              "processed": true
            }
          ],
          "processed": true
        }
      ],
      "processed": true
    }
  }
}
```

### 2. Content Filter

**职责**: 应用过滤规则，排除无意义内容

**接口**:
```typescript
interface ContentFilter {
  applyFilters(units: StructuralUnit[]): FilterResult;
  addCustomRule(rule: FilterRule): void;
  removeCustomRule(ruleId: string): void;
  getFilterStats(): FilterStats;
}

interface FilterRule {
  rule_id: string;
  name: string;
  type: 'regex' | 'keyword' | 'length' | 'pattern';
  pattern: string | RegExp;
  action: 'skip' | 'mark_low_quality';
  reason: string;
  enabled: boolean;
}

interface FilterResult {
  filtered_units: StructuralUnit[];
  skipped_units: StructuralUnit[];
  stats: FilterStats;
}

interface FilterStats {
  total_units: number;
  filtered_units: number;
  skipped_by_rule: Record<string, number>;
}
```

**预定义过滤规则**:
```javascript
const DEFAULT_FILTER_RULES = [
  {
    rule_id: 'filter_header_footer',
    name: '页眉页脚过滤',
    type: 'pattern',
    pattern: /^(页眉|页脚|第\s*\d+\s*页)/,
    action: 'skip',
    reason: '页眉页脚内容',
    enabled: true
  },
  {
    rule_id: 'filter_short_content',
    name: '短内容标记',
    type: 'length',
    pattern: 10,  // 长度阈值
    action: 'mark_low_quality',
    reason: '内容过短（< 10 字符）',
    enabled: true
  },
  {
    rule_id: 'filter_punctuation_only',
    name: '纯标点符号过滤',
    type: 'regex',
    pattern: /^[\s\p{P}\p{S}]+$/u,
    action: 'skip',
    reason: '仅包含标点符号',
    enabled: true
  },
  {
    rule_id: 'filter_number_only',
    name: '纯数字标记',
    type: 'regex',
    pattern: /^\d+$/,
    action: 'mark_low_quality',
    reason: '仅包含数字',
    enabled: true
  },
  {
    rule_id: 'filter_duplicate',
    name: '重复内容过滤',
    type: 'pattern',
    pattern: 'duplicate_detection',  // 特殊标记
    action: 'skip',
    reason: '重复内容（如页眉页脚）',
    enabled: true
  }
];
```

**实现示例**:
```javascript
class ContentFilter {
  constructor() {
    this.rules = [...DEFAULT_FILTER_RULES];
    this.seenContent = new Set();
  }
  
  applyFilters(units) {
    const filtered = [];
    const skipped = [];
    const stats = {
      total_units: units.length,
      filtered_units: 0,
      skipped_by_rule: {}
    };
    
    for (const unit of units) {
      // 跳过空内容
      if (unit.is_empty) {
        unit.should_filter = true;
        unit.filter_reason = '空内容';
        skipped.push(unit);
        continue;
      }
      
      // 应用过滤规则
      let shouldSkip = false;
      for (const rule of this.rules) {
        if (!rule.enabled) continue;
        
        if (this.matchRule(unit, rule)) {
          unit.should_filter = true;
          unit.filter_reason = rule.reason;
          
          if (rule.action === 'skip') {
            shouldSkip = true;
            skipped.push(unit);
            stats.skipped_by_rule[rule.rule_id] = (stats.skipped_by_rule[rule.rule_id] || 0) + 1;
          }
          break;
        }
      }
      
      if (!shouldSkip) {
        filtered.push(unit);
        stats.filtered_units++;
      }
    }
    
    return { filtered_units: filtered, skipped_units: skipped, stats };
  }
  
  matchRule(unit, rule) {
    switch (rule.type) {
      case 'regex':
        return rule.pattern.test(unit.content);
      case 'keyword':
        return unit.content.includes(rule.pattern);
      case 'length':
        return unit.content.length < rule.pattern;
      case 'pattern':
        if (rule.pattern === 'duplicate_detection') {
          if (this.seenContent.has(unit.content)) {
            return true;
          }
          this.seenContent.add(unit.content);
          return false;
        }
        return rule.pattern.test(unit.content);
      default:
        return false;
    }
  }
}
```

### 3. Completeness Validator

**职责**: 验证 CKB 生成的完整性，计算覆盖率

**接口**:
```typescript
interface CompletenessValidator {
  validate(docId: string, structure: DocumentStructure, ckbs: CKB[]): Promise<ValidationResult>;
  calculateCoverage(totalUnits: number, ckbCount: number, skippedCount: number): number;
  identifyMissingUnits(structure: DocumentStructure, ckbs: CKB[]): StructuralUnit[];
}

interface ValidationResult {
  doc_id: string;
  total_structural_units: number;
  ckb_count: number;
  skipped_count: number;
  coverage_rate: number;
  missing_units: StructuralUnit[];
  low_quality_ckbs: CKB[];
  is_complete: boolean;
  warnings: string[];
}
```

**覆盖率计算公式**:
```
Coverage_Rate = (CKB_count + Skipped_count) / Total_structural_units

其中:
- CKB_count: 实际生成的 CKB 数量
- Skipped_count: 被过滤规则跳过的结构单元数量
- Total_structural_units: 文档的总结构单元数量

完整性判断:
- Coverage_Rate ≥ 95%: 完整
- 90% ≤ Coverage_Rate < 95%: 警告
- Coverage_Rate < 90%: 告警
```

**实现示例**:
```javascript
async function validate(docId, structure, ckbs) {
  // 1. 计算覆盖率
  const totalUnits = structure.total_units;
  const ckbCount = ckbs.length;
  const skippedCount = structure.units.filter(u => u.should_filter).length;
  const coverageRate = this.calculateCoverage(totalUnits, ckbCount, skippedCount);
  
  // 2. 识别遗漏的结构单元
  const missingUnits = this.identifyMissingUnits(structure, ckbs);
  
  // 3. 识别低质量 CKB
  const lowQualityCKBs = ckbs.filter(ckb => ckb.quality.source_confidence < 0.5);
  
  // 4. 生成警告
  const warnings = [];
  if (coverageRate < 0.95) {
    warnings.push(`覆盖率 ${(coverageRate * 100).toFixed(1)}% 低于 95%，可能存在遗漏内容`);
  }
  if (lowQualityCKBs.length > 0) {
    warnings.push(`发现 ${lowQualityCKBs.length} 个低质量 CKB（置信度 < 0.5）`);
  }
  if (missingUnits.length > 0) {
    warnings.push(`发现 ${missingUnits.length} 个未处理的结构单元`);
  }
  
  return {
    doc_id: docId,
    total_structural_units: totalUnits,
    ckb_count: ckbCount,
    skipped_count: skippedCount,
    coverage_rate: coverageRate,
    missing_units: missingUnits,
    low_quality_ckbs: lowQualityCKBs,
    is_complete: coverageRate >= 0.95 && missingUnits.length === 0,
    warnings
  };
}

calculateCoverage(totalUnits, ckbCount, skippedCount) {
  if (totalUnits === 0) return 1.0;
  return (ckbCount + skippedCount) / totalUnits;
}

identifyMissingUnits(structure, ckbs) {
  const ckbUnitIds = new Set(ckbs.map(ckb => ckb.source_meta.unit_id));
  return structure.units.filter(unit => 
    !unit.should_filter && 
    !unit.is_empty && 
    !ckbUnitIds.has(unit.unit_id)
  );
}
```


### 4. Validation Reporter

**职责**: 生成详细的验证报告

**接口**:
```typescript
interface ValidationReporter {
  generateReport(validationResult: ValidationResult, structure: DocumentStructure): Promise<ValidationReport>;
  saveReport(report: ValidationReport): Promise<string>;
  getReport(reportId: string): Promise<ValidationReport>;
  exportReport(reportId: string, format: 'json' | 'csv'): Promise<string>;
}

interface ValidationReport {
  report_id: string;
  doc_id: string;
  created_at: string;
  summary: ReportSummary;
  structure_tree: HierarchyTree;
  skipped_content: SkippedContent[];
  low_quality_ckbs: LowQualityCKB[];
  missing_units: MissingUnit[];
  recommendations: string[];
}

interface ReportSummary {
  total_structural_units: number;
  ckb_count: number;
  skipped_count: number;
  coverage_rate: number;
  is_complete: boolean;
  quality_score: number;
}

interface SkippedContent {
  unit_id: string;
  content: string;
  filter_reason: string;
  matched_rule: string;
}

interface LowQualityCKB {
  ckb_id: string;
  content: string;
  source_confidence: number;
  issues: string[];
}

interface MissingUnit {
  unit_id: string;
  type: string;
  content: string;
  level: number;
  parent_id: string | null;
}
```

**报告生成示例**:
```javascript
async function generateReport(validationResult, structure) {
  const reportId = generateUUID();
  
  // 1. 生成摘要
  const summary = {
    total_structural_units: validationResult.total_structural_units,
    ckb_count: validationResult.ckb_count,
    skipped_count: validationResult.skipped_count,
    coverage_rate: validationResult.coverage_rate,
    is_complete: validationResult.is_complete,
    quality_score: this.calculateQualityScore(validationResult)
  };
  
  // 2. 标记结构树中的已处理和未处理节点
  const structureTree = this.markProcessedNodes(
    structure.hierarchy,
    validationResult.missing_units
  );
  
  // 3. 整理跳过的内容
  const skippedContent = structure.units
    .filter(u => u.should_filter)
    .map(u => ({
      unit_id: u.unit_id,
      content: u.content.substring(0, 100),  // 截取前 100 字符
      filter_reason: u.filter_reason,
      matched_rule: u.matched_rule || 'unknown'
    }));
  
  // 4. 整理低质量 CKB
  const lowQualityCKBs = validationResult.low_quality_ckbs.map(ckb => ({
    ckb_id: ckb.ckb_id,
    content: ckb.content.text.substring(0, 100),
    source_confidence: ckb.quality.source_confidence,
    issues: this.identifyQualityIssues(ckb)
  }));
  
  // 5. 整理遗漏的结构单元
  const missingUnits = validationResult.missing_units.map(u => ({
    unit_id: u.unit_id,
    type: u.type,
    content: u.content.substring(0, 100),
    level: u.level,
    parent_id: u.parent_id
  }));
  
  // 6. 生成优化建议
  const recommendations = this.generateRecommendations(validationResult);
  
  const report = {
    report_id: reportId,
    doc_id: validationResult.doc_id,
    created_at: new Date().toISOString(),
    summary,
    structure_tree: structureTree,
    skipped_content: skippedContent,
    low_quality_ckbs: lowQualityCKBs,
    missing_units: missingUnits,
    recommendations
  };
  
  // 7. 持久化报告
  await this.saveReport(report);
  
  return report;
}

calculateQualityScore(validationResult) {
  let score = 100;
  
  // 覆盖率扣分
  if (validationResult.coverage_rate < 0.95) {
    score -= (0.95 - validationResult.coverage_rate) * 100;
  }
  
  // 低质量 CKB 扣分
  const lowQualityRate = validationResult.low_quality_ckbs.length / validationResult.ckb_count;
  score -= lowQualityRate * 20;
  
  // 遗漏内容扣分
  const missingRate = validationResult.missing_units.length / validationResult.total_structural_units;
  score -= missingRate * 30;
  
  return Math.max(0, Math.min(100, score));
}

generateRecommendations(validationResult) {
  const recommendations = [];
  
  if (validationResult.coverage_rate < 0.90) {
    recommendations.push('覆盖率过低，建议检查文档解析逻辑或调整过滤规则');
  }
  
  if (validationResult.low_quality_ckbs.length > validationResult.ckb_count * 0.1) {
    recommendations.push('低质量 CKB 比例过高，建议检查文档质量或 OCR/ASR 配置');
  }
  
  if (validationResult.missing_units.length > 0) {
    recommendations.push(`发现 ${validationResult.missing_units.length} 个未处理的结构单元，建议重新处理文档`);
  }
  
  return recommendations;
}
```

### 5. Pipeline Monitor

**职责**: 监控文档处理流水线

**接口**:
```typescript
interface PipelineMonitor {
  startMonitoring(docId: string): Promise<string>;
  recordStage(monitorId: string, stage: ProcessingStage, status: 'started' | 'completed' | 'failed', metadata?: any): Promise<void>;
  getProgress(monitorId: string): Promise<ProcessingProgress>;
  identifyBottleneck(monitorId: string): Promise<BottleneckAnalysis>;
  exportMonitoringData(monitorId: string, format: 'json' | 'csv'): Promise<string>;
}

interface ProcessingStage {
  stage_name: string;
  start_time: string;
  end_time: string | null;
  duration_ms: number | null;
  status: 'started' | 'completed' | 'failed';
  error_message: string | null;
  metadata: any;
}

interface ProcessingProgress {
  monitor_id: string;
  doc_id: string;
  current_stage: string;
  completed_stages: string[];
  total_stages: number;
  progress_percentage: number;
  estimated_remaining_time_ms: number | null;
}

interface BottleneckAnalysis {
  slowest_stage: string;
  duration_ms: number;
  percentage_of_total: number;
  recommendations: string[];
}
```

**实现示例**:
```javascript
class PipelineMonitor {
  async startMonitoring(docId) {
    const monitorId = generateUUID();
    
    await prisma.processingMonitor.create({
      data: {
        monitor_id: monitorId,
        doc_id: docId,
        start_time: new Date(),
        stages: []
      }
    });
    
    return monitorId;
  }
  
  async recordStage(monitorId, stage, status, metadata = {}) {
    const monitor = await prisma.processingMonitor.findUnique({
      where: { monitor_id: monitorId }
    });
    
    if (!monitor) {
      throw new Error(`Monitor ${monitorId} not found`);
    }
    
    const stages = monitor.stages || [];
    let stageRecord = stages.find(s => s.stage_name === stage);
    
    if (!stageRecord) {
      stageRecord = {
        stage_name: stage,
        start_time: new Date().toISOString(),
        end_time: null,
        duration_ms: null,
        status: 'started',
        error_message: null,
        metadata: {}
      };
      stages.push(stageRecord);
    }
    
    if (status === 'completed' || status === 'failed') {
      stageRecord.end_time = new Date().toISOString();
      stageRecord.duration_ms = new Date(stageRecord.end_time) - new Date(stageRecord.start_time);
      stageRecord.status = status;
      if (status === 'failed' && metadata.error) {
        stageRecord.error_message = metadata.error;
      }
    }
    
    stageRecord.metadata = { ...stageRecord.metadata, ...metadata };
    
    await prisma.processingMonitor.update({
      where: { monitor_id: monitorId },
      data: { stages }
    });
    
    // 检查是否超时
    if (stageRecord.duration_ms && stageRecord.duration_ms > 300000) {  // 5 分钟
      await alertManager.trigger('processing_timeout', {
        monitor_id: monitorId,
        stage: stage,
        duration_ms: stageRecord.duration_ms
      });
    }
  }
  
  async identifyBottleneck(monitorId) {
    const monitor = await prisma.processingMonitor.findUnique({
      where: { monitor_id: monitorId }
    });
    
    if (!monitor || !monitor.stages) {
      return null;
    }
    
    const completedStages = monitor.stages.filter(s => s.status === 'completed');
    if (completedStages.length === 0) {
      return null;
    }
    
    const slowestStage = completedStages.reduce((prev, current) => 
      (current.duration_ms > prev.duration_ms) ? current : prev
    );
    
    const totalDuration = completedStages.reduce((sum, s) => sum + s.duration_ms, 0);
    const percentage = (slowestStage.duration_ms / totalDuration) * 100;
    
    const recommendations = this.generateBottleneckRecommendations(slowestStage);
    
    return {
      slowest_stage: slowestStage.stage_name,
      duration_ms: slowestStage.duration_ms,
      percentage_of_total: percentage,
      recommendations
    };
  }
  
  generateBottleneckRecommendations(stage) {
    const recommendations = [];
    
    if (stage.stage_name === 'ckb_parsing') {
      recommendations.push('优化文档解析器性能');
      recommendations.push('考虑使用更快的解析库');
      recommendations.push('对大文档启用分段处理');
    } else if (stage.stage_name === 'field_extraction') {
      recommendations.push('优化字段抽取规则');
      recommendations.push('减少 LLM 调用频率');
      recommendations.push('增加字段抽取缓存');
    } else if (stage.stage_name === 'schema_matching') {
      recommendations.push('优化 Schema 匹配算法');
      recommendations.push('添加 Schema 索引');
      recommendations.push('并行计算完整度评分');
    }
    
    return recommendations;
  }
}
```


### 6. Segmented Processor

**职责**: 处理超大文档的分段策略

**接口**:
```typescript
interface SegmentedProcessor {
  shouldUseSegmentation(docSize: number, unitCount: number): boolean;
  segmentDocument(structure: DocumentStructure, segmentSize: number): DocumentSegment[];
  processSegment(segment: DocumentSegment): Promise<SegmentResult>;
  mergeSegmentResults(results: SegmentResult[]): Promise<MergedResult>;
  recoverFromFailure(segmentId: string): Promise<void>;
}

interface DocumentSegment {
  segment_id: string;
  doc_id: string;
  segment_index: number;
  total_segments: number;
  units: StructuralUnit[];
  start_unit_id: string;
  end_unit_id: string;
}

interface SegmentResult {
  segment_id: string;
  ckbs: CKB[];
  validation: ValidationResult;
  processing_time_ms: number;
  resource_usage: ResourceUsage;
}

interface ResourceUsage {
  memory_mb: number;
  cpu_percentage: number;
}

interface MergedResult {
  doc_id: string;
  total_ckbs: number;
  merged_validation: ValidationResult;
  total_processing_time_ms: number;
  segment_count: number;
}
```

**实现策略**:
```javascript
class SegmentedProcessor {
  shouldUseSegmentation(docSize, unitCount) {
    // 文档大小 > 10MB 或结构单元 > 5000 个
    return docSize > 10 * 1024 * 1024 || unitCount > 5000;
  }
  
  segmentDocument(structure, segmentSize = 1000) {
    const segments = [];
    const units = structure.units;
    
    for (let i = 0; i < units.length; i += segmentSize) {
      const segmentUnits = units.slice(i, Math.min(i + segmentSize, units.length));
      
      segments.push({
        segment_id: `${structure.doc_id}_seg_${segments.length}`,
        doc_id: structure.doc_id,
        segment_index: segments.length,
        total_segments: Math.ceil(units.length / segmentSize),
        units: segmentUnits,
        start_unit_id: segmentUnits[0].unit_id,
        end_unit_id: segmentUnits[segmentUnits.length - 1].unit_id
      });
    }
    
    return segments;
  }
  
  async processSegment(segment) {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    
    try {
      // 1. 过滤内容
      const filterResult = contentFilter.applyFilters(segment.units);
      
      // 2. 生成 CKB
      const ckbs = [];
      for (const unit of filterResult.filtered_units) {
        const ckb = await ckbParser.parseUnit(unit, segment.doc_id);
        ckbs.push(ckb);
      }
      
      // 3. 验证完整性
      const validation = await completenessValidator.validate(
        segment.doc_id,
        { units: segment.units, total_units: segment.units.length },
        ckbs
      );
      
      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      
      return {
        segment_id: segment.segment_id,
        ckbs,
        validation,
        processing_time_ms: endTime - startTime,
        resource_usage: {
          memory_mb: endMemory - startMemory,
          cpu_percentage: 0  // 需要额外监控
        }
      };
    } catch (error) {
      console.error(`Segment ${segment.segment_id} processing failed:`, error);
      
      // 保存失败状态，支持恢复
      await prisma.segmentProcessing.create({
        data: {
          segment_id: segment.segment_id,
          doc_id: segment.doc_id,
          status: 'failed',
          error_message: error.message,
          failed_at: new Date()
        }
      });
      
      throw error;
    }
  }
  
  async mergeSegmentResults(results) {
    // 1. 合并所有 CKB
    const allCKBs = results.flatMap(r => r.ckbs);
    
    // 2. 合并验证结果
    const totalUnits = results.reduce((sum, r) => sum + r.validation.total_structural_units, 0);
    const totalCKBCount = allCKBs.length;
    const totalSkipped = results.reduce((sum, r) => sum + r.validation.skipped_count, 0);
    const coverageRate = (totalCKBCount + totalSkipped) / totalUnits;
    
    const mergedValidation = {
      doc_id: results[0].validation.doc_id,
      total_structural_units: totalUnits,
      ckb_count: totalCKBCount,
      skipped_count: totalSkipped,
      coverage_rate: coverageRate,
      missing_units: results.flatMap(r => r.validation.missing_units),
      low_quality_ckbs: results.flatMap(r => r.validation.low_quality_ckbs),
      is_complete: coverageRate >= 0.95,
      warnings: []
    };
    
    if (coverageRate < 0.95) {
      mergedValidation.warnings.push(`覆盖率 ${(coverageRate * 100).toFixed(1)}% 低于 95%`);
    }
    
    // 3. 计算总处理时间
    const totalProcessingTime = results.reduce((sum, r) => sum + r.processing_time_ms, 0);
    
    return {
      doc_id: results[0].validation.doc_id,
      total_ckbs: totalCKBCount,
      merged_validation: mergedValidation,
      total_processing_time_ms: totalProcessingTime,
      segment_count: results.length
    };
  }
  
  async recoverFromFailure(segmentId) {
    const failedSegment = await prisma.segmentProcessing.findUnique({
      where: { segment_id: segmentId }
    });
    
    if (!failedSegment) {
      throw new Error(`Segment ${segmentId} not found`);
    }
    
    // 重新加载分段数据
    const segment = await this.loadSegment(segmentId);
    
    // 重新处理
    const result = await this.processSegment(segment);
    
    // 更新状态
    await prisma.segmentProcessing.update({
      where: { segment_id: segmentId },
      data: {
        status: 'completed',
        recovered_at: new Date()
      }
    });
    
    return result;
  }
  
  async processDocumentWithSegmentation(docId, structure) {
    // 1. 判断是否需要分段
    const docSize = await this.getDocumentSize(docId);
    if (!this.shouldUseSegmentation(docSize, structure.total_units)) {
      // 不需要分段，直接处理
      return await this.processNormally(docId, structure);
    }
    
    // 2. 分段
    const segments = this.segmentDocument(structure);
    console.log(`Document ${docId} segmented into ${segments.length} parts`);
    
    // 3. 并行处理分段（可配置并发数）
    const concurrency = 3;  // 同时处理 3 个分段
    const results = [];
    
    for (let i = 0; i < segments.length; i += concurrency) {
      const batch = segments.slice(i, Math.min(i + concurrency, segments.length));
      const batchResults = await Promise.all(
        batch.map(segment => this.processSegment(segment))
      );
      results.push(...batchResults);
      
      console.log(`Processed ${results.length}/${segments.length} segments`);
    }
    
    // 4. 合并结果
    const mergedResult = await this.mergeSegmentResults(results);
    
    // 5. 验证完整性
    if (mergedResult.merged_validation.coverage_rate < 0.95) {
      await alertManager.trigger('low_coverage', {
        doc_id: docId,
        coverage_rate: mergedResult.merged_validation.coverage_rate
      });
    }
    
    return mergedResult;
  }
}
```

### 7. Alert Manager

**职责**: 监控指标并触发告警

**接口**:
```typescript
interface AlertManager {
  trigger(alertType: string, metadata: any): Promise<void>;
  checkCoverageThreshold(coverageRate: number, docId: string): Promise<void>;
  checkQualityThreshold(qualityScore: number, docId: string): Promise<void>;
  checkFailureRate(failureRate: number): Promise<void>;
  getAlertHistory(filters?: AlertFilters): Promise<Alert[]>;
}

interface Alert {
  alert_id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  metadata: any;
  triggered_at: string;
  resolved_at: string | null;
  status: 'active' | 'resolved' | 'ignored';
}

interface AlertFilters {
  alert_type?: string;
  severity?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
}
```

**实现示例**:
```javascript
class AlertManager {
  async trigger(alertType, metadata) {
    const alert = {
      alert_id: generateUUID(),
      alert_type: alertType,
      severity: this.determineSeverity(alertType, metadata),
      message: this.generateMessage(alertType, metadata),
      metadata,
      triggered_at: new Date().toISOString(),
      resolved_at: null,
      status: 'active'
    };
    
    // 保存告警
    await prisma.alert.create({ data: alert });
    
    // 发送通知
    await this.sendNotification(alert);
    
    console.log(`Alert triggered: ${alert.alert_type} - ${alert.message}`);
  }
  
  determineSeverity(alertType, metadata) {
    if (alertType === 'low_coverage' && metadata.coverage_rate < 0.90) {
      return 'error';
    } else if (alertType === 'low_coverage') {
      return 'warning';
    } else if (alertType === 'processing_timeout') {
      return 'warning';
    } else if (alertType === 'high_failure_rate') {
      return 'critical';
    }
    return 'info';
  }
  
  generateMessage(alertType, metadata) {
    switch (alertType) {
      case 'low_coverage':
        return `文档 ${metadata.doc_id} 覆盖率 ${(metadata.coverage_rate * 100).toFixed(1)}% 低于阈值`;
      case 'processing_timeout':
        return `文档处理超时: ${metadata.monitor_id}, 阶段: ${metadata.stage}, 耗时: ${metadata.duration_ms}ms`;
      case 'high_failure_rate':
        return `处理失败率 ${(metadata.failure_rate * 100).toFixed(1)}% 超过 10%`;
      default:
        return `告警: ${alertType}`;
    }
  }
  
  async sendNotification(alert) {
    // 发送邮件、Slack、钉钉等通知
    // 这里简化处理
    if (alert.severity === 'critical' || alert.severity === 'error') {
      console.error(`[ALERT] ${alert.message}`);
      // await emailService.send(adminEmail, alert.message);
    }
  }
  
  async checkCoverageThreshold(coverageRate, docId) {
    if (coverageRate < 0.90) {
      await this.trigger('low_coverage', { doc_id: docId, coverage_rate: coverageRate });
    }
  }
  
  async checkQualityThreshold(qualityScore, docId) {
    if (qualityScore < 80) {
      await this.trigger('low_quality', { doc_id: docId, quality_score: qualityScore });
    }
  }
  
  async checkFailureRate(failureRate) {
    if (failureRate > 0.1) {
      await this.trigger('high_failure_rate', { failure_rate: failureRate });
    }
  }
}
```

## Data Models

### 数据库表设计

```prisma
// prisma/schema.prisma

// 文档结构分析表
model DocumentStructure {
  id              String   @id @default(uuid())
  docId           String   @map("doc_id")
  fileType        String   @map("file_type")
  totalUnits      Int      @map("total_units")
  units           Json     // StructuralUnit[]
  hierarchy       Json     // HierarchyTree
  createdAt       DateTime @default(now()) @map("created_at")
  
  @@map("document_structures")
}

// 验证报告表
model ValidationReport {
  id              String   @id @default(uuid())
  reportId        String   @unique @map("report_id")
  docId           String   @map("doc_id")
  summary         Json     // ReportSummary
  structureTree   Json     @map("structure_tree")
  skippedContent  Json     @map("skipped_content")
  lowQualityCkbs  Json     @map("low_quality_ckbs")
  missingUnits    Json     @map("missing_units")
  recommendations Json
  createdAt       DateTime @default(now()) @map("created_at")
  
  @@map("validation_reports")
}

// 处理监控表
model ProcessingMonitor {
  id              String   @id @default(uuid())
  monitorId       String   @unique @map("monitor_id")
  docId           String   @map("doc_id")
  startTime       DateTime @map("start_time")
  endTime         DateTime? @map("end_time")
  stages          Json     // ProcessingStage[]
  createdAt       DateTime @default(now()) @map("created_at")
  
  @@map("processing_monitors")
}

// 分段处理表
model SegmentProcessing {
  id              String   @id @default(uuid())
  segmentId       String   @unique @map("segment_id")
  docId           String   @map("doc_id")
  segmentIndex    Int      @map("segment_index")
  totalSegments   Int      @map("total_segments")
  status          String   // 'pending' | 'processing' | 'completed' | 'failed'
  errorMessage    String?  @map("error_message")
  failedAt        DateTime? @map("failed_at")
  recoveredAt     DateTime? @map("recovered_at")
  createdAt       DateTime @default(now()) @map("created_at")
  
  @@map("segment_processing")
}

// 告警表
model Alert {
  id              String   @id @default(uuid())
  alertId         String   @unique @map("alert_id")
  alertType       String   @map("alert_type")
  severity        String   // 'info' | 'warning' | 'error' | 'critical'
  message         String
  metadata        Json
  triggeredAt     DateTime @map("triggered_at")
  resolvedAt      DateTime? @map("resolved_at")
  status          String   // 'active' | 'resolved' | 'ignored'
  
  @@map("alerts")
}

// 过滤规则表
model FilterRule {
  id              String   @id @default(uuid())
  ruleId          String   @unique @map("rule_id")
  name            String
  type            String   // 'regex' | 'keyword' | 'length' | 'pattern'
  pattern         String
  action          String   // 'skip' | 'mark_low_quality'
  reason          String
  enabled         Boolean  @default(true)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  
  @@map("filter_rules")
}
```

## API Interfaces

### RESTful API 端点

```typescript
// GET /api/documents/:id/processing-status
// 查询文档处理状态
interface ProcessingStatusResponse {
  doc_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  current_stage: string | null;
  progress_percentage: number;
  estimated_remaining_time_ms: number | null;
  monitor_id: string;
}

// GET /api/documents/:id/validation-report
// 查询验证报告
interface ValidationReportResponse {
  report: ValidationReport;
}

// GET /api/documents/:id/coverage
// 查询覆盖率统计
interface CoverageResponse {
  doc_id: string;
  coverage_rate: number;
  total_structural_units: number;
  ckb_count: number;
  skipped_count: number;
  missing_count: number;
  is_complete: boolean;
}

// POST /api/documents/:id/reprocess
// 重新处理文档
interface ReprocessRequest {
  force: boolean;  // 是否强制重新处理
  segments_only?: string[];  // 仅重新处理指定分段
}

interface ReprocessResponse {
  doc_id: string;
  monitor_id: string;
  message: string;
}

// GET /api/batch-processing/:batchId/status
// 查询批量处理状态
interface BatchProcessingStatusResponse {
  batch_id: string;
  total_documents: number;
  completed_documents: number;
  failed_documents: number;
  progress_percentage: number;
  average_coverage_rate: number;
}

// GET /api/documents/:id/processing-history
// 查询处理历史
interface ProcessingHistoryResponse {
  doc_id: string;
  history: ProcessingRecord[];
}

interface ProcessingRecord {
  monitor_id: string;
  start_time: string;
  end_time: string;
  duration_ms: number;
  coverage_rate: number;
  status: string;
}

// GET /api/documents/:id/quality-assessment
// 查询质量评估
interface QualityAssessmentResponse {
  doc_id: string;
  quality_score: number;
  coverage_rate: number;
  low_quality_ckb_rate: number;
  missing_unit_rate: number;
  recommendations: string[];
}
```

## Performance Optimization

### 性能优化策略

1. **并行处理**:
   - 分段处理时并行处理多个分段
   - 字段抽取时并行处理多个 CKB
   - Schema 匹配时并行计算完整度评分

2. **缓存机制**:
   - 缓存文档结构分析结果
   - 缓存过滤规则匹配结果
   - 缓存验证报告

3. **增量更新**:
   - 仅重新处理变更的文档部分
   - 保留未变更部分的处理结果

4. **资源管理**:
   - 动态调整分段大小
   - 限制并发处理数量
   - 监控内存和 CPU 使用率

## Error Handling

### 错误处理策略

1. **文档解析错误**:
   - 记录错误详情
   - 标记为失败状态
   - 提供重新处理选项

2. **分段处理失败**:
   - 保存失败状态
   - 支持从失败点恢复
   - 不影响其他分段的处理

3. **覆盖率过低**:
   - 触发告警
   - 生成详细的验证报告
   - 提供优化建议

4. **系统资源不足**:
   - 自动调整分段大小
   - 降低并发处理数量
   - 触发告警通知管理员


## Correctness Properties

属性（Property）是一个特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的形式化陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。

### Property 1: 文档结构单元完整识别

*For any* 文档，解析后识别的结构单元数量应该等于文档中实际存在的非空结构单元数量（排除应被过滤的内容）。

**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

### Property 2: CKB 生成完整性

*For any* 文档，生成的 CKB 数量加上被过滤的结构单元数量应该等于总结构单元数量。

**Validates: Requirements 1.5, 1.6**

### Property 3: 覆盖率计算正确性

*For any* 文档，覆盖率应该等于 (CKB_count + Skipped_count) / Total_structural_units，且结果应该在 0 到 1 之间。

**Validates: Requirements 1.6**

### Property 4: 覆盖率阈值触发

*For any* 文档，当覆盖率 < 95% 时，系统应该记录警告日志；当覆盖率 < 90% 时，系统应该触发告警。

**Validates: Requirements 1.7, 2.5**

### Property 5: 内容过滤规则应用

*For any* 结构单元，如果匹配任何启用的过滤规则，则应该被标记为 should_filter = true，并记录 filter_reason。

**Validates: Requirements 3.1, 3.2, 3.8**

### Property 6: 短内容标记

*For any* 结构单元，如果内容长度 < 10 字符，则应该被标记为可能的空白内容（但不自动跳过）。

**Validates: Requirements 3.3**

### Property 7: 低质量内容标记

*For any* 结构单元，如果内容仅包含标点符号或数字，则应该被标记为低质量内容。

**Validates: Requirements 3.4**

### Property 8: 重复内容识别

*For any* 文档，如果内容重复出现（如页眉页脚），系统应该识别并仅保留第一次出现，后续出现应被过滤。

**Validates: Requirements 3.5**

### Property 9: 验证报告完整性

*For any* 文档处理完成后，验证报告应该包含总结构单元数、CKB 数量、覆盖率、跳过的内容列表、低质量 CKB 列表、遗漏的结构单元列表。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

### Property 10: 低质量 CKB 识别

*For any* CKB，如果 source_confidence < 0.5，则应该在验证报告中被标记为低质量 CKB。

**Validates: Requirements 2.3**

### Property 11: 验证报告持久化

*For any* 生成的验证报告，应该被持久化到数据库，并且可以通过 report_id 查询到。

**Validates: Requirements 2.10**

### Property 12: 处理流水线记录

*For any* 文档进入处理流水线，系统应该记录处理开始时间、文档元数据、各阶段的处理时间和状态。

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 13: 处理超时告警

*For any* 文档处理阶段，如果处理时间超过预期阈值（如 5 分钟），系统应该发出告警。

**Validates: Requirements 4.5**

### Property 14: 处理失败率监控

*For any* 批量处理，如果处理失败率 > 10%，系统应该触发告警。

**Validates: Requirements 4.9**

### Property 15: 分段处理触发条件

*For any* 文档，如果文档大小 > 10MB 或结构单元数量 > 5000，系统应该采用分段处理策略。

**Validates: Requirements 5.1, 5.2**

### Property 16: 分段结构连续性

*For any* 分段处理的文档，所有分段的结构单元应该保持原文档的层级结构和顺序。

**Validates: Requirements 5.3**

### Property 17: 分段结果合并完整性

*For any* 分段处理完成后，合并后的 CKB 总数应该等于所有分段的 CKB 数量之和。

**Validates: Requirements 5.4, 5.10**

### Property 18: 分段处理失败恢复

*For any* 分段处理失败，系统应该保存失败状态，并支持从失败点恢复，而不需要重新处理整个文档。

**Validates: Requirements 5.5**

### Property 19: 分段资源记录

*For any* 分段处理，系统应该记录每个分段的处理时间和资源消耗（内存、CPU）。

**Validates: Requirements 5.6**

### Property 20: 资源不足自适应

*For any* 系统资源不足的情况，系统应该自动调整分段大小（减少每批处理的单元数）。

**Validates: Requirements 5.7**

### Property 21: 跨分段实体关联

*For any* 分段处理的文档，跨分段的实体和关系应该能够正确关联（通过 doc_id 和 unit_id）。

**Validates: Requirements 5.8**

### Property 22: 字段抽取完整性

*For any* CKB，字段抽取器应该尝试提取所有预定义的字段类型，并记录提取到的字段数量和类型分布。

**Validates: Requirements 7.1, 7.3**

### Property 23: 字段抽取率计算

*For any* CKB，字段抽取率应该等于 实际提取字段数 / 预期字段数，且结果应该在 0 到 1 之间。

**Validates: Requirements 7.7**

### Property 24: 字段抽取率阈值

*For any* CKB，如果字段抽取率 < 80%，系统应该记录警告，标记可能的抽取问题。

**Validates: Requirements 7.8**

### Property 25: Schema 匹配率计算

*For any* 批量处理，Schema 匹配率应该等于 匹配 CKB 数 / 总 CKB 数，且结果应该在 0 到 1 之间。

**Validates: Requirements 8.2**

### Property 26: Schema 匹配率阈值

*For any* 批量处理，如果 Schema 匹配率 < 70%，系统应该记录警告，建议增加或调整 Schema 定义。

**Validates: Requirements 8.3**

### Property 27: 实体生成率计算

*For any* 批量处理，实体生成率应该等于 生成实体的 CKB 数 / 总 CKB 数，且结果应该在 0 到 1 之间。

**Validates: Requirements 9.3**

### Property 28: 实体生成率阈值

*For any* 批量处理，如果实体生成率异常低（< 20%），系统应该记录警告，建议检查 Schema 阈值设置。

**Validates: Requirements 9.4**

### Property 29: 实体-CKB 双向关联

*For any* 实体，所有 supported_by 中的 CKB ID 应该存在于 CKB 表中，并且查询这些 CKB 应该返回对该实体的引用。

**Validates: Requirements 9.6**

### Property 30: 关系密度计算

*For any* 批量处理，关系密度应该等于 关系数 / 实体数，如果关系密度异常低（< 0.5），系统应该记录警告。

**Validates: Requirements 10.3, 10.4**

### Property 31: 孤立实体识别

*For any* 实体，如果没有任何关系（入边或出边），系统应该在关系抽取完成后识别并记录为孤立实体。

**Validates: Requirements 10.5, 10.8**

### Property 32: 端到端覆盖率计算

*For any* 文档，端到端覆盖率应该综合考虑 CKB 覆盖率、Schema 匹配率、实体生成率，如果端到端覆盖率 < 85%，系统应该标记处理不完整。

**Validates: Requirements 11.3, 11.4, 11.5**

### Property 33: 端到端可追溯性

*For any* 实体或关系，应该能够通过 supported_by 或 evidence_ckb 追溯到原始文档的具体位置（doc_id + unit_id）。

**Validates: Requirements 11.7, 11.10**

### Property 34: 处理质量评分计算

*For any* 文档，处理质量评分应该综合考虑覆盖率、准确性、完整性，评分范围应该在 0 到 100 之间。

**Validates: Requirements 12.1**

### Property 35: 低质量处理标记

*For any* 文档，如果处理质量评分 < 80 分，系统应该标记为低质量处理，建议人工审查。

**Validates: Requirements 12.2**

### Property 36: 质量问题根因识别

*For any* 低质量处理，系统应该识别质量问题的根因（解析错误、字段抽取失败、Schema 不匹配等）。

**Validates: Requirements 12.3**

### Property 37: 异常处理记录

*For any* 处理异常，系统应该记录详细的错误信息（文件路径、错误类型、堆栈跟踪）和异常上下文（文档 ID、CKB ID、处理阶段）。

**Validates: Requirements 13.1, 13.6**

### Property 38: 处理状态保存

*For any* 处理中断，系统应该保存当前处理状态，支持从中断点恢复。

**Validates: Requirements 13.2**

### Property 39: 批量处理隔离

*For any* 批量处理，部分文档失败不应该中断整个批次，系统应该继续处理其他文档。

**Validates: Requirements 13.3**

### Property 40: 性能指标记录

*For any* 文档处理，系统应该记录性能指标（处理时间、内存使用、CPU 使用），并在处理时间超过阈值时触发告警。

**Validates: Requirements 14.1, 14.6, 14.9**

## Testing Strategy

### 双重测试方法

本系统需要**单元测试**和**基于属性的测试**来实现全面覆盖：

- **单元测试**: 验证特定示例、边缘情况和错误条件
- **属性测试**: 通过随机化测试验证所有输入的通用属性

### 单元测试

单元测试应该关注：

1. **特定示例**
   - 解析包含 100 个段落的 Word 文档，验证生成 100 个 CKB
   - 解析包含页眉页脚的文档，验证页眉页脚被过滤
   - 计算覆盖率：总单元 100，CKB 90，跳过 10，验证覆盖率 = 100%

2. **边缘情况**
   - 空文档 → 无结构单元，覆盖率 = 100%
   - 仅包含空白段落的文档 → 所有单元被过滤
   - 超大文档（> 10MB）→ 触发分段处理

3. **错误条件**
   - 文档解析失败 → 记录错误，标记为失败状态
   - 分段处理失败 → 保存失败状态，支持恢复
   - 覆盖率 < 90% → 触发告警

4. **集成点**
   - 文档上传 → 结构分析 → CKB 解析 → 完整性验证 → 报告生成
   - 分段处理 → 并行处理 → 结果合并 → 完整性验证

### 基于属性的测试

属性测试应该配置为**每个测试最少 100 次迭代**。每个测试必须使用标签格式引用其设计文档属性：

```javascript
// Feature: document-full-processing, Property 1: 文档结构单元完整识别
```

**属性测试库**: 使用 `fast-check` (JavaScript/TypeScript)

**示例属性测试**:

1. **Property 3: 覆盖率计算正确性**
   ```javascript
   // Feature: document-full-processing, Property 3: 覆盖率计算正确性
   fc.assert(
     fc.property(
       fc.integer({ min: 0, max: 1000 }),  // total_units
       fc.integer({ min: 0, max: 1000 }),  // ckb_count
       fc.integer({ min: 0, max: 1000 }),  // skipped_count
       (totalUnits, ckbCount, skippedCount) => {
         // 确保 ckb_count + skipped_count <= total_units
         fc.pre(ckbCount + skippedCount <= totalUnits);
         
         const coverageRate = completenessValidator.calculateCoverage(
           totalUnits,
           ckbCount,
           skippedCount
         );
         
         expect(coverageRate).toBeGreaterThanOrEqual(0);
         expect(coverageRate).toBeLessThanOrEqual(1);
         
         if (totalUnits > 0) {
           const expectedRate = (ckbCount + skippedCount) / totalUnits;
           expect(coverageRate).toBeCloseTo(expectedRate, 5);
         } else {
           expect(coverageRate).toBe(1.0);
         }
       }
     ),
     { numRuns: 100 }
   );
   ```

2. **Property 5: 内容过滤规则应用**
   ```javascript
   // Feature: document-full-processing, Property 5: 内容过滤规则应用
   fc.assert(
     fc.property(
       fc.array(fc.record({
         unit_id: fc.uuid(),
         content: fc.string(),
         is_empty: fc.boolean()
       })),
       (units) => {
         const filterResult = contentFilter.applyFilters(units);
         
         // 验证所有被过滤的单元都有 filter_reason
         filterResult.skipped_units.forEach(unit => {
           expect(unit.should_filter).toBe(true);
           expect(unit.filter_reason).toBeDefined();
           expect(unit.filter_reason).not.toBe('');
         });
         
         // 验证未被过滤的单元 should_filter = false
         filterResult.filtered_units.forEach(unit => {
           expect(unit.should_filter).toBe(false);
         });
       }
     ),
     { numRuns: 100 }
   );
   ```

3. **Property 17: 分段结果合并完整性**
   ```javascript
   // Feature: document-full-processing, Property 17: 分段结果合并完整性
   fc.assert(
     fc.property(
       fc.array(fc.record({
         segment_id: fc.uuid(),
         ckbs: fc.array(fc.record({ ckb_id: fc.uuid() })),
         validation: fc.record({
           total_structural_units: fc.integer({ min: 0, max: 1000 }),
           ckb_count: fc.integer({ min: 0, max: 1000 }),
           skipped_count: fc.integer({ min: 0, max: 100 })
         })
       }), { minLength: 1 }),
       async (segmentResults) => {
         const mergedResult = await segmentedProcessor.mergeSegmentResults(segmentResults);
         
         // 验证 CKB 总数等于所有分段的 CKB 数量之和
         const expectedTotalCKBs = segmentResults.reduce(
           (sum, r) => sum + r.ckbs.length,
           0
         );
         expect(mergedResult.total_ckbs).toBe(expectedTotalCKBs);
         
         // 验证总结构单元数等于所有分段的总和
         const expectedTotalUnits = segmentResults.reduce(
           (sum, r) => sum + r.validation.total_structural_units,
           0
         );
         expect(mergedResult.merged_validation.total_structural_units).toBe(expectedTotalUnits);
       }
     ),
     { numRuns: 100 }
   );
   ```

### 测试覆盖率目标

- **单元测试覆盖率**: ≥ 80% 行覆盖率
- **属性测试覆盖率**: 所有 40 个正确性属性都已实现
- **集成测试覆盖率**: 所有 API 端点都已测试
- **性能测试覆盖率**: 所有性能需求（Req 14）都已验证

### 测试工具

- **单元测试**: Jest
- **基于属性的测试**: fast-check
- **API 测试**: Supertest
- **性能测试**: Artillery 或 k6
- **覆盖率**: Istanbul/nyc

### 持续集成

- 每次提交都运行所有测试
- 如果测试失败或覆盖率下降，阻止合并
- 生成覆盖率报告
- 跟踪属性测试失败率

## Integration with Existing System

### 与 schema-driven-knowledge-graph 系统的集成

文档全处理系统作为增强层，包装现有的 schema-driven-knowledge-graph 系统：

```javascript
// kg/index.js - 主入口文件

const { ckbParser } = require('./ckb/ckb_parser');
const { structureAnalyzer } = require('./document_processor/structure_analyzer');
const { contentFilter } = require('./document_processor/content_filter');
const { completenessValidator } = require('./document_processor/completeness_validator');
const { validationReporter } = require('./document_processor/validation_reporter');
const { pipelineMonitor } = require('./document_processor/pipeline_monitor');
const { segmentedProcessor } = require('./document_processor/segmented_processor');
const { alertManager } = require('./document_processor/alert_manager');

async function processDocumentWithFullProcessing(docId, filePath, fileType) {
  // 1. 启动监控
  const monitorId = await pipelineMonitor.startMonitoring(docId);
  
  try {
    // 2. 结构分析
    await pipelineMonitor.recordStage(monitorId, 'structure_analysis', 'started');
    const structure = await structureAnalyzer.analyzeDocument(docId, filePath, fileType);
    await pipelineMonitor.recordStage(monitorId, 'structure_analysis', 'completed', {
      total_units: structure.total_units
    });
    
    // 3. 内容过滤
    await pipelineMonitor.recordStage(monitorId, 'content_filtering', 'started');
    const filterResult = contentFilter.applyFilters(structure.units);
    await pipelineMonitor.recordStage(monitorId, 'content_filtering', 'completed', {
      filtered_units: filterResult.filtered_units.length,
      skipped_units: filterResult.skipped_units.length
    });
    
    // 4. CKB 解析（现有系统）
    await pipelineMonitor.recordStage(monitorId, 'ckb_parsing', 'started');
    const ckbs = await ckbParser.parseDocument(docId, filePath, fileType);
    await pipelineMonitor.recordStage(monitorId, 'ckb_parsing', 'completed', {
      ckb_count: ckbs.length
    });
    
    // 5. 完整性验证
    await pipelineMonitor.recordStage(monitorId, 'completeness_validation', 'started');
    const validationResult = await completenessValidator.validate(docId, structure, ckbs);
    await pipelineMonitor.recordStage(monitorId, 'completeness_validation', 'completed', {
      coverage_rate: validationResult.coverage_rate,
      is_complete: validationResult.is_complete
    });
    
    // 6. 生成验证报告
    await pipelineMonitor.recordStage(monitorId, 'report_generation', 'started');
    const report = await validationReporter.generateReport(validationResult, structure);
    await pipelineMonitor.recordStage(monitorId, 'report_generation', 'completed', {
      report_id: report.report_id
    });
    
    // 7. 检查告警条件
    await alertManager.checkCoverageThreshold(validationResult.coverage_rate, docId);
    await alertManager.checkQualityThreshold(report.summary.quality_score, docId);
    
    return {
      doc_id: docId,
      monitor_id: monitorId,
      ckbs,
      validation_result: validationResult,
      report
    };
  } catch (error) {
    await pipelineMonitor.recordStage(monitorId, 'error', 'failed', {
      error: error.message
    });
    throw error;
  }
}

module.exports = {
  processDocumentWithFullProcessing,
  structureAnalyzer,
  contentFilter,
  completenessValidator,
  validationReporter,
  pipelineMonitor,
  segmentedProcessor,
  alertManager
};
```

### API 路由集成

```javascript
// routes/documentProcessingRoutes.js

const express = require('express');
const router = express.Router();
const { processDocumentWithFullProcessing } = require('../kg');
const { validationReporter, pipelineMonitor, alertManager } = require('../kg');

// 查询文档处理状态
router.get('/documents/:id/processing-status', async (req, res) => {
  try {
    const { id } = req.params;
    const progress = await pipelineMonitor.getProgress(id);
    res.json({ success: true, data: progress });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 查询验证报告
router.get('/documents/:id/validation-report', async (req, res) => {
  try {
    const { id } = req.params;
    const report = await validationReporter.getReportByDocId(id);
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(404).json({ success: false, error: 'Report not found' });
  }
});

// 查询覆盖率统计
router.get('/documents/:id/coverage', async (req, res) => {
  try {
    const { id } = req.params;
    const report = await validationReporter.getReportByDocId(id);
    res.json({
      success: true,
      data: {
        doc_id: id,
        coverage_rate: report.summary.coverage_rate,
        total_structural_units: report.summary.total_structural_units,
        ckb_count: report.summary.ckb_count,
        skipped_count: report.summary.skipped_count,
        missing_count: report.missing_units.length,
        is_complete: report.summary.is_complete
      }
    });
  } catch (error) {
    res.status(404).json({ success: false, error: 'Coverage data not found' });
  }
});

// 重新处理文档
router.post('/documents/:id/reprocess', async (req, res) => {
  try {
    const { id } = req.params;
    const { force, segments_only } = req.body;
    
    // 获取文档信息
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    
    // 重新处理
    const result = await processDocumentWithFullProcessing(id, doc.filePath, doc.fileType);
    
    res.json({
      success: true,
      data: {
        doc_id: id,
        monitor_id: result.monitor_id,
        message: 'Document reprocessing started'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

## Deployment Considerations

### 环境配置

```env
# .env

# 文档全处理配置
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

### 数据库迁移

```bash
# 运行数据库迁移
npx prisma migrate dev --name add_document_processing_tables
```

### 系统启动检查

```javascript
// 系统启动时检查
async function initializeDocumentProcessing() {
  console.log('Initializing Document Full Processing System...');
  
  // 1. 检查数据库表
  await checkDatabaseTables();
  
  // 2. 加载默认过滤规则
  await contentFilter.loadDefaultRules();
  
  // 3. 检查未完成的处理任务
  await pipelineMonitor.checkPendingTasks();
  
  // 4. 恢复失败的分段处理
  await segmentedProcessor.recoverFailedSegments();
  
  console.log('Document Full Processing System initialized successfully');
}
```
