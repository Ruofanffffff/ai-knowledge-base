# LLM文档索引预处理故障排查指南

## 概述

本文档提供LLM文档索引预处理系统常见问题的诊断和解决方案。

## 目录

- [快速诊断](#快速诊断)
- [常见问题](#常见问题)
  - [LLM调用问题](#llm调用问题)
  - [性能问题](#性能问题)
  - [配置问题](#配置问题)
  - [数据问题](#数据问题)
  - [集成问题](#集成问题)
- [日志分析](#日志分析)
- [性能调优](#性能调优)
- [联系支持](#联系支持)

## 快速诊断

### 检查系统状态

```bash
# 检查预处理功能是否启用
curl http://localhost:3000/api/preprocessing/status

# 查看最近的日志
tail -f logs/app.log | grep "preprocessing"

# 检查数据库连接
npm run db:check
```

### 常见症状快速索引

| 症状 | 可能原因 | 快速解决 |
|------|----------|----------|
| LLM调用频繁超时 | 超时配置过短、网络问题 | 增加超时时间、检查网络 |
| 处理速度慢 | 并发数过低、触发阈值过高 | 增加并发数、降低阈值 |
| 成本过高 | 缓存未启用、触发阈值过高 | 启用缓存、降低阈值 |
| 配置不生效 | .env文件位置错误、未重启 | 检查文件、重启服务 |
| 索引质量差 | LLM模型不合适、温度参数过高 | 更换模型、降低温度 |

## 常见问题

### LLM调用问题

#### 问题1: LLM调用频繁超时

**症状**:
```
[ERROR] LLM call timeout: document_index operation exceeded 30000ms
[ERROR] LLM preprocessing failed: timeout
```

**可能原因**:
1. 超时配置过短
2. LLM服务响应慢
3. 网络连接问题
4. 文档过长导致处理时间长

**诊断步骤**:

```bash
# 1. 检查当前超时配置
grep "TIMEOUT" .env

# 2. 测试LLM服务连接
curl -X POST https://your-llm-service/api/test

# 3. 查看超时日志
grep "timeout" logs/app.log | tail -20
```

**解决方案**:

```bash
# 方案1: 增加超时时间
LLM_PREPROCESSING_DOCUMENT_INDEX_TIMEOUT=60000  # 增加到60秒
LLM_PREPROCESSING_FIELD_CORRECTION_TIMEOUT=20000
LLM_PREPROCESSING_RELATION_CORRECTION_TIMEOUT=30000

# 方案2: 降低并发数（减少服务压力）
LLM_PREPROCESSING_MAX_CONCURRENCY=3

# 方案3: 启用更激进的缓存
LLM_PREPROCESSING_CACHE_ENABLED=true
LLM_PREPROCESSING_CACHE_TTL=7200000  # 2小时
```

**预防措施**:
- 根据文档平均长度调整超时时间
- 监控LLM服务的响应时间
- 设置合理的超时告警阈值

#### 问题2: LLM服务不可用

**症状**:
```
[ERROR] LLM service unavailable: connection refused
[ERROR] Failed to generate document index: service unavailable
```

**可能原因**:
1. LLM服务未启动
2. API密钥无效
3. 网络连接问题
4. 服务限流

**诊断步骤**:

```bash
# 1. 检查LLM服务配置
grep "LLM" .env

# 2. 测试服务连接
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://your-llm-service/api/health

# 3. 检查网络连接
ping your-llm-service-domain
```

**解决方案**:

```bash
# 1. 验证API密钥
LLM_API_KEY=your-valid-api-key

# 2. 检查服务端点
LLM_API_ENDPOINT=https://correct-endpoint.com/api

# 3. 配置重试机制
LLM_MAX_RETRIES=3
LLM_RETRY_DELAY=1000

# 4. 启用降级模式（使用原有流程）
ENABLE_LLM_PREPROCESSING=false  # 临时禁用
```

**预防措施**:
- 配置服务健康检查
- 设置自动重试机制
- 准备备用LLM服务

#### 问题3: LLM返回结果格式错误

**症状**:
```
[ERROR] Failed to parse LLM response: invalid JSON
[ERROR] Indexed text validation failed: missing required fields
```

**可能原因**:
1. LLM输出格式不符合预期
2. Prompt设计问题
3. 温度参数过高导致输出不稳定

**诊断步骤**:

```bash
# 1. 查看LLM原始响应
grep "LLM response" logs/app.log | tail -5

# 2. 检查温度参数
grep "TEMPERATURE" .env

# 3. 验证Prompt模板
cat kg/preprocessing/prompts/*.txt
```

**解决方案**:

```bash
# 1. 降低温度参数（提高确定性）
LLM_PREPROCESSING_TEMPERATURE=0.05  # 从0.1降到0.05

# 2. 使用更稳定的模型
LLM_MODEL=qwen-plus  # 或其他稳定模型

# 3. 增加响应验证
# 在代码中添加更严格的验证逻辑
```

**预防措施**:
- 使用低温度参数（0.05-0.1）
- 在Prompt中明确输出格式要求
- 实施严格的响应验证

### 性能问题

#### 问题4: 处理速度太慢

**症状**:
```
[INFO] Document processing took 120000ms (expected < 30000ms)
[WARN] Queue backlog: 15 pending operations
```

**可能原因**:
1. 并发数过低
2. 触发阈值过高导致过多LLM调用
3. 缓存未启用或命中率低
4. 超时时间过长

**诊断步骤**:

```bash
# 1. 查看性能指标
curl http://localhost:3000/api/preprocessing/metrics

# 2. 检查并发配置
grep "CONCURRENCY" .env

# 3. 查看缓存状态
curl http://localhost:3000/api/preprocessing/status | jq '.data.cacheStatus'

# 4. 分析处理时间分布
grep "processing took" logs/app.log | awk '{print $NF}' | sort -n
```

**解决方案**:

```bash
# 方案1: 增加并发数
LLM_PREPROCESSING_MAX_CONCURRENCY=8  # 从5增加到8

# 方案2: 降低触发阈值（减少LLM调用）
LLM_PREPROCESSING_FIELD_COVERAGE_THRESHOLD=0.7  # 从0.8降到0.7
LLM_PREPROCESSING_RELATION_COVERAGE_THRESHOLD=0.6  # 从0.7降到0.6

# 方案3: 优化缓存配置
LLM_PREPROCESSING_CACHE_ENABLED=true
LLM_PREPROCESSING_CACHE_MAX_SIZE=2000  # 增加缓存容量
LLM_PREPROCESSING_CACHE_TTL=7200000  # 延长TTL

# 方案4: 减少超时时间（快速失败）
LLM_PREPROCESSING_DOCUMENT_INDEX_TIMEOUT=20000  # 从30秒减到20秒
```

**性能优化建议**:

| 场景 | 并发数 | 字段阈值 | 关系阈值 | 缓存大小 |
|------|--------|----------|----------|----------|
| 快速处理 | 8-10 | 0.7 | 0.6 | 2000 |
| 平衡模式 | 5 | 0.8 | 0.7 | 1000 |
| 高质量 | 3 | 0.85 | 0.75 | 500 |

#### 问题5: 内存占用过高

**症状**:
```
[WARN] Memory usage: 2.5GB (threshold: 2GB)
[ERROR] Out of memory error
```

**可能原因**:
1. 缓存容量过大
2. 并发处理过多大文档
3. 内存泄漏

**诊断步骤**:

```bash
# 1. 检查内存使用
node --expose-gc --max-old-space-size=4096 server.js

# 2. 查看缓存大小
curl http://localhost:3000/api/preprocessing/status | jq '.data.cacheStatus.size'

# 3. 监控内存趋势
watch -n 5 'ps aux | grep node'
```

**解决方案**:

```bash
# 1. 减小缓存容量
LLM_PREPROCESSING_CACHE_MAX_SIZE=500  # 从1000减到500

# 2. 降低并发数
LLM_PREPROCESSING_MAX_CONCURRENCY=3

# 3. 缩短缓存TTL
LLM_PREPROCESSING_CACHE_TTL=1800000  # 30分钟

# 4. 增加Node.js内存限制
node --max-old-space-size=4096 server.js
```

#### 问题6: 成本过高

**症状**:
- LLM调用次数远超预期
- 每个文档的处理成本过高

**可能原因**:
1. 缓存未启用
2. 触发阈值过高
3. 所有操作都调用LLM

**诊断步骤**:

```bash
# 1. 查看LLM调用统计
curl http://localhost:3000/api/preprocessing/metrics | jq '.data.operations'

# 2. 检查缓存命中率
curl http://localhost:3000/api/preprocessing/status | jq '.data.cacheStatus.hitRate'

# 3. 分析调用分布
grep "LLM call" logs/app.log | awk '{print $4}' | sort | uniq -c
```

**解决方案**:

```bash
# 1. 启用缓存
LLM_PREPROCESSING_CACHE_ENABLED=true
LLM_PREPROCESSING_CACHE_MAX_SIZE=2000
LLM_PREPROCESSING_CACHE_TTL=14400000  # 4小时

# 2. 降低触发阈值
LLM_PREPROCESSING_FIELD_COVERAGE_THRESHOLD=0.7
LLM_PREPROCESSING_RELATION_COVERAGE_THRESHOLD=0.6
LLM_PREPROCESSING_SCHEMA_CONFIDENCE_THRESHOLD=0.7

# 3. 禁用非关键矫正
# 在代码中添加配置选项，只启用关键矫正
```

**成本优化策略**:

| 策略 | 预期效果 | 质量影响 |
|------|----------|----------|
| 启用缓存 | -30% | 无 |
| 降低阈值 | -40% | 轻微 |
| 只启用关键矫正 | -50% | 中等 |
| 使用更便宜的模型 | -60% | 中等 |

### 配置问题

#### 问题7: 配置不生效

**症状**:
- 修改.env文件后配置没有变化
- 启动日志显示的配置与.env不一致

**可能原因**:
1. .env文件位置错误
2. 未重启服务器
3. 环境变量被系统变量覆盖
4. 配置值格式错误

**诊断步骤**:

```bash
# 1. 检查.env文件位置
ls -la .env
pwd

# 2. 查看启动日志中的配置
grep "LLM Preprocessing Configuration" logs/app.log | tail -1

# 3. 检查环境变量
printenv | grep LLM_PREPROCESSING

# 4. 验证配置加载
node -e "require('dotenv').config(); console.log(process.env.ENABLE_LLM_PREPROCESSING)"
```

**解决方案**:

```bash
# 1. 确认.env文件在项目根目录
cp .env.example .env
# 编辑.env文件

# 2. 重启服务器
npm run stop
npm run start

# 3. 清除系统环境变量（如果冲突）
unset ENABLE_LLM_PREPROCESSING
# 然后重启

# 4. 验证配置格式
# 布尔值: true/false (小写)
# 数字: 不要加引号
# 字符串: 可以加引号
```

**配置文件示例**:

```bash
# 正确格式
ENABLE_LLM_PREPROCESSING=true
LLM_PREPROCESSING_MAX_CONCURRENCY=5
LLM_PREPROCESSING_TEMPERATURE=0.1

# 错误格式
ENABLE_LLM_PREPROCESSING="true"  # 不要加引号
LLM_PREPROCESSING_MAX_CONCURRENCY="5"  # 不要加引号
LLM_PREPROCESSING_TEMPERATURE=.1  # 应该是0.1
```

#### 问题8: 配置验证失败

**症状**:
```
[ERROR] Invalid preprocessing configuration: temperature must be between 0 and 1
[ERROR] Configuration validation failed
```

**可能原因**:
1. 配置值超出有效范围
2. 配置值类型错误
3. 必需配置缺失

**诊断步骤**:

```bash
# 查看配置验证错误
grep "Invalid preprocessing configuration" logs/app.log

# 检查所有配置值
cat .env | grep LLM_PREPROCESSING
```

**解决方案**:

```bash
# 确保所有值在有效范围内

# 温度参数: 0-1
LLM_PREPROCESSING_TEMPERATURE=0.1  # ✓
# LLM_PREPROCESSING_TEMPERATURE=1.5  # ✗ 超出范围

# 阈值: 0-1
LLM_PREPROCESSING_FIELD_COVERAGE_THRESHOLD=0.8  # ✓
# LLM_PREPROCESSING_FIELD_COVERAGE_THRESHOLD=1.2  # ✗ 超出范围

# 并发数: >= 1
LLM_PREPROCESSING_MAX_CONCURRENCY=5  # ✓
# LLM_PREPROCESSING_MAX_CONCURRENCY=0  # ✗ 必须 >= 1

# 超时: > 0
LLM_PREPROCESSING_DOCUMENT_INDEX_TIMEOUT=30000  # ✓
# LLM_PREPROCESSING_DOCUMENT_INDEX_TIMEOUT=-1000  # ✗ 必须 > 0
```

### 数据问题

#### 问题9: 索引质量差

**症状**:
- 生成的索引叙述文本包含推理和评论
- 索引事实不完整或不准确
- 矫正效果不明显

**可能原因**:
1. LLM模型不合适
2. 温度参数过高
3. Prompt设计问题
4. 文档质量差

**诊断步骤**:

```bash
# 1. 查看生成的索引
curl http://localhost:3000/api/preprocessing/index/doc-123 | jq '.data.indexedText'

# 2. 检查LLM配置
grep "LLM_MODEL\|TEMPERATURE" .env

# 3. 查看矫正统计
curl http://localhost:3000/api/preprocessing/stats/doc-123
```

**解决方案**:

```bash
# 1. 使用更好的模型
LLM_MODEL=qwen-plus  # 或 gpt-4

# 2. 降低温度参数
LLM_PREPROCESSING_TEMPERATURE=0.05  # 更确定性

# 3. 增加最大Token数（允许更完整的索引）
LLM_PREPROCESSING_MAX_TOKENS=3000

# 4. 优化Prompt（在代码中调整）
# 强调"只描述明确事实"、"不要推理"等
```

**质量检查清单**:
- [ ] 索引只包含明确事实
- [ ] 每条索引独立完整
- [ ] 没有评论和推理
- [ ] 时间、地点、数值完整
- [ ] 指代明确（不用"其"、"该"）

#### 问题10: 矫正记录缺失

**症状**:
- 数据库中没有矫正记录
- 统计信息为空

**可能原因**:
1. 数据库连接问题
2. 矫正功能未正确集成
3. 事务回滚

**诊断步骤**:

```bash
# 1. 检查数据库连接
npm run db:check

# 2. 查询矫正记录表
mysql -u user -p -e "SELECT COUNT(*) FROM correction_record;"

# 3. 查看错误日志
grep "correction_record\|correction_stats" logs/app.log
```

**解决方案**:

```bash
# 1. 验证数据库表存在
npm run db:migrate

# 2. 检查Prisma配置
cat prisma/schema.prisma | grep -A 10 "model CorrectionRecord"

# 3. 测试矫正记录功能
node -e "
const { createCorrectionStatsCollector } = require('./kg/preprocessing/correction_stats_collector');
const collector = createCorrectionStatsCollector();
collector.recordCorrection('test', { type: 'test' });
"
```

### 集成问题

#### 问题11: 预处理未在KG构建中执行

**症状**:
- 知识图谱构建完成但没有预处理日志
- 没有生成document_index记录

**可能原因**:
1. 预处理功能未启用
2. 集成代码未正确添加
3. LLM客户端未传递

**诊断步骤**:

```bash
# 1. 检查预处理开关
grep "ENABLE_LLM_PREPROCESSING" .env

# 2. 查看KG构建日志
grep "preprocessing\|document index" logs/app.log | tail -20

# 3. 检查集成代码
grep -n "generateIndexedText" kg/services/kg_service.js
```

**解决方案**:

```bash
# 1. 启用预处理
ENABLE_LLM_PREPROCESSING=true

# 2. 确保传递LLM客户端
# 在调用buildKnowledgeGraph时:
const result = await buildKnowledgeGraph(docId, filePath, fileType, {
  llmClient: myLLMClient,  // 必须传递
  enableLLMPreprocessing: true
});

# 3. 检查集成代码
# 确保kg_service.js中有预处理调用
```

#### 问题12: 矫正未生效

**症状**:
- 有document_index但矫正统计为0
- 知识图谱质量没有提升

**可能原因**:
1. 矫正器未正确集成
2. 触发阈值过低
3. 索引质量差导致无法矫正

**诊断步骤**:

```bash
# 1. 查看矫正日志
grep "correction\|validator" logs/app.log | tail -30

# 2. 检查触发阈值
grep "THRESHOLD" .env

# 3. 查看索引质量
curl http://localhost:3000/api/preprocessing/index/doc-123
```

**解决方案**:

```bash
# 1. 提高触发阈值（增加矫正频率）
LLM_PREPROCESSING_FIELD_COVERAGE_THRESHOLD=0.85
LLM_PREPROCESSING_RELATION_COVERAGE_THRESHOLD=0.75

# 2. 检查矫正器集成
# 确保在各个处理阶段调用了相应的验证器

# 3. 改善索引质量
# 参考"问题9: 索引质量差"的解决方案
```

## 日志分析

### 关键日志模式

#### 成功的预处理流程

```
[INFO] Starting LLM preprocessing for document: doc-123
[INFO] Generating indexed text...
[INFO] Indexed text generated: 5 facts, 200 tokens
[INFO] Saving document index to database...
[INFO] Document index saved: version 1
[INFO] Field extraction correction: coverage 0.85, 2 fields added
[INFO] Relation extraction correction: coverage 0.78, 1 relation added
[INFO] Consistency check complete: score 0.92
```

#### 失败的预处理流程

```
[ERROR] LLM call failed: timeout after 30000ms
[WARN] Falling back to original flow without preprocessing
[ERROR] Failed to save document index: database connection error
```

### 日志级别说明

| 级别 | 说明 | 示例 |
|------|------|------|
| INFO | 正常操作 | 索引生成成功、矫正完成 |
| WARN | 警告但不影响功能 | 缓存未命中、降级处理 |
| ERROR | 错误需要关注 | LLM调用失败、数据库错误 |

### 日志查询命令

```bash
# 查看所有预处理相关日志
grep "preprocessing" logs/app.log

# 查看错误日志
grep "ERROR.*preprocessing" logs/app.log

# 查看特定文档的日志
grep "doc-123" logs/app.log | grep "preprocessing"

# 查看性能日志
grep "took.*ms" logs/app.log | grep "preprocessing"

# 实时监控
tail -f logs/app.log | grep "preprocessing"
```

## 性能调优

### 调优流程

1. **基准测试**: 记录当前性能指标
2. **识别瓶颈**: 分析日志和指标
3. **调整配置**: 根据瓶颈调整
4. **验证效果**: 对比调整前后
5. **迭代优化**: 重复上述步骤

### 调优检查清单

#### 时延优化
- [ ] 超时配置合理（不过长也不过短）
- [ ] 并发数与LLM服务能力匹配
- [ ] 缓存已启用且命中率 > 30%
- [ ] 触发阈值合理（不过高）

#### 成本优化
- [ ] 缓存TTL足够长（2-4小时）
- [ ] 触发阈值适当降低
- [ ] 只启用必要的矫正环节
- [ ] 使用性价比高的LLM模型

#### 质量优化
- [ ] 温度参数低（0.05-0.1）
- [ ] 使用高质量LLM模型
- [ ] 触发阈值适当提高
- [ ] Prompt设计清晰明确

### 性能监控脚本

```bash
#!/bin/bash
# performance_monitor.sh

echo "=== LLM Preprocessing Performance Monitor ==="
echo ""

# 系统状态
echo "1. System Status:"
curl -s http://localhost:3000/api/preprocessing/status | jq '.data | {enabled, llmAvailable, queuePending: .queueStatus.pending, cacheHitRate: .cacheStatus.hitRate}'

echo ""
echo "2. Performance Metrics (Last 1 hour):"
curl -s http://localhost:3000/api/preprocessing/metrics?period=1h | jq '.data.operations | to_entries[] | {operation: .key, successRate: .value.successRate, avgLatency: .value.latency.avg}'

echo ""
echo "3. Recent Errors:"
tail -20 logs/app.log | grep "ERROR.*preprocessing"

echo ""
echo "4. Memory Usage:"
ps aux | grep node | awk '{print "RSS: " $6/1024 " MB, VSZ: " $5/1024 " MB"}'
```

## 联系支持

如果以上解决方案无法解决您的问题，请联系技术支持：

### 提供以下信息

1. **问题描述**: 详细描述问题症状
2. **错误日志**: 相关的错误日志（最近50行）
3. **配置信息**: .env文件内容（隐藏敏感信息）
4. **系统信息**: Node.js版本、操作系统、数据库版本
5. **复现步骤**: 如何复现问题

### 日志收集脚本

```bash
#!/bin/bash
# collect_logs.sh

OUTPUT_FILE="preprocessing_debug_$(date +%Y%m%d_%H%M%S).tar.gz"

mkdir -p debug_info

# 收集配置
grep "LLM_PREPROCESSING" .env > debug_info/config.txt

# 收集日志
tail -500 logs/app.log | grep "preprocessing" > debug_info/preprocessing.log
tail -100 logs/app.log | grep "ERROR" > debug_info/errors.log

# 收集系统信息
node --version > debug_info/system_info.txt
npm --version >> debug_info/system_info.txt
uname -a >> debug_info/system_info.txt

# 收集性能指标
curl -s http://localhost:3000/api/preprocessing/status > debug_info/status.json
curl -s http://localhost:3000/api/preprocessing/metrics > debug_info/metrics.json

# 打包
tar -czf $OUTPUT_FILE debug_info/
rm -rf debug_info/

echo "Debug information collected: $OUTPUT_FILE"
```

## 相关文档

- [README](./README.md) - 系统概述
- [配置指南](./CONFIG_GUIDE.md) - 配置选项详解
- [API文档](./API_DOCUMENTATION.md) - API接口说明
