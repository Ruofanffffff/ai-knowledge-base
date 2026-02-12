# Design Document: File Upload Storage Migration

## Overview

本设计文档描述了文件上传存储迁移功能的技术实现方案。该功能将废弃现有的 JSON 文件存储方案（documents.json），改用 PostgreSQL 数据库存储文档元数据，并实现基于 SHA-256 hash 的文件重复检测功能。当检测到重复文件时，系统将在前端提供三种处理选项：覆盖现有文件、保存为新文件（自动重命名）、取消上传。

### 设计目标

1. 提高数据可靠性和查询性能
2. 实现智能的文件重复检测
3. 提供友好的用户交互体验
4. 确保平滑的迁移过程和向后兼容性
5. 保证数据完整性和一致性

### 技术栈

- 后端：Node.js + Express + Multer
- 数据库：SQLite（开发环境）/ PostgreSQL（生产环境）
- 前端：React + TypeScript + shadcn/ui + Tailwind CSS + Framer Motion
- 文件存储：本地文件系统（uploads/ 目录）
- Hash 算法：SHA-256

### 开发环境说明

当前处于开发阶段，使用 SQLite 数据库（data/users.db）。设计需要兼容 SQLite 的特性：
- 不支持 JSON 查询，需要在应用层处理
- 使用 `PRAGMA table_info` 而非 `information_schema`
- 索引创建需要考虑 SQLite 语法

## Architecture

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Upload UI    │  │ Duplicate    │  │ Document     │      │
│  │ Component    │  │ Modal Dialog │  │ List View    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                     API Service Layer                        │
└────────────────────────────┼────────────────────────────────┘
                             │ HTTP/REST
┌────────────────────────────┼────────────────────────────────┐
│                     Backend API Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Upload       │  │ Duplicate    │  │ Migration    │      │
│  │ Handler      │  │ Handler      │  │ Script       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                   Service Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Hash         │  │ Duplicate    │  │ File         │      │
│  │ Calculator   │  │ Detector     │  │ Manager      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────────┼────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────┐
│                    Data Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ PostgreSQL   │  │ Prisma ORM   │  │ File System  │      │
│  │ Database     │  │              │  │ (uploads/)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```


## Components and Interfaces

### 1. Hash Calculator Service

负责计算文件的 SHA-256 hash 值。

```typescript
interface HashCalculatorService {
  /**
   * 计算文件的 SHA-256 hash
   * @param filePath 文件路径
   * @returns Promise<string> 返回 hex 格式的 hash 字符串
   */
  calculateFileHash(filePath: string): Promise<string>;
  
  /**
   * 使用流式处理计算大文件的 hash
   * @param stream 文件流
   * @returns Promise<string> 返回 hex 格式的 hash 字符串
   */
  calculateStreamHash(stream: ReadableStream): Promise<string>;
}
```

**实现要点：**
- 使用 Node.js crypto 模块的 createHash('sha256')
- 使用流式处理避免大文件占用过多内存
- 支持进度回调（可选）

### 2. Duplicate Detector Service

负责检测文件重复。

```typescript
interface DuplicateInfo {
  isDuplicate: boolean;
  existingDocument?: {
    id: string;
    title: string;
    fileHash: string;
    size: number;
    createdAt: string;
  };
}

interface DuplicateDetectorService {
  /**
   * 检测文件是否重复
   * @param fileHash 文件 hash
   * @param fileSize 文件大小
   * @returns Promise<DuplicateInfo> 重复检测结果
   */
  detectDuplicate(fileHash: string, fileSize: number): Promise<DuplicateInfo>;
}
```

**实现要点：**
- 同时比较 fileHash 和 fileSize
- 使用数据库索引优化查询性能
- 返回现有文档的完整信息供前端展示

### 3. File Manager Service

负责文件系统操作。

```typescript
interface FileManagerService {
  /**
   * 保存上传的文件
   * @param file 上传的文件
   * @param filename 目标文件名
   * @returns Promise<string> 返回保存的文件路径
   */
  saveFile(file: Express.Multer.File, filename: string): Promise<string>;
  
  /**
   * 删除文件
   * @param filePath 文件路径
   * @returns Promise<void>
   */
  deleteFile(filePath: string): Promise<void>;
  
  /**
   * 生成唯一文件名
   * @param originalName 原始文件名
   * @returns Promise<string> 返回唯一文件名
   */
  generateUniqueFilename(originalName: string): Promise<string>;
  
  /**
   * 替换现有文件
   * @param oldPath 旧文件路径
   * @param newFile 新文件
   * @returns Promise<string> 返回新文件路径
   */
  replaceFile(oldPath: string, newFile: Express.Multer.File): Promise<string>;
}
```

**实现要点：**
- 文件名格式：`filename (n).ext`
- 自动递增后缀直到找到唯一名称
- 验证路径长度限制
- 原子性操作保证一致性

### 4. Document Repository

负责数据库操作（使用 Prisma）。

```typescript
interface DocumentMetadata {
  id: string;
  title: string;
  content: string;
  type: string;
  fileType: string;
  fileHash: string;
  fileSize: number;
  filePath: string;
  metadata: Record<string, any>;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DocumentRepository {
  /**
   * 创建文档记录
   * @param data 文档数据
   * @returns Promise<DocumentMetadata>
   */
  create(data: Partial<DocumentMetadata>): Promise<DocumentMetadata>;
  
  /**
   * 根据 hash 和 size 查找文档
   * @param fileHash 文件 hash
   * @param fileSize 文件大小
   * @returns Promise<DocumentMetadata | null>
   */
  findByHashAndSize(fileHash: string, fileSize: number): Promise<DocumentMetadata | null>;
  
  /**
   * 更新文档记录
   * @param id 文档 ID
   * @param data 更新数据
   * @returns Promise<DocumentMetadata>
   */
  update(id: string, data: Partial<DocumentMetadata>): Promise<DocumentMetadata>;
  
  /**
   * 删除文档记录
   * @param id 文档 ID
   * @returns Promise<void>
   */
  delete(id: string): Promise<void>;
}
```


### 5. Migration Service

负责从 JSON 文件迁移到数据库。

```typescript
interface MigrationResult {
  success: boolean;
  totalRecords: number;
  migratedRecords: number;
  failedRecords: number;
  errors: Array<{
    record: any;
    error: string;
  }>;
}

interface MigrationService {
  /**
   * 执行迁移
   * @returns Promise<MigrationResult>
   */
  migrate(): Promise<MigrationResult>;
  
  /**
   * 验证迁移结果
   * @returns Promise<boolean>
   */
  validateMigration(): Promise<boolean>;
  
  /**
   * 归档旧数据文件
   * @returns Promise<void>
   */
  archiveLegacyFiles(): Promise<void>;
}
```

**实现要点：**
- 读取 documents.json 中的所有记录
- 逐条迁移到数据库，记录失败项
- 为每个文档计算 fileHash（如果文件存在）
- 验证迁移完整性
- 将 documents.json 移动到 data/archive/ 目录

### 6. Upload API Handler

处理文件上传请求。

```typescript
interface UploadResponse {
  success: boolean;
  document?: DocumentMetadata;
  duplicate?: {
    isDuplicate: true;
    existingDocument: DocumentMetadata;
  };
  error?: string;
}

interface DuplicateActionRequest {
  action: 'overwrite' | 'rename' | 'cancel';
  fileHash: string;
  tempFilePath: string;
  originalName: string;
}

interface DuplicateActionResponse {
  success: boolean;
  document?: DocumentMetadata;
  error?: string;
}
```

**API 端点：**

1. `POST /api/documents/upload`
   - 接收 multipart/form-data
   - 返回 UploadResponse
   - 状态码：200（成功）、409（重复）、400（错误）

2. `POST /api/documents/duplicate-action`
   - 接收 DuplicateActionRequest
   - 返回 DuplicateActionResponse
   - 状态码：200（成功）、400（错误）

### 7. Frontend Components

#### UploadButton Component

```typescript
interface UploadButtonProps {
  onUploadSuccess: (document: DocumentMetadata) => void;
  onUploadError: (error: string) => void;
}
```

#### DuplicateModal Component

```typescript
interface DuplicateModalProps {
  isOpen: boolean;
  existingDocument: DocumentMetadata;
  newFile: File;
  onOverwrite: () => void;
  onRename: () => void;
  onCancel: () => void;
}
```

**交互流程：**
1. 用户选择文件并点击上传
2. 前端调用 `/api/documents/upload`
3. 如果返回 409 状态码，显示 DuplicateModal
4. 用户选择操作后，调用 `/api/documents/duplicate-action`
5. 根据结果更新文档列表

## Data Models

### Database Schema Changes

需要在现有的 SQLite documents 表中添加以下字段：

**SQLite Schema (data/users.db):**

```sql
-- 现有表结构
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  type TEXT DEFAULT 'document',
  file_type TEXT,
  metadata TEXT,  -- JSON string
  tags TEXT,      -- JSON array string
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 新增字段（迁移脚本）
ALTER TABLE documents ADD COLUMN file_hash TEXT;
ALTER TABLE documents ADD COLUMN file_size INTEGER;
ALTER TABLE documents ADD COLUMN file_path TEXT;

-- 创建索引（SQLite 语法）
CREATE INDEX IF NOT EXISTS idx_documents_file_hash ON documents(file_hash);
CREATE INDEX IF NOT EXISTS idx_documents_file_size ON documents(file_size);
CREATE INDEX IF NOT EXISTS idx_documents_hash_size ON documents(file_hash, file_size);
```

**注意事项：**
- SQLite 使用 INTEGER PRIMARY KEY AUTOINCREMENT 而非 UUID
- 使用 TEXT 类型存储 JSON 数据
- 索引创建使用 `IF NOT EXISTS` 避免重复创建

### Legacy Data Format

现有的 documents.json 格式：

```json
[
  {
    "id": "1",
    "title": "React学习笔记",
    "content": "React是一个用于构建用户界面的JavaScript库...",
    "type": "document",
    "fileType": ".md",
    "metadata": {
      "source": "manual",
      "tags": ["前端", "React"]
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

迁移时需要：
1. 保留所有现有字段
2. 如果 metadata 中有 filePath，计算对应文件的 hash 和 size
3. 如果文件不存在，fileHash 和 fileSize 设为 null


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Document Persistence

*For any* uploaded document, persisting it to the database should result in the document being retrievable by its ID.

**Validates: Requirements 1.2**

### Property 2: Hash Calculation Consistency

*For any* file, calculating its SHA-256 hash multiple times should produce the same result.

**Validates: Requirements 2.1, 2.4**

### Property 3: Duplicate Detection Accuracy

*For any* file uploaded twice, the second upload should be detected as a duplicate if the file content and size are identical.

**Validates: Requirements 2.2, 2.3, 2.5**

### Property 4: Duplicate Response Format

*For any* duplicate file detection, the API response should contain the existing document's complete information including ID, title, hash, size, and creation date.

**Validates: Requirements 3.1, 4.3**

### Property 5: Overwrite Action Atomicity

*For any* overwrite action, either both the database metadata and physical file are updated, or neither is updated (rollback on failure).

**Validates: Requirements 3.6, 7.3**

### Property 6: Rename Action Uniqueness

*For any* rename action, the generated filename should be unique and not conflict with existing files in the uploads directory.

**Validates: Requirements 3.7, 6.1, 6.3**

### Property 7: Cancel Action Cleanup

*For any* cancel action, the temporarily uploaded file should be deleted from the file system.

**Validates: Requirements 3.8**

### Property 8: API Response Status Codes

*For any* upload request, the API should return 200 for success, 409 for duplicate detection, and 400 for validation errors.

**Validates: Requirements 4.2, 4.6**

### Property 9: User Action Processing

*For any* valid user action (overwrite/rename/cancel), the system should process it and return a success response with the appropriate result.

**Validates: Requirements 4.5**

### Property 10: Migration Data Integrity

*For any* record in the legacy JSON file, after migration it should exist in the database with all original fields preserved.

**Validates: Requirements 5.4**

### Property 11: Migration Error Handling

*For any* migration error on a specific record, the system should log the error and continue processing remaining records.

**Validates: Requirements 5.5**

### Property 12: Filename Format Compliance

*For any* generated filename, it should match the format "filename (n).ext" where n is a positive integer and ext is the original extension.

**Validates: Requirements 6.1, 6.2, 6.4**

### Property 13: Extension Preservation

*For any* file rename operation, the file extension should remain unchanged from the original filename.

**Validates: Requirements 6.2**

### Property 14: Path Length Validation

*For any* generated filename, its full path should not exceed the system's maximum path length limit (typically 255 characters).

**Validates: Requirements 6.5**

### Property 15: File Size Validation

*For any* file upload, if the file size exceeds the configured limit, the upload should be rejected with an appropriate error message.

**Validates: Requirements 7.4**

### Property 16: Upload Progress Feedback

*For any* large file upload (>10MB), the system should emit progress events at regular intervals.

**Validates: Requirements 8.3**


## Error Handling

### Error Categories

1. **File System Errors**
   - 文件读取失败
   - 文件写入失败
   - 磁盘空间不足
   - 权限不足

2. **Database Errors**
   - 连接失败
   - 查询超时
   - 约束违反
   - 事务回滚

3. **Validation Errors**
   - 文件大小超限
   - 文件类型不支持
   - 文件名非法
   - 缺少必需字段

4. **Hash Calculation Errors**
   - 文件损坏
   - 读取中断
   - 内存不足

5. **Migration Errors**
   - JSON 解析失败
   - 数据格式不匹配
   - 文件缺失

### Error Handling Strategy

#### 1. Upload Flow Error Handling

```typescript
try {
  // 1. 保存临时文件
  const tempPath = await saveTemporaryFile(file);
  
  try {
    // 2. 计算 hash
    const fileHash = await calculateHash(tempPath);
    
    try {
      // 3. 检测重复
      const duplicate = await detectDuplicate(fileHash, file.size);
      
      if (duplicate.isDuplicate) {
        // 返回重复信息，保留临时文件供后续处理
        return { status: 409, duplicate: duplicate.existingDocument };
      }
      
      try {
        // 4. 保存到数据库（事务）
        const document = await db.transaction(async (tx) => {
          const doc = await tx.document.create({...});
          await moveFile(tempPath, finalPath);
          return doc;
        });
        
        return { status: 200, document };
      } catch (dbError) {
        // 数据库失败，删除临时文件
        await deleteFile(tempPath);
        throw new DatabaseError('Failed to save document', dbError);
      }
    } catch (duplicateError) {
      // 重复检测失败，继续正常流程（降级处理）
      logger.error('Duplicate detection failed', duplicateError);
      // 继续保存文档
    }
  } catch (hashError) {
    // Hash 计算失败，删除临时文件
    await deleteFile(tempPath);
    throw new HashCalculationError('Failed to calculate file hash', hashError);
  }
} catch (fileError) {
  throw new FileSystemError('Failed to save file', fileError);
}
```

#### 2. Duplicate Action Error Handling

```typescript
async function handleDuplicateAction(action: DuplicateActionRequest) {
  switch (action.action) {
    case 'overwrite':
      return await db.transaction(async (tx) => {
        // 1. 更新数据库
        const doc = await tx.document.update({...});
        
        try {
          // 2. 替换文件
          await replaceFile(doc.filePath, action.tempFilePath);
          return { success: true, document: doc };
        } catch (fileError) {
          // 文件操作失败，回滚事务
          throw fileError;
        }
      });
      
    case 'rename':
      return await db.transaction(async (tx) => {
        // 1. 生成唯一文件名
        const uniqueName = await generateUniqueFilename(action.originalName);
        
        // 2. 创建新文档记录
        const doc = await tx.document.create({...});
        
        try {
          // 3. 移动文件
          await moveFile(action.tempFilePath, uniqueName);
          return { success: true, document: doc };
        } catch (fileError) {
          // 文件操作失败，回滚事务
          throw fileError;
        }
      });
      
    case 'cancel':
      // 删除临时文件
      await deleteFile(action.tempFilePath);
      return { success: true };
  }
}
```

#### 3. Migration Error Handling

```typescript
async function migrate(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    totalRecords: 0,
    migratedRecords: 0,
    failedRecords: 0,
    errors: []
  };
  
  try {
    // 1. 读取 JSON 文件
    const legacyData = await readLegacyData();
    result.totalRecords = legacyData.length;
    
    // 2. 逐条迁移
    for (const record of legacyData) {
      try {
        await migrateRecord(record);
        result.migratedRecords++;
      } catch (error) {
        // 记录错误但继续处理
        result.failedRecords++;
        result.errors.push({
          record,
          error: error.message
        });
        logger.error('Migration failed for record', { record, error });
      }
    }
    
    // 3. 验证迁移
    const isValid = await validateMigration();
    if (!isValid) {
      result.success = false;
      logger.error('Migration validation failed');
    }
    
    // 4. 归档旧文件
    if (result.success && result.failedRecords === 0) {
      await archiveLegacyFiles();
    }
    
    return result;
  } catch (error) {
    result.success = false;
    logger.error('Migration failed', error);
    throw error;
  }
}
```

### Error Response Format

所有 API 错误响应应遵循统一格式：

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;           // 错误代码，如 'FILE_TOO_LARGE'
    message: string;        // 用户友好的错误消息
    details?: any;          // 详细错误信息（开发环境）
    timestamp: string;      // 错误发生时间
  };
}
```

### Logging Strategy

使用结构化日志记录所有关键操作：

```typescript
// 成功操作
logger.info('Document uploaded', {
  documentId,
  fileHash,
  fileSize,
  userId,
  duration: Date.now() - startTime
});

// 错误操作
logger.error('Upload failed', {
  error: error.message,
  stack: error.stack,
  fileSize,
  userId,
  duration: Date.now() - startTime
});

// 重复检测
logger.info('Duplicate detected', {
  fileHash,
  existingDocumentId,
  userId
});
```


## Testing Strategy

### Dual Testing Approach

本项目采用单元测试和属性测试相结合的方式：

- **单元测试**：验证具体示例、边界情况和错误条件
- **属性测试**：验证通用属性在所有输入下都成立

两者互补，共同保证全面的测试覆盖：
- 单元测试捕获具体的 bug
- 属性测试验证通用的正确性

### Property-Based Testing

使用 **fast-check** 库进行属性测试，每个测试至少运行 100 次迭代。

#### 测试配置

```typescript
import fc from 'fast-check';

// 配置
const testConfig = {
  numRuns: 100,  // 最少 100 次迭代
  timeout: 5000   // 5 秒超时
};
```

#### 属性测试示例

```typescript
// Property 2: Hash Calculation Consistency
describe('Hash Calculator', () => {
  it('should produce consistent hash for same file content', async () => {
    // Feature: file-upload-storage-migration, Property 2: Hash Calculation Consistency
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 0, maxLength: 10000 }),
        async (fileContent) => {
          const tempFile = await createTempFile(fileContent);
          
          const hash1 = await hashCalculator.calculateFileHash(tempFile);
          const hash2 = await hashCalculator.calculateFileHash(tempFile);
          
          expect(hash1).toBe(hash2);
          expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 格式
          
          await deleteTempFile(tempFile);
        }
      ),
      testConfig
    );
  });
});

// Property 3: Duplicate Detection Accuracy
describe('Duplicate Detector', () => {
  it('should detect duplicate when file content and size match', async () => {
    // Feature: file-upload-storage-migration, Property 3: Duplicate Detection Accuracy
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1, maxLength: 10000 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        async (fileContent, filename) => {
          // 第一次上传
          const file1 = await uploadFile(fileContent, filename);
          
          // 第二次上传相同内容
          const result = await uploadFile(fileContent, filename);
          
          expect(result.duplicate).toBeDefined();
          expect(result.duplicate.isDuplicate).toBe(true);
          expect(result.duplicate.existingDocument.id).toBe(file1.id);
          
          // 清理
          await deleteDocument(file1.id);
        }
      ),
      testConfig
    );
  });
});

// Property 12: Filename Format Compliance
describe('File Manager', () => {
  it('should generate filenames in correct format', async () => {
    // Feature: file-upload-storage-migration, Property 12: Filename Format Compliance
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.constantFrom('.txt', '.pdf', '.docx', '.jpg'),
        async (basename, extension) => {
          const originalName = basename + extension;
          const generated = await fileManager.generateUniqueFilename(originalName);
          
          // 验证格式：filename.ext 或 filename (n).ext
          const pattern = /^(.+?)( \((\d+)\))?\.([\w]+)$/;
          const match = generated.match(pattern);
          
          expect(match).not.toBeNull();
          if (match[3]) {
            // 有后缀的情况
            expect(parseInt(match[3])).toBeGreaterThan(0);
          }
          expect(match[4]).toBe(extension.slice(1)); // 扩展名匹配
        }
      ),
      testConfig
    );
  });
});
```

### Unit Testing

单元测试关注具体场景和边界情况。

#### 测试覆盖范围

1. **Hash Calculator**
   - 空文件的 hash 计算
   - 大文件的流式处理
   - 文件读取错误处理

2. **Duplicate Detector**
   - 无重复的情况
   - 有重复的情况
   - 数据库查询失败的降级处理

3. **File Manager**
   - 文件保存成功
   - 文件删除成功
   - 文件名冲突处理
   - 路径长度验证

4. **Document Repository**
   - CRUD 操作
   - 事务回滚
   - 并发写入

5. **Migration Service**
   - 完整迁移流程
   - 部分记录失败的处理
   - 数据验证
   - 文件归档

6. **API Handlers**
   - 正常上传流程
   - 重复文件处理
   - 各种错误场景
   - 状态码验证

#### 单元测试示例

```typescript
describe('Upload API Handler', () => {
  it('should return 409 when duplicate is detected', async () => {
    // 准备：上传一个文件
    const file1 = await uploadTestFile('test.txt', 'content');
    
    // 执行：上传相同文件
    const response = await request(app)
      .post('/api/documents/upload')
      .attach('file', Buffer.from('content'), 'test.txt');
    
    // 验证
    expect(response.status).toBe(409);
    expect(response.body.duplicate).toBeDefined();
    expect(response.body.duplicate.existingDocument.id).toBe(file1.id);
    
    // 清理
    await deleteDocument(file1.id);
  });
  
  it('should handle overwrite action correctly', async () => {
    // 准备
    const original = await uploadTestFile('test.txt', 'original content');
    const tempFile = await createTempFile('new content');
    
    // 执行
    const response = await request(app)
      .post('/api/documents/duplicate-action')
      .send({
        action: 'overwrite',
        fileHash: await calculateHash(tempFile),
        tempFilePath: tempFile,
        originalName: 'test.txt'
      });
    
    // 验证
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    
    // 验证文件内容已更新
    const updated = await getDocument(original.id);
    const fileContent = await readFile(updated.filePath);
    expect(fileContent.toString()).toBe('new content');
    
    // 清理
    await deleteDocument(original.id);
  });
});

describe('Migration Service', () => {
  it('should migrate all records from JSON to database', async () => {
    // 准备：创建测试 JSON 文件
    const testData = [
      { id: '1', title: 'Doc 1', content: 'Content 1' },
      { id: '2', title: 'Doc 2', content: 'Content 2' }
    ];
    await writeTestJSON(testData);
    
    // 执行
    const result = await migrationService.migrate();
    
    // 验证
    expect(result.success).toBe(true);
    expect(result.totalRecords).toBe(2);
    expect(result.migratedRecords).toBe(2);
    expect(result.failedRecords).toBe(0);
    
    // 验证数据库中的记录
    const doc1 = await documentRepository.findById('1');
    const doc2 = await documentRepository.findById('2');
    expect(doc1).toBeDefined();
    expect(doc2).toBeDefined();
    expect(doc1.title).toBe('Doc 1');
    expect(doc2.title).toBe('Doc 2');
    
    // 清理
    await cleanupTestData();
  });
  
  it('should continue migration when individual record fails', async () => {
    // 准备：包含一个无效记录的数据
    const testData = [
      { id: '1', title: 'Doc 1', content: 'Content 1' },
      { id: '2', title: null, content: 'Content 2' }, // 无效：title 为 null
      { id: '3', title: 'Doc 3', content: 'Content 3' }
    ];
    await writeTestJSON(testData);
    
    // 执行
    const result = await migrationService.migrate();
    
    // 验证
    expect(result.totalRecords).toBe(3);
    expect(result.migratedRecords).toBe(2);
    expect(result.failedRecords).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].record.id).toBe('2');
    
    // 清理
    await cleanupTestData();
  });
});
```

### Integration Testing

集成测试验证各组件协同工作。

```typescript
describe('End-to-End Upload Flow', () => {
  it('should handle complete upload with duplicate detection', async () => {
    // 1. 第一次上传
    const file = createTestFile('test.pdf', 'PDF content');
    const upload1 = await uploadFile(file);
    expect(upload1.status).toBe(200);
    
    // 2. 第二次上传相同文件
    const upload2 = await uploadFile(file);
    expect(upload2.status).toBe(409);
    expect(upload2.body.duplicate).toBeDefined();
    
    // 3. 选择重命名
    const rename = await handleDuplicateAction({
      action: 'rename',
      fileHash: upload2.body.duplicate.existingDocument.fileHash,
      tempFilePath: upload2.tempPath,
      originalName: 'test.pdf'
    });
    expect(rename.status).toBe(200);
    expect(rename.body.document.title).toMatch(/test \(\d+\)\.pdf/);
    
    // 4. 验证两个文档都存在
    const docs = await getDocuments();
    expect(docs.filter(d => d.fileHash === upload1.body.document.fileHash)).toHaveLength(2);
    
    // 清理
    await deleteDocument(upload1.body.document.id);
    await deleteDocument(rename.body.document.id);
  });
});
```

### Test Data Generators

使用 fast-check 生成测试数据：

```typescript
// 文件内容生成器
const fileContentArbitrary = fc.uint8Array({
  minLength: 0,
  maxLength: 100000
});

// 文件名生成器
const filenameArbitrary = fc.tuple(
  fc.string({ minLength: 1, maxLength: 50 }),
  fc.constantFrom('.txt', '.pdf', '.docx', '.jpg', '.png')
).map(([name, ext]) => name + ext);

// 文档元数据生成器
const documentMetadataArbitrary = fc.record({
  title: fc.string({ minLength: 1, maxLength: 100 }),
  content: fc.string({ minLength: 0, maxLength: 10000 }),
  type: fc.constantFrom('document', 'image', 'pdf'),
  fileType: fc.constantFrom('.txt', '.pdf', '.docx', '.jpg'),
  fileSize: fc.integer({ min: 0, max: 100000000 })
});
```

### Performance Testing

性能测试关注系统在负载下的表现：

```typescript
describe('Performance Tests', () => {
  it('should handle concurrent uploads efficiently', async () => {
    const files = Array.from({ length: 10 }, (_, i) => 
      createTestFile(`file${i}.txt`, `content${i}`)
    );
    
    const startTime = Date.now();
    const results = await Promise.all(files.map(f => uploadFile(f)));
    const duration = Date.now() - startTime;
    
    expect(results.every(r => r.status === 200)).toBe(true);
    expect(duration).toBeLessThan(5000); // 10个文件在5秒内完成
  });
  
  it('should calculate hash for large files efficiently', async () => {
    const largeFile = createTestFile('large.bin', Buffer.alloc(50 * 1024 * 1024)); // 50MB
    
    const startTime = Date.now();
    const hash = await hashCalculator.calculateFileHash(largeFile);
    const duration = Date.now() - startTime;
    
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(duration).toBeLessThan(3000); // 50MB 在 3 秒内完成
  });
});
```

