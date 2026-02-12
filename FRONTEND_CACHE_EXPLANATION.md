# 前端为什么不刷新？

## 问题

后端数据已经清空（documents.json 现在是空数组 `[]`），但前端仍然显示旧的文档列表。

## 原因分析

### 1. 浏览器 HTTP 缓存

浏览器会自动缓存 HTTP 响应，包括 API 的 JSON 数据。当你访问 `/api/documents` 时：

```
第一次请求：
浏览器 → 服务器 → 返回 7 条文档 → 浏览器缓存这个响应

第二次请求（数据已清空）：
浏览器 → 检查缓存 → 发现有缓存 → 直接使用缓存（不请求服务器）
```

### 2. 缺少缓存控制头

当前后端没有设置缓存控制头，浏览器默认会缓存 GET 请求的响应。

## 解决方案

### 方案 1：用户端解决（临时）

用户在浏览器中强制刷新：
- Windows: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

或者清除浏览器缓存。

### 方案 2：后端添加缓存控制头（永久）

在后端 API 响应中添加缓存控制头：

```javascript
// server.js
app.use('/api/documents', (req, res, next) => {
  // 禁用缓存
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
```

这样浏览器就不会缓存 API 响应，每次都会从服务器获取最新数据。

### 方案 3：前端添加时间戳（备选）

在前端 API 调用中添加时间戳参数：

```typescript
// 每次请求都不同，绕过缓存
const response = await fetch(`/api/documents?t=${Date.now()}`);
```

## 推荐方案

**立即实施方案 2**：在后端添加缓存控制头

这是最标准、最彻底的解决方案，可以防止所有缓存问题。

## 实施步骤

1. 在 `server.js` 中添加缓存控制中间件
2. 重启后端服务器
3. 用户在浏览器中强制刷新一次（清除旧缓存）
4. 之后就不会再有缓存问题

## 验证

添加缓存控制头后，可以在浏览器开发者工具中验证：

1. 打开开发者工具（F12）
2. 切换到 Network 标签
3. 刷新页面
4. 查看 `/api/documents` 请求的响应头
5. 应该看到：
   ```
   Cache-Control: no-cache, no-store, must-revalidate
   Pragma: no-cache
   Expires: 0
   ```
