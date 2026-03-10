# 移动端与Web端一致性差距分析报告

## 1. 概述
本报告对比了 Web 端（Backend Services）与移动端（App V2.0）在 Hi Brain 助手实现上的差异。目前发现两者存在**本质架构层面的断层**：Web 端已具备完整的 Agentic RAG 后端能力，而移动端仍停留在前端本地模拟阶段。

## 2. 核心差异对比表

| 特性 | Web 端 (Backend Services) | 移动端 (App V2.0) | 差异等级 |
| :--- | :--- | :--- | :--- |
| **核心架构** | **Agentic RAG** (Knowledge Graph Pipeline) | **Frontend Mock** (Regex + Local Search) | 🔴 **Critical** |
| **知识存储** | 结构化图谱 (Prisma/SQL) + 向量索引 | 本地 JSON 数组 (LocalStorage) | 🔴 **Critical** |
| **语义理解** | **Deep Semantic** (4-Layer Structure + LLM) | **Keyword Matching** (Regex) | 🔴 **Critical** |
| **搜索机制** | 向量相似度 (Embedding Cosine Similarity) | 字符串包含匹配 (`includes()`) | 🔴 **Critical** |
| **记忆持久化**| 数据库持久化，支持增量合并 | 仅会话级内存，刷新即失 (部分 LocalStorage) | 🟠 High |
| **知识生长** | 自动化流水线 (Extract -> Merge -> Mature) | 无 (仅 UI 展示概念) | 🟠 High |

## 3. 详细差距分析

### 3.1 架构断层
*   **Web 端**: 拥有独立的 `services` 层，包含 `KGPipelineService`、`EmbeddingService` 和 `LLMClient`。能够真正理解文档内容，构建实体关系，并进行跨文档的知识融合。
*   **移动端**: 逻辑完全封闭在 `HiBrain.tsx` 前端组件中。虽然 V2.0 增加了本地搜索，但其本质是遍历本地缓存的笔记列表，无法理解“为什么”或“怎么做”等深层问题，也无法处理大规模数据。

### 3.2 数据隔离与同步
*   **Web 端**: 数据存储在服务器端数据库 (SQLite/Prisma)，支持多端同步。
*   **移动端**: 严重依赖 `NoteContext` 中的本地状态。虽然已开始对接 API，但 Hi Brain 的搜索逻辑尚未接入后端的 RAG 接口，导致移动端无法利用服务器端强大的图谱能力。

### 3.3 智能程度
*   **Web 端**: 调用 Qwen-Plus 大模型，具备真正的推理和生成能力。
*   **移动端**: 使用预设的模板 (`AI_RESPONSES`) 和简单的规则判断。虽然 UI 体验（如粒子背景、动效）优于 Web 端，但“智商”远低于 Web 端。

## 4. 改进建议 (Roadmap)

为了消除一致性差距，建议采取以下步骤：

1.  **API 暴露**: 后端需将 `KGPipelineService` 的能力通过 RESTful API (如 `/api/hibrain/query`) 暴露给移动端。
2.  **移动端接入**: 废弃移动端 `HiBrain.tsx` 中的本地正则搜索逻辑，改为调用后端 RAG 接口。
3.  **离线能力**: 在移动端引入轻量级向量数据库 (如 SQLite-vec 或 Isar)，缓存用户的核心知识图谱，实现离线时的基础语义搜索（可选，视性能要求而定）。
4.  **统一配置**: 确保移动端和 Web 端共享相同的 `soul.md` 设定（已在 V2.0 中部分完成）。
