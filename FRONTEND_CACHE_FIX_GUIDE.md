# 前端缓存问题修复指南

## 问题分析

### 问题1: API路径错误（双重/api）
**错误**: `/api/api/kg/status/${docId}`
**原因**: `apiClient` 的 `baseURL` 已经是 `/api`，但代码中又加了 `/api` 前缀
**影响**: 所有KG状态查询都返回404错误

**已修复的文件**: `client/src/services/api.ts`
- ✅ `getKGStatus`: `/api/kg/status/` → `/kg/status/`
- ✅ `rebuildKG`: `/api/kg/rebuild/` → `/kg/rebuild/`
- ✅ `buildKG`: `/api/kg/build` → `/kg/build`

### 问题2: 前端缓存显示已删除的文档
**现象**: 数据库中没有的文档仍然显示在前端
**原因**: 浏览器缓存了旧的文档列表数据

## 解决方案

### 方案1: 清除浏览器缓存（用户端）
1. 打开浏览器开发者工具（F12）
2. 右键点击刷新按钮
3. 选择"清空缓存并硬性重新加载"

或者：
1. 打开开发者工具（F12）
2. 进入 Application/应用程序 标签
3. 左侧选择 Storage/存储
4. 点击 "Clear site data" / "清除网站数据"

### 方案2: 添加缓存控制头（后端）
在 `routes/documentRoutes.js` 中添加缓存控制：

```javascript
// GET /api/documents
router.get('/', async (req, res) => {
  // 禁用缓存
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  // ... 现有代码
});
```

### 方案3: 添加版本号或时间戳（前端）
修改 `client/src/pages/Documents.tsx`:

```typescript
const loadDocuments = async () => {
  try {
    setIsLoading(true);
    // 添加时间戳防止缓存
    const timestamp = new Date().getTime();
    const response = await apiClient.get(`/documents?_t=${timestamp}`);
    setDocuments(response.data || []);
  } catch (error) {
    console.error('加载文档失败:', error);
    setDocuments([]);
  } finally {
    setIsLoading(false);
  }
};
```

## 验证修复

### 1. 验证API路径修复
```bash
# 查看浏览器控制台，应该不再有 /api/api/ 的错误
# 正确的路径应该是:
GET /api/kg/status/1?detailed=true
GET /api/kg/rebuild/1
GET /api/kg/build
```

### 2. 验证文档列表同步
```bash
# 在后端运行
node check-documents.js

# 对比前端显示的文档列表
# 应该完全一致
```

## 临时解决方案（立即生效）

### 用户操作：
1. 按 Ctrl+Shift+R (Windows/Linux) 或 Cmd+Shift+R (Mac) 强制刷新
2. 或者清除浏览器缓存后刷新页面

### 开发者操作：
```bash
# 重启前端开发服务器
# 这会清除 Vite 的缓存
cd ai-knowledge-base
npm run dev
```

## 长期解决方案

### 1. 实现前端数据同步机制
在 `client/src/services/api.ts` 中添加：

```typescript
class ApiService {
  // 添加文档列表缓存失效方法
  invalidateDocumentCache() {
    // 清除本地缓存
    localStorage.removeItem('documents_cache');
    localStorage.removeItem('documents_cache_timestamp');
  }
  
  async getDocuments(): Promise<ApiResponse<Document[]>> {
    // 检查缓存是否过期（例如5分钟）
    const cacheTimestamp = localStorage.getItem('documents_cache_timestamp');
    const now = Date.now();
    const CACHE_TTL = 5 * 60 * 1000; // 5分钟
    
    if (cacheTimestamp && (now - parseInt(cacheTimestamp)) < CACHE_TTL) {
      const cached = localStorage.getItem('documents_cache');
      if (cached) {
        return { success: true, data: JSON.parse(cached) };
      }
    }
    
    // 从服务器获取
    const response = await apiClient.get('/documents');
    const documents = response.data || [];
    
    // 更新缓存
    localStorage.setItem('documents_cache', JSON.stringify(documents));
    localStorage.setItem('documents_cache_timestamp', now.toString());
    
    return { success: true, data: documents };
  }
}
```

### 2. 实现WebSocket实时同步
当文档被删除时，通过WebSocket通知所有客户端更新：

```typescript
// 后端: server.js
io.on('connection', (socket) => {
  socket.on('document:deleted', (docId) => {
    // 广播给所有客户端
    io.emit('document:deleted', docId);
  });
});

// 前端: Documents.tsx
useEffect(() => {
  const socket = io();
  
  socket.on('document:deleted', (docId) => {
    // 从列表中移除文档
    setDocuments(prev => prev.filter(doc => doc.id !== docId));
  });
  
  return () => {
    socket.disconnect();
  };
}, []);
```

## 当前状态

✅ **已修复**: API路径错误（双重/api）
⚠️  **待处理**: 前端缓存同步问题

## 建议操作顺序

1. **立即**: 清除浏览器缓存并刷新页面
2. **短期**: 添加缓存控制头到后端API
3. **长期**: 实现WebSocket实时同步机制

---

**更新时间**: 2026-02-12
**修复人**: Kiro AI Assistant
