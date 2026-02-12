# ✅ 自动构建已启用

## 当前配置

```bash
AUTO_BUILD_KG=true
```

## 这意味着什么？

### 🎉 现在的行为

```
用户上传文档
    ↓
✅ 文档保存到数据库
    ↓
✅ 自动触发KG构建 (后台异步)
    ↓
✅ 前端可实时查询状态
    ↓
✅ 构建完成后可查看知识图谱
```

### 完整流程

1. **上传文档** - 用户通过前端上传文档
2. **保存到数据库** - 文档内容保存到PostgreSQL
3. **自动触发构建** - `document_hooks.js` 自动调用KG构建服务
4. **后台处理** - KG服务从数据库拉取文档并构建知识图谱
5. **状态同步** - 前端通过API实时查询构建状态和进度
6. **完成通知** - 构建完成后，用户可以在Graph页面查看结果

## 如何使用？

### 1. 重启后端服务

配置修改后需要重启服务：

```bash
# 停止当前服务 (Ctrl+C)
# 然后重新启动
cd ai-knowledge-base
npm start
```

### 2. 上传文档测试

启动服务后，直接上传文档即可：

```bash
# 方式1: 通过前端UI
# 访问 http://localhost:5173
# 上传文档，系统会自动开始构建KG

# 方式2: 通过API测试
curl -X POST http://localhost:3000/api/documents/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/your/document.txt"
```

### 3. 查看构建状态

```bash
# 查询KG构建状态
curl -X GET "http://localhost:3000/api/kg/status/YOUR_DOC_ID?detailed=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. 查看知识图谱

构建完成后，访问：
```
http://localhost:5173/graph
```

## 前端集成

前端已经完全集成，可以实时显示构建状态：

```typescript
import { useKGStatus } from '../hooks/useKGStatus';

function DocumentStatus({ docId }: { docId: string }) {
  // 自动刷新状态，每2秒查询一次
  const { status, isLoading, error } = useKGStatus(docId, {
    autoRefresh: true,
    refreshInterval: 2000
  });
  
  return (
    <div>
      <p>状态: {status?.status}</p>
      <p>进度: {status?.progress}%</p>
      <p>实体数: {status?.entityCount}</p>
      <p>关系数: {status?.relationCount}</p>
    </div>
  );
}
```

## 验证自动构建是否生效

启动服务后，查看日志：

```bash
cd ai-knowledge-base
npm start
```

你应该看到：

```
[KG Hook] 自动构建配置: AUTO_BUILD_KG=true
```

如果看到 `AUTO_BUILD_KG=false`，说明配置未生效，需要检查 `.env` 文件。

## 监控和调试

### 查看后端日志

```bash
# 查看KG相关日志
npm start | grep -E "\[KG|KG Service|KG Hook\]"
```

### 查看队列状态

```bash
curl -X GET http://localhost:3000/api/kg/queue/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 查看监控指标

```bash
curl -X GET http://localhost:3000/api/kg/metrics \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 性能考虑

### 并发控制

系统会自动控制并发构建数量：

```bash
KG_MAX_CONCURRENT=3  # 最多同时构建3个文档
```

### 队列管理

如果上传大量文档，系统会自动排队：

```bash
KG_QUEUE_MAX_LENGTH=100  # 队列最大长度
```

### 超时设置

单个文档构建超时：

```bash
KG_BUILD_TIMEOUT=300000  # 5分钟
```

## 如果需要禁用自动构建

编辑 `.env` 文件：

```bash
# 改为
AUTO_BUILD_KG=false
```

然后重启服务。

## 常见问题

### Q: 上传文档后没有自动构建？

**A**: 检查以下几点：
1. 确认 `.env` 文件中 `AUTO_BUILD_KG=true`
2. 确认已重启后端服务
3. 查看后端日志是否有错误
4. 检查队列是否已满

### Q: 如何知道构建是否完成？

**A**: 有三种方式：
1. 前端使用 `useKGStatus` Hook自动刷新
2. 手动调用 `GET /api/kg/status/:docId`
3. 查看后端日志

### Q: 构建失败怎么办？

**A**: 
1. 查看详细状态：`GET /api/kg/status/:docId?detailed=true`
2. 查看后端日志中的错误信息
3. 手动重建：`POST /api/kg/rebuild/:docId`

### Q: 可以批量上传吗？

**A**: 可以！系统会自动排队处理：

```typescript
// 批量上传
for (const file of files) {
  await apiService.uploadDocument(file);
  // 每个文档都会自动触发KG构建
}
```

## 示例代码

完整的上传和状态监控示例：

📄 `client/src/examples/DocumentUploadWithKG.tsx`

这个组件展示了：
- 文档上传进度
- 自动触发KG构建
- 实时显示构建状态
- 构建完成后的操作

## 总结

✅ **自动构建已启用！**

现在你只需要：
1. 重启后端服务
2. 上传文档
3. 系统会自动构建知识图谱
4. 前端实时显示构建进度
5. 构建完成后查看可视化结果

**无需任何手动操作，一切都是自动的！**

---

**配置时间**：2026-02-12  
**状态**：✅ 已启用  
**版本**：1.0
