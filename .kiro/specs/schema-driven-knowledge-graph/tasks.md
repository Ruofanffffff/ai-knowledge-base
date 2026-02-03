# Tasks

## Phase 1: 基础架构和 CKB 层 (Week 1)

- [x] 1. 项目结构搭建
  - [x] 1.1 创建 `kg/` 目录结构
  - [x] 1.2 配置 Prisma schema,添加 KG 相关表
  - [x] 1.3 运行数据库迁移
  - [x] 1.4 创建 KG 模块入口文件 `kg/index.js`

- [x] 2. CKB Parser 实现
  - [x] 2.1 实现 Word 文档解析器 (`kg/ckb/parsers/word_parser.js`)
  - [x] 2.2 实现 PDF 文档解析器 (`kg/ckb/parsers/pdf_parser.js`)
  - [x] 2.3 实现 Excel 文档解析器 (`kg/ckb/parsers/excel_parser.js`)
  - [x] 2.4 实现 CKB 存储模块 (`kg/ckb/ckb_store.js`)
  - [x] 2.5 编写 CKB Parser 单元测试
  - [x] 2.6 编写 Property 1 测试 (CKB Parsing Completeness)

- [x] 3. CKB API 端点
  - [x] 3.1 实现 POST `/api/knowledge-graph/ckb/parse` 接口
  - [x] 3.2 实现 GET `/api/knowledge-graph/ckb/:id` 接口
  - [x] 3.3 实现 GET `/api/knowledge-graph/ckb/document/:docId` 接口
  - [x] 3.4 编写 API 集成测试

## Phase 2: 字段抽取和 Schema 匹配 (Week 2)

- [x] 4. 字段抽取模块
  - [x] 4.1 实现规则抽取器 (`kg/field_extractor/rule_extractor.js`)
  - [x] 4.2 实现 NER 抽取器 (`kg/field_extractor/ner_extractor.js`)
  - [x] 4.3 实现 LLM 抽取器 (`kg/field_extractor/llm_extractor.js`)
  - [x] 4.4 实现字段抽取主逻辑 (`kg/field_extractor/field_extractor.js`)
  - [x] 4.5 编写字段抽取单元测试
  - [x] 4.6 编写 Property 4, 5, 6 测试

- [x] 5. Prompt 模块
  - [x] 5.1 创建 Prompt 1: CKB → 字段抽取 (`kg/prompts/extract_fields.js`)
  - [x] 5.2 创建 Prompt 2: 字段 → Schema 触发判断 (`kg/prompts/schema_score.js`)
  - [x] 5.3 创建 Prompt 3: Schema → 实体实例化 (`kg/prompts/entity_build.js`)
  - [x] 5.4 创建 Prompt 4: 语义关系候选抽取 (`kg/prompts/relation_candidate.js`)

- [x] 6. Schema 管理模块
  - [x] 6.1 实现 Schema Manager (`kg/schema/schema_manager.js`)
  - [x] 6.2 实现 Schema Matcher (`kg/schema/schema_matcher.js`)
  - [x] 6.3 实现 Schema Loader (`kg/schema/schema_loader.js`)
    - 解析 SchemaList.md 文件
    - 转换为 Schema JSON 格式
    - 批量导入到数据库
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7_
  - [x] 6.4 更新 Schema 数据模型
    - 添加 scene、example_description、description、active 字段
    - 更新数据库迁移脚本
    - _Requirements: 17.1, 3.1_
  - [x] 6.5 创建默认 Schema 定义 (地下水位变化事件等)
  - [x] 6.6 从 SchemaList.md 导入 250 个 Schema
    - 运行 Schema Loader
    - 验证导入结果
    - _Requirements: 17.1, 17.9_
  - [x] 6.6.1 增强 Schema 导入功能
    - 添加导入进度显示
    - 添加详细错误日志记录
    - 添加导入结果验证(确保 250 个 Schema)
    - 添加自动重试机制
    - _Requirements: 17.16, 17.17, 17.18_
  - [x] 6.6.2 实现系统启动时 Schema 自动检查
    - 检查数据库中 Schema 数量
    - 如不足 250 个则自动重新导入
    - 触发告警通知
    - _Requirements: 17.19, 17.20_
  - [x] 6.7 编写 Schema 单元测试
  - [x] 6.8 编写 Property 7, 8 测试

- [x] 7. 字段清洗模块
  - [x] 7.1 实现字段清洗主逻辑 (`kg/field_normalizer/field_normalizer.js`)
    - 实现 normalizeFields 方法
    - 实现完整的 4 层映射策略
    - _Requirements: 18.1_
  - [x] 7.2 实现算法映射器 (`kg/field_normalizer/algorithm_mapper.js`)
    - 实现精确匹配
    - 实现字符串相似度算法(编辑距离 + 余弦相似度)
    - 创建初始同义词词典文件 (`synonym_dict.json`)
    - 实现同义词词典映射
    - 实现同义词词典管理类 (`synonym_dict.js`)
    - _Requirements: 18.2, 18.3_
  - [x] 7.3 实现 LLM 映射器 (`kg/field_normalizer/llm_mapper.js`)
    - 实现 LLM 字段映射(50% 概率)
    - 实现批量处理优化
    - _Requirements: 18.5, 18.6, 18.12_
  - [x] 7.4 实现字段值清洗器 (`kg/field_normalizer/field_cleaner.js`)
    - 实现去噪逻辑
    - 实现时间标准化
    - 实现数值标准化
    - _Requirements: 18.4, 18.9_
  - [x] 7.5 实现映射缓存机制
    - 缓存映射结果
    - 避免重复 LLM 调用
    - 实现同义词词典动态扩充(可选)
    - 从 LLM 映射结果中学习新同义词
    - _Requirements: 18.8_
  - [x] 7.6 创建 Prompt 5: 字段名称映射 (`kg/prompts/field_mapping.js`)
    - 设计 LLM Prompt
    - 包含上下文和约束
    - _Requirements: 18.6_
  - [x] 7.7 编写字段清洗单元测试
    - 测试精确匹配
    - 测试相似度算法
    - 测试同义词映射
    - 测试 LLM 映射
    - _Requirements: 18.1-18.15_
  - [x] 7.8 编写 Property 测试: 字段映射准确性
    - **Property 29: 字段映射一致性**
    - **Validates: Requirements 18.1, 18.2, 18.3**
  - [x] 7.9 编写 Property 测试: Token 控制
    - **Property 30: 字段清洗 Token 最小化**
    - **Validates: Requirements 18.5, 18.12, 18.14**
  - [x] 7.10 实现智能字段截断策略
    - 创建 `kg/field_normalizer/intelligent_truncating.js` 模块
    - 实现字段重要性评分函数 (`calculateFieldImportance`)
    - 实现语义相关性评分函数 (`calculateSemanticRelevance`)
    - 实现上下文相关性评分函数 (`calculateContextRelevance`)
    - 实现综合评分和字段选择函数 (`selectRelevantFields`)
    - 实现场景自适应策略函数 (`adaptTruncatingStrategy`)
    - 创建语义类别定义模块 (`kg/field_normalizer/semantic_categories.js`)
    - 集成到 `field_normalizer.js` 的 `llmMatch` 函数
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10, 19.11_
  - [x] 7.11 编写智能截断单元测试
    - 测试字段重要性评分准确性
    - 测试语义相关性评分准确性
    - 测试上下文相关性评分准确性
    - 测试综合评分计算
    - 测试字段选择逻辑(至少前N个、得分阈值、最大数量)
    - 测试场景自适应策略(科研/政府、个人生活、摄影等)
    - 测试 LLM Prompt 构建
    - 测试截断信息记录
    - _Requirements: 19.1-19.15_
  - [x] 7.12 编写智能截断 Property 测试
    - **Property 29: Intelligent Field Truncating Effectiveness**
      - 验证选中字段数 ≤ maxFields
      - 验证所有选中字段得分 ≥ minScore 或在 top N 中
    - **Property 30: Field Truncating Token Savings**
      - 验证 Token 节省率 ≥ 40% (当 schema 字段数 > 5)
    - **Property 31: Field Truncating Scene Adaptation**
      - 验证科研/政府场景 maxFields ≥ 6
      - 验证个人生活场景 maxFields ≤ 4
      - 验证摄影场景 maxFields ≥ 7
    - **Property 32: Field Selection Score Calculation**
      - 验证综合得分计算公式正确性
      - 验证各维度得分范围正确
    - **Validates: Requirements 19.1-19.15**
  - [x] 7.13 增强字段多样性支持
    - [x] 7.13.1 实现模糊匹配和语义推断 (`fuzzySemanticMatch`)
      - 基于字段类型的语义推断
      - 基于上下文的模糊匹配
      - 基于字段值的推断
      - _Requirements: 18.16, 18.17_
    - [x] 7.13.2 实现映射建议功能 (`suggestMapping`)
      - 计算相似度并排序
      - 返回前 3 个建议
      - 支持人工确认
      - _Requirements: 18.20_
    - [x] 7.13.3 实现字段分布统计
      - 记录未映射字段名称
      - 统计字段出现频率
      - 识别高频未映射字段
      - _Requirements: 18.19_
    - [x] 7.13.4 实现映射失败率监控
      - 计算映射失败率
      - 失败率超过 20% 时触发告警
      - 自动触发同义词词典扩充
      - _Requirements: 18.18_
    - [x] 7.13.5 实现动态映射策略调整
      - 根据文档上下文调整策略
      - 根据 Schema 场景调整策略
      - 记录策略调整日志
      - _Requirements: 18.17_
  - [x] 7.14 编写字段多样性单元测试
    - 测试模糊匹配准确性
    - 测试语义推断逻辑
    - 测试映射建议功能
    - 测试字段分布统计
    - 测试失败率监控
    - _Requirements: 18.16-18.20_

- [x] 8. Schema API 端点
  - [x] 8.1 实现 GET `/api/knowledge-graph/schemas` 接口
    - 支持按 scene 筛选
    - 支持按 active 筛选
    - _Requirements: 17.8, 3.12_
  - [x] 8.2 实现 POST `/api/knowledge-graph/schemas` 接口
  - [x] 8.3 实现 PUT `/api/knowledge-graph/schemas/:id` 接口
    - 支持版本控制
    - _Requirements: 17.10_
  - [x] 8.4 实现 DELETE `/api/knowledge-graph/schemas/:id` 接口
    - 检查实体依赖
    - _Requirements: 17.13_
  - [x] 8.5 实现 POST `/api/knowledge-graph/schemas/import` 接口
    - 从 SchemaList.md 导入
    - 支持增量导入
    - _Requirements: 17.15_
  - [x] 8.6 实现 GET `/api/knowledge-graph/schemas/export` 接口
    - 导出为 JSON 或 CSV
    - _Requirements: 17.14_
  - [x] 8.7 实现 PUT `/api/knowledge-graph/schemas/:id/enable` 接口
    - 启用 Schema
    - _Requirements: 17.12_
  - [x] 8.8 实现 PUT `/api/knowledge-graph/schemas/:id/disable` 接口
    - 禁用 Schema
    - _Requirements: 17.11_

## Phase 3: 实体构建 (Week 3)

- [x] 9. 实体构建模块 (增强版)
  - [x] 9.1 实现规范名称生成 (规则 + 50% LLM)
  - [x] 9.2 实现实体合并逻辑 (30% LLM 消歧)
  - [x] 9.3 实现实体属性增强 (LLM 提取隐含信息)
  - [x] 9.4 实现批量实体消歧
  - [x] 9.5 实现实体存储模块 (`kg/entity/entity_store.js`)
  - [x] 9.6 编写实体构建单元测试
  - [x] 9.7 编写 Property 9, 10, 11 测试

- [x] 10. 实体 API 端点
  - [x] 10.1 实现 GET `/api/knowledge-graph/entities` 接口
  - [x] 10.2 实现 GET `/api/knowledge-graph/entities/:id` 接口
  - [x] 10.3 实现 GET `/api/knowledge-graph/entities/search` 接口

## Phase 4: 关系构建 (Week 4)

- [x] 11. 内建关系构建器
  - [x] 11.1 实现内建关系生成逻辑 (`kg/relation/builtin_relation_builder.js`)
  - [x] 11.2 编写内建关系单元测试
  - [x] 11.3 编写 Property 12, 13 测试

- [x] 12. 共现关系构建器
  - [x] 12.1 实现共现关系统计逻辑 (`kg/relation/cooccurrence_relation_builder.js`)
  - [x] 12.2 编写共现关系单元测试
  - [x] 12.3 编写 Property 14, 15 测试

- [x] 13. 语义关系构建器 (增强版)
  - [x] 13.1 实现分层触发逻辑 (高优先级 30% + 随机采样 20%)
  - [x] 13.2 实现增强 Prompt 和三轮验证
  - [x] 13.3 实现批量处理优化
  - [x] 13.4 实现关系类型丰富化
  - [x] 13.5 编写语义关系单元测试
  - [x] 13.6 编写 Property 16 测试

- [x] 14. 关系存储和 API
  - [x] 14.1 实现关系存储模块 (`kg/relation/relation_store.js`)
  - [x] 14.2 实现 GET `/api/knowledge-graph/relations` 接口
  - [x] 14.3 实现 GET `/api/knowledge-graph/relations/:id` 接口

## Phase 5: 置信度和质量管理 (Week 5)

- [x] 15. 置信度引擎
  - [x] 15.1 实现实体置信度计算 (`kg/confidence/confidence_engine.js`)
  - [x] 15.2 实现关系置信度计算
  - [x] 15.3 实现置信度级联更新
  - [x] 15.4 编写置信度引擎单元测试
  - [x] 15.5 编写 Property 17, 18, 19 测试

- [x] 16. 质量过滤器
  - [x] 16.1 实现低质量数据过滤 (`kg/confidence/quality_filter.js`)
  - [x] 16.2 实现冲突消解机制
  - [x] 16.3 编写质量过滤器单元测试

## Phase 6: 图遍历和查询 (Week 6)

- [x] 17. 图遍历实现
  - [x] 17.1 实现图遍历算法 (BFS/DFS)
  - [x] 17.2 实现 POST `/api/knowledge-graph/traverse` 接口
  - [x] 17.2.1 实现 GET `/api/knowledge-graph/neighbors/:id` 接口
  - [x] 17.2.2 实现 GET `/api/knowledge-graph/path/:sourceId/:targetId` 接口
  - [x] 17.2.3 实现 GET `/api/knowledge-graph/subgraph/:id` 接口
  - [x] 17.3 编写图遍历单元测试
  - [x] 17.4 编写 Property 20 测试

- [x] 18. 知识图谱构建服务
  - [x] 18.1 实现 KG 构建主流程 (`kg/services/kg_service.js`)
  - [x] 18.2 实现增量更新逻辑
  - [x] 18.3 实现全量重建逻辑
  - [x] 18.4 编写 Property 21, 22 测试

- [x] 19. KG 构建 API
  - [x] 19.1 实现 POST `/api/knowledge-graph/build` 接口
  - [x] 19.2 实现 POST `/api/knowledge-graph/rebuild` 接口
  - [x] 19.3 实现 POST `/api/knowledge-graph/update` 接口
  - [x] 19.4 实现 DELETE `/api/knowledge-graph/document/:docId` 接口

## Phase 7: Token 优化和统计 (Week 7)

- [x] 20. Token 使用记录
  - [x] 20.1 实现 Token 使用记录模块 (`kg/utils/token_tracker.js`)
  - [x] 20.2 在所有 LLM 调用点添加 Token 记录
  - [x] 20.3 实现 Token 统计 API
    - [x] 20.3.1 实现 GET `/api/knowledge-graph/stats/tokens` 接口
    - [x] 20.3.2 实现 GET `/api/knowledge-graph/stats/tokens/timeseries` 接口
    - [x] 20.3.3 实现 GET `/api/knowledge-graph/stats/tokens/budget` 接口
    - [x] 20.3.4 实现 GET `/api/knowledge-graph/stats/tokens/recommendations` 接口
    - [x] 20.3.5 实现 GET `/api/knowledge-graph/stats/quality` 接口
  - [x] 20.4 编写 Property 23, 24, 25 测试

- [x] 21. LLM 缓存机制
  - [x] 21.1 实现 LLM 响应缓存 (`kg/utils/llm_cache.js`)
  - [x] 21.2 实现缓存失效策略
  - [x] 21.3 编写缓存单元测试

- [x] 22. Token 预算管理
  - [x] 22.1 实现每日 Token 限额检查
  - [x] 22.2 实现 Token 超限告警
  - [x] 22.3 实现动态调整 LLM 调用频率

- [x] 23. 同义词词典智能生成和管理
  - [x] 23.1 实现 LLM 同义词生成器 (`kg/field_normalizer/synonym_generator.js`)
    - 实现初始化生成功能
    - 覆盖工作、科研、生活、旅行、政务、网信工作等领域
    - 每个标准字段生成 5-10 个同义词
    - _Requirements: 20.1, 20.2_
  - [x] 23.2 实现领域扩展生成
    - 针对特定领域生成专业术语
    - 包含领域特定表达
    - 包含口语化、缩写、中英文混合
    - _Requirements: 20.3, 20.4, 20.5, 20.6_
  - [x] 23.3 实现自动学习和扩充
    - 从未映射字段中学习
    - 从 LLM 映射结果中学习
    - 批量生成新同义词
    - _Requirements: 20.8, 20.9, 20.10_
  - [x] 23.4 实现同义词词典质量评估
    - 使用测试集评估覆盖率
    - 计算映射准确率
    - 验证覆盖率达到 90% 以上
    - _Requirements: 20.7, 20.17, 20.18_
  - [x] 23.5 实现同义词词典管理功能
    - 支持版本控制和回退
    - 支持按领域筛选
    - 支持导入导出 JSON
    - 支持冲突消歧
    - _Requirements: 20.11, 20.12, 20.13, 20.14, 20.15, 20.16_
  - [x] 23.6 实现同义词词典性能优化
    - 使用索引优化查询
    - 确保 O(1) 查找
    - 记录命中率统计
    - _Requirements: 20.19, 20.20_
  - [x] 23.7 编写同义词词典单元测试
    - 测试生成功能
    - 测试学习功能
    - 测试质量评估
    - 测试管理功能
    - _Requirements: 20.1-20.20_

- [x] 24. 性能和成本约束管理
  - [x] 24.1 实现性能监控模块 (`kg/utils/performance_monitor.js`)
    - 实现本地处理时间监控 (< 1s)
    - 实现 LLM 调用超时控制 (5-10s)
    - 实现总时延监控 (< 30s)
    - 记录性能指标到数据库
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5_
  - [x] 24.2 实现 Token 预算管理器 (`kg/utils/token_budget_manager.js`)
    - 实现每日 Token 限额检查
    - 实现单文档 Token 限额检查
    - 实现预算告警机制 (80% 预警, 100% 告警)
    - 实现紧急模式 (降低 LLM 调用频率)
    - _Requirements: 21.6, 21.7, 21.8, 21.9_
  - [x] 24.3 实现性能监控面板
    - 实现实时指标收集
    - 实现健康评分计算
    - 实现性能统计 API
    - _Requirements: 21.10_
  - [x] 24.4 实现自动性能优化器 (`kg/utils/performance_optimizer.js`)
    - 实现性能瓶颈识别
    - 实现优化建议生成
    - 实现自动优化应用
    - _Requirements: 21.11_
  - [x] 24.5 实现数据库查询优化
    - 记录慢查询日志 (> 500ms)
    - 优化索引
    - _Requirements: 21.12_
  - [x] 24.6 实现内存和队列管理
    - 实现内存占用监控
    - 实现队列积压监控
    - 实现限流和降级
    - _Requirements: 21.13, 21.14, 21.15, 21.18_
  - [x] 24.7 实现缓存优化
    - 实现缓存过期时间管理
    - 实现缓存命中率统计
    - 优化缓存策略
    - _Requirements: 21.16, 21.17_
  - [x] 24.8 实现成本效益分析
    - 计算每文档平均 Token 成本
    - 计算每文档平均处理时间
    - 提供优化建议
    - _Requirements: 21.19, 21.20_
  - [x] 24.9 编写性能管理单元测试
    - 测试性能监控功能
    - 测试 Token 预算管理
    - 测试自动优化功能
    - _Requirements: 21.1-21.20_

## Phase 7: Token 优化和统计 (Week 7) - 原有内容保留

## Phase 8: 前端可视化 (Week 8)

- [x] 23. Schema KG 视图组件
  - [x] 23.1 创建 SchemaKG.tsx 组件
  - [x] 23.2 实现力导向图布局 (使用 D3.js 或 G6)
  - [x] 23.3 实现实体节点渲染 (按类型着色)
  - [x] 23.4 实现关系边渲染 (按类型和权重)
  - [x] 23.5 编写 Property 27, 28 测试

- [x] 24. 交互功能
  - [x] 24.1 实现节点点击事件 (显示实体详情)
  - [x] 24.2 实现边点击事件 (显示关系详情)
  - [x] 24.3 实现实体搜索和高亮
  - [x] 24.4 实现置信度过滤器
  - [x] 24.5 实现关系类型过滤器

- [x] 25. CKB 浏览器组件
  - [x] 25.1 创建 CKBExplorer.tsx 组件
  - [x] 25.2 实现 CKB 列表展示
  - [x] 25.3 实现 CKB 详情面板
  - [x] 25.4 实现 CKB 到源文档的跳转

## Phase 9: 项目集成 (Week 9)

- [x] 26. 文档操作钩子
  - [x] 26.1 在文档创建后触发 KG 构建
  - [x] 26.2 在文档更新后触发 KG 增量更新
  - [x] 26.3 在文档删除后触发 KG 清理
  - [x] 26.4 编写集成测试

- [x] 27. 路由集成
  - [x] 27.1 创建 knowledgeGraphRoutes.js
  - [x] 27.2 在 server.js 中注册 KG 路由
  - [x] 27.3 在前端添加 KG 页面路由

- [x] 28. 环境配置
  - [x] 28.1 更新 .env.example
  - [x] 28.2 添加 KG 相关环境变量
  - [x] 28.3 更新配置文档

## Phase 10: 测试和文档 (Week 10)

- [x] 29. 测试完善
  - [x] 29.1 确保单元测试覆盖率 ≥ 80%
  - [x] 29.2 确保所有 32 个属性测试通过 (包含 Property 29-32: 智能字段截断)
  - [x] 29.3 编写 API 集成测试
  - [x] 29.4 编写端到端测试

- [x] 30. 性能测试
  - [x] 30.1 测试单文档处理时间 (目标 < 5s)
  - [x] 30.2 测试 Schema 匹配性能 (目标 < 1s)
  - [x] 30.3 测试图查询性能 (目标 < 1s)
  - [x] 30.4 测试并发处理能力

- [x] 31. 文档编写
  - [x] 31.1 编写 KG 模块 README
  - [x] 31.2 编写架构设计文档
  - [x] 31.3 编写 Schema 定义指南
  - [x] 31.4 编写 API 参考文档
  - [x] 31.5 编写部署指南
  - [x] 31.6 更新项目主 README

## Phase 11: GitHub 部署 (Week 11)

- [x] 32. CI/CD 配置
  - [x] 32.1 创建 GitHub Actions 工作流
  - [x] 32.2 配置自动化测试
  - [x] 32.3 配置代码覆盖率报告
  - [x] 32.4 配置 Token 使用检查

- [x] 33. 发布准备
  - [x] 33.1 创建 PR 模板
  - [x] 33.2 更新 CHANGELOG
  - [x] 33.3 创建 release 分支
  - [x] 33.4 打版本标签
  - [x] 33.5 创建 GitHub Release

- [x] 34. 部署检查
  - [x] 34.1 验证数据库迁移
  - [x] 34.2 验证环境变量配置
  - [x] 34.3 验证 API 端点
  - [x] 34.4 验证前端页面
  - [x] 34.5 验证 Token 消耗在预算内
