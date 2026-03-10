# 长期记忆管理系统重构方案

## 1. 概述
基于 OpenClaw 理念，构建一个跨平台的统一记忆层，旨在解决当前系统“记忆碎片化”和“上下文丢失”的问题。本方案将实现分层记忆存储、重要性评分与自动归档机制。

## 2. 分层记忆架构

我们将记忆分为三个层次，分别对应不同的存储策略和生命周期：

### 2.1 短期工作记忆 (Working Memory)
*   **定义**: 当前会话或任务上下文中的即时信息。
*   **存储**: Redis (服务端) / 内存 (客户端)。
*   **容量**: 最近 10-20 轮对话 + 当前活跃文档内容。
*   **淘汰策略**: FIFO (先进先出) 或基于任务完成状态清除。

### 2.2 中期语义记忆 (Semantic Memory)
*   **定义**: 经过结构化处理的知识图谱 (Knowledge Graph)。
*   **存储**: 关系型数据库 (PostgreSQL/SQLite) + 向量数据库 (PgVector/Chroma)。
*   **来源**: `KGPipelineService` 提取的 4 层认知结构 (实体、关系、原则)。
*   **更新机制**: 增量合并 (Incremental Merge)，通过 LLM 识别新知识并融合到旧图谱中。

### 2.3 长期情节记忆 (Episodic Memory)
*   **定义**: 用户交互的历史事件、偏好、习惯和关键决策点。
*   **存储**: 时序数据库或日志型存储 (Elasticsearch / Log-structured Merge Tree)。
*   **结构**: `Event { timestamp, user_intent, ai_action, outcome, emotion_tag }`。
*   **归档**: 定期将低价值的日常对话归档到冷存储 (S3/OSS)，仅保留高价值情节（如用户明确表达的喜好）。

## 3. 记忆重要性评分算法

为了防止记忆库无限膨胀，引入 **Importance Score (IS)** 算法：

$$ IS = (Recency \times w_1) + (Frequency \times w_2) + (EmotionalValence \times w_3) $$

*   **Recency (时效性)**: 记忆产生的时间距离现在的衰减因子。
*   **Frequency (频率)**: 该记忆被检索或引用的次数。
*   **EmotionalValence (情感权重)**: 用户在交互中表现出的强烈情感（满意/愤怒/强调）会显著提高记忆权重。

**淘汰机制**:
*   设置系统阈值 $T_{evict}$。
*   定期扫描 IS < $T_{evict}$ 的记忆条目，将其标记为“遗忘”或移动到冷存储。

## 4. 隐私与安全 (GDPR/CCPA)

*   **记忆加密**: 所有存储在数据库中的记忆内容（Content）字段必须使用 AES-256 进行加密存储。
*   **遗忘权 (Right to be Forgotten)**: 提供 API `/api/memory/forget`，允许用户按时间段或主题彻底删除相关记忆（物理删除）。
*   **数据最小化**: 仅存储与知识生长相关的记忆，自动过滤 PII (个人敏感信息)。

## 5. 调试工具

开发 **Memory Debugger** (Web Admin Panel):
*   **可视化**: 以时间轴形式展示情节记忆，以力导向图展示语义记忆。
*   **溯源**: 查看某次 AI 回答引用了哪些具体的记忆片段 (Citation Trace)。
*   **干预**: 允许开发者或管理员手动修正错误的记忆关联。

## 6. 数据库 Schema 设计 (Draft)

```sql
CREATE TABLE memories (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    type VARCHAR(20) CHECK (type IN ('working', 'semantic', 'episodic')),
    content TEXT NOT NULL, -- Encrypted
    embedding VECTOR(1536),
    importance_score FLOAT DEFAULT 0.5,
    last_accessed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB -- Stores entity tags, source doc IDs, etc.
);

CREATE INDEX memory_embedding_idx ON memories USING hnsw (embedding vector_cosine_ops);
```
