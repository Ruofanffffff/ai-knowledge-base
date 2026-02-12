# 知识图谱API测试指南

## 快速开始

### 1. 启动服务

```bash
# 终端1：启动后端
cd ai-knowledge-base
npm start

# 终端2：启动前端
cd ai-knowledge-base/client
npm run dev
```

### 2. 测试文档上传和KG构建

#### 方式1：通过前端UI

1. 打开浏览器访问 `http://localhost:5173`
2. 登录系统
3. 进入文档上传页面
4. 上传一个文档（支持 .txt, .md, .pdf 等格式）
5. 上传成功后，文档会保存到数据库
6. **重要**：由于 `AUTO_BUILD_KG=false`，需要手动触发KG构建

#### 方式2：通过API直接测试

```bash
# 1. 上传文档
curl -X POST http://localhost:3000/api/documents/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/your/document.txt"

# 响应示例：
# {
#   "success": true,
#   "document": {
#     "id": "doc-123",
#     "name": "document.txt",
#     ...
#   }
# }

# 2. 手动触发KG构建
curl -X POST http://localhost:3000/api/kg/build \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "docId": "doc-123",
    "options": {
      "force": false,
      "async": true
    }
  }'

# 响应示例：
# {
#   "success": true,
#   "data": {
#     "docId": "doc-123",
#     "status": "queued",
#     "queuePosition": 1,
#     "message": "KG build queued"
#   }
# }

# 3. 查询构建状态
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
#     "relationCount": 8,
#     "startTime": "2026-02-12T10:00:00Z",
#     "estimatedCompletion": "2026-02-12T10:05:00Z"
#   }
# }

# 4. 查看知识图谱
# 构建完成后，访问 http://localhost:5173/graph 查看可视化结果
```

### 3. 测试其他API功能

#### 重建KG

```bash
curl -X POST http://localhost:3000/api/kg/rebuild/doc-123 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "options": {
      "async": true
    }
  }'
```

#### 批量构建

```bash
curl -X POST http://localhost:3000/api/kg/build/batch \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "docIds": ["doc-123", "doc-456", "doc-789"],
    "options": {
      "concurrency": 2
    }
  }'
```

#### 取消构建

```bash
curl -X POST http://localhost:3000/api/kg/cancel/doc-123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 查看队列统计

```bash
curl -X GET http://localhost:3000/api/kg/queue/stats \
  -H "Authorization: Bearer YOUR_TOKEN"

# 响应示例：
# {
#   "success": true,
#   "data": {
#     "queued": 3,
#     "running": 2,
#     "completed": 15,
#     "failed": 1
#   }
# }
```

#### 健康检查

```bash
curl -X GET http://localhost:3000/api/kg/health

# 响应示例：
# {
#   "success": true,
#   "data": {
#     "status": "healthy",
#     "queueStats": {...},
#     "timestamp": "2026-02-12T10:00:00Z"
#   }
# }
```

#### 查看监控指标

```bash
curl -X GET http://localhost:3000/api/kg/metrics \
  -H "Authorization: Bearer YOUR_TOKEN"

# 响应示例：
# {
#   "success": true,
#   "data": {
#     "current": {
#       "totalBuilds": 20,
#       "successfulBuilds": 18,
#       "failedBuilds": 2,
#       "averageDuration": 45000,
#       "successRate": 0.9
#     },
#     "realtime": {
#       "activeBuilds": 2,
#       "queuedBuilds": 3,
#       "recentFailures": 0
#     }
#   }
# }
```

## 前端集成测试

### 使用前端API服务

```typescript
import { apiService } from './services/api';

// 1. 上传文档
const file = new File(['测试内容'], 'test.txt', { type: 'text/plain' });
const uploadResult = await apiService.uploadDocument(file, (progress, speed, estimatedTime) => {
  console.log(`上传进度: ${progress.toFixed(2)}%`);
  console.log(`上传速度: ${(speed / 1024).toFixed(2)} KB/s`);
  console.log(`预计剩余时间: ${estimatedTime.toFixed(0)} 秒`);
});

if (uploadResult.success && uploadResult.data.id) {
  const docId = uploadResult.data.id;
  
  // 2. 手动触发KG构建
  const buildResult = await apiService.buildKG(docId);
  console.log('KG构建结果:', buildResult);
  
  // 3. 轮询查询状态
  const checkStatus = async () => {
    const status = await apiService.getKGStatus(docId);
    console.log('KG状态:', status);
    
    if (status.success && status.data) {
      if (status.data.status === 'processing') {
        console.log(`构建进度: ${status.data.progress}%`);
        setTimeout(checkStatus, 2000); // 2秒后再次查询
      } else if (status.data.status === 'completed') {
        console.log('KG构建完成！');
        console.log(`实体数: ${status.data.entityCount}`);
        console.log(`关系数: ${status.data.relationCount}`);
      } else if (status.data.status === 'failed') {
        console.error('KG构建失败:', status.data.error);
      }
    }
  };
  
  checkStatus();
}
```

### 使用React Hook

```typescript
import { useKGStatus } from './hooks/useKGStatus';

function DocumentStatus({ docId }: { docId: string }) {
  const { status, isLoading, error, refresh, rebuild } = useKGStatus(docId, {
    autoRefresh: true,
    refreshInterval: 2000
  });
  
  if (isLoading) return <div>加载中...</div>;
  if (error) return <div>错误: {error}</div>;
  
  return (
    <div>
      <h3>KG构建状态</h3>
      <p>状态: {status?.status}</p>
      {status?.progress && <p>进度: {status.progress}%</p>}
      {status?.entityCount && <p>实体数: {status.entityCount}</p>}
      {status?.relationCount && <p>关系数: {status.relationCount}</p>}
      
      <button onClick={refresh}>刷新状态</button>
      <button onClick={rebuild}>重建KG</button>
    </div>
  );
}
```

## 常见问题排查

### 1. KG没有自动构建

**原因**：`AUTO_BUILD_KG=false`（默认配置）

**解决方案**：
- 方案A：手动调用 `POST /api/kg/build` 触发构建
- 方案B：设置环境变量 `AUTO_BUILD_KG=true` 启用自动构建

### 2. 构建状态一直是 pending

**可能原因**：
- 队列已满（检查 `KG_MAX_CONCURRENT` 配置）
- 构建服务未启动
- 数据库连接问题

**排查步骤**：
```bash
# 1. 检查队列状态
curl http://localhost:3000/api/kg/queue/stats

# 2. 检查健康状态
curl http://localhost:3000/api/kg/health

# 3. 查看后端日志
# 查找 [KG Service] 或 [KG Hook] 相关日志
```

### 3. 构建失败

**排查步骤**：
```bash
# 1. 查看详细状态
curl "http://localhost:3000/api/kg/status/doc-123?detailed=true"

# 2. 查看监控指标
curl http://localhost:3000/api/kg/metrics

# 3. 检查后端日志
# 查找错误信息和堆栈跟踪
```

### 4. 前端无法连接后端

**检查清单**：
- [ ] 后端服务是否启动（默认端口 3000）
- [ ] 前端代理配置是否正确（vite.config.ts）
- [ ] 认证token是否有效
- [ ] CORS配置是否正确

## 性能测试

### 测试并发构建

```bash
# 创建测试脚本 test-concurrent.sh
#!/bin/bash

for i in {1..10}; do
  curl -X POST http://localhost:3000/api/kg/build \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"docId\": \"doc-$i\", \"options\": {\"async\": true}}" &
done

wait
echo "所有请求已发送"

# 查看队列状态
curl http://localhost:3000/api/kg/queue/stats
```

### 测试响应时间

```bash
# 使用 time 命令测试
time curl -X POST http://localhost:3000/api/kg/build \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"docId": "doc-123", "options": {"async": true}}'
```

## 监控和日志

### 查看实时日志

```bash
# 后端日志
cd ai-knowledge-base
npm start | grep -E "\[KG|KG Service|KG Hook\]"

# 前端日志
# 打开浏览器开发者工具 Console 标签
```

### 监控指标

定期检查以下指标：
- 构建成功率（目标 > 95%）
- 平均构建时间（目标 < 60秒）
- 队列长度（目标 < 10）
- 失败率（目标 < 5%）

```bash
# 定期查询监控指标
watch -n 5 'curl -s http://localhost:3000/api/kg/metrics | jq'
```

## 总结

✅ 前端已完成与新KG API的集成  
✅ 所有API端点已实现并可用  
✅ 配置开关已就绪  
✅ 向后兼容性已保证  

**现在可以开始测试完整的文档上传和KG构建流程！**

---

生成时间：2026-02-12  
版本：1.0
