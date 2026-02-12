# 修复 404 轮询问题

## 问题分析

前端持续轮询 `/api/kg/status/5?detailed=true` 并返回 404 错误。

### 根本原因
1. 用户之前访问过 `/documents/5` 页面
2. 数据库被清空后，文档 ID 5 不再存在
3. 浏览器可能仍在该页面或保留了该 URL
4. 前端代码会自动为当前文档 ID 轮询 KG 状态
5. 后端对不存在的文档返回 404，但前端继续轮询

## 解决方案

### 方案 1: 清除浏览器历史和缓存（快速）
1. 在浏览器中打开开发者工具 (F12)
2. 右键点击刷新按钮，选择"清空缓存并硬性重新加载"
3. 或者直接导航到首页: `http://localhost:5173/` 或 `/documents`
4. 关闭所有包含 `/documents/5` 的标签页

### 方案 2: 修改后端返回更友好的错误（推荐）
后端应该返回 JSON 格式的错误响应，而不是 404 HTML 页面：

```javascript
// routes/kgRoutes.js - GET /api/kg/status/:docId
if (!status) {
  return res.status(404).json({
    success: false,
    error: 'Document not found or KG status not available',
    code: 'DOCUMENT_NOT_FOUND'
  });
}
```

### 方案 3: 前端优雅处理 404（推荐）
前端应该在收到 404 时停止轮询：

```typescript
// useKGStatus.ts
const fetchStatusImmediate = useCallback(async () => {
  if (!docId) return;

  try {
    setIsLoading(true);
    setError(null);

    const response = await apiService.getKGStatus(docId);

    if (response.success && response.data) {
      // ... 处理成功响应
    } else {
      // 如果是文档不存在错误，停止轮询
      if (response.error?.includes('not found') || response.error?.includes('404')) {
        stopPolling();
      }
      throw new Error(response.error || 'Failed to fetch KG status');
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Unknown error');
    setError(error);
    
    // 404 错误时停止轮询
    if (error.message.includes('404') || error.message.includes('not found')) {
      stopPolling();
    }
    
    console.error('[useKGStatus] Error fetching status:', error);
  } finally {
    setIsLoading(false);
  }
}, [docId, onStatusChange, onCompleted, onFailed, stopPolling]);
```

## 立即解决步骤

1. **关闭包含旧文档 ID 的页面**
   - 在浏览器中，关闭所有 `/documents/5` 或类似的标签页
   - 导航到 `/documents` 或 `/dashboard`

2. **清除浏览器缓存**
   - 使用之前创建的工具: 打开 `http://localhost:5173/clear-all-cache.html`
   - 或者在开发者工具中手动清除

3. **重启前端服务**（如果需要）
   ```bash
   # 停止前端
   # 然后重新启动
   cd ai-knowledge-base/client
   npm run dev
   ```

## 预防措施

1. 在 DocumentDetail 页面添加文档存在性检查
2. 当文档不存在时，自动重定向到文档列表页
3. 在 useKGStatus hook 中添加 404 错误处理，自动停止轮询
4. 后端统一返回 JSON 格式的错误响应

## 验证

修复后，检查浏览器控制台：
- 不应该再看到 404 错误
- 不应该有持续的轮询请求
- 如果访问不存在的文档，应该看到友好的错误提示或重定向
