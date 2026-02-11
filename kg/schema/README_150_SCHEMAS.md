# 150 Schemas 使用指南

## 快速开始

### 1. 导入所有schemas

```bash
# 步骤1: 导入软件开发和AI科学schemas (100个)
node kg/schema/complete_150_schemas_full.js

# 步骤2: 导入摄影教程schemas (50个)  
node kg/schema/final_150_generator.js
```

### 2. 验证导入

```bash
# 查看schemas统计
node kg/schema/analyze_schemas.js

# 应该看到:
# - 软件开发schemas: 50个
# - 人工智能schemas: 50个
# - 摄影教程schemas: 50个
```

### 3. 测试

```bash
# 测试摄影课程文档处理
node kg/pipeline/process_photography_course.js

# 预期结果:
# ✅ 字段提取成功
# ✅ Schema匹配成功 (摄影相关schemas)
# ✅ Entity构建成功 (有anchor fields)
# ✅ Relation生成成功
```

## 文件说明

| 文件 | 说明 | Schemas数量 |
|------|------|-------------|
| `complete_150_schemas_full.js` | 软件开发+AI科学 | 100 |
| `all_150_schemas_data.js` | 摄影教程(紧凑格式) | 50 |
| `final_150_generator.js` | 统一导入脚本 | - |
| `generate_from_data.js` | 数据驱动生成器 | - |

## Schema列表

### 软件开发 (50个)

**代码与架构 (10个)**
- Code-Module, API-Endpoint, Database-Schema, Design-Pattern, Microservice
- Code-Library, Code-Function, Code-Class, Code-Interface, Architecture-Layer

**开发流程 (10个)**
- User-Story, Sprint, Code-Review, Git-Commit, Pull-Request
- Issue-Ticket, Release-Version, Technical-Debt, Refactoring-Task, Code-Metric

**测试与质量 (10个)**
- Unit-Test, Integration-Test, E2E-Test, Performance-Test, Load-Test
- Stress-Test, Security-Test, Bug-Report, Test-Coverage, Quality-Gate

**DevOps与部署 (10个)**
- CI-Pipeline, CD-Pipeline, Docker-Container, Kubernetes-Pod, Deployment-Config
- Environment-Variable, Server-Instance, Load-Balancer, Monitoring-Alert, Log-Entry

**文档与知识 (10个)**
- API-Documentation, Technical-Specification, Architecture-Decision, Code-Comment, README-File
- Changelog-Entry, Knowledge-Article, Tutorial-Guide, Best-Practice, Troubleshooting-Guide

### 人工智能科学 (50个)

**模型与架构 (10个)**
- ML-Model, Neural-Network, CNN-Architecture, RNN-Architecture, Transformer-Model
- GAN-Model, Autoencoder, Attention-Mechanism, Model-Layer, Activation-Function

**训练与优化 (10个)**
- Training-Dataset, Training-Hyperparameters, Optimizer-Config, Learning-Rate-Schedule, Loss-Function
- Regularization-Method, Data-Augmentation, Batch-Normalization, Dropout-Layer, Training-Epoch

**评估与指标 (10个)**
- Model-Evaluation, Accuracy-Metric, Precision-Recall, F1-Score, ROC-Curve
- Confusion-Matrix, Cross-Validation, Validation-Set, Test-Set, Benchmark-Result

**数据处理 (10个)**
- Data-Preprocessing, Feature-Engineering, Feature-Selection, Data-Normalization, Data-Cleaning
- Missing-Value-Handling, Outlier-Detection, Data-Splitting, Data-Sampling, Data-Labeling

**应用与部署 (10个)**
- Model-Deployment, Inference-Service, Model-Serving, Model-Monitoring, Model-Versioning
- A-B-Testing, Model-Performance, Prediction-Result, Model-Explainability, AI-Ethics

### 摄影教程 (50个)

**摄影技巧 (10个)**
- Photography-Technique, Composition-Rule, Lighting-Technique, Exposure-Triangle, Focus-Technique
- Depth-of-Field, Motion-Blur, Long-Exposure, HDR-Photography, Panorama-Shooting

**相机设置 (10个)**
- Camera-Settings, Aperture-Setting, Shutter-Speed-Setting, ISO-Setting, White-Balance-Setting
- Metering-Mode, Focus-Mode-Setting, Drive-Mode-Setting, Picture-Style, Custom-Function

**器材知识 (10个)**
- Camera-Body, Lens-Recommendation, Prime-Lens, Zoom-Lens, Wide-Angle-Lens
- Telephoto-Lens, Macro-Lens, Filter-Usage, Tripod-Selection, Flash-Equipment

**拍摄场景 (10个)**
- Portrait-Photography, Landscape-Photography, Street-Photography, Wildlife-Photography, Macro-Photography
- Night-Photography, Sports-Photography, Event-Photography, Product-Photography, Food-Photography

**后期处理 (10个)**
- Post-Processing-Workflow, Color-Grading, Exposure-Adjustment, Contrast-Enhancement, Sharpening-Technique
- Noise-Reduction, Cropping-Technique, Layer-Masking, Preset-Application, Export-Settings

## 使用示例

### 查询特定领域的schemas

```javascript
// 查询摄影schemas
const photoSchemas = await prisma.schema.findMany({
  where: {
    scene: { contains: '摄影' },
    active: true
  }
});

// 查询软件开发schemas
const devSchemas = await prisma.schema.findMany({
  where: {
    scene: { contains: '软件开发' },
    active: true
  }
});

// 查询AI schemas
const aiSchemas = await prisma.schema.findMany({
  where: {
    scene: { contains: '人工智能' },
    active: true
  }
});
```

### 查询特定类别的schemas

```javascript
// 查询摄影技巧schemas
const techniqueSchemas = await prisma.schema.findMany({
  where: {
    scene: '摄影教程/技巧',
    active: true
  }
});

// 查询测试相关schemas
const testSchemas = await prisma.schema.findMany({
  where: {
    scene: { contains: '测试' },
    active: true
  }
});
```

## 常见问题

### Q: 如何添加新的schema?

A: 在 `all_150_schemas_data.js` 中添加定义:
```javascript
{
  n: "New-Schema",
  s: "领域/分类",
  d: "描述",
  e: "示例",
  f: [
    {n: "FieldName", w: 0.4, r: true, a: true}
  ]
}
```

### Q: 如何禁用某个schema?

A: 使用Prisma更新:
```javascript
await prisma.schema.update({
  where: { name: 'Schema-Name' },
  data: { active: false }
});
```

### Q: 如何查看schema的详细信息?

A: 使用Prisma查询:
```javascript
const schema = await prisma.schema.findUnique({
  where: { name: 'Photography-Technique' }
});
console.log(JSON.parse(schema.coreFields));
```

### Q: 导入失败怎么办?

A: 检查:
1. Prisma连接是否正常
2. 数据库是否已迁移
3. 查看错误日志
4. 确认schema名称唯一

## 故障排查

### 导入时出现重复错误

```bash
# 清理已存在的schemas (谨慎!)
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.schema.deleteMany({
  where: { name: { startsWith: 'Photography-' } }
}).then(() => console.log('Cleaned')).finally(() => prisma.\$disconnect());
"
```

### 验证anchor字段配置

```bash
# 检查schemas的anchor字段
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.schema.findMany().then(schemas => {
  schemas.forEach(s => {
    const fields = JSON.parse(s.coreFields);
    const anchors = fields.filter(f => f.anchor);
    console.log(s.name, ':', anchors.length, 'anchor fields');
  });
}).finally(() => prisma.\$disconnect());
"
```

## 性能优化

### 批量导入

如果schemas很多,可以使用批量导入:
```javascript
await prisma.schema.createMany({
  data: schemas,
  skipDuplicates: true
});
```

### 索引优化

确保以下字段有索引:
- `name` (唯一索引)
- `scene` (普通索引)
- `active` (普通索引)

## 相关文档

- 完整实现: `IMPLEMENTATION_COMPLETE.md`
- 完成总结: `COMPLETION_SUMMARY.md`
- Schema模型: `SCHEMA_MODEL.md`
- Schema列表: `150_new_schemas_summary.md`
- 状态跟踪: `SCHEMA_IMPLEMENTATION_STATUS.md`

## 支持

如有问题,请查看:
1. `TROUBLESHOOTING.md` - 故障排查指南
2. `kg/TROUBLESHOOTING.md` - 系统故障排查
3. 相关测试文件中的示例

## 贡献

欢迎贡献新的schemas! 请遵循:
1. 使用紧凑格式定义
2. 配置anchor字段
3. 提供清晰的描述和示例
4. 添加到相应的领域分类

---

**版本**: 1.0.0  
**最后更新**: 2026-02-08  
**状态**: ✅ 完成
