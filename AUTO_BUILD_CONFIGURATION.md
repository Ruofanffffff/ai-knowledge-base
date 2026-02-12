# 自动构建配置说明

## 当前状态

❌ **自动构建已禁用**

```bash
AUTO_BUILD_KG=false  # 默认配置
```

## 这意味着什么？

### 当前行为（AUTO_BUILD_KG=false）

```
用户上传文档
    ↓
✅ 文档保存到数据库
    ↓
❌ 不会自动触发KG构建
    ↓
⚠️ 需要手动调用 POST /api/kg/build
```

### 如果启用自动构建（AUTO_BUILD_KG=true）

```
用户上传文档
    ↓
✅ 文档保存到数据库
    ↓
✅ 自动触发KG构建
    ↓
✅ 后台异步处理
    ↓
✅ 前端可查询状态
```

## 如何启用自动构建？

### 方法1：修改环境变量文件

编辑 `ai-knowledge-base/.env` 文件：

```bash
# 找到这一行
AUTO_BUILD_KG=false

# 改为
AUTO_BUILD_KG=true
```

### 方法2：启动时设置环境变量

```bash
# Linux/Mac
AUTO_BUILD_KG=true npm start

# Windows (PowerShell)
$env:AUTO_BUILD_KG="true"; npm start

# Windows (CMD)
set AUTO_BUILD_KG=true && npm start
```

### 重启服务

修改后需要重启后端服务：

```bash
# 停止当前服务 (Ctrl+C)
# 然后重新启动
cd ai-knowledge-base
npm start
```

## 两种模式对比

| 特性 | 手动模式 (false) | 自动模式 (true) |
|------|-----------------|----------------|
| 文档上传 | ✅ 立即完成 | ✅ 立即完成 |
| KG构建触发 | ❌ 需要手动调用API | ✅ 自动触发 |
| 系统负载 | 🟢 可控 | 🟡 可能较高 |
| 用户体验 | 🟡 需要额外操作 | 🟢 无缝体验 |
| 适用场景 | 批量上传、精细控制 | 单个上传、即时构建 |

## 推荐配置

### 开发环境

```bash
AUTO_BUILD_KG=true  # 方便测试
```

### 生产环境

```bash
AUTO_BUILD_KG=false  # 更好的性能控制
```

原因：
- 生产环境可能有大量文档上传
- 手动控制可以避免系统过载
- 可以在低峰期批量触发构建

## 前端集成方案

### 方案1：自动触发（推荐）

即使 `AUTO_BUILD_KG=false`，前端也可以在上传后自动调用API：

```typescript
// 上传文档
const uploadResult = await apiService.uploadDocument(file);

// 立即触发KG构建
if (uploadResult.success && uploadResult.data.id) {
  await apiService.buildKG(uploadResult.data.id);
}
```

这样用户体验和自动模式一样，但后端有更好的控制。

### 方案2：延迟触发

给用户选择权：

```typescript
// 上传文档
const uploadResult = await apiService.uploadDocument(file);

// 显示提示
showNotification({
  message: '文档上传成功！是否立即构建知识图谱？',
  actions: [
    { label: '立即构建', onClick: () => apiService.buildKG(docId) },
    { label: '稍后构建', onClick: () => {} }
  ]
});
```

### 方案3：批量触发

上传多个文档后，统一触发：

```typescript
// 上传多个文档
const docIds = [];
for (const file of files) {
  const result = await apiService.uploadDocument(file);
  if (result.success) docIds.push(result.data.id);
}

// 批量触发构建
await fetch('/api/kg/build/batch', {
  method: 'POST',
  body: JSON.stringify({ docIds })
});
```

## 状态同步

无论哪种模式，前端都可以实时查询KG构建状态：

```typescript
// 使用Hook自动刷新
const { status, isLoading, error } = useKGStatus(docId, {
  autoRefresh: true,
  refreshInterval: 2000  // 每2秒刷新
});

// 状态包含：
// - status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed'
// - progress: 0-100
// - entityCount: 实体数量
// - relationCount: 关系数量
```

## 完整示例

我已经创建了一个完整的示例组件：

📄 `client/src/examples/DocumentUploadWithKG.tsx`

这个组件展示了：
- ✅ 文档上传进度
- ✅ 自动触发KG构建
- ✅ 实时显示构建状态
- ✅ 构建完成后的操作

你可以直接在项目中使用或参考这个组件。

## 常见问题

### Q1: 为什么默认是 false？

**A**: 为了更好的性能控制和资源管理。在生产环境中，大量文档上传可能导致系统过载。

### Q2: 如何知道当前配置？

**A**: 查看后端启动日志：

```
[KG Hook] 自动构建配置: AUTO_BUILD_KG=false
```

### Q3: 可以动态切换吗？

**A**: 不可以。需要修改环境变量并重启服务。

### Q4: 前端如何处理两种模式？

**A**: 前端不需要关心后端配置。始终在上传后调用 `buildKG()` API即可。如果后端已经自动触发，API会返回"已在构建中"的状态。

## 总结

✅ **推荐做法**：
1. 后端设置 `AUTO_BUILD_KG=false`
2. 前端在上传后自动调用 `buildKG()` API
3. 使用 `useKGStatus` Hook实时显示状态

这样既保证了用户体验，又给了后端更好的控制能力。

---

**生成时间**：2026-02-12  
**版本**：1.0
