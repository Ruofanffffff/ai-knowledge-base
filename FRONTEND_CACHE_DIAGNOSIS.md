# 前端缓存问题诊断指南

## 问题描述

前端显示的文档列表与数据库中的实际数据不一致。数据库中有4个正确的文档，但前端显示的是旧的文档。

## 数据库实际内容（已确认）

```
用户: admin (ID: 1)
文档数量: 4

1. ID: 4 - 不妥协画质的直播该如何 (.docx)
2. ID: 3 - 美兰机场商汤科技联合创新协议暨第一阶段方案（初稿） (.docx)
3. ID: 2 - 20210824海南省海口市美兰机场智慧防疫项目测试方案 (.docx)
4. ID: 1 - test-file (.txt)
```

## 诊断步骤

### 步骤 1: 使用 API 直接测试工具

我们创建了一个专门的测试页面，可以绕过 React 组件直接测试后端 API。

1. **访问测试页面**：
   ```
   http://localhost:5173/test-api-direct.html
   ```

2. **点击"测试 /api/documents"按钮**

3. **查看结果**：
   - 如果显示的是正确的4个文档，说明后端 API 正常，问题在前端
   - 如果显示的是旧文档，说明问题在后端

### 步骤 2: 检查浏览器 Network 标签

1. 打开浏览器开发者工具（F12）
2. 切换到 **Network** 标签
3. 刷新文档页面（http://localhost:5173/documents）
4. 找到 `/api/documents` 请求
5. 点击该请求，查看 **Response** 标签
6. 确认返回的数据是否正确

### 步骤 3: 清除所有可能的缓存

在测试页面中点击"清除所有缓存"按钮，这将清除：
- LocalStorage（除了 auth_token）
- SessionStorage
- Service Workers
- Cache API

### 步骤 4: 重启开发服务器

有时 Vite 开发服务器会缓存某些数据。

1. **停止前端服务器**（Ctrl+C）
2. **清除 Vite 缓存**：
   ```bash
   cd client
   rm -rf node_modules/.vite
   ```
3. **重启服务器**：
   ```bash
   npm run dev
   ```

### 步骤 5: 硬刷新浏览器

1. 在浏览器中按 **Cmd+Shift+R**（Mac）或 **Ctrl+Shift+R**（Windows/Linux）
2. 这将强制浏览器重新加载所有资源，忽略缓存

## 可能的原因分析

### 1. React 组件状态缓存

**症状**：API 返回正确数据，但页面显示旧数据

**原因**：React 组件的 state 可能没有正确更新

**解决方案**：
- 检查 `Documents.tsx` 中的 `loadDocuments` 函数
- 确保 `setDocuments(response.data || [])` 正确执行
- 添加 console.log 调试

### 2. Axios 响应拦截器缓存

**症状**：多次请求返回相同的旧数据

**原因**：某个中间件或拦截器可能缓存了响应

**解决方案**：
- 检查 `client/src/api/client.ts` 的拦截器
- 确保没有缓存逻辑

### 3. Vite 开发服务器缓存

**症状**：重启浏览器后仍显示旧数据

**原因**：Vite 的 HMR 或模块缓存

**解决方案**：
- 删除 `node_modules/.vite` 目录
- 重启开发服务器

### 4. 浏览器 HTTP 缓存

**症状**：Network 标签显示请求状态为 "from cache"

**原因**：浏览器缓存了 API 响应

**解决方案**：
- 后端已添加 `Cache-Control: no-store` 头
- 使用硬刷新（Cmd+Shift+R）

## 已实施的修复

### 1. 后端缓存控制头

在 `server.js` 的 `/api/documents` 路由中添加了：

```javascript
res.set({
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store'
});
```

### 2. 创建了诊断工具

- `diagnose-api-response.js` - 检查数据库内容
- `test-api-direct.html` - 直接测试 API 响应

## 下一步行动

1. **首先**：访问 `http://localhost:5173/test-api-direct.html` 并测试 API
2. **如果 API 返回正确数据**：
   - 问题在前端，需要清除 Vite 缓存并重启
   - 检查 React 组件的状态管理
3. **如果 API 返回旧数据**：
   - 检查是否有多个数据库文件
   - 检查后端是否连接到正确的数据库

## 联系信息

如果问题仍然存在，请提供以下信息：
1. 测试页面显示的结果截图
2. Network 标签中 `/api/documents` 请求的 Response 内容
3. 浏览器 Console 中的任何错误信息
