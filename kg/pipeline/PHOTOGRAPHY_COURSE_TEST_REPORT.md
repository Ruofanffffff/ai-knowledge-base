# 摄影课文档测试报告

## 测试时间
2025年2月3日

## 测试文档
- **文件**: `摄影课.md`
- **标题**: 摄影课 - 人物肖像拍摄技巧
- **长度**: 2,172 字符
- **类型**: 摄影教程文档

## 测试配置

### Pipeline配置
```javascript
{
  extraction: {
    useLLM: false,
    useNER: false,
    useRules: false,
    customExtractor: UniversalExtractor  // 使用Universal Extractor
  },
  schemaMatching: {
    useLLM: false,
    minConfidence: 0.3
  },
  normalization: {
    useLLM: false
  },
  entityBuilding: {
    useLLM: false
  },
  relationExtraction: {
    enableSemantic: false
  }
}
```

### Universal Extractor配置
```javascript
{
  maxFields: 150,
  minKeywordScore: 0.01,
  includeStructured: true,
  includeKeywords: true
}
```

## 测试结果

### 1. 性能指标 ⚡
- **总耗时**: 0.41秒
- **Token消耗**: 0（完全本地处理）
- **文档分类**: photography (置信度: 86.5%)
- **Schema预筛选**: 50/267 个候选Schema

### 2. 字段提取结果 📝
- **总字段数**: 60个
- **平均置信度**: 2452.9%（注：这个数值异常高，可能是计算方式问题）

#### 按提取方法分组
| 提取方法 | 数量 | 占比 |
|---------|------|------|
| keyword | 47 | 78.3% |
| structured | 8 | 13.3% |
| keyword_context | 5 | 8.3% |

#### 按值类型分组
| 值类型 | 数量 | 占比 |
|--------|------|------|
| keyword | 47 | 78.3% |
| mixed | 11 | 18.3% |
| text | 1 | 1.7% |
| number | 1 | 1.7% |

#### 提取的结构化字段示例
1. `[1] 焦距: 55 mm/`
2. `F 值: 1.8`
3. `[2] 焦距: 55 mm/`
4. `焦距: 200 mm/F 值：4.0/快门速度：1/400 秒`
5. `焦距: 35 mm/F 值：2/快门速度：1/400 秒`
6. `焦距: 50 mm/F 值：2/快门速度：1/250 秒`
7. `焦距: 55 mm/F 值：2.8/快门速度：1/640 秒`
8. `焦距: 85 mm/F 值：1.8/快门速度：1/1600 秒`

#### 提取的关键词字段示例（Top 20）
1. 拍摄
2. 焦距: 70 mm/F 值：4.0/快门速度：1/250 秒
3. 焦距: 55 mm/
4. 镜头: 专业全画幅相机用户的必备
5. mm
6. 照片
7. 快门速度: 1/250 秒
8. 快门速度: 1/400 秒
9. 虚化
10. 光线
11. 光圈
12. 定焦
13. 构图
14. 逆光
15. 人物
16. 相机
17. 三分法
18. 对象
19. 肖像
20. 画面

### 3. Schema匹配结果 🎯
- **匹配Schema总数**: 5个
- **达到阈值的Schema**: 2个

#### Top 5 Schema
| 排名 | Schema名称 | 完整度 | 映射字段 | 状态 |
|------|-----------|--------|----------|------|
| 1 | Symmetry | 100.0% | 1/1 | ✓ 达到阈值 |
| 2 | Focus-Mode | 60.0% | 1/2 | ✓ 达到阈值 |
| 3 | Shooting-Info | 55.0% | 12/5 | ○ 未达阈值 |
| 4 | PhotographyEntity | 0.0% | 0/7 | ○ 未达阈值 |
| 5 | 政府工作报告实体 | 0.0% | 0/6 | ○ 未达阈值 |

#### 摄影相关Schema
- **匹配数量**: 2个
- **详细列表**:
  1. Focus-Mode: 60.0% (1/2)
  2. Shooting-Info: 55.0% (12/5)

### 4. 实体构建结果 🏷️
- **实体总数**: 5个
- **问题**: 所有实体的schema_name都是undefined，字段数都是0

这表明实体构建过程存在问题，可能的原因：
1. 字段映射不完整
2. Schema字段覆盖率不足
3. 实体构建逻辑需要优化

### 5. 关系提取结果 🔗
- **关系总数**: 0个
- **原因**: 共现关系构建器报错（`cooccurrenceRelationBuilder.buildRelations is not a function`）

## 分析与发现

### ✅ 成功之处

1. **零Token消耗**: 完全本地处理，无需LLM调用
2. **快速处理**: 0.41秒完成整个流水线
3. **文档分类准确**: 正确识别为photography领域（86.5%置信度）
4. **字段提取有效**: 成功提取60个字段，包括：
   - 焦距、光圈、快门速度等摄影参数
   - 拍摄、镜头、相机等关键词
   - 虚化、构图、逆光等摄影术语

5. **结构化识别**: 成功识别8个结构化字段（key: value格式）

### ⚠️ 需要改进的地方

1. **置信度计算异常**: 平均置信度2452.9%明显不合理
   - 原因：可能是多次累加导致
   - 建议：检查置信度计算逻辑

2. **Schema匹配不理想**: 
   - Shooting-Info只有55%完整度（未达60%阈值）
   - 应该匹配更多摄影相关Schema（如Aperture-Usage, Lens-Choice等）
   - 原因：映射表可能缺少中文字段映射

3. **实体构建失败**: 
   - 所有实体的schema_name都是undefined
   - 字段数都是0
   - 需要检查实体构建逻辑

4. **关系提取失败**: 
   - 共现关系构建器报错
   - 需要修复`cooccurrenceRelationBuilder.buildRelations`函数

5. **字段提取质量**: 
   - 部分结构化字段格式不完整（如`[1] 焦距: 55 mm/`）
   - 需要改进结构化模式识别

## 文档内容分析

### 文档主题
摄影课文档主要讲解人物肖像拍摄技巧，包括：

1. **拍摄技巧**:
   - 使用长焦镜头
   - 开大光圈虚化背景
   - 三分法构图
   - 使用逆光
   - 垂直拍摄方向

2. **设备推荐**:
   - SEL35F18F (35mm f/1.8)
   - SEL50F18F (50mm f/1.8)
   - SEL55F18Z (55mm f/1.8)
   - SEL85F18 (85mm f/1.8)

3. **参数示例**:
   - 多个焦距/光圈/快门速度组合
   - A模式（光圈优先）
   - 曝光补偿

### 应该匹配的Schema

根据文档内容，理论上应该匹配以下Schema：

1. ✅ **Shooting-Info** (拍摄信息)
2. ✅ **Focus-Mode** (对焦模式)
3. ❌ **Aperture-Usage** (光圈使用) - 文档多次提到光圈
4. ❌ **Lens-Choice** (镜头选择) - 文档推荐了4款镜头
5. ❌ **Composition-Type** (构图类型) - 文档讲解三分法
6. ❌ **Portrait-Style** (人像风格) - 文档主题就是人像拍摄
7. ❌ **Exposure-Strategy** (曝光策略) - 文档提到曝光补偿
8. ❌ **Shutter-Usage** (快门使用) - 多个快门速度示例

## 改进建议

### 短期改进（立即可做）

1. **修复置信度计算**:
   ```javascript
   // 确保置信度在0-1范围内
   stats.avgConfidence = (totalConfidence / fields.length);  // 不要乘以100
   ```

2. **扩展映射表**:
   - 为Aperture-Usage添加"光圈"映射
   - 为Lens-Choice添加"镜头"映射
   - 为Composition-Type添加"构图"、"三分法"映射
   - 为Portrait-Style添加"肖像"、"人物"映射

3. **修复关系构建器**:
   ```javascript
   // 检查cooccurrenceRelationBuilder.buildRelations是否存在
   if (typeof cooccurrenceRelationBuilder.buildRelations === 'function') {
     // 调用函数
   }
   ```

4. **改进结构化模式**:
   - 优化正则表达式以更好地识别摄影参数格式
   - 处理`[1]`、`[2]`等标记

### 中期改进（需要一定工作量）

1. **优化实体构建**:
   - 检查为什么schema_name是undefined
   - 确保字段正确映射到实体
   - 提高字段覆盖率阈值的灵活性

2. **增强关键词提取**:
   - 改进TF-IDF算法
   - 添加摄影领域专用词典
   - 过滤更多无意义词

3. **支持复合字段**:
   - 识别"焦距：55 mm/F 值：1.8"这种复合格式
   - 拆分为多个独立字段

### 长期改进（需要重构）

1. **领域自适应**:
   - 根据文档领域动态调整提取策略
   - 摄影文档使用专门的摄影参数提取器

2. **智能Schema推荐**:
   - 基于文档内容智能推荐应该创建的Schema
   - 自动生成缺失的Schema

3. **可视化调试**:
   - 提供字段提取结果的可视化界面
   - 显示Schema匹配过程
   - 支持手动调整和反馈

## 结论

Universal Extractor在处理摄影课文档时表现出以下特点：

### 优势
- ✅ **零成本**: 完全本地处理，无Token消耗
- ✅ **高速**: 0.41秒完成处理
- ✅ **通用性**: 成功提取多种类型的字段
- ✅ **准确分类**: 正确识别文档领域

### 不足
- ❌ **Schema匹配不足**: 只匹配到2个摄影Schema
- ❌ **实体构建失败**: 所有实体都是空的
- ❌ **关系提取失败**: 共现关系构建器报错
- ❌ **置信度计算错误**: 数值异常

### 总体评价
Universal Extractor作为一个零Token消耗的本地提取方案，在字段提取方面表现良好，但在Schema匹配和实体构建方面还需要改进。通过扩展映射表和修复已知问题，可以显著提升整体效果。

### 推荐使用场景
- ✅ 需要快速提取结构化信息
- ✅ 预算有限，无法使用LLM
- ✅ 文档格式相对规范
- ❌ 需要深度语义理解
- ❌ 需要复杂的实体关系

## 附录：完整测试日志

测试脚本: `kg/pipeline/test_photography_course.js`

运行命令:
```bash
node kg/pipeline/test_photography_course.js
```

测试结果已保存在测试输出中。
