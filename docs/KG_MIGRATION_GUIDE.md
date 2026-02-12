# 知识图谱API迁移指南

## 概述

本指南帮助你从旧的耦合架构迁移到新的分离架构。新架构实现了文档服务与知识图谱服务的完全分离，提供了更好的性能和灵活性。

## 架构变化

### 旧架构（耦合）

```
前端上传文档
    ↓
notesRoutes.js (保存文档)
    ↓
document_hooks.onDocumentCreated (自动触发)
    ↓
kgService.buildKnowledgeGraph
    ↓
知识图谱构建完成
```

**问题**:
- 文档保存和KG构建紧密耦合
- 无法独立控制KG构建
- 文档保存响应慢（需等待KG构建）
- 职责不清晰

### 新架构（解耦）

```
前端上传文档                    前端触发KG构建
    ↓                              ↓
notesRoutes.js                 kgRoutes.js
    ↓                              ↓
保存到数据库                    从数据库读取文档
    ↓                              ↓
返回文档ID                      kgService.buildKnowledgeGraph
                                   ↓
                               知识图谱构建完成
```

**优势**:
- 文档保存快速响应
- KG构建独立控制
- 职责清晰分离
- 易于维护和扩展

---

## 迁移步骤

### 第一阶段: 准备工作

#### 1. 更新环境变量

在 `.env` 文件中添加新的配置：

```bash
# 自动构建开关 (默认false，推荐手动控制)
AUTO_BUILD_KG=false

# KG服务启用开关
KG_SERVICE_ENABLED=true

# 最大并发构建数
KG_MAX_CONCURRENT=3

# 构建超时时间 (毫秒)
KG_BUILD_TIMEOUT=300000

# 启用构建队列
KG_ENABLE_QUEUE=true

# 队列最大长度
KG_QUEUE_MAX_LENGTH=100
```

#### 2. 重启服务器

```bash
# 停止服务器
# Ctrl+C 或 kill process

# 重新启动
npm start
```

#### 3. 验证新路由已注册

```bash
# 健康检查
curl http://localhost:3000/api/kg/health

# 应该返回:
# {"success":true,"data":{"status":"healthy",...}}
```

---

### 第二阶段: 测试新API

#### 1. 测试单个文档构建

```bash
# 假设你有一个文档ID: doc123
curl -X POST http://localhost:3000/api/kg/build \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"docId": "doc123"}'
```

#### 2. 查询构建状态

```bash
curl http://localhost:3000/api/kg/status/doc123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 3. 测试批量构建

```bash
curl -X POST http://localhost:3000/api/kg/build/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"docIds": ["doc1", "doc2", "doc3"]}'
```

---

### 第三阶段: 前端迁移

#### 旧代码（自动构建）

```javascript
// 上传文档后，KG会自动构建
const response = await fetch('/api/notes', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    title: '我的文档',
    content: '文档内容...'
  })
});

const document = await response.json();
// KG构建在后台自动进行，无法控制
```

#### 新代码（手动控制）

```javascript
// 1. 上传文档
const uploadResponse = await fetch('/api/notes', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    title: '我的文档',
    content: '文档内容...'
  })
});

const document = await uploadResponse.json();

// 2. 手动触发KG构建
const buildResponse = await fetch('/api/kg/build', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ docId: document.id })
});

const buildResult = await buildResponse.json();

// 3. 轮询查询状态
const pollStatus = async () => {
  const statusResponse = await fetch(
    `/api/kg/status/${document.id}?detailed=true`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  
  const { data } = await statusResponse.json();
  
  if (data.status === 'completed') {
    console.log('KG构建完成！');
    // 更新UI，显示知识图谱
  } else if (data.status === 'failed') {
    console.error('KG构建失败:', data.errorMessage);
    // 显示错误信息
  } else {
    // 继续轮询
    setTimeout(pollStatus, 2000);
  }
};

pollStatus();
```

---

### 第四阶段: 优化前端体验

#### 1. 创建KG构建Hook

```javascript
// useKGBuild.js
import { useState, useEffect } from 'react';

export function useKGBuild(docId, token) {
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const startBuild = async () => {
    try {
      setStatus('building');
      
      // 触发构建
      const response = await fetch('/api/kg/build', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ docId })
      });

      if (!response.ok) {
        throw new Error('Failed to start KG build');
      }

      // 开始轮询状态
      pollStatus();
    } catch (err) {
      setError(err.message);
      setStatus('failed');
    }
  };

  const pollStatus = async () => {
    try {
      const response = await fetch(
        `/api/kg/status/${docId}?detailed=true`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const { data } = await response.json();
      
      setStatus(data.status);
      setProgress(data.progress || 0);

      if (data.status === 'building' || data.status === 'queued') {
        // 继续轮询
        setTimeout(pollStatus, 2000);
      } else if (data.status === 'failed') {
        setError(data.errorMessage);
      }
    } catch (err) {
      setError(err.message);
      setStatus('failed');
    }
  };

  return {
    status,
    progress,
    error,
    startBuild
  };
}
```

#### 2. 使用Hook

```javascript
// DocumentUpload.jsx
import { useKGBuild } from './useKGBuild';

function DocumentUpload() {
  const [docId, setDocId] = useState(null);
  const { status, progress, error, startBuild } = useKGBuild(docId, token);

  const handleUpload = async (file) => {
    // 上传文档
    const response = await uploadDocument(file);
    const doc = await response.json();
    
    setDocId(doc.id);
    
    // 询问用户是否构建KG
    if (confirm('是否立即构建知识图谱？')) {
      startBuild();
    }
  };

  return (
    <div>
      <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />
      
      {status === 'building' && (
        <div>
          <p>正在构建知识图谱...</p>
          <progress value={progress} max={100} />
        </div>
      )}
      
      {status === 'completed' && (
        <p>知识图谱构建完成！</p>
      )}
      
      {error && (
        <p style={{color: 'red'}}>错误: {error}</p>
      )}
    </div>
  );
}
```

---

## 向后兼容

### 保持自动构建（不推荐）

如果你希望保持旧的自动构建行为，可以设置：

```bash
AUTO_BUILD_KG=true
```

这样文档创建/更新/删除时会自动触发KG构建，但你会失去新架构的灵活性。

### 混合模式

你可以在过渡期使用混合模式：

1. 设置 `AUTO_BUILD_KG=false`
2. 旧的前端代码继续工作（文档上传成功）
3. 新的前端代码可以手动触发KG构建
4. 逐步迁移所有前端代码

---

## 常见问题

### Q: 迁移后旧文档的KG怎么办？

A: 旧文档的KG不受影响，继续正常工作。如果需要重建，可以使用批量构建API：

```bash
# 获取所有文档ID
curl http://localhost:3000/api/documents \
  -H "Authorization: Bearer YOUR_TOKEN"

# 批量重建
curl -X POST http://localhost:3000/api/kg/build/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"docIds": ["doc1", "doc2", "..."]}'
```

### Q: 迁移过程中服务会中断吗？

A: 不会。新旧架构可以共存，迁移过程是平滑的。

### Q: 如何回滚到旧架构？

A: 设置 `AUTO_BUILD_KG=true` 即可恢复自动构建行为。

### Q: 性能有提升吗？

A: 是的，主要体现在：
- 文档上传响应时间从 5-10秒 降低到 < 500ms
- KG构建可以并发处理，提高吞吐量
- 队列管理避免资源耗尽

---

## 故障排查

### 问题1: 新路由404

**症状**: 调用 `/api/kg/*` 返回404

**解决**:
1. 检查 `server.js` 是否注册了新路由
2. 重启服务器
3. 检查 `routes/kgRoutes.js` 是否存在

### 问题2: 构建一直pending

**症状**: 状态一直是 `pending` 或 `queued`

**解决**:
1. 检查队列统计: `GET /api/kg/queue/stats`
2. 查看服务器日志
3. 检查 `KG_MAX_CONCURRENT` 配置
4. 检查是否有任务卡住

### 问题3: 构建失败

**症状**: 状态变为 `failed`

**解决**:
1. 查询详细状态获取错误信息
2. 检查文档是否有 `filePath`
3. 检查文件是否存在
4. 查看服务器日志

### 问题4: 队列满了

**症状**: 返回 `queue_full` 错误

**解决**:
1. 等待队列中的任务完成
2. 增加 `KG_QUEUE_MAX_LENGTH`
3. 增加 `KG_MAX_CONCURRENT` 提高处理速度

---

## 性能优化建议

### 1. 调整并发数

根据服务器性能调整：

```bash
# 高性能服务器
KG_MAX_CONCURRENT=5

# 低性能服务器
KG_MAX_CONCURRENT=2
```

### 2. 批量处理

对于大量文档，使用批量API：

```javascript
// 分批处理，每批50个
const batchSize = 50;
for (let i = 0; i < docIds.length; i += batchSize) {
  const batch = docIds.slice(i, i + batchSize);
  await fetch('/api/kg/build/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ docIds: batch })
  });
  
  // 等待一段时间再处理下一批
  await new Promise(resolve => setTimeout(resolve, 5000));
}
```

### 3. 智能轮询

使用指数退避减少服务器压力：

```javascript
let pollInterval = 1000; // 初始1秒
const maxInterval = 10000; // 最大10秒

const pollStatus = async () => {
  const response = await fetch(`/api/kg/status/${docId}`);
  const { data } = await response.json();
  
  if (data.status === 'building' || data.status === 'queued') {
    // 逐渐增加轮询间隔
    pollInterval = Math.min(pollInterval * 1.5, maxInterval);
    setTimeout(pollStatus, pollInterval);
  }
};
```

---

## 下一步

迁移完成后，你可以：

1. 查看 [API文档](./KG_API.md) 了解所有API端点
2. 查看 [设计文档](../.kiro/specs/kg-api-separation/design.md) 了解架构细节
3. 实现更多高级功能（监控、告警等）

---

## 技术支持

如有问题，请查看：
- [API文档](./KG_API.md)
- [设计文档](../.kiro/specs/kg-api-separation/design.md)
- [需求文档](../.kiro/specs/kg-api-separation/requirements.md)
