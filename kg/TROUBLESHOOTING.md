# Schema 驱动知识图谱系统 - 故障排查指南

## 1. 概述

本文档提供了 Schema 驱动知识图谱系统常见问题的诊断和解决方案,帮助用户快速定位和解决问题。

## 2. 系统启动问题

### 2.1 服务无法启动

**症状**: 运行 `npm start` 后服务无法启动

**可能原因**:
1. 端口被占用
2. 环境变量未配置
3. 数据库连接失败
4. 依赖包未安装

**诊断步骤**:

```bash
# 1. 检查端口占用
lsof -i :3000

# 2. 检查环境变量
cat .env

# 3. 检查数据库文件
ls -la prisma/knowledge-base.db

# 4. 检查依赖包
npm list
```

**解决方案**:

```bash
# 1. 释放端口
kill -9 <PID>

# 2. 配置环境变量
cp .env.example .env
nano .env

# 3. 初始化数据库
npx prisma migrate dev
npx prisma generate

# 4. 重新安装依赖
rm -rf node_modules
npm install
```

### 2.2 前端无法访问

**症状**: 访问 http://localhost:5173/ 无响应

**可能原因**:
1. 前端服务未启动
2. 端口被占用
3. 前端依赖未安装

**诊断步骤**:

```bash
# 1. 检查前端服务状态
ps aux | grep vite

# 2. 检查端口占用
lsof -i :5173

# 3. 检查前端依赖
cd client && npm list
```

**解决方案**:

```bash
# 1. 启动前端服务
cd client
npm run dev

# 2. 释放端口
kill -9 <PID>

# 3. 重新安装前端依赖
cd client
rm -rf node_modules
npm install
```

### 2.3 数据库迁移失败

**症状**: 运行 `npx prisma migrate dev` 失败

**可能原因**:
1. 数据库文件损坏
2. 迁移文件冲突
3. Prisma 版本不兼容

**诊断步骤**:

```bash
# 1. 检查迁移状态
npx prisma migrate status

# 2. 检查数据库文件
file prisma/knowledge-base.db

# 3. 检查 Prisma 版本
npx prisma --version
```

**解决方案**:

```bash
# 1. 重置数据库 (开发环境)
npx prisma migrate reset

# 2. 删除损坏的数据库文件
rm prisma/knowledge-base.db
npx prisma migrate dev

# 3. 更新 Prisma
npm install @prisma/client@latest prisma@latest
npx prisma generate
```

## 3. Token 相关问题

### 3.1 Token 超限

**症状**: 系统提示 "Token limit exceeded" 或进入紧急模式

**可能原因**:
1. 每日 Token 限额设置过低
2. 大量文档同时处理
3. LLM 调用频率过高
4. 缓存未启用

**诊断步骤**:

```bash
# 1. 查看 Token 使用统计
curl http://localhost:3000/api/knowledge-graph/stats/tokens

# 2. 查看每日预算状态
curl http://localhost:3000/api/knowledge-graph/stats/tokens/budget

# 3. 检查环境变量
grep KG_TOKEN .env
```

**解决方案**:

```bash
# 1. 增加每日限额
# 编辑 .env
KG_TOKEN_DAILY_LIMIT=200000

# 2. 降低 LLM 调用频率
KG_LLM_FIELD_MAPPING_RATE=0.3
KG_LLM_SEMANTIC_RELATION_RANDOM_SAMPLE_RATE=0.1

# 3. 启用缓存
KG_CACHE_ENABLED=true

# 4. 重启服务
pm2 restart kg-server
```

### 3.2 Token 消耗异常高

**症状**: Token 消耗远超预期

**可能原因**:
1. 缓存未命中
2. 智能截断未生效
3. LLM 调用频率过高
4. 文档内容过长

**诊断步骤**:

```bash
# 1. 查看 Token 消耗详情
curl http://localhost:3000/api/knowledge-graph/stats/tokens/breakdown

# 2. 查看缓存命中率
curl http://localhost:3000/api/knowledge-graph/stats/cache

# 3. 查看日志
tail -f logs/kg.log | grep "Token"
```

**解决方案**:

```bash
# 1. 清空缓存并重建
curl -X POST http://localhost:3000/api/knowledge-graph/cache/clear

# 2. 启用智能截断
KG_INTELLIGENT_TRUNCATING_ENABLED=true

# 3. 降低 LLM 调用频率
KG_LLM_FIELD_MAPPING_RATE=0.3
KG_LLM_ENTITY_CANONICAL_NAME_RATE=0.3

# 4. 分批处理大文档
# 将大文档拆分为多个小文档
```

### 3.3 LLM 调用超时

**症状**: 系统提示 "LLM call timeout"

**可能原因**:
1. 网络连接不稳定
2. LLM API 响应慢
3. 超时时间设置过短
4. API 密钥无效

**诊断步骤**:

```bash
# 1. 测试 LLM 连接
node test_llm_connection.js

# 2. 检查网络连接
ping dashscope.aliyuncs.com

# 3. 检查 API 密钥
grep QWEN_API_KEY .env

# 4. 查看错误日志
tail -f logs/error.log | grep "LLM"
```

**解决方案**:

```bash
# 1. 增加超时时间
KG_LLM_CALL_TIMEOUT_MS=15000

# 2. 检查并更新 API 密钥
# 编辑 .env
QWEN_API_KEY=your_valid_api_key

# 3. 使用备用 API
QWEN_API_BASE_URL=https://backup-api.example.com

# 4. 启用重试机制
KG_LLM_MAX_RETRIES=3

# 5. 重启服务
pm2 restart kg-server
```

## 4. Schema 相关问题

### 4.1 Schema 数量不足

**症状**: 系统启动时提示 "Schema count insufficient"

**可能原因**:
1. Schema 未导入
2. 导入失败
3. 数据库损坏
4. SchemaList.md 文件缺失

**诊断步骤**:

```bash
# 1. 检查 Schema 数量
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.schema.count().then(console.log);"

# 2. 检查 SchemaList.md
ls -la SchemaList.md

# 3. 查看导入日志
tail -f logs/schema_import.log
```

**解决方案**:

```bash
# 1. 手动导入 Schema
node kg/schema/load_schemas.js

# 2. 或通过 API 导入
curl -X POST http://localhost:3000/api/knowledge-graph/schemas/reimport

# 3. 验证导入结果
curl http://localhost:3000/api/knowledge-graph/schemas | jq 'length'

# 4. 如果仍然失败,重置数据库
npx prisma migrate reset
node kg/schema/load_schemas.js
```

### 4.2 Schema 匹配失败

**症状**: 文档处理后没有生成实体

**可能原因**:
1. 文档内容不符合任何 Schema
2. 字段抽取失败
3. 完整度评分低于阈值
4. Schema 被禁用

**诊断步骤**:

```bash
# 1. 查看字段抽取结果
curl http://localhost:3000/api/knowledge-graph/debug/fields/:ckb_id

# 2. 查看 Schema 匹配结果
curl http://localhost:3000/api/knowledge-graph/debug/schema-match/:ckb_id

# 3. 查看活跃 Schema 数量
curl http://localhost:3000/api/knowledge-graph/schemas?active=true | jq 'length'

# 4. 查看日志
tail -f logs/kg.log | grep "Schema match"
```

**解决方案**:

```bash
# 1. 检查文档内容是否包含结构化信息
# 确保文档包含时间、地点、数值等关键信息

# 2. 降低 Schema 阈值
# 编辑 Schema 定义,将 threshold 从 0.75 降到 0.6

# 3. 启用所有 Schema
curl -X POST http://localhost:3000/api/knowledge-graph/schemas/enable-all

# 4. 重新处理文档
curl -X POST http://localhost:3000/api/knowledge-graph/rebuild/:doc_id
```

### 4.3 Schema 导入错误

**症状**: 导入 Schema 时出现错误

**可能原因**:
1. SchemaList.md 格式错误
2. Schema 定义重复
3. 字段定义无效
4. 数据库约束冲突

**诊断步骤**:

```bash
# 1. 验证 SchemaList.md 格式
head -20 SchemaList.md

# 2. 查看导入错误日志
cat schema_import_errors.json

# 3. 查看失败的 Schema
cat schema_import_failures.json
```

**解决方案**:

```bash
# 1. 修复 SchemaList.md 格式
# 确保每行包含: ID、名称、场景、字段、示例、描述

# 2. 删除重复的 Schema
# 在数据库中删除重复记录

# 3. 修复字段定义
# 确保字段名称不包含特殊字符

# 4. 重新导入
node kg/schema/load_schemas.js
```

## 5. 字段映射问题

### 5.1 字段映射失败率高

**症状**: 系统告警 "Field mapping failure rate > 20%"

**可能原因**:
1. 同义词词典不完整
2. 字段名称多样性高
3. LLM 调用频率过低
4. 字段类型不匹配

**诊断步骤**:

```bash
# 1. 查看映射失败统计
curl http://localhost:3000/api/knowledge-graph/stats/field-mapping

# 2. 查看未映射字段
curl http://localhost:3000/api/knowledge-graph/debug/unmapped-fields

# 3. 查看同义词词典覆盖率
curl http://localhost:3000/api/knowledge-graph/stats/synonym-dict
```

**解决方案**:

```bash
# 1. 扩充同义词词典
curl -X POST http://localhost:3000/api/knowledge-graph/synonym-dict/expand

# 2. 增加 LLM 映射频率
KG_LLM_FIELD_MAPPING_RATE=0.8

# 3. 启用同义词词典自动学习
KG_SYNONYM_DICT_AUTO_EXPAND=true

# 4. 重新处理文档
curl -X POST http://localhost:3000/api/knowledge-graph/rebuild
```

### 5.2 字段值清洗失败

**症状**: 字段值格式不正确或包含噪声

**可能原因**:
1. 清洗规则不完整
2. 字段值格式多样
3. 特殊字符处理不当

**诊断步骤**:

```bash
# 1. 查看字段值示例
curl http://localhost:3000/api/knowledge-graph/debug/field-values/:field_name

# 2. 查看清洗日志
tail -f logs/kg.log | grep "Field clean"
```

**解决方案**:

```bash
# 1. 添加自定义清洗规则
# 编辑 kg/field_normalizer/field_cleaner.js

# 2. 启用严格清洗模式
KG_FIELD_CLEANING_STRICT=true

# 3. 重新处理文档
curl -X POST http://localhost:3000/api/knowledge-graph/rebuild
```

## 6. 实体和关系问题

### 6.1 实体重复

**症状**: 生成了多个相同或相似的实体

**可能原因**:
1. 实体消歧未生效
2. 规范名称不一致
3. 别名未识别
4. LLM 消歧频率过低

**诊断步骤**:

```bash
# 1. 查看重复实体
curl http://localhost:3000/api/knowledge-graph/debug/duplicate-entities

# 2. 查看实体消歧日志
tail -f logs/kg.log | grep "Entity disambiguation"
```

**解决方案**:

```bash
# 1. 增加 LLM 消歧频率
KG_LLM_ENTITY_DISAMBIGUATION_RATE=0.5

# 2. 手动合并重复实体
curl -X POST http://localhost:3000/api/knowledge-graph/entities/merge \
  -d '{"source_id": "entity_1", "target_id": "entity_2"}'

# 3. 重新构建实体
curl -X POST http://localhost:3000/api/knowledge-graph/rebuild
```

### 6.2 实体置信度低

**症状**: 大量实体的置信度 < 0.6

**可能原因**:
1. 源文档质量低 (OCR/ASR)
2. 字段抽取不准确
3. Schema 匹配度低
4. 支撑 CKB 数量少

**诊断步骤**:

```bash
# 1. 查看低置信度实体
curl http://localhost:3000/api/knowledge-graph/entities?confidence_lt=0.6

# 2. 查看实体详情
curl http://localhost:3000/api/knowledge-graph/entities/:id

# 3. 查看支撑 CKB
curl http://localhost:3000/api/knowledge-graph/entities/:id/ckbs
```

**解决方案**:

```bash
# 1. 提高文档质量
# 使用高质量的文档源,避免 OCR/ASR

# 2. 增加支撑文档
# 上传更多相关文档

# 3. 手动调整置信度
curl -X PUT http://localhost:3000/api/knowledge-graph/entities/:id \
  -d '{"confidence": 0.8}'

# 4. 删除低质量实体
curl -X DELETE http://localhost:3000/api/knowledge-graph/entities/low-quality
```

### 6.3 关系缺失

**症状**: 实体之间缺少预期的关系

**可能原因**:
1. 内建关系未定义
2. 共现关系阈值过高
3. 语义关系未触发
4. 关系置信度过低被过滤

**诊断步骤**:

```bash
# 1. 查看实体的关系
curl http://localhost:3000/api/knowledge-graph/entities/:id/relations

# 2. 查看关系构建日志
tail -f logs/kg.log | grep "Relation build"

# 3. 查看关系统计
curl http://localhost:3000/api/knowledge-graph/stats/relations
```

**解决方案**:

```bash
# 1. 在 Schema 中添加内建关系定义

# 2. 降低共现关系阈值
KG_COOCCURRENCE_THRESHOLD=0.3

# 3. 增加语义关系触发频率
KG_LLM_SEMANTIC_RELATION_HIGH_PRIORITY_RATE=0.5
KG_LLM_SEMANTIC_RELATION_RANDOM_SAMPLE_RATE=0.3

# 4. 降低关系置信度阈值
KG_MIN_RELATION_CONFIDENCE=0.4

# 5. 重新构建关系
curl -X POST http://localhost:3000/api/knowledge-graph/relations/rebuild
```

## 7. 性能问题

### 7.1 处理速度慢

**症状**: 文档处理时间 > 10 秒

**可能原因**:
1. 文档过大
2. LLM 调用过多
3. 数据库查询慢
4. 并发处理不足

**诊断步骤**:

```bash
# 1. 查看性能统计
curl http://localhost:3000/api/knowledge-graph/stats/performance

# 2. 查看慢查询日志
tail -f logs/slow_query.log

# 3. 查看 LLM 调用统计
curl http://localhost:3000/api/knowledge-graph/stats/llm-calls
```

**解决方案**:

```bash
# 1. 增加并发数
KG_BATCH_CONCURRENCY=5

# 2. 启用缓存
KG_CACHE_ENABLED=true

# 3. 优化数据库索引
node kg/utils/optimize_indexes.js

# 4. 降低 LLM 调用频率
KG_LLM_FIELD_MAPPING_RATE=0.3

# 5. 分批处理大文档
# 将大文档拆分为多个小文档
```

### 7.2 内存占用高

**症状**: 系统内存占用 > 2GB

**可能原因**:
1. 缓存过大
2. 内存泄漏
3. 大文档未释放
4. 数据库连接未关闭

**诊断步骤**:

```bash
# 1. 查看内存使用
pm2 list

# 2. 查看缓存大小
curl http://localhost:3000/api/knowledge-graph/stats/cache

# 3. 查看进程详情
pm2 show kg-server
```

**解决方案**:

```bash
# 1. 清空缓存
curl -X POST http://localhost:3000/api/knowledge-graph/cache/clear

# 2. 限制缓存大小
KG_CACHE_MAX_SIZE_MB=50

# 3. 重启服务
pm2 restart kg-server

# 4. 使用流式处理
KG_STREAM_PROCESSING=true
```

### 7.3 数据库查询慢

**症状**: 数据库查询时间 > 500ms

**可能原因**:
1. 缺少索引
2. 查询条件不优化
3. 数据量过大
4. 数据库文件损坏

**诊断步骤**:

```bash
# 1. 查看慢查询日志
tail -f logs/slow_query.log

# 2. 分析查询计划
# 在 Prisma Studio 中查看查询计划

# 3. 检查索引
node kg/utils/check_indexes.js
```

**解决方案**:

```bash
# 1. 创建索引
node kg/utils/create_indexes.js

# 2. 优化查询
# 使用 include 预加载关联数据

# 3. 数据库优化
npx prisma db push --force-reset

# 4. 迁移到 PostgreSQL (生产环境)
# 编辑 .env
DATABASE_URL="postgresql://user:password@localhost:5432/kg_db"
npx prisma migrate deploy
```

## 8. 前端问题

### 8.1 知识图谱无法显示

**症状**: 知识图谱页面空白或报错

**可能原因**:
1. API 调用失败
2. 数据格式错误
3. D3.js 加载失败
4. 浏览器兼容性问题

**诊断步骤**:

```bash
# 1. 检查浏览器控制台错误
# 打开浏览器开发者工具查看错误

# 2. 测试 API
curl http://localhost:3000/api/knowledge-graph

# 3. 检查前端日志
tail -f client/logs/error.log
```

**解决方案**:

```bash
# 1. 清空浏览器缓存
# Ctrl + Shift + Delete

# 2. 重新构建前端
cd client
npm run build

# 3. 检查 API 响应格式
curl http://localhost:3000/api/knowledge-graph | jq

# 4. 使用支持的浏览器
# Chrome 90+, Firefox 88+, Safari 14+
```

### 8.2 搜索功能不工作

**症状**: 搜索框输入后无结果

**可能原因**:
1. 搜索 API 失败
2. 索引未建立
3. 搜索关键词不匹配
4. 前端搜索逻辑错误

**诊断步骤**:

```bash
# 1. 测试搜索 API
curl "http://localhost:3000/api/knowledge-graph/entities/search?q=test"

# 2. 检查浏览器控制台
# 查看网络请求和错误

# 3. 查看搜索日志
tail -f logs/search.log
```

**解决方案**:

```bash
# 1. 重建搜索索引
curl -X POST http://localhost:3000/api/knowledge-graph/search/reindex

# 2. 使用精确搜索
# 在搜索框中使用引号: "精确关键词"

# 3. 检查搜索权限
# 确保已登录并有搜索权限

# 4. 清空前端缓存
# Ctrl + Shift + R 强制刷新
```

## 9. 日志和监控

### 9.1 查看日志

**系统日志**:
```bash
# 错误日志
tail -f logs/error.log

# 所有日志
tail -f logs/combined.log

# KG 模块日志
tail -f logs/kg.log

# 搜索特定错误
grep "Token limit exceeded" logs/error.log
```

**PM2 日志**:
```bash
# 查看所有日志
pm2 logs

# 查看错误日志
pm2 logs --err

# 清空日志
pm2 flush
```

### 9.2 性能监控

**实时监控**:
```bash
# PM2 监控
pm2 monit

# 系统资源
htop

# 网络连接
netstat -an | grep 3000
```

**性能统计**:
```bash
# 获取性能统计
curl http://localhost:3000/api/knowledge-graph/stats/performance

# 获取性能仪表板
curl http://localhost:3000/api/knowledge-graph/stats/performance/dashboard
```

### 9.3 健康检查

**检查服务状态**:
```bash
# 健康检查
curl http://localhost:3000/health

# 检查数据库连接
curl http://localhost:3000/api/knowledge-graph/health/db

# 检查 LLM 连接
curl http://localhost:3000/api/knowledge-graph/health/llm
```

## 10. 紧急恢复

### 10.1 数据备份

**备份数据库**:
```bash
# 备份 SQLite
cp prisma/knowledge-base.db backups/knowledge-base_$(date +%Y%m%d).db

# 备份配置
cp .env backups/.env_$(date +%Y%m%d)

# 备份 Schema
cp SchemaList.md backups/SchemaList_$(date +%Y%m%d).md
```

### 10.2 数据恢复

**恢复数据库**:
```bash
# 停止服务
pm2 stop kg-server

# 恢复数据库
cp backups/knowledge-base_20250203.db prisma/knowledge-base.db

# 重新生成 Prisma Client
npx prisma generate

# 启动服务
pm2 start kg-server
```

### 10.3 系统重置

**完全重置** (⚠️ 谨慎操作):
```bash
# 1. 停止所有服务
pm2 stop all

# 2. 备份数据
cp -r prisma backups/prisma_$(date +%Y%m%d)

# 3. 删除数据库
rm prisma/knowledge-base.db

# 4. 重新初始化
npx prisma migrate reset
node kg/schema/load_schemas.js

# 5. 重启服务
pm2 restart all
```

## 11. 获取帮助

### 11.1 在线资源

- **文档**: 查看完整的技术文档
- **GitHub Issues**: https://github.com/your-org/knowledge-graph/issues
- **FAQ**: 常见问题解答

### 11.2 联系支持

- **邮件**: support@example.com
- **GitHub**: 创建 Issue
- **社区**: 加入讨论组

### 11.3 报告问题

报告问题时请提供:

1. **问题描述**: 详细描述问题现象
2. **复现步骤**: 如何复现问题
3. **错误日志**: 相关的错误日志
4. **系统信息**: 操作系统、Node.js 版本等
5. **配置信息**: 相关的环境变量配置

**问题模板**:
```markdown
## 问题描述
[详细描述问题]

## 复现步骤
1. [步骤 1]
2. [步骤 2]
3. [步骤 3]

## 预期行为
[描述预期的正确行为]

## 实际行为
[描述实际发生的行为]

## 错误日志
```
[粘贴错误日志]
```

## 系统信息
- OS: [操作系统]
- Node.js: [版本]
- npm: [版本]
- 浏览器: [浏览器和版本]

## 配置信息
[相关的环境变量配置]
```

---

**文档版本**: v1.0.0  
**最后更新**: 2025-02-03  
**维护者**: Schema-Driven KG Team
