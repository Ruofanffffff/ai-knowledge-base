# 问题修复报告 - 2026年2月12日

## 问题概述

用户报告了两个主要问题：
1. 后端日志中出现大量404错误
2. 前端显示的文档在数据库中已不存在

## 问题1: API路径错误（双重/api前缀）

### 问题描述
后端日志显示大量404错误：
```
[ERROR] Request error {
  error: 'Resource not found - /api/api/kg/status/1?detailed=true',
  ...
}
```

### 根本原因
前端代码在调用KG相关API时，错误地添加了 `/api` 前缀，而 `apiClient` 的 `baseURL` 已经配置为 `/api`，导致实际请求路径变成了 `/api/api/kg/status/...`（双重前缀）。

### 影响范围
- 所有KG状态查询请求失败
- KG重建请求失败
- KG构建请求失败

### 修复方案
修改 `client/src/services/api.ts` 文件，移除多余的 `/api` 前缀：

**修复前**:
```typescript
const response = await apiClient.get<KGStatusResponse>(`/api/kg/status/${docId}?detailed=true`);
```

**修复后**:
```typescript
const response = await apiClient.get<KGStatusResponse>(`/kg/status/${docId}?detailed=true`);
```

### 修复的具体位置
文件: `ai-knowledge-base/client/src/services/api.ts`

1. **getKGStatus 方法** (约第568行)
   - 修改前: `/api/kg/status/${docId}`
   - 修改后: `/kg/status/${docId}`

2. **rebuildKG 方法** (约第658行)
   - 修改前: `/api/kg/rebuild/${docId}`
   - 修改后: `/kg/rebuild/${docId}`

3. **buildKG 方法** (约第680行)
   - 修改前: `/api/kg/build`
   - 修改后: `/kg/build`

### 验证方法
1. 打开浏览器开发者工具
2. 查看Network标签
3. 确认KG相关请求路径为 `/api/kg/status/...` 而不是 `/api/api/kg/status/...`
4. 确认请求返回200状态码而不是404

---

## 问题2: 前端缓存显示已删除的文档

### 问题描述
用户在前端看到4个文档：
1. 天花板维修流量通道说明
2. 基层机构编制和岗位设置的规范性说明一体化方案（初稿）
3. 20210624年度市级行政单位机构编制动态调整流程方案
4. test.file

但运行 `check-documents.js` 脚本显示数据库中有146个文档，且都是测试文档（Test Document），没有上述4个文档。

### 根本原因
1. **浏览器缓存**: 浏览器缓存了旧的文档列表数据
2. **缺少缓存控制**: 后端API没有设置缓存控制头，浏览器默认缓存了响应
3. **前端没有缓存失效机制**: 前端没有实现缓存失效或强制刷新机制

### 影响范围
- 用户看到的文档列表与实际数据库不一致
- 删除文档后前端仍然显示
- 可能导致用户操作不存在的文档

### 修复方案

#### 方案1: 添加缓存控制头（已实施）
修改 `server.js` 文件，在 GET `/api/documents` 路由中添加缓存控制头：

```javascript
app.get('/api/documents', authMiddleware, (req, res) => {
  // 禁用缓存，确保始终获取最新数据
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  
  // ... 现有代码
});
```

**缓存控制头说明**:
- `Cache-Control: no-store` - 不存储任何缓存
- `Cache-Control: no-cache` - 每次都重新验证
- `Cache-Control: must-revalidate` - 缓存过期后必须重新验证
- `Pragma: no-cache` - HTTP/1.0兼容性
- `Expires: 0` - 立即过期
- `Surrogate-Control: no-store` - 代理服务器不缓存

#### 方案2: 用户立即解决方案
用户可以通过以下方式清除缓存：

**方法1: 硬刷新**
- Windows/Linux: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

**方法2: 清除浏览器缓存**
1. 打开开发者工具（F12）
2. 右键点击刷新按钮
3. 选择"清空缓存并硬性重新加载"

**方法3: 清除网站数据**
1. 打开开发者工具（F12）
2. 进入 Application/应用程序 标签
3. 左侧选择 Storage/存储
4. 点击 "Clear site data" / "清除网站数据"

### 修复的具体位置
文件: `ai-knowledge-base/server.js`

**位置**: 第575行，GET `/api/documents` 路由

**修改内容**: 在路由处理函数开始处添加缓存控制头设置

### 验证方法
1. 清除浏览器缓存
2. 刷新页面
3. 打开开发者工具 Network 标签
4. 查看 `/api/documents` 请求的响应头
5. 确认包含 `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`
6. 确认前端显示的文档列表与数据库一致

---

## 长期改进建议

### 1. 实现WebSocket实时同步
当文档被删除或修改时，通过WebSocket实时通知所有客户端更新：

```javascript
// 后端
io.on('connection', (socket) => {
  socket.on('document:deleted', (docId) => {
    io.emit('document:deleted', docId);
  });
});

// 前端
useEffect(() => {
  const socket = io();
  socket.on('document:deleted', (docId) => {
    setDocuments(prev => prev.filter(doc => doc.id !== docId));
  });
  return () => socket.disconnect();
}, []);
```

### 2. 实现前端数据版本控制
在API响应中添加版本号或ETag，前端根据版本号判断是否需要更新：

```javascript
// 后端
res.set('ETag', generateETag(documents));

// 前端
const cachedETag = localStorage.getItem('documents_etag');
if (response.headers.etag !== cachedETag) {
  // 更新数据
  localStorage.setItem('documents_etag', response.headers.etag);
}
```

### 3. 添加数据一致性检查
定期检查前端缓存与后端数据的一致性：

```javascript
// 前端定期检查
setInterval(async () => {
  const response = await apiClient.head('/api/documents');
  const serverETag = response.headers.etag;
  const localETag = localStorage.getItem('documents_etag');
  if (serverETag !== localETag) {
    // 重新加载数据
    await loadDocuments();
  }
}, 60000); // 每分钟检查一次
```

### 4. 实现乐观更新
在删除文档时，立即从前端列表中移除，不等待服务器响应：

```javascript
const handleDelete = async (docId) => {
  // 乐观更新：立即从UI中移除
  setDocuments(prev => prev.filter(doc => doc.id !== docId));
  
  try {
    await apiClient.delete(`/api/documents/${docId}`);
  } catch (error) {
    // 如果失败，恢复文档
    await loadDocuments();
    alert('删除失败');
  }
};
```

---

## 修复总结

### 已完成的修复
✅ **问题1**: 修复API路径错误（移除双重/api前缀）
✅ **问题2**: 添加缓存控制头到文档列表API

### 需要用户操作
⚠️  清除浏览器缓存并刷新页面（一次性操作）

### 后续改进
📋 考虑实现WebSocket实时同步
📋 考虑添加数据版本控制
📋 考虑实现乐观更新机制

---

## 测试验证

### 测试步骤
1. **重启服务**
   ```bash
   # 停止当前服务
   # 启动新服务
   npm run dev
   ```

2. **清除浏览器缓存**
   - 按 Ctrl+Shift+R (Windows/Linux) 或 Cmd+Shift+R (Mac)

3. **验证API路径**
   - 打开开发者工具 Network 标签
   - 查看KG相关请求
   - 确认路径为 `/api/kg/status/...` 而不是 `/api/api/kg/status/...`

4. **验证文档列表**
   - 查看前端显示的文档
   - 运行 `node check-documents.js` 查看数据库中的文档
   - 确认两者一致

5. **验证缓存控制**
   - 查看 `/api/documents` 请求的响应头
   - 确认包含 `Cache-Control: no-store, no-cache, must-revalidate`

### 预期结果
- ✅ 不再出现 `/api/api/` 的404错误
- ✅ 前端显示的文档与数据库一致
- ✅ 删除文档后刷新页面，文档不再显示
- ✅ 所有KG状态查询正常工作

---

## 相关文件

### 修改的文件
1. `ai-knowledge-base/client/src/services/api.ts` - 修复API路径
2. `ai-knowledge-base/server.js` - 添加缓存控制头

### 新增的文档
1. `ai-knowledge-base/FRONTEND_CACHE_FIX_GUIDE.md` - 缓存问题修复指南
2. `ai-knowledge-base/ISSUES_FIXED_2026-02-12.md` - 本文档

### 相关工具
1. `ai-knowledge-base/check-documents.js` - 数据库文档检查工具
2. `ai-knowledge-base/test-preprocessing-config.js` - 预处理配置测试工具

---

**修复时间**: 2026年2月12日
**修复人**: Kiro AI Assistant
**状态**: ✅ 已完成
