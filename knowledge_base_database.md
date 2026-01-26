# 个人智能知识库数据库模型设计

## 一、数据库架构概述

系统采用**混合数据库架构**：
- **SQLite**：存储结构化数据（元数据、标签、实体关系等）
- **ChromaDB**：存储向量数据（文本嵌入，用于语义搜索）
- **文件系统**：存储原始文件（文档、图片、附件）

## 二、SQLite数据库模型（Prisma Schema）

```prisma
// 数据库连接配置
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// 1. 内容表：存储文档的核心信息和元数据
model Content {
  id            String      @id @default(cuid())
  title         String      @unique
  content       String?     // 文档正文（对于小文档直接存储，大文档存储路径）
  file_path     String?     // 大文档在文件系统中的存储路径
  file_type     String      // 文件类型：md, docx, pdf, txt
  summary       String?     // 自动生成的文档摘要
  author        String?     // 作者
  source_url    String?     // 来源链接
  created_at    DateTime    @default(now())
  updated_at    DateTime    @updatedAt
  user_id       String?     // 预留字段，支持多用户扩展
  
  // 关联关系
  tags          ContentTag[]
  entities      ContentEntity[]
  search_results SearchResult[]
  versions      ContentVersion[]
  
  @@index([title])
  @@index([created_at])
  @@index([file_type])
}

// 2. 内容版本表：存储文档的版本历史
model ContentVersion {
  id            String    @id @default(cuid())
  content_id    String
  content       String    // 版本内容
  version       Int       // 版本号
  created_at    DateTime  @default(now())
  updated_by    String?   // 更新人
  update_note   String?   // 更新说明
  
  // 关联关系
  content       Content   @relation(fields: [content_id], references: [id], onDelete: Cascade)
  
  @@index([content_id])
  @@index([version])
}

// 3. 标签表：存储所有标签
model Tag {
  id            String      @id @default(cuid())
  name          String      @unique
  description   String?     // 标签描述
  color         String?     // 标签颜色
  created_at    DateTime    @default(now())
  
  // 关联关系
  contents      ContentTag[]
  
  @@index([name])
}

// 4. 内容标签关联表：建立内容和标签的多对多关系
model ContentTag {
  content_id    String
  tag_id        String
  created_at    DateTime    @default(now())
  
  // 关联关系
  content       Content     @relation(fields: [content_id], references: [id], onDelete: Cascade)
  tag           Tag         @relation(fields: [tag_id], references: [id], onDelete: Cascade)
  
  // 复合主键
  @@id([content_id, tag_id])
}

// 5. 实体表：存储知识图谱中的实体（概念、书、人、项目等）
model Entity {
  id            String      @id @default(cuid())
  name          String      // 实体名称
  type          String      // 实体类型：concept, book, person, project, etc.
  description   String?     // 实体描述
  created_at    DateTime    @default(now())
  updated_at    DateTime    @updatedAt
  
  // 关联关系
  contents      ContentEntity[]
  relations_as_source EntityRelation[] @relation("source")
  relations_as_target EntityRelation[] @relation("target")
  
  @@index([name])
  @@index([type])
}

// 6. 内容实体关联表：建立内容和实体的多对多关系
model ContentEntity {
  content_id    String
  entity_id     String
  start_pos     Int?        // 实体在文本中的起始位置
  end_pos       Int?        // 实体在文本中的结束位置
  created_at    DateTime    @default(now())
  
  // 关联关系
  content       Content     @relation(fields: [content_id], references: [id], onDelete: Cascade)
  entity        Entity      @relation(fields: [entity_id], references: [id], onDelete: Cascade)
  
  // 复合主键
  @@id([content_id, entity_id])
}

// 7. 实体关系表：存储实体之间的关联关系
model EntityRelation {
  id            String      @id @default(cuid())
  source_id     String
  target_id     String
  relation_type String      // 关系类型：related_to, part_of, derived_from, etc.
  strength      Float       @default(1.0) // 关系强度（0-1之间）
  description   String?     // 关系描述
  created_at    DateTime    @default(now())
  
  // 关联关系
  source        Entity      @relation("source", fields: [source_id], references: [id], onDelete: Cascade)
  target        Entity      @relation("target", fields: [target_id], references: [id], onDelete: Cascade)
  
  // 复合索引
  @@index([source_id, target_id])
  @@index([relation_type])
}

// 8. 用户设置表：存储用户偏好和系统配置
model UserSetting {
  id            String      @id @default(cuid())
  key           String      @unique
  value         String
  category      String      // 设置类别：appearance, search, ai, etc.
  user_id       String?     // 预留字段，支持多用户扩展
  created_at    DateTime    @default(now())
  updated_at    DateTime    @updatedAt
  
  @@index([key])
  @@index([category])
}

// 9. 搜索历史表：存储用户的搜索记录
model SearchHistory {
  id            String      @id @default(cuid())
  query         String      // 搜索查询
  query_type    String      // 查询类型：semantic, keyword
  results_count Int         // 结果数量
  created_at    DateTime    @default(now())
  user_id       String?     // 预留字段，支持多用户扩展
  
  @@index([query])
  @@index([created_at])
}

// 10. 搜索结果表：存储搜索结果与内容的关联
model SearchResult {
  id            String      @id @default(cuid())
  search_id     String?     // 关联到搜索历史ID
  content_id    String
  score         Float       // 匹配得分
  highlight     String?     // 高亮片段
  created_at    DateTime    @default(now())
  
  // 关联关系
  content       Content     @relation(fields: [content_id], references: [id], onDelete: Cascade)
  
  @@index([content_id])
  @@index([score])
}
```

## 三、ChromaDB向量存储模型

### 1. 向量存储结构

ChromaDB将存储**文本嵌入向量**，用于实现语义搜索功能。

```javascript
// ChromaDB集合配置
const collectionConfig = {
  name: "content_embeddings",
  metadata: {
    "description": "Text embeddings for content in knowledge base",
    "model": "all-MiniLM-L6-v2" // 使用的嵌入模型
  }
};
```

### 2. 嵌入文档结构

每个嵌入文档包含以下信息：

| 字段 | 类型 | 描述 |
|------|------|------|
| `id` | String | 唯一标识符，与SQLite中的Content.id对应 |
| `embedding` | Float[] | 文本嵌入向量（维度：384，与all-MiniLM-L6-v2模型匹配） |
| `metadata` | Object | 嵌入元数据，包含：<br>- `content_id`: 关联到SQLite中的Content.id<br>- `title`: 文档标题<br>- `file_type`: 文件类型<br>- `created_at`: 创建时间<br>- `chunk_id`: 文档分块ID（大文档分块存储） |
| `document` | String | 用于生成嵌入的文本内容（完整文本或分块文本） |

### 3. 文档分块策略

对于大文档，采用**分块存储**策略：
- 分块大小：512个词（可配置）
- 重叠大小：64个词（确保上下文连贯性）
- 每个分块生成独立的嵌入向量
- 查询时聚合相关分块的结果

## 四、文件系统存储结构

```
knowledge_base_files/
├── documents/          # 原始文档存储
│   ├── md/            # Markdown文件
│   ├── docx/          # Word文件
│   ├── pdf/           # PDF文件
│   └── txt/           # 文本文件
├── images/            # 图片存储
│   ├── content/       # 文档中的图片
│   └── thumbnails/    # 缩略图
├── backups/           # 备份文件
│   ├── database/      # 数据库备份
│   └── files/         # 文件系统备份
└── temp/              # 临时文件
```

## 五、数据模型关系图

```
┌────────────┐     ┌────────────┐     ┌────────────┐
│  Content   │────▶│ ContentTag │◀────│    Tag     │
└────────────┘     └────────────┘     └────────────┘
     │                     │
     ▼                     ▼
┌────────────┐     ┌────────────┐     ┌────────────┐
│ContentEntity│◀────│   Entity   │────▶│EntityRelation│
└────────────┘     └────────────┘     └────────────┘
     │                     │                     │
     ▼                     ▼                     ▼
┌────────────┐     ┌────────────┐     ┌────────────┐
│ContentVersion│   │SearchResult│◀────│SearchHistory│
└────────────┘     └────────────┘     └────────────┘
                                          │
                                          ▼
                                    ┌────────────┐
                                    │UserSetting │
                                    └────────────┘
```

## 六、数据索引策略

### 1. SQLite索引
- 内容标题索引：加速标题搜索
- 创建时间索引：支持按时间排序
- 文件类型索引：支持按文件类型筛选
- 标签名称索引：加速标签搜索
- 实体名称和类型索引：加速知识图谱查询

### 2. ChromaDB索引
- 向量索引：使用HNSW（Hierarchical Navigable Small World）算法加速向量相似性搜索
- 元数据索引：支持按元数据字段筛选（如文件类型、创建时间）

## 七、数据备份与恢复

### 1. SQLite数据库备份
- 定期自动备份（可配置备份频率）
- 手动备份功能
- 备份文件存储在文件系统的backups/database目录

### 2. 文件系统备份
- 增量备份：仅备份新增和修改的文件
- 完整备份：定期执行完整备份
- 备份文件存储在文件系统的backups/files目录

### 3. 恢复策略
- 支持从指定备份点恢复数据库和文件
- 恢复过程中提供进度反馈

## 八、性能优化考虑

1. **大文档处理**：
   - 大文档正文存储在文件系统，数据库仅存储路径
   - 分块生成嵌入向量，提高搜索效率

2. **查询优化**：
   - 语义搜索使用ChromaDB向量索引加速
   - 关键词搜索使用SQLite全文索引

3. **缓存策略**：
   - 热门文档缓存到内存
   - 搜索结果缓存，避免重复计算

4. **数据库优化**：
   - 定期执行SQLite VACUUM命令优化数据库文件
   - 合理设计索引，避免过度索引影响写入性能

## 九、扩展考虑

1. **多用户支持**：
   - 用户表（预留）
   - 内容和设置的用户关联

2. **高级AI功能**：
   - 预留字段支持本地大语言模型集成
   - 实体关系表支持更复杂的关系类型

3. **外部集成**：
   - 预留API字段，支持与第三方工具集成
   - 元数据字段支持自定义扩展