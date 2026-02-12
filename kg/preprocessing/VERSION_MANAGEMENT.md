# Document Index Version Management

## Overview

The version management system tracks and manages different versions of document indices, allowing you to:
- Query specific versions of document indices
- Compare differences between versions
- View version history
- Delete old versions

## Features

### 1. Version Tracking

Every time a document index is regenerated, a new version is automatically created with an incremented version number.

```javascript
const { VersionManager } = require('./version_manager');
const versionManager = new VersionManager({ prisma });

// Get latest version number
const latestVersion = await versionManager.getLatestVersion('doc-123');
```

### 2. Version Querying

Retrieve specific versions or all versions of a document index:

```javascript
// Get a specific version
const version2 = await versionManager.getVersion('doc-123', 2);

// Get all versions (with pagination)
const allVersions = await versionManager.getAllVersions('doc-123', {
  orderBy: 'desc',
  skip: 0,
  take: 10
});
```

### 3. Version Comparison

Compare two versions to see what changed:

```javascript
const comparison = await versionManager.compareVersions('doc-123', 1, 2);

console.log(comparison);
// {
//   docId: 'doc-123',
//   version1: { version: 1, createdAt: ..., factCount: 5, tokenCount: 200 },
//   version2: { version: 2, createdAt: ..., factCount: 7, tokenCount: 250 },
//   comparison: {
//     text: { identical: false, similarity: 0.85, lengthDiff: 50 },
//     metadata: { factCountDiff: 2, tokenCountDiff: 50, modelChanged: false },
//     facts: {
//       added: 2,
//       removed: 0,
//       modified: 1,
//       unchanged: 4,
//       addedFacts: [...],
//       removedFacts: [...],
//       modifiedFacts: [...]
//     }
//   }
// }
```

### 4. Version History

Get a summary of all versions for a document:

```javascript
const history = await versionManager.getVersionHistory('doc-123');

console.log(history);
// {
//   docId: 'doc-123',
//   totalVersions: 5,
//   latestVersion: 5,
//   firstCreated: '2025-01-01T00:00:00Z',
//   lastUpdated: '2025-01-15T10:30:00Z',
//   versions: [
//     { version: 5, factCount: 10, tokenCount: 300, llmModel: 'qwen-plus', createdAt: ... },
//     { version: 4, factCount: 8, tokenCount: 250, llmModel: 'qwen-plus', createdAt: ... },
//     ...
//   ]
// }
```

### 5. Version Deletion

Delete specific versions when no longer needed:

```javascript
const deleted = await versionManager.deleteVersion('doc-123', 2);
console.log(deleted); // true if deleted, false if not found
```

## API Endpoints

### Get Document Index (Latest or Specific Version)

```
GET /api/preprocessing/index/:docId?version=2
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "index-id",
    "docId": "doc-123",
    "indexedText": "1. Fact one\n2. Fact two",
    "version": 2,
    "metadata": { "fact_count": 2, "token_count": 100 },
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2025-01-15T10:30:00Z"
  }
}
```

### Get All Versions

```
GET /api/preprocessing/index/:docId/versions
```

**Response:**
```json
{
  "success": true,
  "data": {
    "docId": "doc-123",
    "count": 3,
    "versions": [
      { "id": "...", "version": 3, "metadata": {...}, "createdAt": "...", "updatedAt": "..." },
      { "id": "...", "version": 2, "metadata": {...}, "createdAt": "...", "updatedAt": "..." },
      { "id": "...", "version": 1, "metadata": {...}, "createdAt": "...", "updatedAt": "..." }
    ]
  }
}
```

### Get Version History

```
GET /api/preprocessing/index/:docId/history
```

**Response:**
```json
{
  "success": true,
  "data": {
    "docId": "doc-123",
    "totalVersions": 3,
    "latestVersion": 3,
    "firstCreated": "2025-01-01T00:00:00Z",
    "lastUpdated": "2025-01-15T10:30:00Z",
    "versions": [
      { "version": 3, "factCount": 10, "tokenCount": 300, "llmModel": "qwen-plus", "createdAt": "..." },
      { "version": 2, "factCount": 8, "tokenCount": 250, "llmModel": "qwen-plus", "createdAt": "..." },
      { "version": 1, "factCount": 5, "tokenCount": 200, "llmModel": "qwen-plus", "createdAt": "..." }
    ]
  }
}
```

### Compare Versions

```
GET /api/preprocessing/index/:docId/compare?version1=1&version2=2
```

**Response:**
```json
{
  "success": true,
  "data": {
    "docId": "doc-123",
    "version1": {
      "version": 1,
      "createdAt": "2025-01-01T00:00:00Z",
      "factCount": 5,
      "tokenCount": 200
    },
    "version2": {
      "version": 2,
      "createdAt": "2025-01-02T00:00:00Z",
      "factCount": 7,
      "tokenCount": 250
    },
    "comparison": {
      "text": {
        "identical": false,
        "similarity": 0.85,
        "lengthDiff": 50,
        "length1": 200,
        "length2": 250
      },
      "metadata": {
        "factCountDiff": 2,
        "tokenCountDiff": 50,
        "modelChanged": false,
        "model1": "qwen-plus",
        "model2": "qwen-plus"
      },
      "facts": {
        "totalFacts1": 5,
        "totalFacts2": 7,
        "added": 2,
        "removed": 0,
        "modified": 1,
        "unchanged": 4,
        "addedFacts": [
          { "index": 6, "text": "New fact six" },
          { "index": 7, "text": "New fact seven" }
        ],
        "removedFacts": [],
        "modifiedFacts": [
          { "index": 3, "oldText": "Old fact three", "newText": "Modified fact three" }
        ]
      }
    }
  }
}
```

### Regenerate Document Index (Creates New Version)

```
POST /api/preprocessing/index/:docId/regenerate
Content-Type: application/json

{
  "text": "Document text content...",
  "llmConfig": {
    "model": "qwen-plus",
    "temperature": 0.1
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Document index regenerated successfully",
  "data": {
    "id": "new-index-id",
    "docId": "doc-123",
    "version": 4,
    "metadata": { "fact_count": 12, "token_count": 350 },
    "createdAt": "2025-01-15T10:30:00Z"
  }
}
```

### Delete Version

```
DELETE /api/preprocessing/index/:docId/version/:version
```

**Response:**
```json
{
  "success": true,
  "message": "Version 2 deleted successfully"
}
```

## Database Schema

The `document_index` table includes a `version` field:

```sql
CREATE TABLE document_index (
  id VARCHAR(36) PRIMARY KEY,
  doc_id VARCHAR(36) NOT NULL,
  indexed_text TEXT NOT NULL,
  metadata JSON,
  version INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_doc_id (doc_id),
  INDEX idx_created_at (created_at)
);
```

## Use Cases

### 1. Track Document Evolution

Monitor how a document's index changes over time as it's updated or regenerated with different LLM models.

### 2. Rollback to Previous Version

If a new version produces lower quality results, you can reference an older version.

### 3. A/B Testing

Compare indices generated with different LLM models or configurations to determine which produces better results.

### 4. Audit Trail

Maintain a complete history of all document index versions for compliance and debugging purposes.

### 5. Quality Improvement Analysis

Analyze version comparisons to understand how preprocessing quality improves over time.

## Best Practices

1. **Regular Cleanup**: Delete old versions that are no longer needed to save storage space
2. **Version Naming**: Use metadata to document why a new version was created (e.g., model upgrade, configuration change)
3. **Comparison Analysis**: Regularly compare versions to track quality improvements
4. **Backup Important Versions**: Keep versions that represent significant milestones or high-quality results

## Requirements Validation

This implementation satisfies **Requirement 10.4**:
- ✅ Version field implemented in document_index table
- ✅ Version query functionality (get specific version, get all versions, get history)
- ✅ Version comparison functionality (text, metadata, and fact-level comparison)
- ✅ Automatic version increment on regeneration
- ✅ Version deletion support
