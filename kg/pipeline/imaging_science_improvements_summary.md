# 《影像科学PRD》知识图谱生成改进总结

## 当前状态 (2026-02-03)

### ✅ 已完成的工作

1. **扩展了映射表** (`kg/field_normalizer/schema_field_mappings.json`)
   - ✅ 添加了 PhotographyEntity 映射 (7个字段, 118个变体)
   - ✅ 添加了 PostProcessingEntity 映射 (3个字段, 43个变体)
   - ✅ 添加了 ProductDesignEntity 映射 (4个字段, 47个变体)
   - ✅ 扩展了 EITV 通用映射 (5个字段, 66个变体)

2. **创建了摄影相关Schema** (`kg/schema/photography_schemas.js`)
   - ✅ PhotographyEntity (相机、镜头、ISO、光圈、快门、曝光、对焦)
   - ✅ PostProcessingEntity (软件、风格、预设)
   - ✅ ProductDesignEntity (产品名称、版本、作者、状态)

3. **将Schema添加到数据库**
   - ✅ 运行 `add_photography_schemas.js` 成功添加3个Schema
   - ✅ 验证Schema已正确存储在数据库中

### 📊 测试结果分析

**测试文档**: 《影像科学PRD.md》

**文档分类结果**:
- 主要领域: photography (43.8%)
- 次要领域: post_processing (25.0%), government (18.8%)

**Schema预筛选**:
- 总Schema数: 267个
- 筛选后: 175个 (过滤掉92个不相关Schema)
- ✅ PhotographyEntity、PostProcessingEntity、ProductDesignEntity 都通过了预筛选

**Schema匹配结果**:
- ✅ EITV: 100% 完整度 (5/5字段映射成功)
- ❌ PhotographyEntity: 0% 完整度 (0/7字段映射失败)
- ❌ PostProcessingEntity: 未测试 (因EITV已达到高质量匹配阈值，提前终止)
- ❌ ProductDesignEntity: 未测试 (因EITV已达到高质量匹配阈值，提前终止)

**实体生成**:
- 1个实体: "摄影点评专家" (ResearchEntity, EITV Schema)
- 1个关系

### 🔍 问题诊断

#### 问题1: PhotographyEntity 为什么没有匹配？

**原因**: 文档中**没有实际的摄影设备信息**

- PhotographyEntity 期望的字段: Camera, Lens, ISO, Aperture, Shutter, Exposure, Focus
- 文档实际内容: 这是一个**产品需求文档(PRD)**，描述的是一个摄影分析产品，而不是摄影设备评测
- 文档中没有提到具体的相机型号、镜头规格、ISO值等信息

**结论**: PhotographyEntity Schema 设计正确，但不适用于此文档

#### 问题2: ProductDesignEntity 为什么没有匹配？

**原因**: 字段提取器提取的是**中文字段名**，但映射表中的变体不够全面

**提取的字段**:
```json
{
  "name": "项目名称",
  "value": "产品一句话定义： 影像科学（PhotoScience）...",
  "type": "entity"
}
```

**映射表中的变体** (部分):
```json
"ProductName": {
  "common_variations": [
    "产品名称", "产品", "产品名", "项目名称", "项目",
    "Product", "product", ...
  ]
}
```

**问题**: 
1. "项目名称" 在映射表中存在，但字段提取器将其标记为 `type: "entity"` 而不是 `type: "product_name"`
2. 映射表中缺少一些关键的中文变体，如 "版本号"、"状态"、"作者" 等

**解决方案**: 需要在映射表中添加更多中文变体

#### 问题3: 为什么只测试了前10个Schema？

**原因**: 性能优化 - 提前终止机制

- 系统发现 EITV 达到了高质量匹配阈值 (≥85%)
- 为了节省计算资源，系统在当前批次后停止了Schema匹配
- 这导致 ProductDesignEntity 没有被测试

**影响**: 
- 正面: 节省了计算资源和时间
- 负面: 可能错过了更合适的Schema

### 🎯 下一步改进方向

根据改进方案 (`kg/pipeline/imaging_science_prd_report.md`)，还需要实施以下改进:

#### 改进1: LLM兜底机制 (未实施)

**目标**: 当字段映射失败率 > 30% 时，LLM介入检查未映射字段

**需要修改的文件**:
- `kg/pipeline/universal_document_pipeline.js` - `_normalizeFields()` 方法
- `kg/field_normalizer/llm_mapper.js` - 添加兜底逻辑

**预期效果**: 提高字段映射成功率从 20% 到 60-70%

#### 改进2: 排序机制替代阈值 (未实施)

**目标**: 不使用硬阈值过滤Schema，而是排序后取Top-N

**需要修改的文件**:
- `kg/pipeline/universal_document_pipeline.js` - `_matchSchema()` 方法
- 创建 `kg/entity/llm_entity_selector.js` - LLM实体筛选器

**预期效果**: 
- 从只匹配1个Schema (EITV) 到候选5个Schema
- 生成2-3个实体 (LLM筛选后)

#### 改进3: 继续扩展映射表 (部分完成)

**已完成**:
- ✅ 添加了摄影、后期、产品设计的基础映射

**还需要**:
- ❌ 添加更多中文变体 (特别是产品设计领域)
- ❌ 添加更多领域的映射 (如旅游、体育、生活等)

### 📈 改进前后对比

| 指标 | 改进前 | 当前状态 | 目标 |
|------|--------|----------|------|
| 提取字段数 | 51 | 51 | 51 |
| 候选Schema数 | 264 | 175 (预筛选后) | 5 (Top-5) |
| 匹配Schema数 | 1 (EITV) | 1 (EITV) | 2-3 |
| 生成实体数 | 1 | 1 | 2-3 |
| 字段映射成功率 | ~20% | ~20% | 60-70% |
| 实体名称质量 | 中 | 中 | 高 (LLM优化) |

### 🔧 技术细节

#### 为什么EITV总是匹配成功？

EITV (Entity-Indicator-Time-Value) 是一个**通用Schema**，设计用于捕获任何实体的指标数据:

```javascript
{
  "Entity": "实体名称",      // 任何实体
  "Indicator": "指标名称",   // 任何指标
  "Time": "时间",           // 任何时间
  "Value": "数值",          // 任何数值
  "Unit": "单位"            // 任何单位
}
```

**优势**: 
- 适用范围广，几乎可以匹配任何包含实体、指标、时间、数值的文档
- 映射表变体丰富，容易达到100%完整度

**劣势**:
- 过于通用，无法捕获领域特定的语义信息
- 可能掩盖更合适的专业Schema

#### 字段提取器的工作原理

字段提取器使用三种策略:
1. **Rule-based**: 基于正则表达式和规则提取
2. **NER (Named Entity Recognition)**: 使用NLP模型识别实体
3. **LLM**: 使用大语言模型提取字段

**当前配置**:
- 优先使用 Rule + NER
- LLM作为补充 (50%概率)

**提取结果示例**:
```json
{
  "name": "项目名称",
  "value": "产品一句话定义： 影像科学（PhotoScience）...",
  "type": "entity",
  "confidence": 0.85
}
```

### 📝 建议

#### 短期建议 (立即可做)

1. **扩展ProductDesignEntity映射表**
   - 添加更多中文变体: "版本号"、"状态"、"作者"、"创建日期"等
   - 添加更多产品相关术语

2. **调整提前终止阈值**
   - 当前: 85% (过于激进)
   - 建议: 95% (只有非常确定时才提前终止)

3. **测试其他文档**
   - 测试真实的摄影设备评测文档 (验证PhotographyEntity)
   - 测试后期教程文档 (验证PostProcessingEntity)

#### 中期建议 (1-2周)

1. **实施LLM兜底机制**
   - 在字段映射失败率 > 30% 时触发
   - 使用LLM检查未映射字段

2. **实施排序机制**
   - 取消硬阈值过滤
   - 改为Top-5排序 + LLM筛选

3. **优化实体名称生成**
   - 添加质量检查
   - 低质量时强制LLM优化

#### 长期建议 (1个月+)

1. **建立Schema库管理系统**
   - 自动化Schema创建和更新
   - Schema版本管理
   - Schema质量评估

2. **优化字段提取器**
   - 训练领域特定的NER模型
   - 改进字段类型识别

3. **建立测试数据集**
   - 收集各领域的典型文档
   - 建立基准测试
   - 持续评估改进效果

## 总结

当前已完成的工作为后续改进奠定了基础:
- ✅ 映射表已扩展，支持摄影、后期、产品设计领域
- ✅ Schema已创建并添加到数据库
- ✅ 文档分类和预筛选机制工作正常

但核心改进 (LLM兜底、排序机制) 尚未实施，这是提升系统性能的关键。

**下一步行动**: 实施LLM兜底机制，提高字段映射成功率。
