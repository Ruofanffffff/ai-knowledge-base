# 文件上传处理全流程文档

## 最新更新 (2026-02-04)

### 知识图谱可视化修复
- **问题**: 图谱页面显示硬编码的演示数据,而不是真实的知识图谱数据
- **解决方案**: 添加了 GET `/api/knowledge-graph` 端点,返回可视化就绪的图谱数据
- **变更内容**:
  1. 在 `routes/knowledgeGraphRoutes.js` 中添加新端点 (约第1970行)
  2. 前端 `Graph.tsx` 已配置为调用此端点
  3. 端点返回前端可视化所需的节点和链接格式

### API 端点详情
**GET /api/knowledge-graph**
- 返回用于可视化的节点(实体)和链接(关系)
- 查询参数:
  - `minConfidence`: 最小置信度阈值 (默认: 0.5)
  - `maxNodes`: 最大节点数 (默认: 100)
  - `entityType`: 按实体类型过滤 (可选)
  - `relationType`: 按关系类型过滤 (可选)
- 响应格式:
  ```json
  {
    "success": true,
    "nodes": [
      {
        "id": "entity_id",
        "label": "canonical_name",
        "type": "entity_type",
        "confidence": 0.9
      }
    ],
    "links": [
      {
        "source": "source_entity_id",
        "target": "target_entity_id",
        "relation": "relation_type",
        "confidence": 0.85
      }
    ],
    "metadata": {
      "nodeCount": 10,
      "linkCount": 15,
      "minConfidence": 0.5
    }
  }
  ```

---

## 概述

本文档详细描述了从前端上传文件到后端处理、知识图谱构建的完整流程。

## 流程架构图

```
前端 (React)
    ↓
文件选择/拖拽
    ↓
FormData 封装
    ↓
API 调用 (/api/upload)
    ↓
后端 (Express + Multer)
    ↓
文件保存到 uploads/
    ↓
文件解析 (docx/pdf/txt)
    ↓
创建文档记录
    ↓
触发知识图谱钩子
    ↓
知识图谱构建流程
    ↓
返回响应给前端
```

---

## 1. 前端文件上传

### 1.1 组件位置
- **文件**: `client/src/pages/DocumentsList.tsx`
- **API工具**: `client/src/utils/api.ts`

### 1.2 上传触发方式

#### 方式一：点击上传按钮
```tsx
<button onClick={() => fileInputRef.current?.click()}>
  <Upload size={16} /> 上传文件
</button>
<input 
  type="file" 
  ref={fileInputRef} 
  multiple 
  onChange={handleFileSelect} 
  className="hidden" 
/>
```

#### 方式二：拖拽上传
```tsx
<div
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={handleDrop}
>
  {/* 拖拽区域 */}
</div>
```

### 1.3 文件处理流程

```typescript
const handleFiles = (files: File[]) => {
  // 1. 初始化上传状态
  const newUploads: UploadFile[] = files.map(f => ({ 
    id: Date.now() + Math.random(),
    name: f.name, 
    size: f.size, 
    progress: 0,
    status: 'waiting'
  }));
  
  setUploadingFiles(prev => [...prev, ...newUploads]);
  
  // 2. 逐个上传文件
  files.forEach((file, index) => {
    setTimeout(() => {
      // 更新状态为上传中
      setUploadingFiles(prev => 
        prev.map(u => u.name === file.name ? 
          { ...u, status: 'uploading' } : u
        )
      );
      
      // 3. 调用上传API
      uploadFile(file)
        .then(response => {
          // 上传成功
          setUploadingFiles(prev => 
            prev.map(u => u.name === file.name ? 
              { ...u, status: 'done', progress: 100 } : u
            )
          );
          
          // 添加到文档列表
          setDocs(prev => [...prev, response.document]);
        })
        .catch(error => {
          // 上传失败
          setUploadingFiles(prev => 
            prev.map(u => u.name === file.name ? 
              { ...u, status: 'error' } : u
            )
          );
        });
    }, index * 500); // 错开上传时间
  });
};
```

### 1.4 API调用

**文件**: `client/src/utils/api.ts`

```typescript
export const uploadFile = async (file: File) => {
  // 1. 创建 FormData
  const formData = new FormData();
  formData.append('file', file);

  // 2. 获取认证token
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  // 3. 发送请求
  const response = await fetch(`${SERVER_URL}/upload`, {
    method: 'POST',
    headers, // Content-Type 自动设置为 multipart/form-data
    body: formData,
  });

  if (!response.ok) throw new Error('Upload failed');
  return await response.json();
};
```

---

## 2. 后端文件接收

### 2.1 Multer配置

**文件**: `server.js`

```javascript
const multer = require('multer');
const path = require('path');

// 配置存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: function (req, file, cb) {
    // 生成唯一文件名: timestamp-originalname
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// 创建上传目录
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
}
```

### 2.2 上传路由

```javascript
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    // 1. 检查文件是否存在
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { filename, path: filePath, originalname, size, mimetype } = req.file;
    
    // 2. 根据文件类型进行解析
    let content = '';
    let fileType = path.extname(originalname).toLowerCase();
    
    // 3. 文件内容提取
    if (fileType === '.txt' || fileType === '.md') {
      content = fs.readFileSync(filePath, 'utf8');
    } else if (fileType === '.docx') {
      // 解析 docx 文件
      const data = fs.readFileSync(filePath);
      const zip = await JSZip.loadAsync(data);
      const docXml = await zip.file('word/document.xml').async('string');
      const textMatches = docXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
      if (textMatches) {
        content = textMatches.map(match => 
          match.replace(/<[^>]*>/g, '')
        ).join('\n');
      }
    }
    
    // 4. 修复中文文件名乱码
    let title = originalname.replace(fileType, '');
    title = Buffer.from(title, 'latin1').toString('utf8');
    
    // 5. 创建文档记录
    const document = {
      id: (mockDocuments.length + 1).toString(),
      title: title,
      content,
      type: 'document',
      fileType: fileType,
      metadata: {
        filename,
        originalname: Buffer.from(originalname, 'latin1').toString('utf8'),
        size,
        mimetype,
        filePath
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    mockDocuments.push(document);
    saveDocuments(mockDocuments);
    
    // 6. 触发知识图谱构建钩子（异步）
    console.log('[Upload] 文档上传成功，开始触发知识图谱构建...');
    onDocumentCreated(document, { async: true, skipIfExists: false })
      .then(result => {
        console.log('[KG Hook] 知识图谱构建结果:', result);
      })
      .catch(error => {
        console.error('[KG Hook] 知识图谱构建失败:', error);
      });
    
    // 7. 立即返回响应
    res.status(201).json(document);
    
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});
```

---

## 3. 知识图谱构建流程

### 3.1 文档钩子触发

**文件**: `kg/hooks/document_hooks.js`

```javascript
async function onDocumentCreated(document, options = {}) {
  const { async = true, skipIfExists = false } = options;
  
  try {
    console.log(`[KG Hook] 文档创建钩子触发: ${document.id}`);
    
    // 1. 检查是否启用KG
    if (process.env.KG_ENABLED === 'false') {
      return { skipped: true, reason: 'KG disabled' };
    }
    
    // 2. 检查是否已存在
    if (skipIfExists) {
      const existingCKB = await prisma.cKB.findFirst({
        where: { doc_id: document.id }
      });
      if (existingCKB) {
        return { skipped: true, reason: 'Already exists' };
      }
    }
    
    // 3. 选择处理模式
    const usePipeline = process.env.USE_PIPELINE === 'true';
    
    // 4. 异步执行
    if (async) {
      setImmediate(async () => {
        try {
          if (usePipeline) {
            // Pipeline 模式
            const pipeline = getPipelineInstance();
            const context = await pipeline.processDocument({
              id: document.id,
              type: 'text',
              title: document.title,
              content: document.content,
              metadata: document.metadata
            });
            console.log(`[KG Hook] Pipeline 处理完成: ${context.status}`);
          } else {
            // 传统 kgService 模式
            const filePath = document.metadata?.filePath;
            const fileType = document.fileType;
            await kgService.buildKnowledgeGraph(document.id, filePath, fileType);
            console.log(`[KG Hook] 知识图谱构建完成`);
          }
        } catch (error) {
          console.error(`[KG Hook] 构建失败:`, error);
        }
      });
      
      return { 
        success: true, 
        async: true,
        message: 'KG build started in background' 
      };
    }
  } catch (error) {
    console.error(`[KG Hook] 钩子执行失败:`, error);
    return { success: false, error: error.message };
  }
}
```

### 3.2 知识图谱服务流程

**文件**: `kg/services/kg_service.js`

```javascript
async function buildKnowledgeGraph(docId, filePath, fileType, options = {}) {
  const result = {
    doc_id: docId,
    ckbs_created: 0,
    entities_created: 0,
    relations_created: {
      builtin: 0,
      cooccurrence: 0,
      semantic: 0
    }
  };

  try {
    // Step 1: 解析文档为CKB (Contextual Knowledge Blocks)
    console.log(`[KG Service] 解析文档 ${docId}...`);
    const ckbs = await ckbParser.parseDocument(docId, filePath, fileType);
    result.ckbs_created = ckbs.length;

    // Step 2: 提取和规范化字段
    console.log(`[KG Service] 提取字段...`);
    for (const ckb of ckbs) {
      const rawFields = await fieldExtractor.extractFields(ckb);
      ckb.extracted_fields = rawFields;
    }

    // Step 3: 匹配Schema并构建实体
    console.log(`[KG Service] 匹配Schema并构建实体...`);
    const schemas = await schemaManager.listSchemas({ active: true });
    
    for (const ckb of ckbs) {
      if (!ckb.extracted_fields) continue;

      // 匹配Schema
      const schemaMatches = await schemaMatcher.matchSchemas(
        ckb.extracted_fields, 
        schemas
      );
      
      // 构建实体
      for (const match of schemaMatches) {
        if (match.completeness >= match.schema.threshold) {
          // 规范化字段
          const normalizedFields = await fieldNormalizer.normalizeFields(
            ckb.extracted_fields,
            match.schema,
            options
          );

          // 构建实体
          const entity = await entityBuilder.buildEntity(
            match.schema,
            normalizedFields,
            ckb,
            options
          );

          if (entity) {
            result.entities_created++;
            if (!ckb.entities) ckb.entities = [];
            ckb.entities.push(entity);
          }
        }
      }
    }

    // Step 4: 构建内置关系
    console.log(`[KG Service] 构建内置关系...`);
    for (const ckb of ckbs) {
      if (ckb.entities && ckb.entities.length > 0) {
        const builtinRelations = await builtinRelationBuilder
          .buildBuiltinRelations(ckb.entities);
        result.relations_created.builtin += builtinRelations.length;
      }
    }

    // Step 5: 构建共现关系
    console.log(`[KG Service] 构建共现关系...`);
    const cooccurrenceRelations = await cooccurrenceRelationBuilder
      .buildCooccurrenceRelations(ckbs);
    result.relations_created.cooccurrence = cooccurrenceRelations.length;

    // Step 6: 构建语义关系（可选）
    if (options.enableSemanticRelations) {
      console.log(`[KG Service] 构建语义关系...`);
      const semanticRelations = await semanticRelationBuilder
        .buildSemanticRelations(ckbs, options.llmClient);
      result.relations_created.semantic = semanticRelations.length;
    }

    console.log(`[KG Service] 知识图谱构建完成:`, result);
    return result;

  } catch (error) {
    console.error(`[KG Service] 构建失败:`, error);
    throw error;
  }
}
```

### 3.3 CKB解析器

**文件**: `kg/ckb/ckb_parser.js`

```javascript
async function parseDocument(docId, filePath, fileType) {
  console.log(`解析文档: ${docId}, 类型: ${fileType}`);
  
  let ckbs = [];
  
  switch (fileType.toLowerCase()) {
    case 'word':
    case 'docx':
    case 'doc':
      ckbs = await wordParser.parse(docId, filePath);
      break;
    
    case 'pdf':
      ckbs = await pdfParser.parse(docId, filePath);
      break;
    
    case 'excel':
    case 'xlsx':
    case 'xls':
      ckbs = await excelParser.parse(docId, filePath);
      break;
    
    default:
      throw new Error(`不支持的文件类型: ${fileType}`);
  }
  
  console.log(`从文档 ${docId} 解析出 ${ckbs.length} 个CKB`);
  return ckbs;
}
```

---

## 4. 数据流转

### 4.1 文件存储
```
uploads/
  ├── 1738123456789-文档1.docx
  ├── 1738123457890-文档2.pdf
  └── 1738123458901-文档3.txt
```

### 4.2 数据库存储

#### CKB表 (Contextual Knowledge Blocks)
```sql
CREATE TABLE CKB (
  ckb_id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL,
  content TEXT,
  context TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Entity表
```sql
CREATE TABLE Entity (
  entity_id TEXT PRIMARY KEY,
  schema_id TEXT NOT NULL,
  fields JSONB,
  confidence FLOAT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Relation表
```sql
CREATE TABLE Relation (
  relation_id TEXT PRIMARY KEY,
  source_entity_id TEXT,
  target_entity_id TEXT,
  relation_type TEXT,
  confidence FLOAT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 5. 配置选项

### 5.1 环境变量

```bash
# 是否启用知识图谱功能
KG_ENABLED=true

# 是否使用Pipeline模式
USE_PIPELINE=true

# Pipeline配置
PIPELINE_EXTRACTION_USE_LLM=false
PIPELINE_EXTRACTION_USE_NER=true
PIPELINE_EXTRACTION_USE_RULES=true

PIPELINE_NORMALIZATION_USE_LLM=false
PIPELINE_NORMALIZATION_USE_ALGORITHM=true

PIPELINE_ENTITY_USE_LLM=false
PIPELINE_ENTITY_ALLOW_PARTIAL=true

PIPELINE_RELATION_BUILTIN=true
PIPELINE_RELATION_COOCCURRENCE=true
PIPELINE_RELATION_SEMANTIC=false
```

### 5.2 上传选项

```javascript
// 前端
const uploadOptions = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: ['.txt', '.md', '.docx', '.pdf'],
  multiple: true
};

// 后端
const multerOptions = {
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /txt|md|docx|pdf/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    if (extname) {
      return cb(null, true);
    }
    cb(new Error('不支持的文件类型'));
  }
};
```

---

## 6. 错误处理

### 6.1 前端错误处理

```typescript
try {
  const response = await uploadFile(file);
  // 成功处理
} catch (error) {
  if (error.message.includes('Upload failed')) {
    showError('文件上传失败，请重试');
  } else if (error.message.includes('File too large')) {
    showError('文件太大，请选择小于10MB的文件');
  } else {
    showError('未知错误，请联系管理员');
  }
}
```

### 6.2 后端错误处理

```javascript
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    // 上传处理逻辑
  } catch (error) {
    console.error('Upload error:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        error: 'File too large',
        maxSize: '10MB'
      });
    }
    
    if (error.message.includes('Unsupported file type')) {
      return res.status(400).json({ 
        error: 'Unsupported file type',
        allowedTypes: ['.txt', '.md', '.docx', '.pdf']
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});
```

---

## 7. 性能优化

### 7.1 异步处理
- 文件上传后立即返回响应
- 知识图谱构建在后台异步执行
- 使用 `setImmediate` 避免阻塞主线程

### 7.2 批量处理
- 支持多文件同时上传
- 错开上传时间避免服务器压力
- 使用进度条显示上传状态

### 7.3 缓存机制
- 字段提取结果缓存
- Schema匹配结果缓存
- LLM调用结果缓存

---

## 8. 监控和日志

### 8.1 日志记录

```javascript
console.log('[Upload] 文档上传成功');
console.log('[KG Hook] 知识图谱构建开始');
console.log('[KG Service] 解析文档...');
console.log('[KG Service] 提取字段...');
console.log('[KG Service] 构建实体...');
console.log('[KG Service] 构建关系...');
console.log('[KG Service] 知识图谱构建完成');
```

### 8.2 性能监控

```javascript
const performanceMonitor = require('../utils/performance_monitor');

const timer = performanceMonitor.startTimer('kg_build');
// ... 知识图谱构建
performanceMonitor.endTimer(timer);

const metrics = performanceMonitor.getMetrics();
console.log('性能指标:', metrics);
```

---

## 9. 测试

### 9.1 单元测试
- 文件解析测试
- 字段提取测试
- 实体构建测试
- 关系构建测试

### 9.2 集成测试
- 端到端上传测试
- 知识图谱构建测试
- API响应测试

### 9.3 性能测试
- 大文件上传测试
- 并发上传测试
- 知识图谱构建性能测试

---

## 10. 常见问题

### Q1: 中文文件名乱码
**解决方案**: 使用 Buffer 转换编码
```javascript
const title = Buffer.from(originalname, 'latin1').toString('utf8');
```

### Q2: 文件上传失败
**检查项**:
- 文件大小是否超过限制
- 文件类型是否支持
- uploads 目录是否存在
- 磁盘空间是否充足

### Q3: 知识图谱构建失败
**检查项**:
- 文件内容是否可解析
- Schema是否正确配置
- 数据库连接是否正常
- 环境变量是否正确设置

---

## 11. 未来改进

1. **支持更多文件格式**
   - Excel (.xlsx, .xls)
   - PowerPoint (.pptx)
   - 图片 (OCR)
   - 视频 (ASR)

2. **增强错误处理**
   - 更详细的错误信息
   - 自动重试机制
   - 错误恢复策略

3. **性能优化**
   - 流式上传
   - 分块处理大文件
   - 并行处理多个CKB

4. **用户体验**
   - 实时进度更新
   - 预览功能
   - 批量操作

---

## 总结

文件上传处理流程涉及前端、后端、知识图谱构建等多个环节，每个环节都有详细的错误处理和日志记录。通过异步处理和缓存机制，系统能够高效地处理大量文件上传和知识图谱构建任务。
