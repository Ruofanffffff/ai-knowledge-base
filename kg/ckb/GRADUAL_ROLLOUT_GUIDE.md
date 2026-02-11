# CKB智能分片灰度发布指南

## 概述

本指南详细说明CKB智能分片系统的三阶段灰度发布策略，包括配置、监控、进度管理和应急回滚。

## 灰度发布策略

### 三阶段发布计划

| 阶段 | 流量比例 | 持续时间 | 目标 |
|------|---------|---------|------|
| Phase 1 | 10% | 1周 | 初步验证优化效果 |
| Phase 2 | 50% | 1周 | 扩大测试范围 |
| Phase 3 | 100% | 持续 | 全量上线 |

### 流量分配机制

使用**一致性哈希**确保同一文档始终使用相同的处理方式（优化或基线）：

```javascript
// 文档ID哈希到0-100的百分比
const hash = md5(documentId) % 100;

// Phase 1: hash < 10 使用优化
// Phase 2: hash < 50 使用优化
// Phase 3: 全部使用优化
```

**优势**：
- 同一文档的处理方式保持一致
- 便于问题追踪和对比
- 避免结果不一致

## 配置

### 环境变量

```bash
# 启用灰度发布
ENABLE_GRADUAL_ROLLOUT=true

# 初始阶段 (0=禁用, 1=10%, 2=50%, 3=100%)
ROLLOUT_INITIAL_PHASE=0

# 阶段流量比例
ROLLOUT_PHASE1_PERCENTAGE=10
ROLLOUT_PHASE2_PERCENTAGE=50
ROLLOUT_PHASE3_PERCENTAGE=100

# 阶段持续时间（天）
ROLLOUT_PHASE_DURATION_DAYS=7

# 质量阈值
ROLLOUT_MAX_ACCURACY_DROP=0.05        # 最大准确性下降5%
ROLLOUT_MAX_ERROR_RATE=0.05           # 最大错误率5%
ROLLOUT_MAX_LATENCY_INCREASE=2.0      # 最大时延增加2倍
ROLLOUT_MIN_TOKEN_SAVINGS=0.50        # 最小token节省50%

# 监控配置
ROLLOUT_CHECK_INTERVAL=60000          # 检查间隔（毫秒）
ROLLOUT_AUTO_ROLLBACK=true            # 自动回滚
ROLLOUT_MIN_REQUESTS=100              # 最小请求数
```

### 代码集成

```javascript
const { getGradualRolloutManager } = require('./kg/ckb/gradual_rollout');

// 在文档处理时检查是否使用优化
async function processDocument(documentId, content) {
  const rolloutManager = getGradualRolloutManager();
  const useOptimization = rolloutManager.shouldUseOptimization(documentId);
  
  if (useOptimization) {
    // 使用CKB智能分片优化
    return await processWithOptimization(documentId, content);
  } else {
    // 使用基线方法
    return await processBaseline(documentId, content);
  }
}
```

## 阶段管理

### Phase 1: 10%流量（第1周）

#### 启动Phase 1

```bash
# 方法1: API调用
curl -X POST http://localhost:3000/api/rollout/phase/start \
  -H "Content-Type: application/json" \
  -d '{"phase": 1}'

# 方法2: 代码调用
const rolloutManager = getGradualRolloutManager();
rolloutManager.startPhase(1);
```

#### 监控指标

每天检查以下指标：

```bash
# 获取当前状态
curl http://localhost:3000/api/rollout/status

# 获取详细报告
curl http://localhost:3000/api/rollout/report
```

**关键指标**：
- Token节省率 > 70%
- 准确性下降 < 2%
- 错误率 < 5%
- 时延改善 > 60%

#### 进度检查

```bash
# 检查是否可以进入下一阶段
curl http://localhost:3000/api/rollout/phase/progress
```

**进入Phase 2的条件**：
1. ✅ 运行满7天
2. ✅ 所有质量指标达标
3. ✅ 无重大问题

### Phase 2: 50%流量（第2周）

#### 启动Phase 2

```bash
curl -X POST http://localhost:3000/api/rollout/phase/start \
  -H "Content-Type: application/json" \
  -d '{"phase": 2}'
```

#### 监控重点

- 扩大测试范围，覆盖更多文档类型
- 监控不同领域的表现（摄影、旅游、科技等）
- 收集用户反馈

#### 每日检查清单

- [ ] Token消耗正常
- [ ] 准确性保持稳定
- [ ] 无异常错误
- [ ] 时延改善明显
- [ ] 用户反馈良好

### Phase 3: 100%全量（第3周）

#### 启动Phase 3

```bash
curl -X POST http://localhost:3000/api/rollout/phase/start \
  -H "Content-Type: application/json" \
  -d '{"phase": 3}'
```

#### 上线后监控

持续监控1周，确保系统稳定：

```bash
# 每小时检查一次
*/60 * * * * curl http://localhost:3000/api/rollout/check-emergency
```

## 质量监控

### 自动质量检查

系统会自动检查以下指标：

```javascript
{
  "qualityCheck": {
    "passed": true,
    "failures": [],
    "metrics": {
      "accuracy": {
        "baseline": 0.85,
        "optimized": 0.84,
        "drop": 0.01  // 1% drop - OK
      },
      "errorRate": 0.02,  // 2% - OK
      "latency": {
        "baseline": 10000,
        "optimized": 4000,
        "improvement": 0.60  // 60% improvement - OK
      },
      "tokenSavings": 0.75  // 75% savings - OK
    }
  }
}
```

### 质量阈值

| 指标 | 阈值 | 说明 |
|------|------|------|
| 准确性下降 | < 5% | 超过则触发回滚 |
| 错误率 | < 5% | 超过则触发回滚 |
| 时延增加 | < 2倍 | 超过则触发回滚 |
| Token节省 | > 50% | 低于则触发回滚 |

## 应急回滚

### 自动回滚触发条件

系统会在以下情况自动回滚：

1. **准确性下降超过5%**
2. **错误率超过5%**
3. **时延增加超过2倍**
4. **Token节省低于50%**

### 手动回滚

```bash
# 紧急回滚
curl -X POST http://localhost:3000/api/rollout/rollback \
  -H "Content-Type: application/json" \
  -d '{"reason": "发现严重问题，需要立即回滚"}'
```

### 回滚效果

回滚后：
- 所有流量切换回基线方法
- 灰度发布被禁用
- 保留所有监控数据用于分析

### 回滚后恢复

```bash
# 1. 分析问题
curl http://localhost:3000/api/rollout/history

# 2. 修复问题后，重新启动Phase 1
curl -X POST http://localhost:3000/api/rollout/phase/start \
  -H "Content-Type: application/json" \
  -d '{"phase": 1}'
```

## API参考

### 获取状态

```bash
GET /api/rollout/status
```

**响应**：
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "currentPhase": 1,
    "percentage": 10,
    "phaseDuration": 3.5,
    "metrics": {
      "totalRequests": 1000,
      "optimizedRequests": 100,
      "errorRate": 0.02
    },
    "qualityCheck": { ... },
    "progressCheck": { ... }
  }
}
```

### 获取报告

```bash
GET /api/rollout/report
```

**响应**：
```json
{
  "success": true,
  "data": {
    "summary": {
      "phase": 1,
      "percentage": "10%",
      "duration": "3.5 days",
      "totalRequests": 1000
    },
    "performance": {
      "tokenSavings": "75.0%",
      "accuracyDrop": "1.00%",
      "latencyImprovement": "60.0%"
    },
    "quality": {
      "passed": true,
      "failures": []
    }
  }
}
```

### 启动阶段

```bash
POST /api/rollout/phase/start
Content-Type: application/json

{
  "phase": 1
}
```

### 检查进度

```bash
GET /api/rollout/phase/progress
```

### 检查质量

```bash
GET /api/rollout/quality
```

### 触发回滚

```bash
POST /api/rollout/rollback
Content-Type: application/json

{
  "reason": "回滚原因"
}
```

### 检查应急回滚

```bash
GET /api/rollout/check-emergency
```

### 重置指标

```bash
POST /api/rollout/metrics/reset
```

### 获取历史

```bash
GET /api/rollout/history
```

## 监控仪表板

### 实时监控指标

```javascript
// 每分钟更新一次
setInterval(async () => {
  const response = await fetch('/api/rollout/status');
  const { data } = await response.json();
  
  // 更新仪表板
  updateDashboard({
    phase: data.currentPhase,
    percentage: data.percentage,
    tokenSavings: data.qualityCheck.metrics.tokenSavings,
    accuracyDrop: data.qualityCheck.metrics.accuracy.drop,
    errorRate: data.metrics.errorRate,
  });
}, 60000);
```

### 关键可视化

1. **流量分配饼图**
   - 优化流量 vs 基线流量

2. **Token节省趋势图**
   - 每日token消耗对比

3. **准确性对比图**
   - 基线准确性 vs 优化准确性

4. **时延改善图**
   - 处理时延对比

5. **阶段进度条**
   - 当前阶段进度和剩余时间

## 故障排查

### 问题1: Token节省不足

**症状**：Token节省 < 50%

**可能原因**：
- 上下文窗口设置过大
- 相关性阈值过低
- 文档类型不适合分片

**解决方案**：
```bash
# 调整配置
MAX_CONTEXT_TOKENS=400  # 降低上下文窗口
RELEVANCE_THRESHOLD=0.6  # 提高相关性阈值
```

### 问题2: 准确性下降过大

**症状**：准确性下降 > 5%

**可能原因**：
- 上下文窗口过小
- 相关性阈值过高
- 关键信息被过滤

**解决方案**：
```bash
# 调整配置
MAX_CONTEXT_TOKENS=800  # 增加上下文窗口
RELEVANCE_THRESHOLD=0.4  # 降低相关性阈值
MIN_CONTEXT_CHUNKS=5     # 增加最小chunk数
```

### 问题3: 错误率过高

**症状**：错误率 > 5%

**可能原因**：
- 分片失败
- LLM调用超时
- 内存不足

**解决方案**：
```bash
# 检查日志
tail -f logs/kg-service.log | grep ERROR

# 增加资源
pm2 restart kg-service --max-memory-restart 2G
```

### 问题4: 自动回滚频繁触发

**症状**：系统频繁自动回滚

**可能原因**：
- 质量阈值设置过严
- 测试数据不足
- 系统不稳定

**解决方案**：
```bash
# 放宽阈值
ROLLOUT_MAX_ACCURACY_DROP=0.08  # 8%
ROLLOUT_MIN_REQUESTS=200        # 增加最小请求数

# 或禁用自动回滚
ROLLOUT_AUTO_ROLLBACK=false
```

## 最佳实践

### 1. 充分测试

在启动Phase 1之前：
- ✅ 所有单元测试通过
- ✅ 集成测试通过
- ✅ 在测试环境运行1周
- ✅ 准备好回滚方案

### 2. 渐进式推进

- 不要跳过阶段
- 每个阶段至少运行7天
- 收集足够的数据再进入下一阶段

### 3. 持续监控

- 设置自动告警
- 每日检查报告
- 关注用户反馈

### 4. 快速响应

- 发现问题立即回滚
- 分析问题根因
- 修复后重新开始

### 5. 文档记录

- 记录每个阶段的关键指标
- 记录遇到的问题和解决方案
- 总结经验教训

## 成功标准

### Phase 1成功标准

- ✅ 运行满7天无重大问题
- ✅ Token节省 > 70%
- ✅ 准确性下降 < 2%
- ✅ 错误率 < 5%
- ✅ 用户反馈良好

### Phase 2成功标准

- ✅ 运行满7天无重大问题
- ✅ 所有质量指标稳定
- ✅ 不同文档类型表现良好
- ✅ 无性能瓶颈

### Phase 3成功标准

- ✅ 全量上线1周稳定运行
- ✅ 所有质量指标达标
- ✅ 用户满意度提升
- ✅ 成本显著降低

## 总结

灰度发布是确保CKB智能分片系统安全上线的关键策略。通过三阶段渐进式发布、持续监控和自动回滚机制，我们可以：

1. **降低风险**：逐步扩大影响范围
2. **快速发现问题**：在小范围内验证
3. **保证质量**：自动监控和回滚
4. **积累经验**：每个阶段总结优化

遵循本指南，您可以安全、稳定地将CKB智能分片系统推向生产环境，实现70-85%的token节省和60-75%的时延改善！
