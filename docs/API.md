# API Documentation

## Knowledge Graph Status API

### Overview

The Knowledge Graph Status API provides endpoints for tracking and managing the status of knowledge graph builds for uploaded documents. These endpoints enable real-time monitoring of the build process, from initial upload through completion or failure.

### Base URL

```
http://localhost:3000/api
```

### Authentication

All endpoints require authentication. Include the authentication token in the request headers:

```
Authorization: Bearer <your-token>
```

---

## Endpoints

### 1. Get Knowledge Graph Status

Retrieve the current build status for a specific document.

**Endpoint:** `GET /api/kg-status/:docId`

**Parameters:**
- `docId` (path parameter, required): The unique identifier of the document

**Response:**

```json
{
  "success": true,
  "data": {
    "docId": "123",
    "status": "completed",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:35:00.000Z",
    "entityCount": 45,
    "relationCount": 23
  }
}
```

**Status Values:**
- `pending`: Document uploaded, waiting for processing
- `building`: Knowledge graph is currently being built
- `completed`: Knowledge graph build completed successfully
- `failed`: Knowledge graph build failed

**Response Fields:**
- `docId` (string): Document identifier
- `status` (string): Current build status
- `createdAt` (string): ISO 8601 timestamp when the build was initiated
- `updatedAt` (string): ISO 8601 timestamp of the last status update
- `errorMessage` (string, optional): Error description if status is "failed"
- `entityCount` (number, optional): Number of entities extracted (only for completed builds)
- `relationCount` (number, optional): Number of relations extracted (only for completed builds)

**Error Responses:**

404 Not Found:
```json
{
  "success": false,
  "error": "Document not found or status not available"
}
```

500 Internal Server Error:
```json
{
  "success": false,
  "error": "Failed to retrieve status"
}
```

**Example:**

```bash
curl -X GET http://localhost:3000/api/kg-status/123 \
  -H "Authorization: Bearer your-token"
```

---

### 2. Batch Get Knowledge Graph Status

Retrieve build statuses for multiple documents in a single request.

**Endpoint:** `POST /api/kg-status/batch`

**Request Body:**

```json
{
  "docIds": ["123", "124", "125"]
}
```

**Parameters:**
- `docIds` (array of strings, required): List of document identifiers

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "docId": "123",
      "status": "completed",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:35:00.000Z",
      "entityCount": 45,
      "relationCount": 23
    },
    {
      "docId": "124",
      "status": "building",
      "createdAt": "2024-01-15T10:32:00.000Z",
      "updatedAt": "2024-01-15T10:33:00.000Z"
    },
    {
      "docId": "125",
      "status": "failed",
      "createdAt": "2024-01-15T10:28:00.000Z",
      "updatedAt": "2024-01-15T10:29:00.000Z",
      "errorMessage": "Invalid file format"
    }
  ]
}
```

**Error Responses:**

400 Bad Request:
```json
{
  "success": false,
  "error": "docIds array is required"
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/kg-status/batch \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"docIds": ["123", "124", "125"]}'
```

---

### 3. Rebuild Knowledge Graph

Trigger a rebuild of the knowledge graph for a specific document.

**Endpoint:** `POST /api/kg-rebuild/:docId`

**Parameters:**
- `docId` (path parameter, required): The unique identifier of the document

**Response:**

```json
{
  "success": true,
  "message": "Knowledge graph rebuild initiated"
}
```

**Behavior:**
- Resets the build status to "pending"
- Clears existing graph data (entities and relations)
- Triggers the knowledge graph build process
- Prevents concurrent rebuilds for the same document

**Error Responses:**

404 Not Found:
```json
{
  "success": false,
  "error": "Document not found"
}
```

409 Conflict:
```json
{
  "success": false,
  "error": "Rebuild already in progress for this document"
}
```

500 Internal Server Error:
```json
{
  "success": false,
  "error": "Failed to initiate rebuild"
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/kg-rebuild/123 \
  -H "Authorization: Bearer your-token"
```

---

### 4. End-to-End Test (Development Only)

Run a complete end-to-end test of the knowledge graph build process.

**Endpoint:** `POST /api/kg-test/e2e`

**Request:**
- Content-Type: `multipart/form-data`
- Body: File upload with field name `file`

**Response:**

```json
{
  "success": true,
  "steps": [
    {
      "step": 1,
      "name": "上传测试文档",
      "status": "completed",
      "docId": "123"
    },
    {
      "step": 2,
      "name": "验证初始状态",
      "status": "completed",
      "initialStatus": "pending"
    },
    {
      "step": 3,
      "name": "触发KG构建",
      "status": "completed"
    },
    {
      "step": 4,
      "name": "验证状态转换",
      "status": "completed",
      "statusTransitions": [
        { "status": "pending", "timestamp": 0 },
        { "status": "building", "timestamp": 500 },
        { "status": "completed", "timestamp": 5000 }
      ],
      "finalStatus": "completed"
    },
    {
      "step": 5,
      "name": "验证图谱数据",
      "status": "completed",
      "entityCount": 15,
      "relationCount": 8,
      "hasValidData": true
    }
  ],
  "totalTime": 5234,
  "errors": []
}
```

**Note:** This endpoint is for testing purposes only and should not be exposed in production environments.

---

## Error Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid authentication |
| 404 | Not Found - Document or resource not found |
| 409 | Conflict - Operation conflicts with current state |
| 500 | Internal Server Error - Server-side error |

---

## Rate Limiting

To ensure optimal performance:
- Status queries are cached for 1 second on the client side
- Batch queries should be used when fetching statuses for multiple documents
- Maximum of 3 concurrent knowledge graph builds are allowed

---

## Polling Recommendations

For real-time status updates, implement polling with the following guidelines:

1. **Polling Interval:** 2 seconds (2000ms)
2. **Active Polling:** Only poll when status is "pending" or "building"
3. **Stop Polling:** Stop when status becomes "completed" or "failed"
4. **Debouncing:** Implement request debouncing (300ms) to prevent excessive calls
5. **Batch Queries:** Use batch endpoint for multiple documents

**Example Polling Implementation (JavaScript):**

```javascript
async function pollStatus(docId) {
  const pollInterval = 2000; // 2 seconds
  
  const poll = async () => {
    const response = await fetch(`/api/kg-status/${docId}`);
    const data = await response.json();
    
    if (data.data.status === 'pending' || data.data.status === 'building') {
      // Continue polling
      setTimeout(poll, pollInterval);
    } else {
      // Status is completed or failed, stop polling
      console.log('Final status:', data.data.status);
    }
  };
  
  poll();
}
```

---

## Webhooks (Future Enhancement)

Webhook support for status updates is planned for future releases. This will eliminate the need for polling and provide real-time push notifications when build status changes.

---

## Support

For issues or questions about the API, please contact the development team or refer to the [Troubleshooting Guide](./KG_STATUS_GUIDE.md).
