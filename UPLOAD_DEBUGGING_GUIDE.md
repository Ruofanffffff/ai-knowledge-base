# 文件上传调试指南

## 问题总结

用户反馈两个问题：
1. **文件已存在时前端没有提示** - 重复检测模态框没有显示
2. **上传时没有进度提示** - 上传进度条没有显示

## 已完成的修复

### 修复 1: 重复检测响应格式兼容性

**文件**: `client/src/pages/DocumentsList.tsx`

**修改内容**:
- 修改了重复检测逻辑，同时支持 `isDuplicate` 和 `duplicate` 字段
- 添加了详细的调试日志

```typescript
// 修改前
if ((response as any).isDuplicate && response.data) {
  // ...
}

// 修改后
const isDuplicate = (response as any).isDuplicate || (response.data && (response.data as any).duplicate);
if (isDuplicate && response.data) {
  console.log('[Upload] 检测到重复文件:', {
    fileName: file.name,
    duplicateType: duplicateData.duplicateType,
    existingFile: duplicateData.existingFile
  });
  // ...
}
```

### 修复 2: 添加上传进度调试日志

**文件**: `client/src/pages/DocumentsList.tsx`

**修改内容**:
- 在 `uploadSingleFile` 函数中添加了详细的调试日志
- 记录文件信息、进度更新和响应数据

```typescript
console.log('[Upload] 开始上传文件:', { name: file.name, size: file.size, type: file.type });

// 进度回调中
console.log('[Upload] 进度更新:', { 
  fileName: file.name, 
  progress: Math.round(progress), 
  speed: Math.round(speed), 
  estimatedTime: Math.round(estimatedTime) 
});

// 收到响应后
console.log('[Upload] 收到响应:', response);
```

## 调试步骤

### 步骤 1: 检查浏览器控制台

1. 打开浏览器开发者工具（F12）
2. 切换到 Console 标签
3. 上传一个文件
4. 观察控制台输出：

**期望看到的日志**:
```
[Upload] 开始上传文件: {name: "test.txt", size: 1234, type: "text/plain"}
[Upload] 进度更新: {fileName: "test.txt", progress: 25, speed: 102400, estimatedTime: 3}
[Upload] 进度更新: {fileName: "test.txt", progress: 50, speed: 98304, estimatedTime: 2}
[Upload] 进度更新: {fileName: "test.txt", progress: 75, speed: 105000, estimatedTime: 1}
[Upload] 进度更新: {fileName: "test.txt", progress: 100, speed: 100000, estimatedTime: 0}
[Upload] 收到响应: {success: true, data: {...}}
```

**如果是重复文件**:
```
[Upload] 检测到重复文件: {fileName: "test.txt", duplicateType: "content", existingFile: {...}}
[Upload] 重复检测模态框应该显示
```

### 步骤 2: 检查网络请求

1. 在开发者工具中切换到 Network 标签
2. 上传文件
3. 找到 `/api/documents/upload` 请求
4. 检查：
   - Request Headers 中是否有 `Authorization` token
   - Response 的状态码（应该是 200）
   - Response Body 的格式

**正常上传的响应格式**:
```json
{
  "success": true,
  "document": {
    "id": "123",
    "title": "test",
    "fileType": ".txt",
    "size": 1234,
    "hash": "abc123...",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**重复文件的响应格式**:
```json
{
  "success": false,
  "duplicate": true,
  "duplicateType": "content",
  "existingFile": {
    "id": "456",
    "title": "test",
    "size": 1234,
    "uploadDate": "2024-01-01T00:00:00.000Z"
  },
  "tempFileId": "temp_789",
  "newFile": {
    "name": "test.txt",
    "size": 1234
  }
}
```

### 步骤 3: 检查上传面板显示

1. 上传文件后，检查页面右下角是否出现上传面板
2. 上传面板应该显示：
   - 文件名
   - 上传状态（等待中、上传中、处理中、完成）
   - 进度条（0-100%）
   - 上传速度（KB/s 或 MB/s）
   - 预计剩余时间

**如果上传面板没有显示**:
- 检查 `uploadingFiles` 状态是否有数据
- 检查 CSS 样式是否正确
- 检查 z-index 是否被其他元素覆盖

### 步骤 4: 检查重复检测模态框

1. 上传一个已存在的文件（相同内容或相同文件名）
2. 模态框应该弹出，显示：
   - 重复类型（内容重复、文件名重复、完全重复）
   - 新文件信息（文件名、大小）
   - 现有文件信息（文件名、大小、上传时间）
   - 三个操作按钮：
     - 覆盖现有文件（红色）
     - 保存为新文件（紫色）
     - 取消上传（灰色）

**如果模态框没有显示**:
- 检查控制台是否有 "[Upload] 检测到重复文件" 日志
- 检查 `duplicateInfo` 状态是否被设置
- 检查 `DuplicateDetectionModal` 组件是否正确渲染

## 后端测试

使用提供的测试脚本验证后端功能：

```bash
# 1. 获取认证 token（登录后从浏览器 localStorage 获取）
# 2. 运行测试脚本
node test-upload-flow.js YOUR_TOKEN_HERE
```

测试脚本会：
1. 上传一个新文件
2. 上传相同内容的文件（测试内容重复检测）
3. 上传相同文件名的文件（测试文件名重复检测）
4. 测试重复解决功能（keep-both, cancel）

## 常见问题排查

### 问题 1: 进度条不显示

**可能原因**:
1. 文件太小，上传太快（< 100ms）
2. 上传面板被折叠（`isUploadPanelOpen` 为 false）
3. CSS 样式问题

**解决方法**:
1. 上传一个较大的文件（> 10MB）测试
2. 检查 `isUploadPanelOpen` 状态
3. 检查浏览器控制台的 CSS 错误

### 问题 2: 重复检测模态框不显示

**可能原因**:
1. 后端没有返回 `duplicate: true`
2. 前端响应处理逻辑错误
3. `duplicateInfo` 状态没有被设置

**解决方法**:
1. 检查后端日志，确认重复检测逻辑执行
2. 检查浏览器控制台的响应数据
3. 检查 `setDuplicateInfo` 是否被调用

### 问题 3: 上传失败

**可能原因**:
1. 认证 token 无效或过期
2. 数据库连接问题
3. 文件权限问题

**解决方法**:
1. 重新登录获取新 token
2. 检查后端日志
3. 检查文件系统权限

## 下一步

如果问题仍然存在：

1. **收集信息**:
   - 浏览器控制台的完整日志
   - Network 标签中的请求/响应详情
   - 后端服务器日志

2. **提供详细描述**:
   - 具体的操作步骤
   - 期望的行为
   - 实际的行为
   - 错误消息（如果有）

3. **测试环境**:
   - 浏览器类型和版本
   - 操作系统
   - 文件类型和大小
   - 是否使用 HTTPS

## 相关文件

- `client/src/pages/DocumentsList.tsx` - 前端上传逻辑
- `client/src/services/api.ts` - API 服务
- `client/src/components/DuplicateDetectionModal.tsx` - 重复检测模态框
- `server.js` - 后端上传处理（handleFileUpload 函数）
- `services/fileHashService.js` - 文件 hash 计算
- `services/deduplicationService.js` - 重复检测服务
- `services/tempFileManager.js` - 临时文件管理
