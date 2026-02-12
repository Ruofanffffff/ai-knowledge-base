# 🚀 快速启动指南 - 自动构建知识图谱

## ✅ 配置已完成

自动构建已启用！现在只需3步即可开始使用。

## 第1步：重启后端服务

```bash
# 进入项目目录
cd ai-knowledge-base

# 如果服务正在运行，先停止 (Ctrl+C)
# 然后启动服务
npm start
```

**验证启动成功**：查看日志中是否有：

```
[KG Hook] 自动构建配置: AUTO_BUILD_KG=true
```

## 第2步：启动前端服务

```bash
# 新开一个终端
cd ai-knowledge-base/client

# 启动前端
npm run dev
```

前端会在 `http://localhost:5173` 启动。

## 第3步：上传文档测试

### 方式A：通过前端UI（推荐）

1. 打开浏览器访问 `http://localhost:5173`
2. 登录系统
3. 进入文档上传页面
4. 选择并上传一个文档（支持 .txt, .md, .pdf 等）
5. 🎉 系统会自动开始构建知识图谱！

### 方式B：通过API测试

```bash
# 上传文档
curl -X POST http://localhost:3000/api/documents/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.txt"

# 响应示例：
# {
#   "success": true,
#   "document": {
#     "id": "doc-123",
#     "name": "test.txt",
#     ...
#   }
# }

# 查询KG构建状态
curl -X GET "http://localhost:3000/api/kg/status/doc-123?detailed=true" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 响应示例：
# {
#   "success": true,
#   "data": {
#     "docId": "doc-123",
#     "status": "processing",
#     "progress": 45,
#     "entityCount": 12,
#     "relationCount": 8
#   }
# }
```

## 🎯 完整流程演示

### 1. 上传文档

```
用户操作：选择文件 → 点击上传
    ↓
前端：显示上传进度
    ↓
后端：保存文档到数据库
    ↓
✅ 上传成功！
```

### 2. 自动构建KG（无需任何操作）

```
后端自动触发：
    ↓
[KG Hook] 文档创建钩子触发: doc-123
    ↓
[KG Service] 开始构建知识图谱...
    ↓
[KG Service] 提取实体和关系...
    ↓
[KG Service] 保存到数据库...
    ↓
✅ 构建完成！
```

### 3. 前端实时显示状态

```
前端自动刷新（每2秒）：
    ↓
状态: queued → processing → completed
    ↓
进度: 0% → 25% → 50% → 75% → 100%
    ↓
显示结果：实体数、关系数
    ↓
✅ 可以查看知识图谱了！
```

### 4. 查看知识图谱

访问 `http://localhost:5173/graph` 查看可视化结果。

## 📊 监控和调试

### 查看后端日志

```bash
# 实时查看KG相关日志
cd ai-knowledge-base
npm start | grep -E "\[KG"
```

你会看到类似的日志：

```
[KG Hook] 自动构建配置: AUTO_BUILD_KG=true
[KG Hook] 文档创建钩子触发: doc-123 - test.txt
[KG Service] 开始构建知识图谱: doc-123
[KG Service] 提取实体: 15个
[KG Service] 提取关系: 12个
[KG Service] 构建完成: doc-123
```

### 查看队列状态

```bash
curl -X GET http://localhost:3000/api/kg/queue/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

响应：

```json
{
  "success": true,
  "data": {
    "queued": 2,
    "running": 1,
    "completed": 5,
    "failed": 0
  }
}
```

### 查看监控指标

```bash
curl -X GET http://localhost:3000/api/kg/metrics \
  -H "Authorization: Bearer YOUR_TOKEN"
```

响应：

```json
{
  "success": true,
  "data": {
    "current": {
      "totalBuilds": 10,
      "successfulBuilds": 9,
      "failedBuilds": 1,
      "averageDuration": 45000,
      "successRate": 0.9
    },
    "realtime": {
      "activeBuilds": 1,
      "queuedBuilds": 2
    }
  }
}
```

## 🔧 故障排查

### 问题1：上传后没有自动构建

**检查步骤**：

1. 确认配置：
   ```bash
   grep AUTO_BUILD_KG ai-knowledge-base/.env
   # 应该显示: AUTO_BUILD_KG=true
   ```

2. 确认服务已重启：
   ```bash
   # 查看日志中的配置
   # 应该看到: [KG Hook] 自动构建配置: AUTO_BUILD_KG=true
   ```

3. 查看后端日志是否有错误

### 问题2：构建一直在 pending 状态

**可能原因**：
- 队列已满
- 并发数已达上限
- 服务未正常启动

**解决方法**：
```bash
# 查看队列状态
curl http://localhost:3000/api/kg/queue/stats

# 查看健康状态
curl http://localhost:3000/api/kg/health
```

### 问题3：构建失败

**查看详细错误**：
```bash
curl "http://localhost:3000/api/kg/status/YOUR_DOC_ID?detailed=true"
```

**手动重建**：
```bash
curl -X POST http://localhost:3000/api/kg/rebuild/YOUR_DOC_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📝 测试清单

完成以下测试，确保一切正常：

- [ ] 后端服务启动成功
- [ ] 前端服务启动成功
- [ ] 日志显示 `AUTO_BUILD_KG=true`
- [ ] 上传文档成功
- [ ] 后端日志显示"文档创建钩子触发"
- [ ] 可以查询到KG构建状态
- [ ] 状态从 pending → processing → completed
- [ ] 可以在Graph页面看到知识图谱
- [ ] 实体和关系数量正确

## 🎉 成功标志

如果你看到以下内容，说明一切正常：

1. **后端日志**：
   ```
   [KG Hook] 自动构建配置: AUTO_BUILD_KG=true
   [KG Hook] 文档创建钩子触发: doc-123
   [KG Service] 构建完成: doc-123
   ```

2. **前端显示**：
   - 上传进度条
   - KG构建状态
   - 实体和关系数量
   - 知识图谱可视化

3. **API响应**：
   ```json
   {
     "success": true,
     "data": {
       "status": "completed",
       "entityCount": 15,
       "relationCount": 12
     }
   }
   ```

## 📚 相关文档

- 📄 `AUTO_BUILD_ENABLED.md` - 详细配置说明
- 📄 `AUTO_BUILD_CONFIGURATION.md` - 配置选项对比
- 📄 `KG_API_TESTING_GUIDE.md` - 完整测试指南
- 📄 `FRONTEND_INTEGRATION_COMPLETE.md` - 前端集成报告
- 📄 `client/src/examples/DocumentUploadWithKG.tsx` - 示例代码

## 💡 提示

- 第一次构建可能需要几秒到几分钟，取决于文档大小
- 系统会自动控制并发数，避免过载
- 可以同时上传多个文档，系统会自动排队处理
- 前端会自动刷新状态，无需手动刷新页面

## 🎊 开始使用吧！

现在一切就绪，开始上传你的第一个文档，体验自动知识图谱构建的魔力！

---

**创建时间**：2026-02-12  
**状态**：✅ 就绪  
**版本**：1.0
