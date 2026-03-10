# 移动端 Flutter 3.0 重构技术方案

## 1. 重构背景与目标
基于《一致性差距分析报告》，为了实现移动端与 Web 端（后端）的深度融合，并解决当前 React/Capacitor 架构在高性能渲染和原生功能集成上的局限性，计划使用 Flutter 3.0 对 Hi Brain 助手 App 进行全量重构。

**核心目标**:
*   **功能一致性**: 100% 复刻 Web 端 RAG 能力。
*   **性能提升**: 启动速度 < 1s，列表滑动帧率稳定 60fps。
*   **架构解耦**: 采用 Clean Architecture，确保业务逻辑独立于 UI 框架。

## 2. 技术栈选型

*   **Framework**: Flutter 3.x (Dart)
*   **State Management**: BLoC (Business Logic Component) - 适合复杂的事件驱动型应用。
*   **Network**: Dio (支持拦截器、取消、缓存)。
*   **Local DB**: Isar (高性能 NoSQL) 或 SQLite (sqflite) + sqlite-vec (本地向量支持)。
*   **Dependency Injection**: GetIt + Injectable.
*   **Navigation**: GoRouter.

## 3. 模块架构设计 (Clean Architecture)

应用将严格分为三层：

### 3.1 Data Layer (数据层)
*   **Repositories**: 实现领域层定义的接口 (e.g., `NoteRepositoryImpl`, `MemoryRepositoryImpl`)。
*   **Data Sources**:
    *   *Remote*: Retrofit/Dio 客户端，对接 `KGPipelineService` API。
    *   *Local*: Isar 数据库，缓存笔记和离线图谱。
*   **Models**: DTO (Data Transfer Objects) 与 Entity 的转换。

### 3.2 Domain Layer (领域层) - **纯 Dart，无 Flutter 依赖**
*   **Entities**: 核心业务对象 (e.g., `Note`, `KnowledgeGraph`, `Memory`).
*   **Use Cases**: 业务逻辑封装 (e.g., `AskHiBrainUseCase`, `SyncNotesUseCase`).
*   **Interfaces**: Repository 接口定义。

### 3.3 Presentation Layer (表现层)
*   **BLoC**: 状态管理，处理 UI 事件，调用 Use Cases，发射 State。
*   **Pages/Widgets**: UI 组件。
    *   *HiBrainPage*: 聊天界面，集成粒子动效 (使用 `flutter_vfx` 或自定义 `CustomPainter`)。
    *   *GraphView*: 知识图谱可视化 (使用 `graphview` 库)。

## 4. 关键功能实现

### 4.1 离线模式与本地 RAG
*   **同步策略**: 首次启动全量拉取知识图谱摘要，增量更新。
*   **本地向量检索**: 集成 `sqlite-vec` 或使用 Dart 实现轻量级余弦相似度计算，在无网络环境下基于本地 Isar 数据库进行基础问答。

### 4.2 沉浸式 UI
*   使用 `SystemChrome.setSystemUIOverlayStyle` 实现全屏透明状态栏（替代当前的 Android XML 修改）。
*   利用 Flutter 的 Skia/Impeller 引擎绘制高性能的动态背景。

## 5. 迁移与兼容性
*   **协议兼容**: 保持与现有 Node.js 后端 API 协议完全一致。
*   **自动化测试**:
    *   Unit Tests (Domain/Data layers): 覆盖率 > 90%。
    *   Widget Tests: 关键 UI 组件交互。
    *   Integration Tests: 完整用户流程 (Patrol)。

## 6. 工程阶段分解
1.  **Phase 1 (基础框架)**: 搭建 Clean Architecture 骨架，配置 CI/CD。
2.  **Phase 2 (核心业务)**: 移植笔记 CRUD 功能，对接 API。
3.  **Phase 3 (Hi Brain)**: 实现聊天 UI，对接后端 RAG 接口，实现流式响应。
4.  **Phase 4 (性能/离线)**: 引入本地数据库和缓存，优化启动速度。
5.  **Phase 5 (UI Polish)**: 动效、主题、多端适配。
