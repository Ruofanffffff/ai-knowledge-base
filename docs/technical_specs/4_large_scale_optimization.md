# 大规模思库性能优化方案

## 1. 概述
针对单用户思库数据量 >10GB 的场景，传统的全量向量检索将面临严重的性能瓶颈。本方案通过分层索引、动态摘要和边缘缓存等技术，确保系统在 P99 < 500ms 的响应时间内处理大规模查询。

## 2. 分层索引架构 (Tiered Indexing)

建立三级索引体系，逐层过滤，减少计算量：

1.  **Level 1: 元数据索引 (Metadata Index)**
    *   **机制**: 基于 SQL 的精确匹配（时间范围、标签、文档类型）。
    *   **作用**: 快速过滤掉 90% 的无关文档。
    *   **实现**: B-Tree 索引 (SQLite/Postgres)。

2.  **Level 2: 语义向量索引 (Semantic Vector Index)**
    *   **机制**: 基于 HNSW (Hierarchical Navigable Small World) 算法的近似最近邻搜索 (ANN)。
    *   **优化**: 使用 Product Quantization (PQ) 对向量进行压缩，减少内存占用。
    *   **作用**: 在剩余文档中召回 Top-K 相关片段。

3.  **Level 3: 全文索引 (Full-Text Index)**
    *   **机制**: BM25 算法 (倒排索引)。
    *   **作用**: 弥补向量检索在精确关键词（如人名、特定术语）匹配上的不足，与向量检索结果进行 RRF (Reciprocal Rank Fusion) 融合。

## 3. 动态摘要与上下文压缩

为了解决 RAG 上下文窗口限制（Token 消耗优化）：

*   **动态摘要 (Dynamic Summarization)**:
    *   对检索到的长文档片段，不直接送入 LLM，而是先通过小模型 (如 Qwen-7B-Int4) 生成针对当前 Query 的微摘要。
    *   目标压缩率: > 80%。

*   **LongNet / Token Optimization**:
    *   参考 Microsoft LongNet 架构，采用 Dilated Attention 机制处理超长上下文（如需自研模型）。
    *   **当前工程落地**: 采用 "Sliding Window" + "Summary Hierarchy" 策略。即只保留最近对话的详细 Token，远期对话仅保留高级摘要。

## 4. 查询路由 (Query Routing)

建立 **领域专家模型 (Domain Expert Router)**：

*   **机制**: 在查询前置一个轻量级分类器 (Classifier)。
*   **逻辑**:
    *   如果 Query 是 "查一下昨天的会议记录" -> 路由到 SQL 元数据查询。
    *   如果 Query 是 "分析一下近期的市场趋势" -> 路由到 向量检索 + 深度总结。
    *   如果 Query 是 "你好" -> 路由到 闲聊模块 (无需 RAG)。
*   **收益**: 避免不必要的 RAG 检索，降低 Token 消耗 60% 以上。

## 5. 边缘缓存 (Edge Caching)

*   **CDN 加速**: 对静态的文档资源、图片进行 CDN 缓存。
*   **Local Vector Cache**: 在移动端 (Flutter) 本地构建小型的向量索引 (使用 `sqlite-vec`)，缓存用户最高频访问的 1000 条知识点。
    *   命中本地缓存时，响应时间 < 50ms。
    *   未命中时才请求云端。

## 6. 性能基准测试体系

*   **工具**: Locust / JMeter。
*   **指标**:
    *   **Latency**: P99 < 500ms (端到端)。
    *   **Throughput**: 支持 100 QPS (单节点)。
    *   **Token Cost**: 单轮对话平均 Token 消耗 < 500 (通过压缩和路由优化)。
