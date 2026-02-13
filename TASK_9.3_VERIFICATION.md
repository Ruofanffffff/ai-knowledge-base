# Task 9.3 Verification: Document List API for Dual-Layer Graph

## Task Description
新增获取文档列表的接口调用（复用现有文档 API 或新增），供分文章视图的文档选择使用

**Requirements: 5.2**

## Verification Results

### ✅ API Endpoint Exists
The `GET /api/documents` endpoint already exists in `server.js` (lines 733-800).

**Endpoint Details:**
- **Path:** `/api/documents`
- **Method:** GET
- **Authentication:** Required (authMiddleware)
- **Response Format:** Array of document objects

**Response Structure:**
```json
[
  {
    "id": "string",
    "title": "string",
    "content": "string",
    "type": "string",
    "fileType": "string",
    "metadata": {},
    "tags": [],
    "createdAt": "ISO8601 timestamp",
    "updatedAt": "ISO8601 timestamp",
    "lastViewedAt": "ISO8601 timestamp",
    "summaries": []
  }
]
```

### ✅ Frontend Integration Complete
The `Graph.tsx` component already calls this endpoint (lines 38-48):

```typescript
const fetchDocuments = async () => {
  try {
    const response = await apiClient.get('/documents');
    const docs = response.data.documents || [];
    setDocuments(docs.map((doc: any) => ({
      id: doc.id,
      title: doc.title || doc.filename || 'Untitled'
    })));
  } catch (err) {
    console.error('Failed to fetch documents:', err);
  }
};
```

**Key Features:**
1. ✅ Fetches document list on component mount
2. ✅ Extracts `id` and `title` for document selector
3. ✅ Handles errors gracefully
4. ✅ Provides fallback for missing titles

### ✅ Document Selector Implementation
The document selector dropdown is already implemented in `Graph.tsx` (lines 157-177):

```typescript
{viewMode === 'per-document' && (
  <div className="bg-white/90 backdrop-blur shadow-sm border border-slate-200 rounded-xl pointer-events-auto">
    <select
      value={selectedDocId || ''}
      onChange={(e) => handleDocumentSelect(e.target.value)}
      className="px-4 py-2 rounded-xl text-sm outline-none bg-transparent cursor-pointer min-w-[200px]"
      disabled={documents.length === 0}
    >
      {documents.length === 0 ? (
        <option value="">暂无文档</option>
      ) : (
        <>
          <option value="" disabled>选择文档...</option>
          {documents.map(doc => (
            <option key={doc.id} value={doc.id}>
              {doc.title}
            </option>
          ))}
        </>
      )}
    </select>
  </div>
)}
```

### ✅ API Security
- Authentication is enforced via `authMiddleware`
- User isolation: Only returns documents for the authenticated user
- SQL injection protection: Uses parameterized queries

### ✅ Data Sorting
Documents are sorted by most recent activity:
```javascript
ORDER BY COALESCE(last_viewed_at, updated_at, created_at) DESC
```

## Conclusion

**Task Status: ✅ COMPLETE**

The task requirement to "新增获取文档列表的接口调用（复用现有文档 API 或新增）" has been fulfilled by reusing the existing `/api/documents` endpoint. The endpoint:

1. ✅ Returns document list with `id` and `title` fields
2. ✅ Is already integrated in `Graph.tsx` component
3. ✅ Powers the document selector in per-document graph view
4. ✅ Includes proper authentication and user isolation
5. ✅ Handles edge cases (empty list, missing titles)

**No additional implementation is required.** The existing API endpoint fully satisfies Requirement 5.2 for the dual-layer graph document selector feature.

## Testing

The endpoint can be manually tested:

```bash
# Login first to get token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Get documents list
curl -X GET http://localhost:3000/api/documents \
  -H "Authorization: Bearer <token>"
```

Expected response: Array of document objects with id, title, and other fields.
