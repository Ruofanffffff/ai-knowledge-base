# Design Document: File Upload Deduplication

## Overview

本设计文档描述了文件上传去重功能的技术实现方案。该功能将修复当前的上传失败问题，将存储从 JSON 文件迁移到 SQLite 数据库，并实现基于内容 hash 和文件名的重复检测机制。系统将提供用户友好的模态框让用户选择如何处理重复文件，并优化上传进度显示以提供真实的上传状态反馈。

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Layer                        │
├─────────────────────────────────────────────────────────────┤
│  DocumentsList.tsx                                           │
│  ├─ FileUploadHandler                                        │
│  ├─ DuplicateDetectionModal (New)                           │
│  └─ RealTimeProgressTracker (Enhanced)                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/Multipart
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                        Backend Layer                         │
├─────────────────────────────────────────────────────────────┤
│  server.js                                                   │
│  ├─ handleFileUpload (Fixed)                                │
│  ├─ checkDuplicates (New)                                   │
│  └─ handleDuplicateAction (New)                             │
│                                                              │
│  Services                                                    │
│  ├─ FileHashService (New)                                   │
│  ├─ DeduplicationService (New)                              │
│  └─ DocumentStorageService (New)                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ SQL
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      Storage Layer                           │
├─────────────────────────────────────────────────────────────┤
│  SQLite Database (users.db)                                 │
│  └─ documents table (Enhanced with hash column)             │
│                                                              │
│  File System                                                 │
│  └─ uploads/ directory                                       │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Upload Initiation**: User selects files → Frontend sends multipart request
2. **Temporary Storage**: Backend saves file to temp location
3. **Hash Calculation**: Calculate content hash (streaming for large files)
4. **Duplicate Check**: Query database for matching hash/filename
5. **User Decision** (if duplicate): Show modal → User chooses action
6. **Final Storage**: Save file and metadata based on user decision
7. **Progress Update**: Real-time progress feedback to frontend

## Components and Interfaces

### Backend Services

#### FileHashService

负责计算文件内容的 hash 值。

```javascript
class FileHashService {
  /**
   * Calculate hash for a file
   * @param {string} filePath - Path to the file
   * @param {string} algorithm - Hash algorithm (default: 'sha256')
   * @returns {Promise<string>} - Hex hash string
   */
  async calculateHash(filePath, algorithm = 'sha256'): Promise<string>
  
  /**
   * Calculate hash using streaming for large files
   * @param {string} filePath - Path to the file
   * @param {number} threshold - Size threshold for streaming (default: 10MB)
   * @returns {Promise<string>} - Hex hash string
   */
  async calculateHashStreaming(filePath, threshold = 10 * 1024 * 1024): Promise<string>
}
```

**Implementation Details:**
- Use Node.js `crypto.createHash()` for hash calculation
- For files > 10MB, use `fs.createReadStream()` with streaming
- Return lowercase hexadecimal hash string
- Handle errors gracefully (return null on failure, log error)

#### DeduplicationService

负责检测重复文件并管理重复处理逻辑。

```javascript
interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateType: 'none' | 'content' | 'filename' | 'both';
  existingFile?: {
    id: string;
    title: string;
    size: number;
    uploadDate: string;
    hash: string;
  };
}

class DeduplicationService {
  /**
   * Check if file is duplicate
   * @param {string} hash - File content hash
   * @param {string} filename - Original filename
   * @param {number} userId - User ID
   * @returns {Promise<DuplicateCheckResult>}
   */
  async checkDuplicate(hash, filename, userId): Promise<DuplicateCheckResult>
  
  /**
   * Handle user's duplicate resolution choice
   * @param {string} action - 'replace' | 'keep-both' | 'cancel'
   * @param {File} newFile - New file data
   * @param {string} existingFileId - ID of existing file (if any)
   * @returns {Promise<Document>}
   */
  async handleDuplicateAction(action, newFile, existingFileId): Promise<Document>
}
```

**Implementation Details:**
- Query database for both hash and filename matches
- Return detailed duplicate information
- For "replace" action: delete old file, save new file with same ID
- For "keep-both" action: generate unique filename (append timestamp)
- For "cancel" action: delete temp file, return null

#### DocumentStorageService

负责文件和元数据的存储操作。

```javascript
interface DocumentMetadata {
  id: string;
  userId: number;
  title: string;
  content: string;
  type: string;
  fileType: string;
  metadata: object;
  hash: string;
  size: number;
  createdAt: string;
  updatedAt: string;
}

class DocumentStorageService {
  /**
   * Save document to database and file system
   * @param {DocumentMetadata} metadata
   * @param {string} tempFilePath
   * @returns {Promise<DocumentMetadata>}
   */
  async saveDocument(metadata, tempFilePath): Promise<DocumentMetadata>
  
  /**
   * Update existing document
   * @param {string} documentId
   * @param {DocumentMetadata} metadata
   * @param {string} tempFilePath
   * @returns {Promise<DocumentMetadata>}
   */
  async updateDocument(documentId, metadata, tempFilePath): Promise<DocumentMetadata>
  
  /**
   * Delete document
   * @param {string} documentId
   * @returns {Promise<boolean>}
   */
  async deleteDocument(documentId): Promise<boolean>
  
  /**
   * Query documents by hash
   * @param {string} hash
   * @param {number} userId
   * @returns {Promise<DocumentMetadata[]>}
   */
  async findByHash(hash, userId): Promise<DocumentMetadata[]>
  
  /**
   * Query documents by filename
   * @param {string} filename
   * @param {number} userId
   * @returns {Promise<DocumentMetadata[]>}
   */
  async findByFilename(filename, userId): Promise<DocumentMetadata[]>
}
```

**Implementation Details:**
- Use database transactions for atomic operations
- Validate file exists before committing metadata
- Clean up old files when replacing
- Use prepared statements to prevent SQL injection

### Backend API Endpoints

#### POST /api/upload

现有端点，增强以支持重复检测。

**Request:**
```
Content-Type: multipart/form-data
Body: file (binary)
Headers: Authorization: Bearer <token>
```

**Response (Success - No Duplicate):**
```json
{
  "success": true,
  "document": {
    "id": "123",
    "title": "example.pdf",
    "size": 1024000,
    "fileType": ".pdf",
    "uploadDate": "2024-01-15T10:30:00Z",
    "hash": "abc123..."
  }
}
```

**Response (Duplicate Detected):**
```json
{
  "success": false,
  "duplicate": true,
  "duplicateType": "content",
  "existingFile": {
    "id": "456",
    "title": "old-example.pdf",
    "size": 1024000,
    "uploadDate": "2024-01-10T08:20:00Z"
  },
  "tempFileId": "temp_789"
}
```

#### POST /api/upload/resolve-duplicate

新端点，处理用户的重复文件决策。

**Request:**
```json
{
  "action": "replace" | "keep-both" | "cancel",
  "tempFileId": "temp_789",
  "existingFileId": "456"
}
```

**Response:**
```json
{
  "success": true,
  "document": {
    "id": "456",
    "title": "example.pdf",
    "size": 1024000,
    "fileType": ".pdf",
    "uploadDate": "2024-01-15T10:30:00Z"
  }
}
```

### Frontend Components

#### DuplicateDetectionModal

新组件，显示重复文件信息并收集用户决策。

```typescript
interface DuplicateModalProps {
  isOpen: boolean;
  duplicateType: 'content' | 'filename' | 'both';
  newFile: {
    name: string;
    size: number;
  };
  existingFile: {
    id: string;
    title: string;
    size: number;
    uploadDate: string;
  };
  onResolve: (action: 'replace' | 'keep-both' | 'cancel') => void;
}

function DuplicateDetectionModal(props: DuplicateModalProps): JSX.Element
```

**UI Design:**
- Purple theme matching existing design
- Rounded corners (rounded-2xl)
- Shadow (shadow-xl)
- Framer Motion animations (fade in/out, scale)
- Clear visual comparison of old vs new file
- Three prominent action buttons
- Keyboard shortcuts (Esc for cancel, Enter for default action)

#### Enhanced Upload Progress

修改现有的上传进度组件以显示真实进度。

```typescript
interface UploadProgressProps {
  files: UploadFile[];
  onCancel: (fileName: string) => void;
}

interface UploadFile {
  name: string;
  size: number;
  progress: number; // 0-100, real progress from XHR
  status: 'waiting' | 'uploading' | 'checking-duplicate' | 'processing' | 'done' | 'error';
  speed?: number; // bytes per second
  estimatedTime?: number; // seconds remaining
}
```

**Implementation:**
- Use XMLHttpRequest with progress events
- Calculate upload speed from progress deltas
- Estimate remaining time based on speed
- Show "checking-duplicate" status during duplicate check
- Support concurrent uploads (max 3)

## Data Models

### Database Schema Changes

#### documents table (Enhanced)

```sql
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  type VARCHAR(50) DEFAULT 'document',
  file_type VARCHAR(50) DEFAULT '.md',
  metadata TEXT,
  tags TEXT,
  hash VARCHAR(64),  -- NEW: SHA-256 hash of file content
  size INTEGER,      -- NEW: File size in bytes
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- NEW: Index for fast duplicate detection
CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(hash);
CREATE INDEX IF NOT EXISTS idx_documents_user_filename ON documents(user_id, title);
```

**Migration Strategy:**
1. Add new columns (hash, size) with ALTER TABLE
2. Existing rows will have NULL hash values
3. Optionally: background job to calculate hashes for existing files
4. New uploads will always have hash values

### Temporary File Management

临时文件存储在 `uploads/temp/` 目录，使用唯一 ID 命名。

```javascript
interface TempFile {
  id: string;           // Unique temp ID
  originalName: string;
  path: string;         // Path in temp directory
  size: number;
  hash: string;
  uploadedAt: Date;
  expiresAt: Date;      // Auto-cleanup after 1 hour
}
```

**Cleanup Strategy:**
- Store temp file metadata in memory (Map)
- Set expiration time (1 hour)
- Background job runs every 15 minutes to clean expired files
- Clean up immediately on cancel/complete

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Hash Calculation Consistency

*For any* file, calculating its hash multiple times should produce the same hash value.

**Validates: Requirements 3.1, 3.2**

### Property 2: Duplicate Detection Accuracy

*For any* two files with identical content, the deduplication engine should identify them as content duplicates regardless of their filenames.

**Validates: Requirements 3.3, 3.4**

### Property 3: Filename Duplicate Detection

*For any* two files with the same filename uploaded by the same user, the deduplication engine should identify them as filename duplicates regardless of content.

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 4: Transaction Atomicity

*For any* file upload operation, either both the file and its metadata are saved successfully, or neither is saved (rollback on failure).

**Validates: Requirements 9.1, 9.2**

### Property 5: File Replacement Integrity

*For any* file replacement operation (user chooses "覆盖现有文件"), the old file should only be deleted after the new file is successfully saved.

**Validates: Requirements 5.5, 9.4**

### Property 6: Unique Filename Generation

*For any* "keep-both" action, the generated filename should be unique within the user's document collection.

**Validates: Requirements 5.6**

### Property 7: Temp File Cleanup

*For any* upload operation that is cancelled or fails, all temporary files should be cleaned up.

**Validates: Requirements 5.7, 7.6**

### Property 8: Hash Storage Format Consistency

*For all* stored hash values, they should be in lowercase hexadecimal format.

**Validates: Requirements 9.5**

### Property 9: Progress Accuracy

*For any* file upload, the reported progress percentage should accurately reflect the ratio of bytes uploaded to total file size.

**Validates: Requirements 6.2**

### Property 10: Concurrent Upload Limit

*For any* set of concurrent uploads, the system should process at most 3 files simultaneously.

**Validates: Requirements 8.3**

## Error Handling

### Error Categories

1. **Network Errors**
   - Connection timeout
   - Connection interrupted
   - Server unreachable
   - **Handling**: Retry with exponential backoff (max 3 attempts), show user-friendly message

2. **Storage Errors**
   - Disk space insufficient
   - File system permission denied
   - **Handling**: Check disk space before upload, return clear error message

3. **Database Errors**
   - Connection失败
   - Query timeout
   - Constraint violation
   - **Handling**: Use transactions, rollback on error, log详细信息

4. **Hash Calculation Errors**
   - File read error
   - Corrupted file
   - **Handling**: Log error, proceed without deduplication check (graceful degradation)

5. **Validation Errors**
   - Invalid file type
   - File too large
   - Missing required fields
   - **Handling**: Validate early, return 400 with specific error message

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "DISK_SPACE_INSUFFICIENT",
    "message": "磁盘空间不足，无法保存文件",
    "details": {
      "required": 1024000,
      "available": 512000
    }
  }
}
```

### Error Recovery

- **Automatic Retry**: Network errors, temporary database errors
- **User Retry**: Show retry button for recoverable errors
- **Graceful Degradation**: If hash calculation fails, allow upload without deduplication
- **Cleanup**: Always clean up temp files on error

## Testing Strategy

### Unit Tests

测试单个函数和组件的正确性。

**Backend Unit Tests:**
- `FileHashService.calculateHash()` - 测试 hash 计算正确性
- `FileHashService.calculateHashStreaming()` - 测试流式 hash 计算
- `DeduplicationService.checkDuplicate()` - 测试重复检测逻辑
- `DeduplicationService.handleDuplicateAction()` - 测试各种用户决策
- `DocumentStorageService.saveDocument()` - 测试文档保存
- `DocumentStorageService.updateDocument()` - 测试文档更新
- `DocumentStorageService.deleteDocument()` - 测试文档删除

**Frontend Unit Tests:**
- `DuplicateDetectionModal` - 测试模态框渲染和交互
- `UploadProgressTracker` - 测试进度计算和显示
- File upload handler - 测试文件选择和上传逻辑

### Property-Based Tests

使用 fast-check (JavaScript) 进行基于属性的测试，每个测试运行至少 100 次迭代。

**Property Tests:**
- **Property 1**: Hash calculation consistency
  - Generate random file content, calculate hash twice, verify equality
  - **Feature: file-upload-deduplication, Property 1: Hash Calculation Consistency**

- **Property 2**: Duplicate detection accuracy
  - Generate random file content, save with two different names, verify content duplicate detected
  - **Feature: file-upload-deduplication, Property 2: Duplicate Detection Accuracy**

- **Property 3**: Filename duplicate detection
  - Generate random filename, save two files with same name, verify filename duplicate detected
  - **Feature: file-upload-deduplication, Property 3: Filename Duplicate Detection**

- **Property 4**: Transaction atomicity
  - Simulate database failure during save, verify no partial data saved
  - **Feature: file-upload-deduplication, Property 4: Transaction Atomicity**

- **Property 5**: File replacement integrity
  - Simulate failure during replacement, verify old file not deleted
  - **Feature: file-upload-deduplication, Property 5: File Replacement Integrity**

- **Property 6**: Unique filename generation
  - Generate random filename, trigger "keep-both" multiple times, verify all filenames unique
  - **Feature: file-upload-deduplication, Property 6: Unique Filename Generation**

- **Property 7**: Temp file cleanup
  - Upload and cancel random files, verify all temp files cleaned up
  - **Feature: file-upload-deduplication, Property 7: Temp File Cleanup**

- **Property 8**: Hash storage format consistency
  - Generate random file content, save document, verify hash is lowercase hex
  - **Feature: file-upload-deduplication, Property 8: Hash Storage Format Consistency**

- **Property 9**: Progress accuracy
  - Simulate upload with random progress events, verify progress percentage calculation
  - **Feature: file-upload-deduplication, Property 9: Progress Accuracy**

- **Property 10**: Concurrent upload limit
  - Trigger random number of concurrent uploads, verify max 3 active at once
  - **Feature: file-upload-deduplication, Property 10: Concurrent Upload Limit**

### Integration Tests

测试组件之间的集成和端到端流程。

**Integration Test Scenarios:**
1. Complete upload flow (no duplicate)
2. Upload duplicate file (content match)
3. Upload duplicate file (filename match)
4. Upload duplicate file (both match)
5. User chooses "replace" action
6. User chooses "keep-both" action
7. User chooses "cancel" action
8. Multiple concurrent uploads
9. Upload failure and retry
10. Network interruption during upload

### Manual Testing

**Test Cases:**
1. Upload various file types (.pdf, .docx, .txt, .md, images)
2. Upload large files (> 100MB) and verify streaming hash
3. Upload duplicate files and verify modal appearance
4. Test all three duplicate resolution options
5. Upload multiple files concurrently
6. Interrupt network during upload
7. Fill disk space and verify error handling
8. Test drag-and-drop upload
9. Test keyboard shortcuts in modal
10. Verify progress bar accuracy with network throttling

## Performance Considerations

### Optimization Strategies

1. **Streaming Hash Calculation**
   - Files > 10MB use streaming to avoid memory issues
   - Process in 64KB chunks
   - Target: < 2 seconds for 100MB file

2. **Database Indexing**
   - Index on `hash` column for fast duplicate lookup
   - Index on `(user_id, title)` for filename duplicate lookup
   - Target: < 50ms query time

3. **Concurrent Upload Management**
   - Limit to 3 simultaneous uploads
   - Queue additional uploads
   - Prevent browser/server overload

4. **Async Operations**
   - Hash calculation in background
   - Database queries non-blocking
   - Knowledge graph building async (existing)

5. **Temp File Cleanup**
   - Background job every 15 minutes
   - Immediate cleanup on complete/cancel
   - Prevent disk space accumulation

### Performance Targets

- Hash calculation: < 2s for 100MB file
- Duplicate check query: < 50ms
- Upload API response: < 500ms (excluding file transfer)
- Modal display: < 100ms after duplicate detected
- Progress update frequency: 100ms intervals
- Concurrent uploads: 3 max, queue others

## Security Considerations

1. **Authentication**: Verify user token before upload
2. **Authorization**: Users can only access their own files
3. **File Validation**: Check file type and size limits
4. **SQL Injection**: Use prepared statements
5. **Path Traversal**: Sanitize filenames, use safe path joining
6. **Temp File Security**: Use unique IDs, restrict access permissions
7. **Hash Collision**: Use SHA-256 (cryptographically secure)

## Migration Plan

### Phase 1: Database Schema Update

1. Add `hash` and `size` columns to `documents` table
2. Create indexes for performance
3. Test on development database
4. Backup production database
5. Apply migration to production

### Phase 2: Backend Implementation

1. Implement `FileHashService`
2. Implement `DeduplicationService`
3. Implement `DocumentStorageService`
4. Update `handleFileUpload` function
5. Add new `/api/upload/resolve-duplicate` endpoint
6. Fix `userDb` connection issue

### Phase 3: Frontend Implementation

1. Create `DuplicateDetectionModal` component
2. Enhance upload progress tracking
3. Update API service methods
4. Integrate duplicate detection flow
5. Add error handling and retry logic

### Phase 4: Testing and Deployment

1. Run all unit tests
2. Run all property-based tests
3. Run integration tests
4. Perform manual testing
5. Deploy to staging environment
6. User acceptance testing
7. Deploy to production
8. Monitor for issues

## Backward Compatibility

- Existing documents without hash values will continue to work
- Hash calculation only for new uploads
- Optional: Background job to calculate hashes for existing files
- No breaking changes to existing API endpoints
- Frontend gracefully handles old documents without hash
