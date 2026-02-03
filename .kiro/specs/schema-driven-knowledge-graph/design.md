# Design Document: Schema-Driven Knowledge Graph System

## Overview

本设计文档描述了基于 Schema 驱动的知识图谱系统的技术架构和实现方案。该系统是现有个人智能知识库项目的功能扩展,采用四层架构设计,通过规则优先、LLM 兜底的策略,实现 Token 消耗最小化(目标减少 90%)的知识图谱构建。

### 核心设计原则

1. **CKB 是唯一入口**: 所有实体和关系必须可追溯到 CKB(最小事实单元)
2. **Schema 驱动**: 实体由 Schema 完整度触发生成,而非直接从文本生成
3. **规则优先,LLM 兜底**: 最大化使用规则和统计方法,最小化 LLM 调用
4. **置信度驱动**: 自动过滤低质量数据,保证知识图谱可靠性
5. **增量更新**: 支持文档的增删改,自动更新知识图谱
6. **可追溯性**: 每个实体和关系都能回溯到源文档的具体位置

### 系统架构

```
┌────────────────────────────────────────────────────────────┐
│                    推理/应用层                              │
│         查询 · 推理 · 可视化 · Agent                        │
└──────────────────────┬─────────────────────────────────────┘
                       │
┌──────────────────────┴─────────────────────────────────────┐
│                  知识图谱层 (KG)                            │
│            Entity · Event · Relation                        │
└──────────────────────┬─────────────────────────────────────┘
                       │
┌──────────────────────┴─────────────────────────────────────┐
│               Schema & Rule 层                              │
│      Schema 触发 · 完整度评分 · 规则匹配                    │
└──────────────────────┬─────────────────────────────────────┘
                       │
┌──────────────────────┴─────────────────────────────────────┐
│                 CKB 事实证据层                              │
│         文档 · 段落 · 表行 · OCR · ASR                      │
└────────────────────────────────────────────────────────────┘
```

## 核心概念澄清: Schema vs Entity

### Schema 是什么?

**Schema 是"实体构造规则/模板"**,定义了如何识别和构建实体。Schema 本身不是实体,而是用于生成实体的规则集合。

- **Schema 的作用**: 定义实体的结构、必需字段、权重、触发阈值
- **Schema 的存储**: 预先定义在 `schemas` 表中或 `SchemaList.md` 文件中
- **Schema 的使用**: 在运行时加载到系统中,用于匹配 CKB 并决定是否生成实体

**示例 Schema**:
```json
{
  "schema_name": "地下水位变化事件",
  "entity_type": "EventEntity",
  "core_fields": [
    {"name": "区域", "weight": 0.3, "required": true},
    {"name": "时间", "weight": 0.2, "required": true},
    {"name": "指标", "weight": 0.2, "required": true},
    {"name": "数值", "weight": 0.2, "required": false},
    {"name": "单位", "weight": 0.1, "required": false}
  ],
  "threshold": 0.75
}
```

这个 Schema 定义了"地下水位变化事件"这类实体应该具备哪些字段,但它本身不是一个具体的事件。

### Entity 是什么?

**Entity 是"具体的实体实例"**,是通过 Schema 从文档内容中动态生成的。实体不是预先写在数据库里的,而是从文档中提取和构建的。

- **Entity 的来源**: 从文档内容中动态提取
- **Entity 的生成**: 通过 Schema 匹配和完整度评分触发
- **Entity 的存储**: 生成后存储在 `kg_entities` 表中

**示例 Entity**:
```json
{
  "entity_id": "entity_001",
  "entity_type": "EventEntity",
  "canonical_name": "阿里C区_水位下降_2025-01",
  "schemas": [
    {"schema_name": "地下水位变化事件", "confidence": 0.92}
  ],
  "attributes": {
    "区域": "阿里C区",
    "时间": "2025-01",
    "指标": "水位",
    "数值": "10",
    "单位": "米",
    "变化": "下降"
  },
  "supported_by": ["ckb_001"],
  "confidence": 0.9
}
```

这是一个具体的实体实例,描述了"阿里C区在2025年1月水位下降10米"这个具体事件。

### 实体的动态生成过程

实体不是预先定义的,而是通过以下流程动态生成的:

```
1. 文档上传
   输入: "阿里C区2025年1月水位下降10米"
   
2. CKB 解析
   生成: CKB {
     ckb_id: "ckb_001",
     content: { text: "阿里C区2025年1月水位下降10米" },
     quality: { source_confidence: 0.9 }
   }
   
3. 字段抽取
   提取: [
     {name: "区域", value: "阿里C区", type: "location"},
     {name: "时间", value: "2025-01", type: "time"},
     {name: "指标", value: "水位", type: "indicator"},
     {name: "数值", value: "10", type: "number"},
     {name: "单位", value: "米", type: "unit"}
   ]
   
4. Schema 匹配
   匹配 Schema: "地下水位变化事件"
   计算完整度: (1×0.3 + 1×0.2 + 1×0.2 + 1×0.2 + 1×0.1) × 0.9 = 0.9
   判断: 0.9 ≥ 0.75 (阈值) ✓ 触发实体生成
   
5. 实体实例化
   生成: Entity {
     canonical_name: "阿里C区_水位下降_2025-01",
     type: "EventEntity",
     attributes: {区域: "阿里C区", 时间: "2025-01", ...},
     supported_by: ["ckb_001"],
     confidence: 0.9
   }
   
6. 持久化
   存储到 kg_entities 表
```

### 关键区别总结

| 维度 | Schema | Entity |
|------|--------|--------|
| **本质** | 规则/模板 | 具体实例 |
| **来源** | 预先定义(SchemaList.md) | 从文档动态生成 |
| **存储** | schemas 表 | kg_entities 表 |
| **数量** | 有限(几十个) | 无限(随文档增长) |
| **内容** | 字段定义、权重、阈值 | 具体字段值、置信度 |
| **示例** | "地下水位变化事件" | "阿里C区_水位下降_2025-01" |

### 常见误解澄清

❌ **误解 1**: "地下水位变化事件"是一个实体
✅ **正确**: "地下水位变化事件"是一个 Schema(模板),"阿里C区_水位下降_2025-01"才是实体

❌ **误解 2**: 实体是预先写在数据库里的
✅ **正确**: 实体是从文档内容中动态提取和生成的,数据库中只存储生成后的实体

❌ **误解 3**: Schema 是通过合成生成的
✅ **正确**: Schema 是预先定义的规则,实体才是通过 Schema 合成生成的

### SchemaList.md 的作用

`SchemaList.md` 文件中定义的是 **Schema 模板**,不是实体。这些 Schema 会被加载到系统中,用于:

1. **匹配 CKB**: 判断文档内容是否符合某个 Schema
2. **触发实体生成**: 当完整度达到阈值时,生成实体实例
3. **指导字段抽取**: 告诉系统应该提取哪些字段

**SchemaList.md 结构**:
- **Schema 名称**: 预定义的 Schema 模板名称(如"EITV"、"地下水位变化事件")
- **场景**: 适用场景(如"科研/政府"、"个人生活"、"旅行"、"摄影")
- **核心字段**: 触发该 Schema 所需的字段(如"Entity, Indicator, Time, Value, Unit")
- **示例描述**: 如何触发该 Schema 的示例(如"A区2022年地下水位下降0.8米")
- **Description**: Schema 的详细描述和用途

**SchemaList.md 包含 250 个 Schema,分为以下类别**:
- **科研/政府类** (1-100): EITV, Entity-Attribute, Cause-Effect, Comparison, Trend, Event-Time-Location, Observation, Experiment-Result, Risk-Impact-Mitigation, Sensor-Alert, Maintenance-Log, Policy-Update, Meeting-Minutes, Legal-Case 等
- **个人生活类** (39-52, 76-87): Health-Observation, Habit-Tracker, Fitness-Progress, Expense-Record, Diary-Reflection, Goal-Progress, Knowledge-Note 等
- **娱乐类** (101-105): Movie-Review, Music-Log, Concert-Log, Game-Play, Book-Reading 等
- **旅行类** (106-137): Travel-Trip, Travel-Itinerary, Hotel-Stay, Flight-Record, Restaurant-Review, Scenic-Spot, Travel-Photo 等
- **运动类** (113-150): Hiking-Log, Cycling-Log, Running-Log, Gym-Workout, Swimming-Log, Yoga-Session, Meditation-Log 等
- **摄影类** (151-190): Shooting-Info, Exposure-Strategy, Composition-Type, Light-Composition 等
- **后期类** (191-250): Raw-Develop, Exposure-Adjust, Color-Grading, Retouch-Skin 等

**示例**: 如果 `SchemaList.md` 中定义了"地下水位变化事件" Schema,系统会:
- 从文档中寻找符合这个模式的内容
- 提取相关字段(区域、时间、指标等)
- 如果字段完整度足够,生成一个新的实体实例
- 实体的具体内容来自文档,不是来自 Schema

**实际 Schema 示例(来自 SchemaList.md)**:

1. **EITV Schema** (科研/政府):
```json
{
  "schema_name": "EITV",
  "scene": "科研/政府",
  "core_fields": ["Entity", "Indicator", "Time", "Value", "Unit"],
  "example": "A区2022年地下水位下降0.8米",
  "description": "用于记录某个实体在某个时间点的指标数值，便于统计、趋势分析和图谱构建"
}
```

2. **Travel-Photo Schema** (旅行):
```json
{
  "schema_name": "Travel-Photo",
  "scene": "旅行/休闲",
  "core_fields": ["PhotoID", "Location", "Timestamp", "Description"],
  "example": "青森美术馆 → 2026-01-20 → 赏雪场景",
  "description": "记录旅行照片及拍摄信息"
}
```

3. **Shooting-Info Schema** (摄影):
```json
{
  "schema_name": "Shooting-Info",
  "scene": "摄影",
  "core_fields": ["Camera", "Lens", "ISO", "Aperture", "Shutter"],
  "example": "A7M4 + 35mm f1.8, ISO800",
  "description": "记录一次拍摄的基础参数信息"
}
```

## Architecture

### 模块划分

系统分为以下核心模块:

1. **CKB 模块** (`kg/ckb/`)
   - `ckb_parser.js`: 文档解析器,支持 Word、PDF、Excel、图片、视频
   - `ckb_store.js`: CKB 存储和查询

2. **字段抽取模块** (`kg/field_extractor/`)
   - `field_extractor.js`: 字段抽取主逻辑
   - `rule_extractor.js`: 基于规则的字段抽取(正则、NER)
   - `llm_extractor.js`: 基于 LLM 的字段抽取(兜底)

3. **Schema 模块** (`kg/schema/`)
   - `schema_manager.js`: Schema 定义管理(CRUD)
   - `schema_matcher.js`: Schema 匹配和完整度评分
   - `schema_loader.js`: 从 SchemaList.md 加载 Schema

4. **字段清洗模块** (`kg/field_normalizer/`)
   - `field_normalizer.js`: 字段清洗主逻辑
   - `algorithm_mapper.js`: 基于算法的字段映射(字符串相似度、同义词)
   - `llm_mapper.js`: 基于 LLM 的字段映射(兜底)
   - `field_cleaner.js`: 字段值清洗(去噪、标准化)

5. **实体模块** (`kg/entity/`)
   - `entity_builder.js`: 实体实例化
   - `entity_store.js`: 实体存储和查询

6. **关系模块** (`kg/relation/`)
   - `builtin_relation_builder.js`: Schema 内建关系生成
   - `cooccurrence_relation_builder.js`: 共现关系生成
   - `semantic_relation_builder.js`: LLM 语义关系抽取
   - `relation_store.js`: 关系存储和查询

7. **置信度模块** (`kg/confidence/`)
   - `confidence_engine.js`: 置信度计算和更新
   - `quality_filter.js`: 低质量数据过滤

8. **Prompt 模块** (`kg/prompts/`)
   - `extract_fields.prompt`: Prompt 1 - CKB → 字段抽取
   - `schema_score.prompt`: Prompt 2 - 字段 → Schema 触发判断
   - `entity_build.prompt`: Prompt 3 - Schema → 实体实例化
   - `relation_candidate.prompt`: Prompt 4 - 语义关系候选抽取
   - `field_mapping.prompt`: Prompt 5 - 字段名称映射

9. **API 模块** (`routes/knowledgeGraphRoutes.js`)
   - RESTful API 接口

10. **可视化模块** (`client/src/pages/KnowledgeGraph/`)
   - React 组件,使用 D3.js 或 ECharts 进行图可视化

### 数据流

```
文档上传
    ↓
CKB 解析 (ckb_parser)
    ↓
字段抽取 (field_extractor)
    ↓
字段清洗和映射 (field_normalizer) ← 新增
    ↓
Schema 匹配 (schema_matcher)
    ↓
完整度评分 ≥ 阈值?
    ↓ Yes
实体实例化 (entity_builder)
    ↓
关系生成 (relation_builder)
    ├─ 内建关系 (0 Token)
    ├─ 共现关系 (0 Token)
    └─ 语义关系 (最小 Token)
    ↓
置信度计算 (confidence_engine)
    ↓
持久化到 KG_Store
    ↓
API 查询 / 可视化
```

## Components and Interfaces

### 1. CKB Parser

**职责**: 将各种格式的文档解析为 CKB(最小可引用事实单元)

**接口**:
```typescript
interface CKBParser {
  parseDocument(docId: string, filePath: string, fileType: string): Promise<CKB[]>;
  parseWord(filePath: string): Promise<CKB[]>;
  parsePDF(filePath: string): Promise<CKB[]>;
  parseExcel(filePath: string): Promise<CKB[]>;
  parseImage(filePath: string): Promise<CKB[]>;
  parseVideo(filePath: string): Promise<CKB[]>;
}
```

**实现策略**:
- **Word**: 使用 `mammoth` 或 `docx` 库提取段落和标题层级
- **PDF**: 使用 `pdf-parse` 提取文本,保留段落结构
- **Excel**: 使用 `xlsx` 库,检测表头,每行生成一个 CKB
- **图片**: 使用 `tesseract.js` 进行 OCR,设置 `source_confidence = 0.6`
- **视频**: 集成 ASR 服务(如 Whisper API),记录时间范围

**输出示例**:
```json
{
  "ckb_id": "ckb_001",
  "doc_id": "doc_123",
  "source_type": "pdf",
  "source_meta": {
    "file_name": "report.pdf",
    "page": 5
  },
  "structure": {
    "section_title": "3.2 数据分析",
    "level": 2
  },
  "content": {
    "text": "阿里C区2025年1月水位下降10米",
    "language": "zh"
  },
  "quality": {
    "source_confidence": 0.9
  },
  "timestamps": {
    "created_at": "2025-01-26T10:00:00Z"
  }
}
```

### 2. Field Extractor

**职责**: 从 CKB 中提取结构化字段,为 Schema 匹配提供输入

**接口**:
```typescript
interface FieldExtractor {
  extractFields(ckb: CKB): Promise<Field[]>;
  extractByRule(text: string): Field[];
  extractByNER(text: string): Field[];
  extractByLLM(ckb: CKB): Promise<Field[]>;
}

interface Field {
  name: string;        // 字段名称: 区域、时间、数值、单位等
  value: string;       // 字段值
  type: FieldType;     // location | time | number | unit | indicator | entity
  confidence: number;  // 0-1
}
```

**实现策略**:
1. **规则优先**: 使用正则表达式提取时间、数值、单位
   ```javascript
   // 时间提取
   const timeRegex = /(\d{4})年(\d{1,2})月/;
   // 数值提取
   const numberRegex = /(\d+\.?\d*)\s*(米|公里|吨|万元)/;
   ```

2. **NER 模型**: 使用轻量级 NER 模型(如 `compromise` 库)提取地点、组织、人名
   ```javascript
   const nlp = require('compromise');
   const doc = nlp(text);
   const places = doc.places().out('array');
   ```

3. **LLM 兜底**: 仅在规则和 NER 无法提取时调用 LLM
   ```javascript
   const prompt = `从以下文本中提取字段,不要推理:
   文本: ${ckb.content.text}
   输出 JSON: {"fields": [{"name": "区域", "value": "...", "type": "location", "confidence": 0.9}]}`;
   ```

### 3. Schema Manager

**职责**: 管理 Schema 定义,支持 CRUD 操作,从 SchemaList.md 加载 Schema

**接口**:
```typescript
interface SchemaManager {
  createSchema(schema: Schema): Promise<string>;
  getSchema(schemaId: string): Promise<Schema>;
  listSchemas(filters?: SchemaFilters): Promise<Schema[]>;
  updateSchema(schemaId: string, updates: Partial<Schema>): Promise<void>;
  deleteSchema(schemaId: string): Promise<void>;
  loadSchemasFromFile(filePath: string): Promise<number>;
  importSchemas(schemas: Schema[]): Promise<number>;
  getSchemasByScene(scene: string): Promise<Schema[]>;
  searchSchemas(query: string): Promise<Schema[]>;
  enableSchema(schemaId: string): Promise<void>;
  disableSchema(schemaId: string): Promise<void>;
}

interface Schema {
  schema_id: string;
  schema_name: string;
  entity_type: string;
  scene: string;  // 新增: 场景分类
  core_fields: CoreField[];
  threshold: number;
  relations: RelationTemplate[];
  example_description: string;  // 新增: 示例描述
  description: string;  // 新增: Schema 描述
  version: string;
  active: boolean;  // 新增: 是否启用
  created_at: string;
  updated_at: string;
}

interface SchemaFilters {
  scene?: string;
  entity_type?: string;
  active?: boolean;
}

interface CoreField {
  name: string;
  weight: number;
  required: boolean;
}

interface RelationTemplate {
  type: string;
  target_field: string;
  direction: 'outgoing' | 'incoming';
}
```

**从 SchemaList.md 加载 Schema(增强版)**:
```javascript
async function loadSchemasFromFile(filePath) {
  console.log('Starting Schema import from SchemaList.md...');
  const startTime = Date.now();
  
  // 1. 读取 SchemaList.md 文件
  const content = await fs.readFile(filePath, 'utf-8');
  
  // 2. 解析 Markdown 表格
  const lines = content.split('\n').filter(line => line.trim());
  const schemas = [];
  let parseErrors = [];
  
  for (let i = 2; i < lines.length; i++) {  // 跳过表头
    try {
      const columns = lines[i].split('\t').map(col => col.trim());
      if (columns.length < 5) {
        parseErrors.push({ line: i, reason: 'Insufficient columns', content: lines[i] });
        continue;
      }
      
      const [id, schemaName, scene, coreFieldsStr, exampleDesc, description] = columns;
      
      // 3. 解析核心字段
      const coreFields = parseCoreFields(coreFieldsStr);
      
      // 4. 生成 Schema 对象
      const schema = {
        schema_id: `schema_${id}`,
        schema_name: schemaName,
        entity_type: inferEntityType(schemaName, scene),
        scene: scene,
        core_fields: coreFields,
        threshold: 0.75,  // 默认阈值
        relations: [],  // 可后续配置
        example_description: exampleDesc,
        description: description,
        version: '1.0',
        active: true
      };
      
      schemas.push(schema);
      
      // 显示进度
      if (schemas.length % 50 === 0) {
        console.log(`Parsed ${schemas.length} schemas...`);
      }
    } catch (error) {
      parseErrors.push({ line: i, reason: error.message, content: lines[i] });
    }
  }
  
  console.log(`Parsed ${schemas.length} schemas from SchemaList.md`);
  
  // 5. 验证数量
  const expectedCount = 250;
  if (schemas.length !== expectedCount) {
    console.warn(`Warning: Expected ${expectedCount} schemas, but parsed ${schemas.length}`);
  }
  
  // 6. 记录解析错误
  if (parseErrors.length > 0) {
    console.error(`Parse errors: ${parseErrors.length}`);
    await fs.writeFile(
      'schema_import_errors.json',
      JSON.stringify(parseErrors, null, 2),
      'utf-8'
    );
  }
  
  // 7. 批量导入到数据库
  const importResult = await importSchemas(schemas);
  
  const totalTime = Date.now() - startTime;
  console.log(`Schema import completed in ${totalTime}ms`);
  console.log(`Imported: ${importResult.imported}, Skipped: ${importResult.skipped}, Failed: ${importResult.failed}`);
  
  // 8. 验证导入结果
  const dbCount = await prisma.schema.count({ where: { active: true } });
  if (dbCount !== expectedCount) {
    console.error(`Database verification failed: Expected ${expectedCount} schemas, found ${dbCount}`);
    await triggerAlert('schema_import_incomplete', {
      expected: expectedCount,
      actual: dbCount,
      missing: expectedCount - dbCount
    });
  } else {
    console.log(`✓ Schema import verification passed: ${dbCount} schemas in database`);
  }
  
  return {
    parsed: schemas.length,
    imported: importResult.imported,
    skipped: importResult.skipped,
    failed: importResult.failed,
    errors: parseErrors,
    totalTime,
    verified: dbCount === expectedCount
  };
}

function parseCoreFields(coreFieldsStr) {
  // 解析 "Entity, Indicator, Time, Value, Unit" 格式
  const fieldNames = coreFieldsStr.split(',').map(f => f.trim());
  const weight = 1.0 / fieldNames.length;  // 平均权重
  
  return fieldNames.map(name => ({
    name: name,
    weight: weight,
    required: true  // 默认必需
  }));
}

function inferEntityType(schemaName, scene) {
  // 根据场景推断实体类型
  if (scene.includes('科研') || scene.includes('政府')) {
    return 'ResearchEntity';
  } else if (scene.includes('旅行')) {
    return 'TravelEntity';
  } else if (scene.includes('摄影') || scene.includes('后期')) {
    return 'PhotographyEntity';
  } else if (scene.includes('运动')) {
    return 'SportsEntity';
  } else if (scene.includes('个人生活')) {
    return 'LifeEntity';
  } else if (scene.includes('娱乐')) {
    return 'EntertainmentEntity';
  } else {
    return 'GeneralEntity';
  }
}

async function importSchemas(schemas) {
  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const failedSchemas = [];
  
  // 使用事务确保原子性
  await prisma.$transaction(async (tx) => {
    for (const schema of schemas) {
      try {
        // 检查是否已存在
        const existing = await tx.schema.findUnique({
          where: { name: schema.schema_name }
        });
        
        if (existing) {
          console.log(`Schema ${schema.schema_name} already exists, skipping`);
          skipped++;
          continue;
        }
        
        // 插入新 Schema
        await tx.schema.create({ data: schema });
        imported++;
        
        // 显示进度
        if (imported % 50 === 0) {
          console.log(`Imported ${imported} schemas...`);
        }
      } catch (error) {
        console.error(`Failed to import schema ${schema.schema_name}:`, error.message);
        failed++;
        failedSchemas.push({
          schema_name: schema.schema_name,
          error: error.message
        });
      }
    }
  });
  
  // 记录失败的 Schema
  if (failedSchemas.length > 0) {
    await fs.writeFile(
      'schema_import_failures.json',
      JSON.stringify(failedSchemas, null, 2),
      'utf-8'
    );
  }
  
  return { imported, skipped, failed, failedSchemas };
}

// 系统启动时自动检查和导入
async function ensureSchemasLoaded() {
  const expectedCount = 250;
  const currentCount = await prisma.schema.count({ where: { active: true } });
  
  if (currentCount < expectedCount) {
    console.warn(`Schema count insufficient: ${currentCount}/${expectedCount}`);
    console.log('Auto-importing schemas from SchemaList.md...');
    
    const result = await loadSchemasFromFile('./SchemaList.md');
    
    if (!result.verified) {
      console.error('Schema import verification failed, please check manually');
      await triggerAlert('schema_auto_import_failed', {
        expected: expectedCount,
        current: currentCount,
        result
      });
    }
  } else {
    console.log(`✓ Schema count verified: ${currentCount}/${expectedCount}`);
  }
}

// 在系统启动时调用
await ensureSchemasLoaded();
```

**按场景查询 Schema**:
```javascript
async function getSchemasByScene(scene) {
  return await prisma.schema.findMany({
    where: {
      scene: { contains: scene },
      active: true
    },
    orderBy: { schema_name: 'asc' }
  });
}
```

**存储**: Schema 定义存储在 `schemas` 表中,使用 JSON 格式

### 4. Field Normalizer (字段清洗和映射)

**职责**: 将文档中提取的原始字段名映射到 Schema 定义的标准字段名,采用算法优先、LLM 兜底的混合策略

**核心问题**: 文档中提取的字段名称(如"地区"、"日期")不一定与 Schema 定义的字段名称(如"区域"、"时间")一致,需要进行字段映射和清洗。

**接口**:
```typescript
interface FieldNormalizer {
  normalizeFields(rawFields: Field[], schema: Schema): Promise<NormalizedField[]>;
  mapFieldName(rawFieldName: string, schemaFields: string[]): Promise<FieldMapping>;
  cleanFieldValue(field: Field): Field;
  batchNormalize(rawFieldsList: Field[][], schemas: Schema[]): Promise<NormalizedField[][]>;
}

interface FieldMapping {
  raw_name: string;
  mapped_name: string;
  confidence: number;
  method: 'exact' | 'similarity' | 'synonym' | 'llm';
}

interface NormalizedField extends Field {
  original_name: string;  // 原始字段名
  mapping_confidence: number;  // 映射置信度
  mapping_method: string;  // 映射方法
}
```

**智能字段截断策略(Intelligent Field Truncating)**:

在调用 LLM 进行字段映射时,为了控制 Token 消耗和提高映射准确性,需要智能选择最相关的 Schema 字段子集,而不是传递所有字段。

**核心思想**: 根据字段重要性、语义相关性和上下文信息,动态选择最有可能匹配的字段子集。

**字段选择策略(多维度评分)**:

1. **字段重要性评分** (基于 Schema 定义):
   ```javascript
   function calculateFieldImportance(field, schema) {
     let score = 0;
     
     // 1. 权重得分 (0-40分)
     score += field.weight * 40;
     
     // 2. 必需字段加分 (0-20分)
     if (field.required) {
       score += 20;
     }
     
     // 3. 字段频率得分 (0-20分)
     // 统计该字段在历史映射中的出现频率
     const frequency = getFieldMappingFrequency(field.name);
     score += frequency * 20;
     
     // 4. 字段类型通用性 (0-20分)
     // 通用字段(时间、区域、数值)优先级更高
     const universalFields = ['时间', '区域', '地点', '数值', '单位', '名称', '类型', '状态'];
     if (universalFields.includes(field.name)) {
       score += 20;
     }
     
     return score;  // 总分 0-100
   }
   ```

2. **语义相关性评分** (基于字段名称相似度):
   ```javascript
   function calculateSemanticRelevance(rawFieldName, schemaFieldName) {
     let score = 0;
     
     // 1. 字符串相似度 (0-40分)
     const editDistance = levenshtein(rawFieldName, schemaFieldName);
     const maxLen = Math.max(rawFieldName.length, schemaFieldName.length);
     const similarity = 1 - (editDistance / maxLen);
     score += similarity * 40;
     
     // 2. 字符 n-gram 相似度 (0-30分)
     const ngramSim = cosineSimilarity(
       generateNgrams(rawFieldName, 2),
       generateNgrams(schemaFieldName, 2)
     );
     score += ngramSim * 30;
     
     // 3. 语义类别匹配 (0-30分)
     // 如果两个字段属于同一语义类别,加分
     const rawCategory = getSemanticCategory(rawFieldName);
     const schemaCategory = getSemanticCategory(schemaFieldName);
     if (rawCategory === schemaCategory) {
       score += 30;
     }
     
     return score;  // 总分 0-100
   }
   
   // 语义类别定义
   const SEMANTIC_CATEGORIES = {
     temporal: ['时间', '日期', '时刻', '时段', '年份', '月份', '时间点'],
     spatial: ['区域', '地区', '地点', '位置', '场所', '地域'],
     quantitative: ['数值', '数量', '值', '大小', '量'],
     unit: ['单位', '计量单位', '度量单位'],
     identifier: ['名称', '标识', 'ID', '编号', '代码'],
     categorical: ['类型', '种类', '分类', '类别'],
     descriptive: ['描述', '说明', '备注', '注释'],
     status: ['状态', '情况', '态势', '阶段']
   };
   
   function getSemanticCategory(fieldName) {
     for (const [category, keywords] of Object.entries(SEMANTIC_CATEGORIES)) {
       if (keywords.includes(fieldName)) {
         return category;
       }
     }
     return 'other';
   }
   ```

3. **上下文相关性评分** (基于字段值类型):
   ```javascript
   function calculateContextRelevance(rawField, schemaField) {
     let score = 0;
     
     // 如果原始字段有类型信息,与 Schema 字段的语义类别匹配
     if (rawField.type) {
       const typeToCategory = {
         'time': 'temporal',
         'location': 'spatial',
         'number': 'quantitative',
         'unit': 'unit',
         'entity': 'identifier'
       };
       
       const expectedCategory = typeToCategory[rawField.type];
       const schemaCategory = getSemanticCategory(schemaField.name);
       
       if (expectedCategory === schemaCategory) {
         score += 50;  // 类型匹配,高分
       }
     }
     
     return score;  // 总分 0-50
   }
   ```

4. **综合评分和字段选择**:
   ```javascript
   function selectRelevantFields(rawFieldName, rawField, schemaFields, schema, options = {}) {
     const {
       maxFields = 5,           // 最多选择 5 个字段
       minScore = 30,           // 最低得分阈值
       includeTopN = 3          // 至少包含前 N 个高分字段
     } = options;
     
     // 计算每个 Schema 字段的综合得分
     const scoredFields = schemaFields.map(schemaField => {
       const fieldDef = schema.core_fields.find(f => f.name === schemaField);
       
       const importanceScore = calculateFieldImportance(fieldDef, schema);
       const semanticScore = calculateSemanticRelevance(rawFieldName, schemaField);
       const contextScore = calculateContextRelevance(rawField, fieldDef);
       
       // 加权综合得分
       const totalScore = 
         importanceScore * 0.3 +   // 重要性权重 30%
         semanticScore * 0.5 +     // 语义相关性权重 50%
         contextScore * 0.2;       // 上下文相关性权重 20%
       
       return {
         name: schemaField,
         score: totalScore,
         breakdown: { importanceScore, semanticScore, contextScore }
       };
     });
     
     // 按得分降序排序
     scoredFields.sort((a, b) => b.score - a.score);
     
     // 选择策略:
     // 1. 至少包含前 N 个高分字段
     // 2. 包含所有得分 >= minScore 的字段
     // 3. 总数不超过 maxFields
     const selectedFields = [];
     
     for (let i = 0; i < scoredFields.length; i++) {
       const field = scoredFields[i];
       
       if (i < includeTopN || field.score >= minScore) {
         selectedFields.push(field.name);
         
         if (selectedFields.length >= maxFields) {
           break;
         }
       }
     }
     
     return {
       selectedFields,
       scoredFields  // 返回完整评分信息,用于调试
     };
   }
   ```

5. **场景自适应策略**:
   ```javascript
   function adaptTruncatingStrategy(schema, rawField) {
     // 根据 Schema 场景调整截断策略
     const sceneStrategies = {
       '科研/政府': {
         maxFields: 6,           // 科研场景字段更多
         minScore: 25,
         includeTopN: 4,
         priorityCategories: ['temporal', 'spatial', 'quantitative']
       },
       '个人生活': {
         maxFields: 4,           // 个人生活场景字段较少
         minScore: 35,
         includeTopN: 3,
         priorityCategories: ['temporal', 'descriptive']
       },
       '旅行/休闲': {
         maxFields: 5,
         minScore: 30,
         includeTopN: 3,
         priorityCategories: ['spatial', 'temporal', 'descriptive']
       },
       '摄影': {
         maxFields: 7,           // 摄影场景参数多
         minScore: 20,
         includeTopN: 5,
         priorityCategories: ['quantitative', 'categorical']
       },
       'default': {
         maxFields: 5,
         minScore: 30,
         includeTopN: 3,
         priorityCategories: []
       }
     };
     
     const scene = schema.scene || 'default';
     return sceneStrategies[scene] || sceneStrategies['default'];
   }
   ```

6. **LLM Prompt 优化**:
   ```javascript
   async function llmMatchWithTruncating(rawFieldName, rawField, schemaFields, schema) {
     // 智能选择相关字段
     const strategy = adaptTruncatingStrategy(schema, rawField);
     const { selectedFields, scoredFields } = selectRelevantFields(
       rawFieldName, 
       rawField, 
       schemaFields, 
       schema, 
       strategy
     );
     
     // 构建优化的 Prompt
     const prompt = `你是一个字段映射专家。请将原始字段名映射到标准字段名。

原始字段名: ${rawFieldName}
字段值: ${rawField.value}
字段类型: ${rawField.type || '未知'}

候选标准字段(按相关性排序):
${selectedFields.map((name, i) => `${i+1}. ${name}`).join('\n')}

Schema 场景: ${schema.scene}
Schema 名称: ${schema.schema_name}

任务:
1. 判断原始字段名应该映射到哪个标准字段
2. 如果无法确定映射,返回 null
3. 评估映射的置信度(0-1)

输出 JSON:
{
  "mapped_name": "标准字段名" 或 null,
  "confidence": 0.85,
  "reason": "映射理由"
}`;
     
     const result = await llmClient.call(prompt);
     
     // 验证 LLM 返回的字段是否在候选列表中
     if (result.mapped_name && !selectedFields.includes(result.mapped_name)) {
       console.warn(`LLM returned field not in candidate list: ${result.mapped_name}`);
       // 检查是否在完整字段列表中
       if (!schemaFields.includes(result.mapped_name)) {
         return null;  // 无效映射
       }
     }
     
     if (result.mapped_name && result.confidence >= 0.7) {
       return {
         mapped_name: result.mapped_name,
         confidence: result.confidence * 0.9,  // LLM 置信度打折
         method: 'llm',
         truncating_info: {
           total_fields: schemaFields.length,
           selected_fields: selectedFields.length,
           token_saved: (schemaFields.length - selectedFields.length) * 2  // 估算节省的 Token
         }
       };
     }
     
     return null;
   }
   ```

**优化效果预期**:

| 指标 | 无截断 | 智能截断 | 提升 |
|------|--------|----------|------|
| 平均字段数 | 8-12 | 3-5 | 60% Token 节省 |
| 映射准确率 | 75-80% | 85-90% | +10% |
| 场景覆盖率 | 70% | 95%+ | +25% |
| Prompt Token | 150-200 | 80-120 | 40% 节省 |

**覆盖场景分析**:

1. **科研/政府场景** (30%): 字段多(8-15个),需要更大的 maxFields (6-7)
2. **个人生活场景** (20%): 字段少(3-6个),可以用较小的 maxFields (4)
3. **旅行/摄影场景** (25%): 字段中等(5-10个),标准 maxFields (5)
4. **通用场景** (25%): 使用默认策略,覆盖其他所有场景

通过多维度评分和场景自适应,该策略可以覆盖 **95%+ 的实际场景**。

**混合策略(50% LLM 参与)**:

1. **精确匹配(优先级最高)**:
   ```javascript
   function exactMatch(rawFieldName, schemaFields) {
     // 完全匹配
     if (schemaFields.includes(rawFieldName)) {
       return {
         mapped_name: rawFieldName,
         confidence: 1.0,
         method: 'exact'
       };
     }
     return null;
   }
   ```

2. **字符串相似度算法(优先级高)**:
   ```javascript
   function similarityMatch(rawFieldName, schemaFields) {
     let bestMatch = null;
     let maxSimilarity = 0;
     
     for (const schemaField of schemaFields) {
       // 编辑距离(Levenshtein Distance)
       const editDistance = levenshtein(rawFieldName, schemaField);
       const maxLen = Math.max(rawFieldName.length, schemaField.length);
       const similarity = 1 - (editDistance / maxLen);
       
       // 余弦相似度(基于字符 n-gram)
       const cosineSim = cosineSimilarity(
         generateNgrams(rawFieldName, 2),
         generateNgrams(schemaField, 2)
       );
       
       // 综合相似度
       const combinedSim = (similarity + cosineSim) / 2;
       
       if (combinedSim > maxSimilarity && combinedSim >= 0.7) {
         maxSimilarity = combinedSim;
         bestMatch = schemaField;
       }
     }
     
     if (bestMatch) {
       return {
         mapped_name: bestMatch,
         confidence: maxSimilarity,
         method: 'similarity'
       };
     }
     return null;
   }
   
   function levenshtein(a, b) {
     const matrix = [];
     for (let i = 0; i <= b.length; i++) {
       matrix[i] = [i];
     }
     for (let j = 0; j <= a.length; j++) {
       matrix[0][j] = j;
     }
     for (let i = 1; i <= b.length; i++) {
       for (let j = 1; j <= a.length; j++) {
         if (b.charAt(i - 1) === a.charAt(j - 1)) {
           matrix[i][j] = matrix[i - 1][j - 1];
         } else {
           matrix[i][j] = Math.min(
             matrix[i - 1][j - 1] + 1,
             matrix[i][j - 1] + 1,
             matrix[i - 1][j] + 1
           );
         }
       }
     }
     return matrix[b.length][a.length];
   }
   ```

3. **同义词词典映射(优先级中)**:
   ```javascript
   const SYNONYM_DICT = {
     '时间': ['日期', '时刻', '时段', '时间点'],
     '区域': ['地区', '地域', '区', '地点', '位置'],
     '数值': ['值', '数字', '数量', '量'],
     '单位': ['计量单位', '度量单位'],
     '指标': ['指数', '参数', '度量'],
     '实体': ['对象', '主体', '目标'],
     '描述': ['说明', '备注', '注释'],
     '类型': ['种类', '分类', '类别'],
     '状态': ['情况', '状况', '态势'],
     '结果': ['成果', '产出', '输出']
   };
   
   function synonymMatch(rawFieldName, schemaFields) {
     for (const [standard, synonyms] of Object.entries(SYNONYM_DICT)) {
       if (synonyms.includes(rawFieldName) && schemaFields.includes(standard)) {
         return {
           mapped_name: standard,
           confidence: 0.9,
           method: 'synonym'
         };
       }
     }
     return null;
   }
   ```

**同义词词典管理(LLM 增强版)**:

**设计目标**: 使用大模型的生成能力构建覆盖工作、科研、生活、旅行、政务、中国网信工作 90% 以上场景的同义词词典

**存储格式**: 使用 JSON 文件存储,便于维护和扩展
```json
// kg/field_normalizer/synonym_dict.json
{
  "时间": {
    "synonyms": ["日期", "时刻", "时段", "时间点", "发生时间", "记录时间", "啥时候", "何时", "when", "timestamp"],
    "domain": ["通用"],
    "confidence": 1.0,
    "usage_count": 1250
  },
  "区域": {
    "synonyms": ["地区", "地域", "区", "地点", "位置", "场所", "发生地点", "location", "地方", "哪里"],
    "domain": ["通用", "科研", "政务"],
    "confidence": 1.0,
    "usage_count": 980
  },
  "指标": {
    "synonyms": ["指数", "参数", "度量", "指标名称", "metric", "KPI", "考核指标", "监测指标"],
    "domain": ["科研", "政务", "工作"],
    "confidence": 0.95,
    "usage_count": 560
  },
  "网络安全等级": {
    "synonyms": ["安全等级", "防护等级", "网安等级", "等保等级", "信息安全等级"],
    "domain": ["网信工作", "政务"],
    "confidence": 0.9,
    "usage_count": 120
  },
  "景点": {
    "synonyms": ["旅游景点", "名胜", "景区", "观光点", "打卡地", "attraction"],
    "domain": ["旅行"],
    "confidence": 0.95,
    "usage_count": 340
  },
  "光圈": {
    "synonyms": ["aperture", "f值", "光圈值", "光圈大小"],
    "domain": ["摄影"],
    "confidence": 1.0,
    "usage_count": 280
  }
}
```

**LLM 生成策略**:

1. **初始化生成**:
   ```javascript
   async function generateInitialSynonymDict() {
     const domains = [
       "工作(会议、任务、项目、汇报)",
       "科研(实验、数据、指标、论文)",
       "生活(健康、饮食、运动、娱乐)",
       "旅行(景点、酒店、交通、美食)",
       "政务(政策、文件、审批、监管)",
       "中国网信工作(网络安全、数据治理、舆情、等保)"
     ];
     
     const standardFields = [
       "时间", "区域", "数值", "单位", "指标", "实体", "描述", "类型", "状态", "结果",
       "名称", "内容", "来源", "作者", "标签", "评分", "价格", "数量", "持续时间", "频率"
     ];
     
     const prompt = `你是一个同义词词典生成专家。请为以下标准字段生成同义词，覆盖多个领域。

领域: ${domains.join(', ')}

标准字段: ${standardFields.join(', ')}

要求:
1. 每个标准字段生成 8-12 个同义词
2. 包含正式术语和口语化表达
3. 包含中英文混合表达
4. 包含缩写和全称
5. 包含领域特定术语
6. 确保覆盖 90% 以上的实际使用场景

输出 JSON 格式:
{
  "标准字段": {
    "synonyms": ["同义词1", "同义词2", ...],
    "domain": ["适用领域1", "领域2"],
    "confidence": 1.0
  }
}`;
     
     const result = await llmClient.call(prompt, { temperature: 0.7, max_tokens: 4000 });
     return result;
   }
   ```

2. **领域扩展生成**:
   ```javascript
   async function expandDomainSynonyms(domain, existingDict) {
     const prompt = `扩展同义词词典，专注于 ${domain} 领域。

现有词典: ${JSON.stringify(existingDict, null, 2)}

任务:
1. 为现有标准字段添加 ${domain} 领域的专业术语
2. 识别 ${domain} 领域特有的字段，生成新的标准字段和同义词
3. 确保覆盖该领域 95% 以上的常见表达

输出 JSON 格式(仅包含新增或更新的字段):
{
  "标准字段": {
    "synonyms": ["新同义词1", "新同义词2", ...],
    "domain": ["${domain}"],
    "confidence": 0.9
  }
}`;
     
     const result = await llmClient.call(prompt, { temperature: 0.6, max_tokens: 3000 });
     return result;
   }
   ```

3. **自动学习和扩充**:
   ```javascript
   async function learnFromUnmappedFields(unmappedFields) {
     // 收集未映射字段
     if (unmappedFields.length < 50) return;  // 积累到一定数量再处理
     
     const prompt = `分析以下未映射的字段名称，判断它们应该映射到哪些标准字段，或者是否需要创建新的标准字段。

未映射字段: ${unmappedFields.join(', ')}

现有标准字段: ${Object.keys(synonymDict.dict).join(', ')}

任务:
1. 将未映射字段归类到现有标准字段
2. 识别需要新增的标准字段
3. 生成映射关系

输出 JSON 格式:
{
  "mappings": [
    {"raw": "原始字段", "standard": "标准字段", "confidence": 0.85}
  ],
  "new_standards": [
    {"name": "新标准字段", "synonyms": ["同义词1", ...], "domain": ["领域"]}
  ]
}`;
     
     const result = await llmClient.call(prompt, { temperature: 0.5, max_tokens: 2000 });
     
     // 应用学习结果
     for (const mapping of result.mappings) {
       if (mapping.confidence >= 0.8) {
         synonymDict.addSynonym(mapping.standard, mapping.raw);
       }
     }
     
     for (const newStandard of result.new_standards) {
       synonymDict.addStandardField(newStandard.name, newStandard.synonyms, newStandard.domain);
     }
   }
   ```

4. **质量评估和优化**:
   ```javascript
   async function evaluateDictQuality() {
     // 使用测试集评估覆盖率
     const testSet = loadTestSet();  // 包含各领域的真实字段名称
     
     let covered = 0;
     let total = testSet.length;
     
     for (const testField of testSet) {
       const mapping = synonymDict.match(testField.name, testField.schema_fields);
       if (mapping && mapping.confidence >= 0.7) {
         covered++;
       }
     }
     
     const coverageRate = covered / total;
     
     if (coverageRate < 0.9) {
       console.warn(`Synonym dict coverage rate: ${coverageRate.toFixed(2)}, below target 0.9`);
       // 触发扩充流程
       const uncoveredFields = testSet.filter(f => !synonymDict.match(f.name, f.schema_fields));
       await learnFromUnmappedFields(uncoveredFields.map(f => f.name));
     }
     
     return { coverageRate, covered, total };
   }
   ```

**初始化**:
```javascript
// kg/field_normalizer/synonym_dict.js
const fs = require('fs');
const path = require('path');

class SynonymDict {
  constructor() {
    this.dict = this.loadDict();
  }
  
  loadDict() {
    const dictPath = path.join(__dirname, 'synonym_dict.json');
    if (fs.existsSync(dictPath)) {
      return JSON.parse(fs.readFileSync(dictPath, 'utf-8'));
    }
    return {};
  }
  
  match(rawFieldName, schemaFields) {
    for (const [standard, synonyms] of Object.entries(this.dict)) {
      if (synonyms.includes(rawFieldName) && schemaFields.includes(standard)) {
        return {
          mapped_name: standard,
          confidence: 0.9,
          method: 'synonym'
        };
      }
    }
    return null;
  }
  
  // 动态扩充词典(可选)
  addSynonym(standard, synonym) {
    if (!this.dict[standard]) {
      this.dict[standard] = [];
    }
    if (!this.dict[standard].includes(synonym)) {
      this.dict[standard].push(synonym);
      this.saveDict();
    }
  }
  
  saveDict() {
    const dictPath = path.join(__dirname, 'synonym_dict.json');
    fs.writeFileSync(dictPath, JSON.stringify(this.dict, null, 2), 'utf-8');
  }
  
  // 从 LLM 映射结果中学习(可选)
  learnFromLLM(rawFieldName, mappedFieldName, confidence) {
    if (confidence >= 0.9) {
      this.addSynonym(mappedFieldName, rawFieldName);
      console.log(`Learned synonym: ${rawFieldName} → ${mappedFieldName}`);
    }
  }
}

module.exports = new SynonymDict();
```

**扩充策略**:
1. **手动扩充**: 根据实际使用情况,定期添加新的同义词
2. **自动学习**: 记录 LLM 映射的高置信度结果,自动添加到词典
3. **领域定制**: 针对特定领域(科研、旅行、摄影等)添加专业术语同义词

**优势**:
- 减少 LLM 调用,降低 Token 消耗
- 提高映射速度(O(1) 查找)
- 可持续优化,越用越准确

4. **LLM 映射(兜底,50% 概率)**:
   ```javascript
   async function llmMatch(rawFieldName, schemaFields, context) {
     // 仅在算法无法确定映射时,以 50% 概率调用 LLM
     if (Math.random() > 0.5) {
       return null;  // 跳过 LLM,接受映射失败
     }
     
     const prompt = `你是一个字段映射专家。请将原始字段名映射到标准字段名。

原始字段名: ${rawFieldName}
标准字段列表: ${schemaFields.join(', ')}
上下文: ${context}

任务:
1. 判断原始字段名应该映射到哪个标准字段
2. 如果无法确定映射,返回 null
3. 评估映射的置信度(0-1)

输出 JSON:
{
  "mapped_name": "标准字段名" 或 null,
  "confidence": 0.85,
  "reason": "映射理由"
}`;
     
     const result = await llmClient.call(prompt);
     
     if (result.mapped_name && result.confidence >= 0.7) {
       return {
         mapped_name: result.mapped_name,
         confidence: result.confidence * 0.9,  // LLM 置信度打折
         method: 'llm'
       };
     }
     return null;
   }
   ```

5. **字段值清洗**:
   ```javascript
   function cleanFieldValue(field) {
     let value = field.value;
     
     // 去除多余空格
     value = value.trim().replace(/\s+/g, ' ');
     
     // 去除特殊字符(保留必要的标点)
     value = value.replace(/[^\w\s\u4e00-\u9fa5.,;:!?()（）、，。；：！？-]/g, '');
     
     // 标准化时间格式
     if (field.type === 'time') {
       value = standardizeTime(value);
     }
     
     // 标准化数值格式
     if (field.type === 'number') {
       value = standardizeNumber(value);
     }
     
     return { ...field, value };
   }
   
   function standardizeTime(timeStr) {
     // "2025年1月" → "2025-01"
     // "2025-01-26" → "2025-01-26"
     // "2025/01/26" → "2025-01-26"
     const patterns = [
       { regex: /(\d{4})年(\d{1,2})月/, format: (m) => `${m[1]}-${m[2].padStart(2, '0')}` },
       { regex: /(\d{4})\/(\d{1,2})\/(\d{1,2})/, format: (m) => `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` }
     ];
     
     for (const { regex, format } of patterns) {
       const match = timeStr.match(regex);
       if (match) {
         return format(match);
       }
     }
     return timeStr;
   }
   ```

6. **批量处理优化**:
   ```javascript
   async function batchNormalize(rawFieldsList, schemas) {
     // 收集所有需要 LLM 映射的字段
     const llmBatch = [];
     const results = [];
     
     for (let i = 0; i < rawFieldsList.length; i++) {
       const rawFields = rawFieldsList[i];
       const schema = schemas[i];
       const normalizedFields = [];
       
       for (const field of rawFields) {
         // 尝试算法映射
         let mapping = exactMatch(field.name, schema.core_fields.map(f => f.name));
         if (!mapping) mapping = similarityMatch(field.name, schema.core_fields.map(f => f.name));
         if (!mapping) mapping = synonymMatch(field.name, schema.core_fields.map(f => f.name));
         
         if (mapping) {
           normalizedFields.push({
             ...field,
             name: mapping.mapped_name,
             original_name: field.name,
             mapping_confidence: mapping.confidence,
             mapping_method: mapping.method
           });
         } else {
           // 需要 LLM 映射
           llmBatch.push({ field, schema, index: i });
         }
       }
       
       results[i] = normalizedFields;
     }
     
     // 批量调用 LLM(最多 10 个/批)
     if (llmBatch.length > 0) {
       const batchSize = 10;
       for (let i = 0; i < llmBatch.length; i += batchSize) {
         const batch = llmBatch.slice(i, i + batchSize);
         const llmResults = await batchLLMMapping(batch);
         
         for (let j = 0; j < llmResults.length; j++) {
           const { field, schema, index } = batch[j];
           const mapping = llmResults[j];
           
           if (mapping) {
             results[index].push({
               ...field,
               name: mapping.mapped_name,
               original_name: field.name,
               mapping_confidence: mapping.confidence,
               mapping_method: mapping.method
             });
           }
         }
       }
     }
     
     return results;
   }
   ```

7. **映射缓存**:
   ```javascript
   const mappingCache = new Map();
   
   function getCachedMapping(rawFieldName, schemaName) {
     const key = `${schemaName}:${rawFieldName}`;
     return mappingCache.get(key);
   }
   
   function cacheMapping(rawFieldName, schemaName, mapping) {
     const key = `${schemaName}:${rawFieldName}`;
     mappingCache.set(key, mapping);
   }
   ```

**完整流程(增强字段多样性支持)**:
```javascript
async function normalizeFields(rawFields, schema, options = {}) {
  const { 
    enableLearning = true,
    provideHumanFeedback = false 
  } = options;
  
  const normalizedFields = [];
  const unmappedFields = [];
  const mappingStats = {
    exact: 0,
    similarity: 0,
    synonym: 0,
    llm: 0,
    failed: 0
  };
  
  for (const field of rawFields) {
    // 1. 检查缓存
    let mapping = getCachedMapping(field.name, schema.schema_name);
    
    if (!mapping) {
      // 2. 尝试精确匹配
      mapping = exactMatch(field.name, schema.core_fields.map(f => f.name));
      if (mapping) mappingStats.exact++;
      
      // 3. 尝试相似度匹配
      if (!mapping) {
        mapping = similarityMatch(field.name, schema.core_fields.map(f => f.name));
        if (mapping) mappingStats.similarity++;
      }
      
      // 4. 尝试同义词匹配
      if (!mapping) {
        mapping = synonymMatch(field.name, schema.core_fields.map(f => f.name));
        if (mapping) mappingStats.synonym++;
      }
      
      // 5. 尝试模糊匹配和语义推断(新增)
      if (!mapping) {
        mapping = await fuzzySemanticMatch(field, schema);
        if (mapping) mappingStats.similarity++;
      }
      
      // 6. LLM 兜底(50% 概率)
      if (!mapping) {
        mapping = await llmMatch(field.name, schema.core_fields.map(f => f.name), field.context);
        if (mapping) {
          mappingStats.llm++;
          
          // 学习新映射
          if (enableLearning && mapping.confidence >= 0.9) {
            await synonymDict.learnFromLLM(field.name, mapping.mapped_name, mapping.confidence);
          }
        }
      }
      
      // 7. 缓存映射结果
      if (mapping) {
        cacheMapping(field.name, schema.schema_name, mapping);
      }
    }
    
    if (mapping) {
      // 8. 清洗字段值
      const cleanedField = cleanFieldValue(field);
      
      // 9. 生成标准化字段
      normalizedFields.push({
        ...cleanedField,
        name: mapping.mapped_name,
        original_name: field.name,
        mapping_confidence: mapping.confidence,
        mapping_method: mapping.method
      });
    } else {
      // 映射失败,记录未映射字段
      unmappedFields.push({
        name: field.name,
        value: field.value,
        type: field.type,
        schema: schema.schema_name,
        context: field.context
      });
      
      mappingStats.failed++;
      
      // 保留原始字段名,但标记为低置信度
      normalizedFields.push({
        ...field,
        original_name: field.name,
        mapping_confidence: 0.3,
        mapping_method: 'none'
      });
      
      // 提供人工反馈选项
      if (provideHumanFeedback) {
        const suggestion = await suggestMapping(field, schema);
        console.log(`Unmapped field: ${field.name}, Suggestion: ${suggestion}`);
        // 可以通过 UI 让用户确认
      }
    }
  }
  
  // 10. 记录统计信息
  await recordMappingStats(schema.schema_name, mappingStats);
  
  // 11. 检查映射失败率
  const failureRate = mappingStats.failed / rawFields.length;
  if (failureRate > 0.2) {
    console.warn(`High mapping failure rate: ${(failureRate * 100).toFixed(1)}% for schema ${schema.schema_name}`);
    
    // 触发同义词词典扩充
    if (enableLearning && unmappedFields.length >= 20) {
      await synonymDict.learnFromUnmappedFields(unmappedFields.map(f => f.name));
    }
  }
  
  // 12. 记录字段名称分布
  await recordFieldDistribution(unmappedFields);
  
  return {
    normalizedFields,
    unmappedFields,
    stats: mappingStats,
    failureRate
  };
}

// 新增: 模糊匹配和语义推断
async function fuzzySemanticMatch(field, schema) {
  // 1. 基于字段类型的语义推断
  const typeToCategory = {
    'time': ['时间', '日期', '时刻', '时段'],
    'location': ['区域', '地区', '地点', '位置'],
    'number': ['数值', '数量', '值'],
    'unit': ['单位'],
    'indicator': ['指标', '参数', '度量']
  };
  
  if (field.type && typeToCategory[field.type]) {
    const candidates = typeToCategory[field.type];
    for (const candidate of candidates) {
      if (schema.core_fields.some(f => f.name === candidate)) {
        return {
          mapped_name: candidate,
          confidence: 0.75,
          method: 'semantic_inference'
        };
      }
    }
  }
  
  // 2. 基于上下文的模糊匹配
  if (field.context) {
    // 从上下文中提取关键词,辅助判断
    const contextKeywords = extractKeywords(field.context);
    for (const schemaField of schema.core_fields) {
      if (contextKeywords.some(kw => schemaField.name.includes(kw) || kw.includes(schemaField.name))) {
        return {
          mapped_name: schemaField.name,
          confidence: 0.7,
          method: 'context_fuzzy'
        };
      }
    }
  }
  
  // 3. 基于字段值的推断
  if (field.value) {
    // 例如: 如果值是日期格式,推断为"时间"字段
    if (isDateFormat(field.value) && schema.core_fields.some(f => f.name === '时间')) {
      return {
        mapped_name: '时间',
        confidence: 0.8,
        method: 'value_inference'
      };
    }
    
    // 如果值是地名,推断为"区域"字段
    if (isLocationName(field.value) && schema.core_fields.some(f => f.name === '区域')) {
      return {
        mapped_name: '区域',
        confidence: 0.75,
        method: 'value_inference'
      };
    }
  }
  
  return null;
}

// 新增: 提供映射建议
async function suggestMapping(field, schema) {
  // 计算与所有 Schema 字段的相似度
  const similarities = schema.core_fields.map(schemaField => ({
    name: schemaField.name,
    similarity: calculateSimilarity(field.name, schemaField.name)
  }));
  
  // 排序并返回前 3 个建议
  similarities.sort((a, b) => b.similarity - a.similarity);
  return similarities.slice(0, 3).map(s => s.name);
}

// 新增: 记录字段名称分布
async function recordFieldDistribution(unmappedFields) {
  for (const field of unmappedFields) {
    await prisma.fieldDistribution.upsert({
      where: { fieldName: field.name },
      update: {
        count: { increment: 1 },
        lastSeen: new Date(),
        schemas: { push: field.schema }
      },
      create: {
        fieldName: field.name,
        count: 1,
        lastSeen: new Date(),
        schemas: [field.schema]
      }
    });
  }
}

// 新增: 获取高频未映射字段
async function getHighFrequencyUnmappedFields(limit = 50) {
  return await prisma.fieldDistribution.findMany({
    orderBy: { count: 'desc' },
    take: limit
  });
}
```

**优化效果预期**:
- **算法映射率**: 70-80%(精确匹配 + 相似度 + 同义词)
- **LLM 映射率**: 10-15%(仅在算法失败时,50% 概率调用)
- **映射失败率**: 5-10%(接受部分字段无法映射)
- **Token 控制**: 通过缓存和批量处理,减少 80% 的 LLM 调用

### 5. Schema Matcher

**职责**: 计算 CKB 字段与 Schema 的完整度评分

**接口**:
```typescript
interface SchemaMatcher {
  matchSchemas(fields: Field[], schemas: Schema[]): SchemaScore[];
  calculateCompleteness(fields: Field[], schema: Schema, sourceConfidence: number): number;
}

interface SchemaScore {
  schema_name: string;
  matched_fields: string[];
  missing_fields: string[];
  completeness: number;
}
```

**完整度计算公式**:
```
Completeness = Σ(字段命中次数 × 字段权重) × 来源置信度

示例:
Schema: 地下水位变化事件
  - 区域 (weight: 0.3, required: true)
  - 时间 (weight: 0.2, required: true)
  - 指标 (weight: 0.2, required: true)
  - 数值 (weight: 0.2, required: false)
  - 单位 (weight: 0.1, required: false)
  - threshold: 0.75

Fields: [区域=阿里C区, 时间=2025-01, 指标=水位, 数值=10, 单位=米]
Completeness = (1×0.3 + 1×0.2 + 1×0.2 + 1×0.2 + 1×0.1) × 0.9 = 0.9

触发实体实例化: 0.9 ≥ 0.75 ✓
```

### 6. Entity Builder (Enhanced with LLM)

**职责**: 当 Schema 完整度达到阈值时,实例化实体,采用混合策略提高实体质量

**接口**:
```typescript
interface EntityBuilder {
  buildEntity(schemaScore: SchemaScore, fields: Field[], ckb: CKB): Promise<Entity>;
  generateCanonicalName(fields: Field[], schema: Schema): Promise<string>;
  mergeEntity(existingEntity: Entity, newCKB: CKB): Promise<Entity>;
  enrichEntityWithLLM(entity: Entity, ckb: CKB): Promise<Entity>;
  resolveEntityConflicts(entities: Entity[]): Promise<Entity>;
}

interface Entity {
  entity_id: string;
  entity_type: string;
  canonical_name: string;
  aliases: string[];  // 新增: 实体别名
  schemas: SchemaReference[];
  supported_by: string[];  // CKB IDs
  attributes: Record<string, any>;
  confidence: number;
  llm_enriched: boolean;  // 新增: 标记是否经过 LLM 增强
  created_at: string;
  updated_at: string;
}

interface SchemaReference {
  schema_name: string;
  confidence: number;
}
```

**混合策略(50% LLM 参与)**:

1. **规范名称生成(规则优先 + LLM 增强)**:
   ```javascript
   async function generateCanonicalName(fields, schema) {
     // 第一步: 规则生成基础名称
     let canonicalName;
     if (schema.entity_type === 'EventEntity') {
       canonicalName = `${fields.区域}_${fields.指标}_${fields.时间}`;
     } else if (schema.entity_type === 'LocationEntity') {
       canonicalName = fields.区域;
     } else {
       // 通用规则: 使用最重要的字段
       const topField = schema.core_fields.sort((a, b) => b.weight - a.weight)[0];
       canonicalName = fields[topField.name];
     }
     
     // 第二步: LLM 标准化(50% 概率,或名称不规范时)
     if (Math.random() < 0.5 || !isWellFormed(canonicalName)) {
       const prompt = `标准化以下实体名称:
       原始名称: ${canonicalName}
       实体类型: ${schema.entity_type}
       上下文: ${ckb.content.text}
       
       要求:
       1. 去除冗余词汇
       2. 统一格式(如"阿里C区" vs "阿里 C 区")
       3. 提供 2-3 个常见别名
       
       输出 JSON: {"canonical_name": "...", "aliases": ["...", "..."]}`;
       
       const result = await llmClient.call(prompt);
       return {
         canonical_name: result.canonical_name,
         aliases: result.aliases
       };
     }
     
     return { canonical_name: canonicalName, aliases: [] };
   }
   ```

2. **实体合并(智能冲突消解)**:
   ```javascript
   async function mergeEntity(existingEntity, newCKB, newFields) {
     // 检查是否为同一实体(考虑别名)
     const isSameEntity = 
       existingEntity.canonical_name === newCanonicalName ||
       existingEntity.aliases.includes(newCanonicalName);
     
     if (isSameEntity) {
       // 简单合并
       existingEntity.supported_by.push(newCKB.ckb_id);
       existingEntity.confidence = calculateConfidence(existingEntity.supported_by);
       return existingEntity;
     }
     
     // 可能是同一实体但名称不同,使用 LLM 判断
     if (Math.random() < 0.3) {  // 30% 概率使用 LLM 消歧
       const prompt = `判断以下两个实体是否为同一实体:
       实体1: ${existingEntity.canonical_name}
         属性: ${JSON.stringify(existingEntity.attributes)}
       实体2: ${newCanonicalName}
         属性: ${JSON.stringify(newFields)}
       
       输出 JSON: {"is_same": true/false, "confidence": 0.9, "reason": "..."}`;
       
       const result = await llmClient.call(prompt);
       if (result.is_same && result.confidence > 0.8) {
         // 合并并添加别名
         existingEntity.aliases.push(newCanonicalName);
         existingEntity.supported_by.push(newCKB.ckb_id);
         existingEntity.confidence = calculateConfidence(existingEntity.supported_by);
         return existingEntity;
       }
     }
     
     // 创建新实体
     return createNewEntity(newCanonicalName, newFields, newCKB);
   }
   ```

3. **实体属性增强(LLM 提取隐含信息)**:
   ```javascript
   async function enrichEntityWithLLM(entity, ckb) {
     // 仅对重要实体(高置信度或多 CKB 支撑)进行增强
     if (entity.confidence < 0.8 || entity.supported_by.length < 3) {
       return entity;
     }
     
     const prompt = `从文本中提取实体的额外属性:
     实体: ${entity.canonical_name}
     类型: ${entity.entity_type}
     文本: ${ckb.content.text}
     
     已知属性: ${JSON.stringify(entity.attributes)}
     
     请提取以下类型的属性(如果存在):
     - 数值属性(大小、数量、比例等)
     - 时间属性(发生时间、持续时间等)
     - 空间属性(位置、范围等)
     - 状态属性(状态、趋势等)
     
     输出 JSON: {"additional_attributes": {"key": "value", ...}}`;
     
     const result = await llmClient.call(prompt);
     entity.attributes = { ...entity.attributes, ...result.additional_attributes };
     entity.llm_enriched = true;
     return entity;
   }
   ```

4. **批量实体消歧(减少 LLM 调用)**:
   ```javascript
   async function resolveEntityConflicts(entities) {
     // 找出可能重复的实体(名称相似度高)
     const conflicts = findSimilarEntities(entities);
     
     if (conflicts.length === 0) return entities;
     
     // 批量调用 LLM 消歧
     const prompt = `判断以下实体组中哪些是同一实体:
     ${conflicts.map((group, i) => 
       `组${i+1}:\n${group.map(e => `  - ${e.canonical_name}: ${JSON.stringify(e.attributes)}`).join('\n')}`
     ).join('\n\n')}
     
     输出 JSON: {"merges": [{"group_id": 0, "merge_ids": [0, 2], "canonical": "..."}]}`;
     
     const result = await llmClient.call(prompt);
     // 执行合并
     return applyMerges(entities, result.merges);
   }
   ```

**优化效果预期**:
- **实体准确性**: 从 70-80% 提升到 85-95%(通过别名和消歧)
- **属性丰富度**: 提取更多隐含属性,提高实体信息完整度
- **重复率降低**: 通过智能合并,减少 30-50% 的重复实体
- **Token 控制**: 通过概率采样和批量处理,保持 50% LLM 参与率

### 7. Relation Builders

#### 7.1 Built-in Relation Builder

**职责**: 根据 Schema 定义生成确定性关系(0 Token)

**接口**:
```typescript
interface BuiltinRelationBuilder {
  buildRelations(entity: Entity, schema: Schema, fields: Field[]): Promise<Relation[]>;
}
```

**实现示例**:
```javascript
// Schema 定义
{
  "schema_name": "地下水位变化事件",
  "relations": [
    {"type": "发生于", "target_field": "区域", "direction": "outgoing"},
    {"type": "发生时间", "target_field": "时间", "direction": "outgoing"}
  ]
}

// 生成关系
for (const relTemplate of schema.relations) {
  const targetValue = fields.find(f => f.name === relTemplate.target_field)?.value;
  const targetEntity = await entityStore.findByValue(targetValue);
  if (targetEntity) {
    relations.push({
      source_id: entity.entity_id,
      target_id: targetEntity.entity_id,
      type: relTemplate.type,
      confidence: 1.0,  // 确定性关系
      evidence_ckb: [ckb.ckb_id]
    });
  }
}
```

#### 7.2 Co-occurrence Relation Builder

**职责**: 基于统计方法生成共现关系(0 Token)

**接口**:
```typescript
interface CooccurrenceRelationBuilder {
  buildCooccurrenceRelations(ckbs: CKB[]): Promise<Relation[]>;
  calculateWeight(cooccurrenceCount: number, sourceWeights: number[]): number;
}
```

**实现策略**:
```javascript
// 统计共现
const cooccurrenceMap = new Map();
for (const ckb of ckbs) {
  const entities = await entityStore.findByCKB(ckb.ckb_id);
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const key = `${entities[i].entity_id}_${entities[j].entity_id}`;
      if (!cooccurrenceMap.has(key)) {
        cooccurrenceMap.set(key, { count: 0, ckbs: [], weights: [] });
      }
      const entry = cooccurrenceMap.get(key);
      entry.count++;
      entry.ckbs.push(ckb.ckb_id);
      entry.weights.push(ckb.quality.source_confidence);
    }
  }
}

// 生成关系
for (const [key, entry] of cooccurrenceMap) {
  const weight = entry.count * (entry.weights.reduce((a, b) => a + b) / entry.weights.length);
  if (weight >= threshold) {
    relations.push({
      source_id: key.split('_')[0],
      target_id: key.split('_')[1],
      type: 'co_occurrence',
      weight: weight,
      evidence_ckb: entry.ckbs
    });
  }
}
```

#### 7.3 Semantic Relation Builder (Enhanced with LLM)

**职责**: 使用 LLM 抽取语义关系,采用混合策略平衡准确性和成本

**接口**:
```typescript
interface SemanticRelationBuilder {
  extractSemanticRelations(ckb: CKB, entities: Entity[]): Promise<Relation[]>;
  shouldUseLLM(ckb: CKB, entities: Entity[]): boolean;
  extractWithConfidenceScoring(ckb: CKB, entities: Entity[]): Promise<Relation[]>;
}
```

**混合策略(50% LLM 参与)**:

1. **触发条件分层**:
   ```javascript
   function shouldUseLLM(ckb, entities) {
     // 高优先级场景(必须用 LLM,约 30%)
     if (containsCausalKeywords(ckb.content.text)) return true;  // "导致"、"因为"、"由于"
     if (containsComparisonKeywords(ckb.content.text)) return true;  // "优于"、"相比"
     if (entities.length >= 3) return true;  // 多实体场景,关系复杂
     
     // 中优先级场景(随机采样 20%)
     if (Math.random() < 0.2) return true;  // 随机采样,发现新模式
     
     // 低优先级场景(不用 LLM,约 50%)
     return false;  // 简单共现关系已足够
   }
   ```

2. **增强的 LLM Prompt(提供更多上下文)**:
   ```javascript
   const prompt = `你是一个知识图谱关系抽取专家。请从文本中识别实体间的语义关系。

   文本: ${ckb.content.text}
   
   已识别实体:
   ${entities.map(e => `- ${e.canonical_name} (类型: ${e.type})`).join('\n')}
   
   任务:
   1. 识别实体间的明确关系(因果、对比、包含、影响等)
   2. 为每个关系评估置信度(0-1)
   3. 提供支持该关系的文本片段
   
   输出 JSON:
   {
     "relations": [
       {
         "subject": "实体A",
         "relation": "导致",
         "object": "实体B",
         "confidence": 0.85,
         "evidence_text": "支持该关系的原文片段"
       }
     ]
   }
   
   注意:
   - 只输出明确的关系,不要推测
   - 置信度低于 0.7 的关系不要输出
   - 关系类型包括: 导致、影响、包含、属于、优于、劣于、相关、对比`;
   ```

3. **多轮验证机制**:
   ```javascript
   async function extractWithConfidenceScoring(ckb, entities) {
     // 第一轮: LLM 抽取候选关系
     const candidates = await llmClient.call(prompt);
     
     // 第二轮: 规则验证(提高准确性)
     const validated = candidates.relations.filter(rel => {
       // 验证实体存在性
       if (!validateEntities(rel.subject, rel.object, entities)) return false;
       
       // 验证文本证据(evidence_text 必须在原文中)
       if (!ckb.content.text.includes(rel.evidence_text)) return false;
       
       // 验证关系方向性(某些关系有方向约束)
       if (!validateRelationDirection(rel, entities)) return false;
       
       return true;
     });
     
     // 第三轮: 置信度加权(结合 LLM 置信度和规则验证)
     return validated.map(rel => ({
       source_id: findEntityId(rel.subject, entities),
       target_id: findEntityId(rel.object, entities),
       type: 'semantic',
       subtype: rel.relation,
       confidence: rel.confidence * 0.9,  // LLM 置信度打折
       evidence_ckb: [ckb.ckb_id],
       evidence_text: rel.evidence_text,
       validation_score: calculateValidationScore(rel, ckb)
     }));
   }
   ```

4. **关系类型丰富化**:
   ```javascript
   const RELATION_TYPES = {
     causal: ['导致', '引起', '造成', '产生'],
     influence: ['影响', '作用于', '改变'],
     comparison: ['优于', '劣于', '相似于', '不同于'],
     containment: ['包含', '属于', '是...的一部分'],
     temporal: ['先于', '后于', '同时发生'],
     spatial: ['位于', '邻近', '远离']
   };
   ```

5. **成本控制策略**:
   ```javascript
   // Token 预算管理
   const TOKEN_BUDGET = {
     daily_limit: 100000,
     per_ckb_limit: 500,
     priority_multiplier: {
       high: 2.0,    // 高优先级场景可用更多 Token
       medium: 1.0,
       low: 0.5
     }
   };
   
   // 批量处理优化
   async function batchExtractRelations(ckbs) {
     // 合并多个 CKB 到一个 LLM 请求
     const batch = ckbs.slice(0, 5);  // 每批最多 5 个
     const prompt = `批量抽取以下文本的关系:\n${batch.map((ckb, i) => 
       `文本${i+1}: ${ckb.content.text}`
     ).join('\n\n')}`;
     // 减少网络开销,提高吞吐量
   }
   ```

**优化效果预期**:
- **准确性提升**: 从纯规则的 60-70% 提升到 80-90%
- **召回率提升**: 发现更多复杂语义关系(因果、对比等)
- **Token 控制**: 通过分层触发,仅在必要时使用 LLM,保持 50% 参与率
- **可解释性**: 每个关系都有 evidence_text,可追溯到原文

### 8. Confidence Engine

**职责**: 计算和管理实体、关系的置信度

**接口**:
```typescript
interface ConfidenceEngine {
  calculateEntityConfidence(entity: Entity): number;
  calculateRelationConfidence(relation: Relation): number;
  updateConfidenceOnCKBChange(ckbId: string, changeType: 'add' | 'update' | 'delete'): Promise<void>;
  filterLowQualityData(threshold: number): Promise<void>;
}
```

**置信度计算**:
```javascript
// 实体置信度
Entity.confidence = Σ(CKB.source_confidence) / CKB 数量

// 关系置信度
if (relation.type === 'builtin') {
  Relation.confidence = 1.0;
} else if (relation.type === 'co_occurrence') {
  Relation.confidence = relation.weight / max_weight;
} else if (relation.type === 'semantic') {
  Relation.confidence = llm_confidence × source_entity.confidence × target_entity.confidence;
}
```

### 9. KG Store

**职责**: 持久化和查询知识图谱数据

**接口**:
```typescript
interface KGStore {
  // Entity operations
  saveEntity(entity: Entity): Promise<void>;
  getEntity(entityId: string): Promise<Entity>;
  findEntitiesByType(type: string): Promise<Entity[]>;
  findEntitiesByConfidence(minConfidence: number): Promise<Entity[]>;
  deleteEntity(entityId: string): Promise<void>;
  
  // Relation operations
  saveRelation(relation: Relation): Promise<void>;
  getRelation(relationId: string): Promise<Relation>;
  findRelationsBySource(sourceId: string): Promise<Relation[]>;
  findRelationsByTarget(targetId: string): Promise<Relation[]>;
  findRelationsByType(type: string): Promise<Relation[]>;
  deleteRelation(relationId: string): Promise<void>;
  
  // Graph traversal
  traverse(startEntityId: string, depth: number, relationTypes?: string[]): Promise<Graph>;
  
  // CKB operations
  saveCKB(ckb: CKB): Promise<void>;
  getCKB(ckbId: string): Promise<CKB>;
  findCKBsByDocument(docId: string): Promise<CKB[]>;
  deleteCKB(ckbId: string): Promise<void>;
}
```

## Data Models

### 数据库表设计

#### 1. ckb 表
```sql
CREATE TABLE ckb (
  id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL,
  source_type TEXT NOT NULL,  -- word | pdf | excel | image | video
  source_meta JSON,
  structure JSON,
  content JSON NOT NULL,
  quality JSON NOT NULL,
  timestamps JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX idx_ckb_doc_id ON ckb(doc_id);
CREATE INDEX idx_ckb_source_type ON ckb(source_type);
```

#### 2. schemas 表
```sql
CREATE TABLE schemas (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  entity_type TEXT NOT NULL,
  scene TEXT NOT NULL,  -- 新增: 场景分类
  core_fields JSON NOT NULL,
  threshold REAL NOT NULL,
  relations JSON,
  example_description TEXT,  -- 新增: 示例描述
  description TEXT,  -- 新增: Schema 描述
  active BOOLEAN DEFAULT TRUE,  -- 新增: 是否启用
  version TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_schemas_entity_type ON schemas(entity_type);
CREATE INDEX idx_schemas_scene ON schemas(scene);  -- 新增: 场景索引
CREATE INDEX idx_schemas_active ON schemas(active);  -- 新增: 启用状态索引
```

#### 3. kg_entities 表
```sql
CREATE TABLE kg_entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  schemas JSON NOT NULL,
  supported_by JSON NOT NULL,  -- Array of CKB IDs
  attributes JSON,
  confidence REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kg_entities_type ON kg_entities(type);
CREATE INDEX idx_kg_entities_canonical_name ON kg_entities(canonical_name);
CREATE INDEX idx_kg_entities_confidence ON kg_entities(confidence);
```

#### 4. kg_relations 表
```sql
CREATE TABLE kg_relations (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  type TEXT NOT NULL,  -- builtin | co_occurrence | semantic
  subtype TEXT,
  weight REAL,
  confidence REAL NOT NULL,
  evidence_ckb JSON NOT NULL,  -- Array of CKB IDs
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES kg_entities(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES kg_entities(id) ON DELETE CASCADE
);

CREATE INDEX idx_kg_relations_source ON kg_relations(source_id);
CREATE INDEX idx_kg_relations_target ON kg_relations(target_id);
CREATE INDEX idx_kg_relations_type ON kg_relations(type);
CREATE INDEX idx_kg_relations_confidence ON kg_relations(confidence);
```

#### 5. kg_token_usage 表
```sql
CREATE TABLE kg_token_usage (
  id TEXT PRIMARY KEY,
  module TEXT NOT NULL,  -- field_extractor | entity_builder | semantic_relation
  ckb_id TEXT,
  model_name TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  cost REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ckb_id) REFERENCES ckb(id) ON DELETE SET NULL
);

CREATE INDEX idx_kg_token_usage_module ON kg_token_usage(module);
CREATE INDEX idx_kg_token_usage_created_at ON kg_token_usage(created_at);
```

### JSON 字段结构

#### CKB.source_meta
```json
{
  "file_name": "report.pdf",
  "page": 5,
  "sheet": "Sheet1",
  "cell_range": "A2:D2",
  "time_range": "03:20-03:50",
  "bbox": [100, 200, 300, 400]
}
```

#### CKB.structure
```json
{
  "section_title": "3.2 数据分析",
  "level": 2,
  "parent_section": "3. 数据治理"
}
```

#### CKB.content
```json
{
  "text": "阿里C区2025年1月水位下降10米",
  "language": "zh",
  "keywords": ["阿里C区", "水位", "下降"],
  "entities": []
}
```

#### CKB.quality
```json
{
  "source_confidence": 0.9,
  "ocr": false,
  "asr": false
}
```

#### Schema.core_fields
```json
[
  {"name": "区域", "weight": 0.3, "required": true},
  {"name": "时间", "weight": 0.2, "required": true},
  {"name": "指标", "weight": 0.2, "required": true},
  {"name": "数值", "weight": 0.2, "required": false},
  {"name": "单位", "weight": 0.1, "required": false}
]
```

#### Schema.relations
```json
[
  {"type": "发生于", "target_field": "区域", "direction": "outgoing"},
  {"type": "发生时间", "target_field": "时间", "direction": "outgoing"},
  {"type": "影响指标", "target_field": "指标", "direction": "outgoing"}
]
```

#### Entity.schemas
```json
[
  {"schema_name": "地下水位变化事件", "confidence": 0.92},
  {"schema_name": "区域水文状态", "confidence": 0.85}
]
```

#### Entity.supported_by
```json
["ckb_001", "ckb_014", "ckb_087"]
```

#### Relation.evidence_ckb
```json
["ckb_001", "ckb_045"]
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: CKB Parsing Completeness

*For any* document with structured content (Word/PDF paragraphs, Excel rows), parsing should generate at least one CKB per structural unit, and each CKB should contain non-empty text content.

**Validates: Requirements 1.1, 1.2, 1.3, 1.7**

### Property 2: Source Confidence Consistency

*For any* CKB generated from OCR or ASR sources, the source_confidence value should be lower than manually created content (OCR: 0.5-0.7, ASR: 0.4-0.6, manual: 0.9-1.0).

**Validates: Requirements 1.4, 1.5, 1.8**

### Property 3: CKB-Document Traceability

*For any* CKB, querying by its doc_id should return the CKB, and deleting the source document should cascade delete all associated CKBs.

**Validates: Requirements 1.9, 1.10**

### Property 4: Field Extraction Determinism

*For any* CKB with the same content, extracting fields multiple times should produce the same field list (when using rule-based extraction).

**Validates: Requirements 2.1, 2.2, 2.9**

### Property 5: Field Type Validity

*For any* extracted field, the type should be one of: location, time, number, unit, indicator, entity, and the confidence should be between 0 and 1.

**Validates: Requirements 2.4, 2.5**

### Property 6: Time Field Standardization

*For any* extracted time field, the value should be in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ).

**Validates: Requirements 2.10**

### Property 7: Schema Completeness Calculation

*For any* set of fields and a schema, the completeness score should be calculated as: Σ(field_match_count × field_weight) × source_confidence, and the result should be between 0 and 1.

**Validates: Requirements 3.5**

### Property 8: Schema Threshold Triggering

*For any* schema with completeness score ≥ threshold, entity instantiation should be triggered; if completeness < threshold, no entity should be created.

**Validates: Requirements 3.4, 4.1**

### Property 9: Entity-CKB Bidirectional Association

*For any* entity, all CKB IDs in supported_by should exist in the ckb table, and querying those CKBs should return references to the entity.

**Validates: Requirements 4.4, 4.9**

### Property 10: Entity Confidence Calculation

*For any* entity, the confidence should equal the average of source_confidence values from all supporting CKBs: Entity.confidence = Σ(CKB.source_confidence) / CKB_count.

**Validates: Requirements 4.7, 8.1**

### Property 11: Entity Merging Idempotence

*For any* existing entity, adding a new CKB with the same canonical_name should update the supported_by list and recalculate confidence, not create a duplicate entity.

**Validates: Requirements 4.6**

### Property 12: Built-in Relation Determinism

*For any* entity instantiated from a schema with relation templates, the same set of built-in relations should be generated every time (given the same target entities exist).

**Validates: Requirements 5.1, 5.2, 5.7**

### Property 13: Built-in Relation Confidence

*For any* built-in relation generated from schema templates, the confidence should always be 1.0 (deterministic relation).

**Validates: Requirements 5.4**

### Property 14: Co-occurrence Relation Weight Calculation

*For any* pair of entities, the co-occurrence relation weight should equal: co_occurrence_count × average(source_confidence_values), and should only be created if weight ≥ threshold.

**Validates: Requirements 6.3, 6.4**

### Property 15: Co-occurrence Relation Symmetry

*For any* two entities A and B, if a co-occurrence relation exists from A to B, the weight and evidence_ckb should be identical to the relation from B to A (undirected relation).

**Validates: Requirements 6.1, 6.2**

### Property 16: Semantic Relation Validation

*For any* semantic relation candidate returned by LLM, both subject and object must correspond to existing entities, and confidence must be ≥ 0.7 to be accepted.

**Validates: Requirements 7.5, 7.9**

### Property 17: Low Confidence Entity Filtering

*For any* entity with confidence < deletion_threshold (0.4), the entity should be automatically deleted along with all its relations.

**Validates: Requirements 8.3**

### Property 18: Confidence Cascade Update

*For any* CKB deletion, all entities supported by that CKB should have their confidence recalculated, and entities falling below threshold should be deleted.

**Validates: Requirements 8.9, 4.10**

### Property 19: Relation Confidence Dependency

*For any* semantic relation, the relation confidence should be ≤ min(source_entity.confidence, target_entity.confidence).

**Validates: Requirements 8.4**

### Property 20: Graph Traversal Completeness

*For any* entity and depth N, traversing the graph should return all entities reachable within N hops through any relation type (unless filtered).

**Validates: Requirements 9.8**

### Property 21: Incremental Update Isolation

*For any* document modification, only CKBs, entities, and relations associated with that document should be recomputed; unrelated graph components should remain unchanged.

**Validates: Requirements 10.1, 10.2, 10.10**

### Property 22: Traceability Round-trip

*For any* entity or relation, following the supported_by or evidence_ckb links should lead to valid CKBs, and those CKBs should reference back to the entity/relation.

**Validates: Requirements 10.4, 10.5**

### Property 23: Token Minimization for Schema Operations

*For any* schema matching or built-in relation generation operation, zero LLM tokens should be consumed (pure rule-based).

**Validates: Requirements 11.2, 11.3**

### Property 24: Token Minimization for Co-occurrence

*For any* co-occurrence relation generation, zero LLM tokens should be consumed (pure statistical).

**Validates: Requirements 11.4**

### Property 25: LLM Call Caching

*For any* identical LLM query (same prompt and parameters), the result should be retrieved from cache, avoiding redundant API calls.

**Validates: Requirements 11.7**

### Property 26: API Response Format Consistency

*For any* successful API call, the response should contain {success: true, data: {...}, metadata: {...}}; for failures, {success: false, error_code: "...", message: "...", details: {...}}.

**Validates: Requirements 12.9, 12.10**

### Property 27: Entity Type Visualization Consistency

*For any* entity displayed in the visualization, entities of the same type should use the same color and icon.

**Validates: Requirements 13.2**

### Property 28: Relation Weight Visual Mapping

*For any* relation displayed in the visualization, the edge thickness should be proportional to the relation's weight or confidence value.

**Validates: Requirements 13.4**

### Property 29: Intelligent Field Truncating Effectiveness

*For any* LLM field mapping call with intelligent truncating, the number of selected fields should be ≤ maxFields (default 5), and all selected fields should have a relevance score ≥ minScore (default 30) or be in the top N (default 3) highest-scoring fields.

**Validates: Requirements 19.1, 19.5, 19.6, 19.7**

### Property 30: Field Truncating Token Savings

*For any* LLM field mapping call with intelligent truncating enabled, the Token consumption should be at least 40% less than without truncating (when schema has > 5 fields).

**Validates: Requirements 19.14**

### Property 31: Field Truncating Scene Adaptation

*For any* schema with scene="科研/政府", the maxFields should be ≥ 6; for scene="个人生活", maxFields should be ≤ 4; for scene="摄影", maxFields should be ≥ 7.

**Validates: Requirements 19.8, 19.9, 19.10**

### Property 32: Field Selection Score Calculation

*For any* field selection, the total score should be calculated as: importanceScore × 0.3 + semanticScore × 0.5 + contextScore × 0.2, where each component score is between 0 and 100.

**Validates: Requirements 19.2, 19.3, 19.4, 19.5**

## Performance and Cost Management

### 性能约束设计

**目标**: 本地处理 1 秒内完成，总时延不超过 30 秒

**性能优化策略**:

1. **本地处理优化(< 1 秒)**:
   ```javascript
   class PerformanceMonitor {
     async measureLocalProcessing(ckb) {
       const startTime = Date.now();
       
       try {
         // 字段抽取 (目标 < 300ms)
         const extractStart = Date.now();
         const fields = await fieldExtractor.extractFields(ckb);
         const extractTime = Date.now() - extractStart;
         
         // Schema 匹配 (目标 < 200ms)
         const matchStart = Date.now();
         const schemaScores = await schemaMatcher.matchSchemas(fields, schemas);
         const matchTime = Date.now() - matchStart;
         
         // 字段清洗 (目标 < 500ms, 不含 LLM)
         const normalizeStart = Date.now();
         const normalizedFields = await fieldNormalizer.normalizeFields(fields, schema, { skipLLM: true });
         const normalizeTime = Date.now() - normalizeStart;
         
         const totalTime = Date.now() - startTime;
         
         // 记录性能指标
         await this.recordMetrics({
           ckb_id: ckb.id,
           extract_time: extractTime,
           match_time: matchTime,
           normalize_time: normalizeTime,
           total_local_time: totalTime,
           is_within_budget: totalTime < 1000
         });
         
         if (totalTime > 1000) {
           console.warn(`Local processing exceeded 1s: ${totalTime}ms for CKB ${ckb.id}`);
           await this.triggerPerformanceAlert('local_processing_slow', { ckb_id: ckb.id, time: totalTime });
         }
         
         return { fields, schemaScores, normalizedFields, metrics: { totalTime } };
       } catch (error) {
         console.error('Local processing error:', error);
         throw error;
       }
     }
   }
   ```

2. **LLM 调用超时控制**:
   ```javascript
   class LLMClient {
     async callWithTimeout(prompt, options = {}) {
       const {
         timeout = 5000,  // 默认 5 秒超时
         fallback = null,
         retries = 2
       } = options;
       
       for (let attempt = 0; attempt <= retries; attempt++) {
         try {
           const result = await Promise.race([
             this.call(prompt, options),
             new Promise((_, reject) => 
               setTimeout(() => reject(new Error('LLM timeout')), timeout)
             )
           ]);
           return result;
         } catch (error) {
           if (error.message === 'LLM timeout') {
             console.warn(`LLM timeout on attempt ${attempt + 1}/${retries + 1}`);
             if (attempt === retries) {
               // 最后一次尝试失败，使用 fallback
               if (fallback) {
                 console.log('Using fallback result');
                 return fallback;
               }
               throw error;
             }
           } else {
             throw error;
           }
         }
       }
     }
   }
   
   // 使用示例
   async function llmMatch(rawFieldName, schemaFields, context) {
     try {
       const result = await llmClient.callWithTimeout(prompt, {
         timeout: 5000,
         fallback: null,  // 超时则跳过映射
         retries: 1
       });
       return result;
     } catch (error) {
       console.error('LLM mapping failed:', error);
       return null;  // 映射失败，使用算法结果
     }
   }
   ```

3. **总时延控制**:
   ```javascript
   class DocumentProcessor {
     async processDocument(docId, options = {}) {
       const { maxTime = 30000 } = options;  // 30 秒总时延限制
       const startTime = Date.now();
       
       try {
         // 1. CKB 解析 (目标 < 5s)
         const ckbs = await this.parseToCKB(docId);
         this.checkTimeout(startTime, maxTime, 'CKB parsing');
         
         // 2. 并行处理 CKB (目标 < 20s)
         const results = await Promise.all(
           ckbs.map(ckb => this.processCKB(ckb, { 
             deadline: startTime + maxTime 
           }))
         );
         this.checkTimeout(startTime, maxTime, 'CKB processing');
         
         // 3. 实体构建 (目标 < 5s)
         const entities = await this.buildEntities(results);
         this.checkTimeout(startTime, maxTime, 'Entity building');
         
         const totalTime = Date.now() - startTime;
         
         if (totalTime > maxTime) {
           console.warn(`Document processing exceeded ${maxTime}ms: ${totalTime}ms`);
           await this.triggerPerformanceAlert('document_processing_slow', { 
             doc_id: docId, 
             time: totalTime 
           });
         }
         
         return { entities, metrics: { totalTime } };
       } catch (error) {
         if (error.message === 'Timeout exceeded') {
           console.error(`Document processing timeout: ${docId}`);
           // 返回部分结果
           return { entities: [], partial: true, error: 'timeout' };
         }
         throw error;
       }
     }
     
     checkTimeout(startTime, maxTime, stage) {
       const elapsed = Date.now() - startTime;
       if (elapsed > maxTime) {
         throw new Error(`Timeout exceeded at stage: ${stage}`);
       }
     }
   }
   ```

### Token 消耗管理

**目标**: 单文档 < 5000 tokens，每日 < 100000 tokens

**Token 预算管理**:

```javascript
class TokenBudgetManager {
  constructor() {
    this.dailyLimit = 100000;
    this.perDocLimit = 5000;
    this.warningThreshold = 0.8;
    this.currentUsage = 0;
    this.lastResetDate = new Date().toDateString();
  }
  
  async checkAndResetDaily() {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      // 新的一天，重置计数
      this.currentUsage = 0;
      this.lastResetDate = today;
      console.log('Daily token budget reset');
    }
  }
  
  async recordUsage(module, tokens, metadata = {}) {
    await this.checkAndResetDaily();
    
    this.currentUsage += tokens;
    
    // 记录到数据库
    await prisma.kGTokenUsage.create({
      data: {
        module,
        ckbId: metadata.ckb_id,
        modelName: metadata.model_name || 'qwen',
        inputTokens: metadata.input_tokens || 0,
        outputTokens: metadata.output_tokens || 0,
        totalTokens: tokens,
        cost: this.calculateCost(tokens, metadata.model_name)
      }
    });
    
    // 检查预算
    const usageRate = this.currentUsage / this.dailyLimit;
    
    if (usageRate >= 1.0) {
      console.error('Daily token budget exceeded!');
      await this.triggerAlert('budget_exceeded', { 
        usage: this.currentUsage, 
        limit: this.dailyLimit 
      });
      // 降级服务
      this.enableEmergencyMode();
    } else if (usageRate >= this.warningThreshold) {
      console.warn(`Token budget at ${(usageRate * 100).toFixed(1)}%`);
      await this.triggerAlert('budget_warning', { 
        usage: this.currentUsage, 
        limit: this.dailyLimit,
        remaining: this.dailyLimit - this.currentUsage
      });
    }
    
    return {
      allowed: usageRate < 1.0,
      remaining: this.dailyLimit - this.currentUsage,
      usageRate
    };
  }
  
  async checkDocumentBudget(docId, estimatedTokens) {
    if (estimatedTokens > this.perDocLimit) {
      console.warn(`Document ${docId} estimated tokens ${estimatedTokens} exceeds limit ${this.perDocLimit}`);
      await this.triggerAlert('document_budget_exceeded', { 
        doc_id: docId, 
        estimated: estimatedTokens, 
        limit: this.perDocLimit 
      });
      return false;
    }
    return true;
  }
  
  enableEmergencyMode() {
    // 降低 LLM 调用频率
    config.llm_participation_rate = 0.2;  // 从 50% 降到 20%
    config.enable_entity_enrichment = false;  // 禁用实体增强
    config.semantic_relation_sampling_rate = 0.1;  // 降低语义关系采样
    console.log('Emergency mode enabled: LLM usage reduced');
  }
  
  calculateCost(tokens, modelName = 'qwen') {
    const pricing = {
      'qwen': 0.002 / 1000,  // $0.002 per 1K tokens
      'deepseek': 0.001 / 1000
    };
    return tokens * (pricing[modelName] || pricing['qwen']);
  }
  
  async getStats(timeRange = '24h') {
    const since = new Date(Date.now() - this.parseTimeRange(timeRange));
    
    const stats = await prisma.kGTokenUsage.groupBy({
      by: ['module'],
      where: { createdAt: { gte: since } },
      _sum: { totalTokens: true },
      _count: true
    });
    
    const totalTokens = stats.reduce((sum, s) => sum + (s._sum.totalTokens || 0), 0);
    const totalCost = await this.calculateTotalCost(since);
    
    return {
      timeRange,
      totalTokens,
      totalCost,
      byModule: stats,
      averagePerCall: totalTokens / stats.reduce((sum, s) => sum + s._count, 0),
      dailyUsage: this.currentUsage,
      dailyLimit: this.dailyLimit,
      usageRate: this.currentUsage / this.dailyLimit
    };
  }
  
  parseTimeRange(range) {
    const units = { 'h': 3600000, 'd': 86400000, 'w': 604800000 };
    const match = range.match(/^(\d+)([hdw])$/);
    if (!match) return 86400000;  // 默认 24 小时
    return parseInt(match[1]) * units[match[2]];
  }
}

// 全局实例
const tokenBudget = new TokenBudgetManager();
```

### 性能监控面板

**实时监控指标**:

```javascript
class PerformanceMonitor {
  async getDashboardMetrics() {
    const now = Date.now();
    const last24h = new Date(now - 86400000);
    
    // 1. 处理时延统计
    const latencyStats = await prisma.performanceMetrics.aggregate({
      where: { createdAt: { gte: last24h } },
      _avg: {
        extractTime: true,
        matchTime: true,
        normalizeTime: true,
        totalLocalTime: true
      },
      _max: {
        totalLocalTime: true
      }
    });
    
    // 2. Token 消耗统计
    const tokenStats = await tokenBudget.getStats('24h');
    
    // 3. 吞吐量统计
    const throughput = await prisma.ckb.count({
      where: { createdAt: { gte: last24h } }
    });
    
    // 4. 缓存命中率
    const cacheStats = await this.getCacheStats();
    
    // 5. 错误率
    const errorRate = await this.getErrorRate(last24h);
    
    // 6. 队列积压
    const queueBacklog = await this.getQueueBacklog();
    
    return {
      latency: {
        avgExtract: latencyStats._avg.extractTime,
        avgMatch: latencyStats._avg.matchTime,
        avgNormalize: latencyStats._avg.normalizeTime,
        avgTotal: latencyStats._avg.totalLocalTime,
        maxTotal: latencyStats._max.totalLocalTime,
        withinBudget: latencyStats._avg.totalLocalTime < 1000
      },
      tokens: tokenStats,
      throughput: {
        ckbsProcessed: throughput,
        ckbsPerHour: throughput / 24
      },
      cache: cacheStats,
      errors: errorRate,
      queue: queueBacklog,
      health: this.calculateHealthScore({
        latency: latencyStats._avg.totalLocalTime,
        tokenUsage: tokenStats.usageRate,
        errorRate: errorRate.rate,
        cacheHitRate: cacheStats.hitRate
      })
    };
  }
  
  calculateHealthScore(metrics) {
    let score = 100;
    
    // 时延扣分
    if (metrics.latency > 1000) score -= 20;
    else if (metrics.latency > 800) score -= 10;
    
    // Token 使用率扣分
    if (metrics.tokenUsage > 0.9) score -= 30;
    else if (metrics.tokenUsage > 0.8) score -= 15;
    
    // 错误率扣分
    if (metrics.errorRate > 0.1) score -= 25;
    else if (metrics.errorRate > 0.05) score -= 10;
    
    // 缓存命中率加分
    if (metrics.cacheHitRate > 0.7) score += 10;
    
    return Math.max(0, Math.min(100, score));
  }
}
```

### 自动性能优化

**性能分析和优化建议**:

```javascript
class PerformanceOptimizer {
  async analyzeAndOptimize() {
    const metrics = await performanceMonitor.getDashboardMetrics();
    const recommendations = [];
    
    // 1. 分析时延瓶颈
    if (metrics.latency.avgTotal > 1000) {
      const bottleneck = this.identifyBottleneck(metrics.latency);
      recommendations.push({
        type: 'latency',
        severity: 'high',
        issue: `${bottleneck} is slow (${metrics.latency[`avg${bottleneck}`]}ms)`,
        suggestion: this.getLatencyOptimization(bottleneck)
      });
    }
    
    // 2. 分析 Token 消耗
    if (metrics.tokens.usageRate > 0.8) {
      recommendations.push({
        type: 'token',
        severity: 'high',
        issue: `Token usage at ${(metrics.tokens.usageRate * 100).toFixed(1)}%`,
        suggestion: [
          '提高算法映射阈值，减少 LLM 调用',
          '增加缓存过期时间',
          '降低 LLM 参与率 (当前 50% → 建议 30%)',
          '禁用非关键的实体增强功能'
        ]
      });
    }
    
    // 3. 分析缓存效率
    if (metrics.cache.hitRate < 0.5) {
      recommendations.push({
        type: 'cache',
        severity: 'medium',
        issue: `Cache hit rate low (${(metrics.cache.hitRate * 100).toFixed(1)}%)`,
        suggestion: [
          '优化缓存键设计，提高命中率',
          '增加缓存容量',
          '调整缓存过期策略'
        ]
      });
    }
    
    // 4. 分析队列积压
    if (metrics.queue.backlog > 100) {
      recommendations.push({
        type: 'queue',
        severity: 'high',
        issue: `Queue backlog: ${metrics.queue.backlog} tasks`,
        suggestion: [
          '增加并发处理数',
          '优化处理逻辑，提高吞吐量',
          '考虑扩容或分布式处理'
        ]
      });
    }
    
    return {
      health: metrics.health,
      metrics,
      recommendations,
      autoApplied: await this.applyAutoOptimizations(recommendations)
    };
  }
  
  identifyBottleneck(latency) {
    const stages = {
      Extract: latency.avgExtract,
      Match: latency.avgMatch,
      Normalize: latency.avgNormalize
    };
    return Object.keys(stages).reduce((a, b) => stages[a] > stages[b] ? a : b);
  }
  
  getLatencyOptimization(stage) {
    const optimizations = {
      Extract: [
        '优化正则表达式',
        '使用更快的 NER 模型',
        '减少字段类型判断逻辑'
      ],
      Match: [
        '添加 Schema 索引',
        '使用缓存存储常用 Schema',
        '并行计算完整度评分'
      ],
      Normalize: [
        '优化字符串相似度算法',
        '增加同义词词典覆盖率',
        '减少 LLM 调用频率'
      ]
    };
    return optimizations[stage] || [];
  }
  
  async applyAutoOptimizations(recommendations) {
    const applied = [];
    
    for (const rec of recommendations) {
      if (rec.severity === 'high' && rec.type === 'token') {
        // 自动降低 LLM 参与率
        config.llm_participation_rate *= 0.8;
        applied.push('Reduced LLM participation rate');
      }
      
      if (rec.type === 'cache' && rec.severity === 'medium') {
        // 自动增加缓存过期时间
        config.cache_ttl *= 1.5;
        applied.push('Increased cache TTL');
      }
    }
    
    return applied;
  }
}
```

## Error Handling

### CKB Parsing Errors

1. **Unsupported File Format**: Return error with supported formats list
2. **Corrupted File**: Log error, skip file, notify user
3. **OCR/ASR Failure**: Set source_confidence to minimum (0.3), log warning
4. **Empty Content**: Skip CKB creation, log warning

### Field Extraction Errors

1. **LLM API Timeout**: Retry with exponential backoff (max 3 attempts)
2. **LLM API Rate Limit**: Queue request, retry after delay
3. **Invalid Field Format**: Log warning, mark field as low confidence
4. **No Fields Extracted**: Return empty array, log info

### Schema Matching Errors

1. **No Schema Matched**: Log info, skip entity creation
2. **Multiple High-Score Schemas**: Select highest score, log info
3. **Missing Required Fields**: Lower completeness score, may not trigger entity

### Entity Building Errors

1. **Duplicate Canonical Name**: Merge with existing entity
2. **LLM Canonical Name Generation Failure**: Use fallback rule-based name
3. **Database Constraint Violation**: Rollback transaction, log error

### Relation Building Errors

1. **Target Entity Not Found**: Skip relation creation, log warning
2. **Circular Relation**: Allow (valid in knowledge graphs)
3. **Duplicate Relation**: Update evidence_ckb and weight, don't create new

### Database Errors

1. **Connection Failure**: Retry with exponential backoff, alert admin
2. **Transaction Deadlock**: Retry transaction
3. **Disk Full**: Alert admin, pause processing

### API Errors

1. **Invalid Request Parameters**: Return 400 with validation errors
2. **Resource Not Found**: Return 404 with error message
3. **Internal Server Error**: Return 500, log stack trace
4. **Rate Limiting**: Return 429 with Retry-After header

## Testing Strategy

### Dual Testing Approach

This system requires both **unit tests** and **property-based tests** for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs using randomized testing

### Unit Testing

Unit tests should focus on:

1. **Specific Examples**
   - Parse a sample Word document and verify CKB structure
   - Extract fields from "阿里C区2025年1月水位下降10米" and verify expected fields
   - Match fields against "地下水位变化事件" schema and verify completeness score

2. **Edge Cases**
   - Empty document → no CKBs generated
   - Document with only whitespace → no CKBs generated
   - Excel with no table header → each row still generates CKB
   - OCR with very low confidence → source_confidence set correctly

3. **Error Conditions**
   - Corrupted PDF → error logged, processing continues
   - LLM API timeout → retry logic triggered
   - Database connection failure → transaction rolled back

4. **Integration Points**
   - Document upload → CKB creation → field extraction → entity creation pipeline
   - Entity deletion → cascade delete relations
   - CKB deletion → entity confidence update

### Property-Based Testing

Property tests should be configured with **minimum 100 iterations** per test. Each test must reference its design document property using the tag format:

```javascript
// Feature: schema-driven-knowledge-graph, Property 1: CKB Parsing Completeness
```

**Property Test Library**: Use `fast-check` for JavaScript/TypeScript

**Example Property Tests**:

1. **Property 1: CKB Parsing Completeness**
   ```javascript
   // Feature: schema-driven-knowledge-graph, Property 1: CKB Parsing Completeness
   fc.assert(
     fc.property(
       fc.record({
         paragraphs: fc.array(fc.string({ minLength: 1 }), { minLength: 1 })
       }),
       async (doc) => {
         const ckbs = await ckbParser.parseDocument(doc);
         expect(ckbs.length).toBeGreaterThanOrEqual(doc.paragraphs.length);
         ckbs.forEach(ckb => {
           expect(ckb.content.text).not.toBe('');
         });
       }
     ),
     { numRuns: 100 }
   );
   ```

2. **Property 7: Schema Completeness Calculation**
   ```javascript
   // Feature: schema-driven-knowledge-graph, Property 7: Schema Completeness Calculation
   fc.assert(
     fc.property(
       fc.array(fc.record({
         name: fc.constantFrom('区域', '时间', '指标', '数值', '单位'),
         value: fc.string(),
         confidence: fc.float({ min: 0, max: 1 })
       })),
       fc.float({ min: 0, max: 1 }), // source_confidence
       (fields, sourceConfidence) => {
         const schema = getTestSchema();
         const completeness = schemaMatcher.calculateCompleteness(fields, schema, sourceConfidence);
         expect(completeness).toBeGreaterThanOrEqual(0);
         expect(completeness).toBeLessThanOrEqual(1);
       }
     ),
     { numRuns: 100 }
   );
   ```

3. **Property 10: Entity Confidence Calculation**
   ```javascript
   // Feature: schema-driven-knowledge-graph, Property 10: Entity Confidence Calculation
   fc.assert(
     fc.property(
       fc.array(fc.float({ min: 0, max: 1 }), { minLength: 1 }),
       (ckbConfidences) => {
         const entity = createTestEntity(ckbConfidences);
         const expectedConfidence = ckbConfidences.reduce((a, b) => a + b) / ckbConfidences.length;
         expect(entity.confidence).toBeCloseTo(expectedConfidence, 5);
       }
     ),
     { numRuns: 100 }
   );
   ```

4. **Property 14: Co-occurrence Relation Weight Calculation**
   ```javascript
   // Feature: schema-driven-knowledge-graph, Property 14: Co-occurrence Relation Weight Calculation
   fc.assert(
     fc.property(
       fc.integer({ min: 1, max: 10 }), // co-occurrence count
       fc.array(fc.float({ min: 0, max: 1 }), { minLength: 1 }), // source confidences
       (count, confidences) => {
         const weight = cooccurrenceBuilder.calculateWeight(count, confidences);
         const expectedWeight = count * (confidences.reduce((a, b) => a + b) / confidences.length);
         expect(weight).toBeCloseTo(expectedWeight, 5);
       }
     ),
     { numRuns: 100 }
   );
   ```

5. **Property 22: Traceability Round-trip**
   ```javascript
   // Feature: schema-driven-knowledge-graph, Property 22: Traceability Round-trip
   fc.assert(
     fc.property(
       fc.record({
         entity_id: fc.uuid(),
         supported_by: fc.array(fc.uuid(), { minLength: 1 })
       }),
       async (entity) => {
         await entityStore.saveEntity(entity);
         for (const ckbId of entity.supported_by) {
           const ckb = await ckbStore.getCKB(ckbId);
           expect(ckb).toBeDefined();
           const entitiesFromCKB = await entityStore.findByCKB(ckbId);
           expect(entitiesFromCKB.some(e => e.entity_id === entity.entity_id)).toBe(true);
         }
       }
     ),
     { numRuns: 100 }
   );
   ```

### Test Coverage Goals

- **Unit Test Coverage**: ≥ 80% line coverage
- **Property Test Coverage**: All 28 correctness properties implemented
- **Integration Test Coverage**: All API endpoints tested
- **Performance Test Coverage**: All performance requirements (Req 14) validated

### Testing Tools

- **Unit Testing**: Jest
- **Property-Based Testing**: fast-check
- **API Testing**: Supertest
- **Performance Testing**: Artillery or k6
- **Coverage**: Istanbul/nyc

### Continuous Integration

- Run all tests on every commit
- Block merge if tests fail or coverage drops
- Generate coverage reports
- Track property test failure rates


## Project Integration and Deployment

### 与现有项目的集成策略

#### 1. 模块化集成

知识图谱系统作为独立模块集成到现有项目,保持松耦合:

```
personal-knowledge-base/
├── kg/                          # 新增: 知识图谱模块
│   ├── ckb/
│   │   ├── ckb_parser.js
│   │   └── ckb_store.js
│   ├── field_extractor/
│   │   ├── field_extractor.js
│   │   ├── rule_extractor.js
│   │   └── llm_extractor.js
│   ├── schema/
│   │   ├── schema_manager.js
│   │   └── schema_matcher.js
│   ├── entity/
│   │   ├── entity_builder.js
│   │   └── entity_store.js
│   ├── relation/
│   │   ├── builtin_relation_builder.js
│   │   ├── cooccurrence_relation_builder.js
│   │   ├── semantic_relation_builder.js
│   │   └── relation_store.js
│   ├── confidence/
│   │   ├── confidence_engine.js
│   │   └── quality_filter.js
│   ├── prompts/
│   │   ├── extract_fields.js
│   │   ├── schema_score.js
│   │   ├── entity_build.js
│   │   └── relation_candidate.js
│   └── index.js                 # 模块入口
├── routes/
│   ├── knowledgeGraphRoutes.js  # 新增: KG API 路由
│   └── ...                      # 现有路由
├── client/src/
│   ├── pages/
│   │   ├── KnowledgeGraph/      # 增强: 现有页面
│   │   │   ├── SchemaKG.tsx     # 新增: Schema 驱动的 KG 视图
│   │   │   ├── CKBExplorer.tsx  # 新增: CKB 浏览器
│   │   │   └── ...
│   │   └── ...
│   └── ...
├── prisma/
│   └── schema.prisma            # 扩展: 添加 KG 相关表
└── ...
```

#### 2. 数据库集成

扩展现有 Prisma schema,添加知识图谱相关表:

```prisma
// prisma/schema.prisma

// 新增: CKB 表
model CKB {
  id            String   @id @default(uuid())
  docId         String   @map("doc_id")
  sourceType    String   @map("source_type")
  sourceMeta    Json     @map("source_meta")
  structure     Json
  content       Json
  quality       Json
  timestamps    Json
  createdAt     DateTime @default(now()) @map("created_at")
  
  document      Document @relation(fields: [docId], references: [id], onDelete: Cascade)
  
  @@map("ckb")
  @@index([docId])
  @@index([sourceType])
}

// 新增: Schema 表
model Schema {
  id          String   @id @default(uuid())
  name        String   @unique
  entityType  String   @map("entity_type")
  coreFields  Json     @map("core_fields")
  threshold   Float
  relations   Json?
  version     String
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  
  @@map("schemas")
  @@index([entityType])
}

// 新增: KG 实体表
model KGEntity {
  id            String       @id @default(uuid())
  type          String
  canonicalName String       @map("canonical_name")
  aliases       Json?
  schemas       Json
  supportedBy   Json         @map("supported_by")
  attributes    Json?
  confidence    Float
  llmEnriched   Boolean      @default(false) @map("llm_enriched")
  createdAt     DateTime     @default(now()) @map("created_at")
  updatedAt     DateTime     @updatedAt @map("updated_at")
  
  relationsAsSource KGRelation[] @relation("SourceEntity")
  relationsAsTarget KGRelation[] @relation("TargetEntity")
  
  @@map("kg_entities")
  @@index([type])
  @@index([canonicalName])
  @@index([confidence])
}

// 新增: KG 关系表
model KGRelation {
  id          String   @id @default(uuid())
  sourceId    String   @map("source_id")
  targetId    String   @map("target_id")
  type        String
  subtype     String?
  weight      Float?
  confidence  Float
  evidenceCkb Json     @map("evidence_ckb")
  evidenceText String? @map("evidence_text")
  metadata    Json?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  
  source      KGEntity @relation("SourceEntity", fields: [sourceId], references: [id], onDelete: Cascade)
  target      KGEntity @relation("TargetEntity", fields: [targetId], references: [id], onDelete: Cascade)
  
  @@map("kg_relations")
  @@index([sourceId])
  @@index([targetId])
  @@index([type])
  @@index([confidence])
}

// 新增: KG Token 使用记录表
model KGTokenUsage {
  id           String   @id @default(uuid())
  module       String
  ckbId        String?  @map("ckb_id")
  modelName    String   @map("model_name")
  inputTokens  Int      @map("input_tokens")
  outputTokens Int      @map("output_tokens")
  totalTokens  Int      @map("total_tokens")
  cost         Float?
  createdAt    DateTime @default(now()) @map("created_at")
  
  @@map("kg_token_usage")
  @@index([module])
  @@index([createdAt])
}

// 扩展: Document 表(添加 CKB 关联)
model Document {
  // ... 现有字段
  ckbs        CKB[]
}
```

#### 3. API 集成

在现有 Express 服务器中注册知识图谱路由:

```javascript
// server.js
const knowledgeGraphRoutes = require('./routes/knowledgeGraphRoutes');

// ... 现有路由
app.use('/api/knowledge-graph', knowledgeGraphRoutes);
```

新增 API 端点:

```javascript
// routes/knowledgeGraphRoutes.js
const express = require('express');
const router = express.Router();
const kgController = require('../kg/controllers/kgController');

// CKB 管理
router.post('/ckb/parse', kgController.parseToCKB);
router.get('/ckb/:id', kgController.getCKB);
router.get('/ckb/document/:docId', kgController.getCKBsByDocument);

// Schema 管理
router.get('/schemas', kgController.listSchemas);
router.post('/schemas', kgController.createSchema);
router.put('/schemas/:id', kgController.updateSchema);
router.delete('/schemas/:id', kgController.deleteSchema);

// 实体查询
router.get('/entities', kgController.getEntities);
router.get('/entities/:id', kgController.getEntity);
router.get('/entities/search', kgController.searchEntities);

// 关系查询
router.get('/relations', kgController.getRelations);
router.get('/relations/:id', kgController.getRelation);

// 图遍历
router.post('/traverse', kgController.traverseGraph);

// 知识图谱构建
router.post('/build', kgController.buildKG);
router.post('/rebuild', kgController.rebuildKG);
router.post('/update', kgController.updateKG);

// 统计信息
router.get('/stats', kgController.getStats);
router.get('/stats/tokens', kgController.getTokenStats);

module.exports = router;
```

#### 4. 前端集成

增强现有知识图谱页面,添加 Schema 驱动视图:

```typescript
// client/src/pages/KnowledgeGraph/SchemaKG.tsx
import React, { useEffect, useState } from 'react';
import { Graph } from '@antv/g6';
import { Card, Select, Slider, Switch, Tabs } from 'antd';

const SchemaKG: React.FC = () => {
  const [entities, setEntities] = useState([]);
  const [relations, setRelations] = useState([]);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.6);
  const [showBuiltinRelations, setShowBuiltinRelations] = useState(true);
  const [showCooccurrenceRelations, setShowCooccurrenceRelations] = useState(true);
  const [showSemanticRelations, setShowSemanticRelations] = useState(true);

  useEffect(() => {
    fetchKGData();
  }, [confidenceThreshold]);

  const fetchKGData = async () => {
    const response = await fetch(`/api/knowledge-graph/entities?minConfidence=${confidenceThreshold}`);
    const data = await response.json();
    setEntities(data.entities);
    setRelations(filterRelations(data.relations));
  };

  const filterRelations = (relations) => {
    return relations.filter(rel => {
      if (rel.type === 'builtin' && !showBuiltinRelations) return false;
      if (rel.type === 'co_occurrence' && !showCooccurrenceRelations) return false;
      if (rel.type === 'semantic' && !showSemanticRelations) return false;
      return true;
    });
  };

  return (
    <Card title="Schema 驱动知识图谱">
      <div style={{ marginBottom: 16 }}>
        <label>置信度阈值: {confidenceThreshold}</label>
        <Slider
          min={0}
          max={1}
          step={0.1}
          value={confidenceThreshold}
          onChange={setConfidenceThreshold}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <Switch checked={showBuiltinRelations} onChange={setShowBuiltinRelations} />
        <span style={{ marginLeft: 8 }}>内建关系</span>
        <Switch checked={showCooccurrenceRelations} onChange={setShowCooccurrenceRelations} style={{ marginLeft: 16 }} />
        <span style={{ marginLeft: 8 }}>共现关系</span>
        <Switch checked={showSemanticRelations} onChange={setShowSemanticRelations} style={{ marginLeft: 16 }} />
        <span style={{ marginLeft: 8 }}>语义关系</span>
      </div>
      <div id="kg-container" style={{ width: '100%', height: 600 }} />
    </Card>
  );
};

export default SchemaKG;
```

#### 5. 事件钩子集成

在现有文档操作中添加知识图谱更新钩子:

```javascript
// routes/documentRoutes.js (现有文件)
const kgService = require('../kg/services/kgService');

// 文档创建后触发 KG 构建
router.post('/', async (req, res) => {
  const document = await createDocument(req.body);
  
  // 异步触发 KG 构建(不阻塞响应)
  kgService.processDocument(document.id).catch(err => {
    console.error('KG build error:', err);
  });
  
  res.json(document);
});

// 文档更新后触发 KG 增量更新
router.put('/:id', async (req, res) => {
  const document = await updateDocument(req.params.id, req.body);
  
  // 异步触发 KG 增量更新
  kgService.updateDocument(document.id).catch(err => {
    console.error('KG update error:', err);
  });
  
  res.json(document);
});

// 文档删除后触发 KG 清理
router.delete('/:id', async (req, res) => {
  await deleteDocument(req.params.id);
  
  // 异步触发 KG 清理
  kgService.deleteDocument(req.params.id).catch(err => {
    console.error('KG cleanup error:', err);
  });
  
  res.json({ success: true });
});
```

### GitHub 部署和共享策略

#### 1. 分支策略

```
main                    # 稳定版本
├── develop             # 开发分支
│   ├── feature/kg-ckb-layer          # CKB 层开发
│   ├── feature/kg-schema-matching    # Schema 匹配开发
│   ├── feature/kg-entity-building    # 实体构建开发
│   └── feature/kg-relation-building  # 关系构建开发
└── release/v2.0        # 包含 KG 功能的发布分支
```

#### 2. 提交规范

使用 Conventional Commits 规范:

```bash
# 新功能
git commit -m "feat(kg): implement CKB parser for Word documents"

# Bug 修复
git commit -m "fix(kg): correct entity confidence calculation"

# 文档更新
git commit -m "docs(kg): add Schema definition guide"

# 性能优化
git commit -m "perf(kg): optimize co-occurrence relation calculation"

# 重构
git commit -m "refactor(kg): extract LLM client to separate module"
```

#### 3. Pull Request 模板

创建 `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## 变更描述
<!-- 简要描述本次 PR 的变更内容 -->

## 变更类型
- [ ] 新功能 (feat)
- [ ] Bug 修复 (fix)
- [ ] 性能优化 (perf)
- [ ] 重构 (refactor)
- [ ] 文档更新 (docs)
- [ ] 测试 (test)

## 知识图谱模块
- [ ] CKB 层
- [ ] Schema 层
- [ ] 实体层
- [ ] 关系层
- [ ] API 层
- [ ] 前端可视化

## 测试清单
- [ ] 单元测试通过
- [ ] 属性测试通过 (如适用)
- [ ] 集成测试通过
- [ ] 手动测试通过

## Token 消耗
<!-- 如果涉及 LLM 调用,请说明 Token 消耗情况 -->
- 预估 Token 消耗: XXX tokens/document
- 优化措施: ...

## 截图/演示
<!-- 如果有 UI 变更,请提供截图或 GIF -->

## 相关 Issue
Closes #XXX
```

#### 4. CI/CD 配置

创建 `.github/workflows/kg-tests.yml`:

```yaml
name: Knowledge Graph Tests

on:
  push:
    branches: [ main, develop, 'feature/kg-*' ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: |
        npm install
        cd client && npm install
    
    - name: Run Prisma migrations
      run: npx prisma migrate dev
    
    - name: Run unit tests
      run: npm test -- --coverage
    
    - name: Run property-based tests
      run: npm run test:property
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        files: ./coverage/lcov.info
    
    - name: Check Token usage
      run: npm run check:tokens
```

#### 5. 文档结构

```
docs/
├── kg/
│   ├── README.md                    # KG 模块总览
│   ├── architecture.md              # 架构设计
│   ├── schema-guide.md              # Schema 定义指南
│   ├── api-reference.md             # API 参考
│   ├── deployment.md                # 部署指南
│   └── examples/
│       ├── schema-examples.json     # Schema 示例
│       ├── ckb-examples.json        # CKB 示例
│       └── query-examples.md        # 查询示例
└── ...
```

#### 6. 环境变量配置

更新 `.env.example`:

```bash
# 现有配置
DATABASE_URL="file:./knowledge-base.db"
QWEN_API_KEY=your_qwen_api_key
DEEPSEEK_API_KEY=your_deepseek_api_key

# 知识图谱配置
KG_ENABLED=true
KG_LLM_PARTICIPATION_RATE=0.5          # LLM 参与率 (0-1)
KG_ENTITY_CONFIDENCE_THRESHOLD=0.6     # 实体置信度阈值
KG_RELATION_CONFIDENCE_THRESHOLD=0.5   # 关系置信度阈值
KG_TOKEN_DAILY_LIMIT=100000            # 每日 Token 限额
KG_BATCH_SIZE=10                       # 批处理大小
KG_ENABLE_CACHING=true                 # 启用 LLM 缓存
```

#### 7. 版本发布流程

```bash
# 1. 完成功能开发
git checkout develop
git merge feature/kg-*

# 2. 创建发布分支
git checkout -b release/v2.0

# 3. 更新版本号
npm version minor  # 2.0.0

# 4. 更新 CHANGELOG
# 编辑 CHANGELOG.md,添加新功能说明

# 5. 合并到 main
git checkout main
git merge release/v2.0

# 6. 打标签
git tag -a v2.0.0 -m "Release v2.0.0: Schema-driven Knowledge Graph"

# 7. 推送到 GitHub
git push origin main --tags

# 8. 创建 GitHub Release
# 在 GitHub 上创建 Release,附上 CHANGELOG
```

#### 8. README 更新

更新项目 `README.md`,添加知识图谱功能说明:

```markdown
# 个人智能知识库

## 新功能: Schema 驱动知识图谱 🎉

### 特性
- ✅ **CKB 层**: 文档解析为最小可引用事实单元
- ✅ **Schema 驱动**: 通过 Schema 定义自动构建实体
- ✅ **混合策略**: 规则优先 + LLM 增强,Token 消耗减少 90%
- ✅ **三类关系**: 内建关系、共现关系、语义关系
- ✅ **置信度管理**: 自动过滤低质量数据
- ✅ **可追溯性**: 每个实体和关系都能回溯到源文档

### 快速开始

1. 安装依赖
```bash
npm install
cd client && npm install
```

2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env,设置 API keys
```

3. 运行数据库迁移
```bash
npx prisma migrate dev
```

4. 启动服务
```bash
npm run dev
```

5. 访问知识图谱
打开浏览器访问 `http://localhost:3000/knowledge-graph`

### 文档
- [架构设计](docs/kg/architecture.md)
- [Schema 定义指南](docs/kg/schema-guide.md)
- [API 参考](docs/kg/api-reference.md)

### 贡献
欢迎提交 Issue 和 Pull Request!请参考 [贡献指南](CONTRIBUTING.md)。
```

### 部署检查清单

- [ ] 数据库迁移脚本已测试
- [ ] 环境变量已配置
- [ ] API 端点已测试
- [ ] 前端页面已测试
- [ ] 单元测试覆盖率 ≥ 80%
- [ ] 属性测试全部通过
- [ ] Token 消耗在预算内
- [ ] 文档已更新
- [ ] CHANGELOG 已更新
- [ ] GitHub Release 已创建
