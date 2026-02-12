# 轮询404问题 - 完整解决方案

## 问题现状

✅ **已确认**: 数据库中没有文档，但前端缓存了旧的文档列表  
✅ **症状**: 点击文档后出现持续的404轮询请求  
✅ **影响**: 浏览器性能下降，页面响应缓慢

## 立即解决步骤

### 步骤1：清理浏览器缓存（必须）

选择以下任一方法：

#### 方法A：使用紧急缓存清理页面（最简单）

1. 在浏览器中打开：`http://localhost:5173/emergency-cache-clear.html`
2. 点击"清理缓存并刷新"按钮
3. 等待页面自动刷新到首页
4. 完成！

#### 方法B：手动清理（适用于所有浏览器）

1. 按 `F12` 打开开发者工具
2. 找到 `Application`（Chrome/Edge）或 `Storage`（Firefox）标签
3. 点击 `Clear storage` 或 `Clear site data`
4. 确认清除
5. 按 `Ctrl+Shift+R`（Windows）或 `Cmd+Shift+R`（Mac）强制刷新

### 步骤2：验证问题已解决

1. 刷新页面后，文档列表应该是空的
2. 打开浏览器开发者工具的 Network 标签
3. 不应该再看到重复的404请求
4. 如果还有问题，继续下一步

### 步骤3：运行诊断脚本（可选）

```bash
cd ai-knowledge-base
node diagnose-polling-issue.js
```

这个脚本会：
- 检查数据库中的文档数量
- 列出所有文档和KG状态
- 识别孤立的KG状态记录
- 提供具体的解决建议

### 步骤4：清理孤立的KG状态（如果需要）

如果诊断脚本发现孤立的KG状态记录：

```bash
node cleanup-orphaned-kg-status.js
```

## 技术改进（已实施）

### 1. useKGStatus Hook 改进

**文件**: `client/src/hooks/useKGStatus.ts`

**改进内容**:
- ✅ 检测404错误并自动停止轮询
- ✅ 添加详细的控制台日志
- ✅ 改进错误处理逻辑
- ✅ 确保 stopPolling 在 fetchStatusImmediate 之前定义

**关键代码**:
```typescript
// 检测404并停止轮询
const isNotFound = errorMsg.includes('not found') || 
                  errorMsg.includes('404') || 
                  errorMsg.includes('DOCUMENT_NOT_FOUND');

if (isNotFound) {
  console.warn('[useKGStatus] Document not found, stopping polling:', docId);
  stopPolling();
}
```

### 2. DocumentDetail 页面改进

**文件**: `client/src/pages/DocumentDetail.tsx`

**改进内容**:
- ✅ 检测404错误并重定向到文档列表
- ✅ 显示友好的错误提示
- ✅ 给用户2秒时间看到错误消息

**关键代码**:
```typescript
if (error.response?.status === 404 || 
    error.message?.includes('404') || 
    error.message?.includes('not found')) {
  console.warn('Document not found, redirecting to documents list');
  setTimeout(() => {
    navigate('/documents');
  }, 2000);
}
```

### 3. Documents 列表页面改进

**文件**: `client/src/pages/Documents.tsx`

**改进内容**:
- ✅ 组件挂载时添加日志
- ✅ 强制重新加载文档列表
- ✅ 清除可能的缓存问题

### 4. API Service 改进

**文件**: `client/src/services/api.ts`

**已有功能**:
- ✅ 1秒缓存TTL，避免重复请求
- ✅ 改进的错误处理
- ✅ 缓存失效机制

## 预防措施

### 开发环境最佳实践

1. **删除文档时**:
   - 使用API端点删除，不要直接操作数据库
   - 删除后清理相关的KG状态记录
   - 通知前端更新文档列表

2. **清空数据库时**:
   - 同时清理所有相关表（Document, KGBuildStatus, CKB, KGEntity, KGRelation）
   - 或者使用提供的清理脚本

3. **测试时**:
   - 使用浏览器隐私模式避免缓存问题
   - 定期清理浏览器缓存
   - 监控Network标签中的异常请求

### 生产环境建议

1. **实施软删除**:
   - 不要物理删除文档，使用 `deleted` 标志
   - 前端过滤已删除的文档

2. **添加数据一致性检查**:
   - 定期运行诊断脚本
   - 自动清理孤立的记录

3. **改进错误处理**:
   - 在前端添加全局错误边界
   - 实施更智能的重试逻辑

## 工具和脚本

### 诊断工具

| 脚本 | 用途 | 命令 |
|------|------|------|
| `diagnose-polling-issue.js` | 诊断轮询问题 | `node diagnose-polling-issue.js` |
| `check-document-kg-status.js` | 检查文档和KG状态 | `node check-document-kg-status.js` |
| `cleanup-orphaned-kg-status.js` | 清理孤立的KG状态 | `node cleanup-orphaned-kg-status.js` |

### 前端工具

| 页面 | 用途 | URL |
|------|------|-----|
| `emergency-cache-clear.html` | 紧急缓存清理 | `http://localhost:5173/emergency-cache-clear.html` |
| `clear-cache.html` | 标准缓存清理 | `http://localhost:5173/clear-cache.html` |

## 常见问题

### Q: 为什么会出现这个问题？

A: 这是因为：
1. 数据库被清空或文档被删除
2. 浏览器缓存了旧的文档列表
3. 前端尝试获取不存在文档的KG状态
4. 轮询机制持续发送请求

### Q: 清理缓存会丢失什么？

A: 会清除：
- 登录令牌（需要重新登录）
- 用户偏好设置
- 临时数据

不会影响：
- 服务器上的文档
- 数据库中的数据
- 用户账户信息

### Q: 如何确认问题已解决？

A: 检查以下几点：
1. 文档列表正确显示（空列表或实际文档）
2. Network标签中没有重复的404请求
3. 页面响应正常，没有卡顿
4. 控制台没有错误信息

### Q: 问题还是没解决怎么办？

A: 尝试以下步骤：
1. 完全关闭浏览器并重新打开
2. 使用隐私/无痕模式测试
3. 尝试不同的浏览器
4. 检查后端服务是否正常运行
5. 查看后端日志中的错误信息

## 联系支持

如果以上方法都无法解决问题，请提供：
1. 浏览器控制台的完整错误日志
2. Network标签的请求详情截图
3. 诊断脚本的输出结果
4. 浏览器类型和版本

## 更新日志

- **2024-02-12**: 创建完整解决方案文档
- **2024-02-12**: 实施 useKGStatus hook 改进
- **2024-02-12**: 创建紧急缓存清理页面
- **2024-02-12**: 添加诊断和清理脚本
