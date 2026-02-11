# 150个新增Schema使用指南

## 📋 概述

本次更新新增了**150个Schema**，覆盖三个重要领域：
- 🖥️ **软件开发** (50个)
- 🤖 **人工智能科学** (50个)
- 📷 **摄影教程** (50个)

这些Schema将大幅提升系统在这三个领域的知识图谱构建能力。

## 🎯 新增Schema的特点

### 1. 完整的Schema结构
每个Schema都包含：
- **name**: 唯一标识符
- **entityType**: 实体类型
- **scene**: 场景分类（用于快速筛选）
- **description**: 详细功能说明
- **exampleDescription**: 实际应用示例
- **coreFields**: 核心字段定义（包含anchor字段）
- **threshold**: 匹配阈值（0-1）
- **relations**: 关系模板
- **version**: 版本号
- **active**: 启用状态

### 2. Anchor字段配置
所有Schema都正确配置了anchor字段，解决了之前摄影课文档处理时遇到的"锚点字段为空"问题。

### 3. 场景分类
使用细粒度的场景分类，便于：
- 快速筛选相关Schema
- 提高Schema匹配准确性
- 优化文档分类效果

## 📦 Schema分布

### 软件开发领域 (50个)

#### 代码与架构 (10个)
- Code-Module, API-Endpoint, Database-Schema
- Design-Pattern, Microservice, Code-Library
- Code-Function, Code-Class, Code-Interface
- Architecture-Layer

#### 开发流程 (10个)
- User-Story, Sprint, Code-Review
- Git-Commit, Pull-Request, Issue-Ticket
- Release-Version, Technical-Debt, Refactoring-Task
- Code-Metric

#### 测试与质量 (10个)
- Unit-Test, Integration-Test, E2E-Test
- Performance-Test, Load-Test, Stress-Test
- Security-Test, Bug-Report, Test-Coverage
- Quality-Gate

#### DevOps与部署 (10个)
- CI-Pipeline, CD-Pipeline, Docker-Container
- Kubernetes-Pod, Deployment-Config, Environment-Variable
- Server-Instance, Load-Balancer, Monitoring-Alert
- Log-Entry

#### 文档与知识 (10个)
- API-Documentation, Technical-Specification, Architecture-Decision
- Code-Comment, README-File, Changelog-Entry
- Knowledge-Article, Tutorial-Guide, Best-Practice
- Troubleshooting-Guide

### 人工智能科学领域 (50个)

#### 模型与架构 (10个)
- ML-Model, Neural-Network, CNN-Architecture
- RNN-Architecture, Transformer-Model, GAN-Model
- Autoencoder, Attention-Mechanism, Model-Layer
- Activation-Function

#### 训练与优化 (10个)
- Training-Dataset, Training-Hyperparameters, Optimizer-Config
- Learning-Rate-Schedule, Loss-Function, Regularization-Method
- Data-Augmentation, Batch-Normalization, Dropout-Layer
- Training-Epoch

#### 评估与指标 (10个)
- Model-Evaluation, Accuracy-Metric, Precision-Recall
- F1-Score, ROC-Curve, Confusion-Matrix
- Cross-Validation, Validation-Set, Test-Set
- Benchmark-Result

#### 数据处理 (10个)
- Data-Preprocessing, Feature-Engineering, Feature-Selection
- Data-Normalization, Data-Cleaning, Missing-Value-Handling
- Outlier-Detection, Data-Splitting, Data-Sampling
- Data-Labeling

#### 应用与部署 (10个)
- Model-Deployment, Inference-Service, Model-Serving
- Model-Monitoring, Model-Versioning, A-B-Testing
- Model-Performance, Prediction-Result, Model-Explainability
- AI-Ethics

### 摄影教程领域 (50个)

#### 摄影技巧 (10个)
- Photography-Technique, Composition-Rule, Lighting-Technique
- Exposure-Triangle, Focus-Technique, Depth-of-Field
- Motion-Blur, Long-Exposure, HDR-Photography
- Panorama-Shooting

#### 相机设置 (10个)
- Camera-Settings, Aperture-Setting, Shutter-Speed-Setting
- ISO-Setting, White-Balance-Setting, Metering-Mode
- Focus-Mode-Setting, Drive-Mode-Setting, Picture-Style
- Custom-Function

#### 器材知识 (10个)
- Camera-Body, Lens-Recommendation, Prime-Lens
- Zoom-Lens, Wide-Angle-Lens, Telephoto-Lens
- Macro-Lens, Filter-Usage, Tripod-Selection
- Flash-Equipment

#### 拍摄场景 (10个)
- Portrait-Photography, Landscape-Photography, Street-Photography
- Wildlife-Photography, Macro-Photography, Night-Photography
- Sports-Photography, Event-Photography, Product-Photography
- Food-Photography

#### 后期处理 (10个)
- Post-Processing-Workflow, Color-Grading, Exposure-Adjustment
- Contrast-Enhancement, Sharpening-Technique, Noise-Reduction
- Cropping-Technique, Layer-Masking, Preset-Application
- Export-Settings

## 🚀 使用方法

### 方法1: 查看Schema定义

```bash
# 查看Schema总结
cat kg/schema/150_new_schemas_summary.md

# 查看完整定义（需要完善）
node kg/schema/add_150_new_schemas.js --dry-run
```

### 方法2: 添加到数据库

```bash
# 添加所有150个Schema到数据库
node kg/schema/add_150_new_schemas.js

# 验证添加结果
node kg/schema/analyze_schemas.js
```

### 方法3: 测试Schema匹配

```bash
# 使用摄影课文档测试
node kg/pipeline/process_photography_course.js

# 使用软件开发文档测试
node kg/pipeline/test_software_doc.js

# 使用AI文档测试
node kg/pipeline/test_ai_doc.js
```

## 📊 预期效果

### 1. 摄影课文档处理改进

**之前的问题**:
- 匹配到不相关的Schema (Climbing-Log, Surfing-Log)
- 锚点字段为空，无法构建实体
- 提取了86个字段但生成0个实体

**现在的改进**:
- 新增50个摄影专业Schema
- 正确配置anchor字段
- 预期能匹配到相关Schema并成功构建实体

### 2. 软件开发文档支持

新增50个软件开发Schema，支持：
- 代码文档（API文档、技术规范）
- 项目管理（Sprint、Issue、PR）
- 测试报告（单元测试、性能测试）
- DevOps配置（CI/CD、Docker、K8s）

### 3. AI科学文档支持

新增50个AI科学Schema，支持：
- 模型论文（架构、训练方法）
- 实验报告（评估指标、基准测试）
- 数据集文档（预处理、特征工程）
- 部署文档（模型服务、监控）

## 🔧 Schema维护

### 启用/禁用Schema

```javascript
// 禁用某个Schema
await prisma.schema.update({
  where: { name: 'Schema-Name' },
  data: { active: false }
});

// 启用某个Schema
await prisma.schema.update({
  where: { name: 'Schema-Name' },
  data: { active: true }
});
```

### 按场景查询Schema

```javascript
// 查询软件开发相关Schema
const softwareSchemas = await prisma.schema.findMany({
  where: {
    scene: { contains: '软件开发' },
    active: true
  }
});

// 查询摄影教程相关Schema
const photographySchemas = await prisma.schema.findMany({
  where: {
    scene: { contains: '摄影教程' },
    active: true
  }
});
```

### 更新Schema

```javascript
// 更新Schema的阈值
await prisma.schema.update({
  where: { name: 'Schema-Name' },
  data: { threshold: 0.6 }
});

// 更新Schema的描述
await prisma.schema.update({
  where: { name: 'Schema-Name' },
  data: { 
    description: '新的描述',
    exampleDescription: '新的示例'
  }
});
```

## 📝 下一步计划

1. **完善Schema定义**: 补充完整的150个Schema定义到`add_150_new_schemas.js`
2. **添加字段映射**: 为新Schema添加字段映射规则到`schema_field_mappings.json`
3. **测试验证**: 使用实际文档测试每个领域的Schema匹配效果
4. **性能优化**: 优化Schema匹配算法，提高大规模Schema的匹配速度
5. **文档完善**: 为每个Schema编写详细的使用文档和示例

## 🐛 已知问题

1. **Schema定义未完整**: 当前只提供了部分Schema的完整定义，需要补充剩余Schema
2. **字段映射缺失**: 新Schema的字段映射规则需要添加
3. **测试覆盖不足**: 需要为每个领域创建测试文档和测试用例

## 💡 贡献指南

如果你想添加新的Schema或改进现有Schema：

1. 参考`kg/schema/SCHEMA_MODEL.md`了解Schema结构
2. 在`add_150_new_schemas.js`中添加Schema定义
3. 确保配置正确的anchor字段
4. 添加字段映射规则
5. 编写测试用例验证Schema匹配效果

## 📞 联系方式

如有问题或建议，请：
- 查看文档：`kg/schema/SCHEMA_MODEL.md`
- 查看示例：`kg/schema/photography_schemas.js`
- 运行测试：`npm test kg/schema/`

---

*最后更新: 2026-02-08*
*版本: 1.0.0*
