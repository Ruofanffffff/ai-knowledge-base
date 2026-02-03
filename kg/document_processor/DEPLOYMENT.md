# Document Full Processing System - 部署指南

## 系统要求

- Node.js >= 14.x
- npm >= 6.x
- SQLite 3.x (或其他 Prisma 支持的数据库)
- 至少 2GB 可用内存
- 至少 10GB 可用磁盘空间

## 安装步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 文档全处理系统配置
DOCUMENT_PROCESSING_ENABLED=true
COVERAGE_THRESHOLD_WARNING=0.95
COVERAGE_THRESHOLD_ERROR=0.90
QUALITY_SCORE_THRESHOLD=80
PROCESSING_TIMEOUT_MS=300000
SEGMENTATION_SIZE_THRESHOLD_MB=10
SEGMENTATION_UNIT_THRESHOLD=5000
SEGMENT_SIZE=1000
SEGMENT_CONCURRENCY=3
```

### 3. 数据库迁移

运行 Prisma 迁移以创建必要的数据库表：

```bash
npx prisma migrate dev
```

这将创建以下 6 个表：
- document_structures
- validation_reports
- processing_monitors
- segment_processing
- alerts
- filter_rules

### 4. 验证安装

运行测试以验证系统正常工作：

```bash
npm test kg/document_processor
```

### 5. 启动服务器

```bash
npm start
```

服务器将在 `http://localhost:3000` 启动。

## 配置说明

### 覆盖率阈值

- `COVERAGE_THRESHOLD_WARNING`: 覆盖率警告阈值（默认 0.95 = 95%）
- `COVERAGE_THRESHOLD_ERROR`: 覆盖率错误阈值（默认 0.90 = 90%）

当文档处理覆盖率低于这些阈值时，系统会触发相应级别的告警。

### 质量评分阈值

- `QUALITY_SCORE_THRESHOLD`: 质量评分阈值（默认 80 分）

当文档处理质量评分低于此阈值时，系统会标记为低质量处理。

### 处理超时

- `PROCESSING_TIMEOUT_MS`: 处理超时时间（默认 300000 = 5 分钟）

各个处理阶段有不同的超时阈值，超时会触发告警。

### 分段处理

- `SEGMENTATION_SIZE_THRESHOLD_MB`: 文档大小阈值（默认 10 MB）
- `SEGMENTATION_UNIT_THRESHOLD`: 结构单元数量阈值（默认 5000）
- `SEGMENT_SIZE`: 每个分段的单元数量（默认 1000）
- `SEGMENT_CONCURRENCY`: 并发处理的分段数量（默认 3）

当文档大小或结构单元数量超过阈值时，系统会自动启用分段处理。

## API 端点

系统提供以下 REST API 端点：

### 1. 查询处理状态

```
GET /api/documents/:id/processing-status
```

返回文档的处理状态、当前阶段和进度百分比。

### 2. 查询验证报告

```
GET /api/documents/:id/validation-report
```

返回完整的验证报告，包括覆盖率、质量评分和优化建议。

### 3. 查询覆盖率

```
GET /api/documents/:id/coverage
```

返回文档的覆盖率统计信息。

### 4. 重新处理文档

```
POST /api/documents/:id/reprocess
Content-Type: application/json

{
  "force": true,
  "segments_only": ["seg_1", "seg_2"]
}
```

重新处理文档或指定的分段。

### 5. 查询批量处理状态

```
GET /api/batch-processing/:batchId/status
```

返回批量处理的整体进度和统计信息。

### 6. 查询处理历史

```
GET /api/documents/:id/processing-history?limit=10&offset=0
```

返回文档的处理历史记录。

### 7. 查询质量评估

```
GET /api/documents/:id/quality-assessment
```

返回文档的质量评估结果和优化建议。

## 监控和维护

### 日志

系统日志输出到控制台，包括：
- 处理进度
- 告警信息
- 错误信息
- 性能指标

建议使用日志管理工具（如 PM2、Winston）进行日志收集和分析。

### 数据库维护

定期清理旧的处理记录和告警：

```sql
-- 删除 30 天前的处理监控记录
DELETE FROM processing_monitors WHERE created_at < datetime('now', '-30 days');

-- 删除已解决的告警
DELETE FROM alerts WHERE status = 'resolved' AND resolved_at < datetime('now', '-7 days');
```

### 性能优化

1. **数据库索引**：确保关键字段有索引
   ```sql
   CREATE INDEX idx_doc_id ON document_structures(doc_id);
   CREATE INDEX idx_monitor_doc_id ON processing_monitors(doc_id);
   CREATE INDEX idx_report_doc_id ON validation_reports(doc_id);
   ```

2. **并发控制**：根据服务器资源调整 `SEGMENT_CONCURRENCY`

3. **缓存**：考虑使用 Redis 缓存频繁查询的报告

4. **分布式处理**：对于大规模部署，考虑使用消息队列（如 RabbitMQ）进行分布式处理

## 故障排查

### 问题：覆盖率过低

**症状**：文档处理后覆盖率 < 90%

**可能原因**：
1. 文档解析失败
2. 过滤规则过于严格
3. CKB 生成失败

**解决方案**：
1. 检查文档格式是否支持
2. 查看验证报告中的遗漏单元
3. 调整过滤规则
4. 检查 CKB 解析器日志

### 问题：处理超时

**症状**：文档处理时间过长，触发超时告警

**可能原因**：
1. 文档过大
2. 系统资源不足
3. 某个处理阶段性能瓶颈

**解决方案**：
1. 启用分段处理（降低 `SEGMENTATION_SIZE_THRESHOLD_MB`）
2. 增加系统资源
3. 查看瓶颈分析，优化慢速阶段
4. 增加超时阈值

### 问题：质量评分低

**症状**：文档处理质量评分 < 80

**可能原因**：
1. 文档质量差（OCR/ASR 错误）
2. Schema 匹配失败
3. 字段抽取不完整

**解决方案**：
1. 检查原始文档质量
2. 调整 Schema 匹配阈值
3. 优化字段抽取规则
4. 查看低质量 CKB 列表

### 问题：内存不足

**症状**：处理大文档时内存溢出

**可能原因**：
1. 文档过大
2. 分段大小过大
3. 并发数过高

**解决方案**：
1. 降低 `SEGMENT_SIZE`
2. 降低 `SEGMENT_CONCURRENCY`
3. 增加系统内存
4. 启用资源自适应调整

## 升级指南

### 从旧版本升级

1. 备份数据库
   ```bash
   cp prisma/knowledge-base.db prisma/knowledge-base.db.backup
   ```

2. 拉取最新代码
   ```bash
   git pull origin main
   ```

3. 安装新依赖
   ```bash
   npm install
   ```

4. 运行数据库迁移
   ```bash
   npx prisma migrate deploy
   ```

5. 重启服务器
   ```bash
   npm restart
   ```

## 安全建议

1. **API 认证**：为 API 端点添加认证机制
2. **输入验证**：验证所有用户输入
3. **文件上传限制**：限制上传文件的大小和类型
4. **SQL 注入防护**：使用 Prisma ORM 的参数化查询
5. **日志脱敏**：避免在日志中记录敏感信息

## 备份和恢复

### 备份

```bash
# 备份数据库
cp prisma/knowledge-base.db backup/knowledge-base-$(date +%Y%m%d).db

# 备份上传的文件
tar -czf backup/uploads-$(date +%Y%m%d).tar.gz uploads/
```

### 恢复

```bash
# 恢复数据库
cp backup/knowledge-base-20240130.db prisma/knowledge-base.db

# 恢复上传的文件
tar -xzf backup/uploads-20240130.tar.gz
```

## 联系支持

如有问题，请：
1. 查看日志文件
2. 检查 GitHub Issues
3. 联系技术支持团队

## 许可证

MIT
