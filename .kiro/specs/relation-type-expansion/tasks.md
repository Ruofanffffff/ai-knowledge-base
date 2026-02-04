# Implementation Plan: 关系类型扩充

## Overview

本实现计划将关系类型扩充功能分解为可执行的任务。实现将采用增量方式，先建立核心基础设施，然后逐步添加各领域的关系类型定义，最后进行集成和测试。

## Tasks

- [x] 1. 创建关系类型数据模型和核心类
  - [x] 1.1 定义RelationTypeDefinition数据结构
    - 创建 `kg/relation/relation_type_definition.js`
    - 定义关系类型的完整数据结构（包含所有元数据字段）
    - 添加类型验证辅助函数
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10_
  
  - [x] 1.2 编写RelationTypeDefinition的单元测试
    - 测试数据结构的创建和验证
    - 测试边界情况（空值、null、undefined）
    - _Requirements: 7.1-7.10_
  
  - [x] 1.3 创建RelationTypeRegistry类
    - 创建 `kg/relation/relation_type_registry.js`
    - 实现注册表的核心功能（register, get, has, getAll）
    - 实现索引机制（domainIndex, categoryIndex, entityTypeIndex）
    - _Requirements: 8.1, 8.2, 9.2_
  
  - [x] 1.4 编写RelationTypeRegistry的属性测试
    - **Property 2: 关系类型ID唯一性**
    - **Validates: Requirements 7.1**
    - **Property 9: 动态注册不影响现有数据**
    - **Validates: Requirements 9.2, 9.3**

- [x] 2. 实现关系类型加载器
  - [x] 2.1 创建RelationTypeLoader类
    - 创建 `kg/relation/relation_type_loader.js`
    - 实现从JSON文件加载关系类型定义
    - 实现定义的规范化和验证
    - 实现继承关系解析
    - _Requirements: 11.1, 11.2, 11.4_
  
  - [x] 2.2 编写RelationTypeLoader的属性测试
    - **Property 12: 配置文件加载幂等性**
    - **Validates: Requirements 11.2**
  
  - [x] 2.3 编写RelationTypeLoader的单元测试
    - 测试JSON文件加载
    - 测试继承关系解析
    - 测试错误处理
    - _Requirements: 11.1, 11.2_

- [x] 3. 创建关系类型定义文件
  - [x] 3.1 创建关系类型定义JSON文件
    - 创建 `kg/relation/relation_types.json`
    - 定义文件结构（domains, categories, types）
    - _Requirements: 8.1, 8.2_
  
  - [x] 3.2 定义生活领域关系类型
    - 添加家庭关系类型（6种）
    - 添加社交关系类型（4种）
    - 添加居住关系类型（3种）
    - 添加健康关系类型（4种）
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 3.3 定义工作领域关系类型
    - 添加雇佣关系类型（4种）
    - 添加协作关系类型（4种）
    - 添加汇报关系类型（3种）
    - 添加项目关系类型（4种）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [x] 3.4 定义旅行领域关系类型
    - 添加出行关系类型（4种）
    - 添加住宿关系类型（3种）
    - 添加景点关系类型（3种）
    - 添加路线关系类型（3种）
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [x] 3.5 定义购物领域关系类型
    - 添加购买关系类型（4种）
    - 添加支付关系类型（3种）
    - 添加配送关系类型（3种）
    - 添加评价关系类型（3种）
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [x] 3.6 定义政务领域关系类型
    - 添加审批关系类型（4种）
    - 添加监管关系类型（4种）
    - 添加服务关系类型（4种）
    - 添加政策关系类型（4种）
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [x] 3.7 定义管理领域关系类型
    - 添加决策关系类型（4种）
    - 添加执行关系类型（4种）
    - 添加监督关系类型（4种）
    - 添加资源分配关系类型（4种）
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [x] 3.8 编写关系类型定义的验证测试
    - 验证所有领域的关系类型数量
    - 验证关系类型元数据完整性
    - **Property 1: 关系类型元数据完整性**
    - **Validates: Requirements 7.1-7.10**
    - **Property 3: 领域分类一致性**
    - **Validates: Requirements 8.1**

- [x] 4. 实现关系类型验证器
  - [x] 4.1 创建RelationTypeValidator类
    - 创建 `kg/relation/relation_type_validator.js`
    - 实现关系实例验证逻辑
    - 实现实体类型约束验证
    - 实现置信度和时间戳验证
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_
  
  - [x] 4.2 编写RelationTypeValidator的属性测试
    - **Property 4: 实体类型约束验证**
    - **Validates: Requirements 10.1**
    - **Property 5: 目标实体类型约束验证**
    - **Validates: Requirements 10.2**
    - **Property 6: 置信度范围验证**
    - **Validates: Requirements 10.4**
    - **Property 11: 验证错误信息清晰性**
    - **Validates: Requirements 10.6**
  
  - [x] 4.3 编写RelationTypeValidator的单元测试
    - 测试各种验证场景
    - 测试错误信息格式
    - _Requirements: 10.1-10.6_

- [x] 5. 实现关系类型查询器
  - [x] 5.1 创建RelationTypeQuery类
    - 创建 `kg/relation/relation_type_query.js`
    - 实现按领域查询
    - 实现按分类查询
    - 实现按实体类型查询
    - 实现关键词搜索
    - 实现层次结构查询
    - _Requirements: 8.4, 8.5_
  
  - [x] 5.2 编写RelationTypeQuery的属性测试
    - **Property 7: 查询过滤器正确性**
    - **Validates: Requirements 8.4**
    - **Property 8: 实体类型过滤器正确性**
    - **Validates: Requirements 8.5**
  
  - [x] 5.3 编写RelationTypeQuery的单元测试
    - 测试各种查询场景
    - 测试边界情况
    - _Requirements: 8.4, 8.5_

- [x] 6. Checkpoint - 核心功能验证
  - 确保所有核心类的测试通过
  - 验证关系类型定义文件的完整性
  - 如有问题，请向用户反馈

- [x] 7. 数据库Schema扩展
  - [x] 7.1 更新Prisma schema
    - 在 `prisma/schema.prisma` 中添加RelationType模型
    - 定义所有必需字段和索引
    - _Requirements: 9.6_
  
  - [x] 7.2 生成数据库迁移
    - 运行 `npx prisma migrate dev --name add-relation-types`
    - 验证迁移文件
    - _Requirements: 9.5_
  
  - [x] 7.3 创建关系类型数据库操作模块
    - 创建 `kg/relation/relation_type_store.js`
    - 实现CRUD操作
    - 实现查询和过滤功能
    - _Requirements: 9.2, 9.4_

- [x] 8. 与现有系统集成
  - [x] 8.1 扩展builtin_relation_builder
    - 修改 `kg/relation/builtin_relation_builder.js`
    - 在构建关系时验证关系类型
    - 支持新的关系类型ID
    - _Requirements: 9.1, 9.3, 9.6_
  
  - [x] 8.2 扩展relation_store
    - 修改 `kg/relation/relation_store.js`
    - 在保存关系时验证关系类型
    - 添加按关系类型查询的方法
    - _Requirements: 9.1, 9.3_
  
  - [x] 8.3 扩展schema_manager
    - 修改 `kg/schema/schema_manager.js`
    - 在验证schema时检查关系类型有效性
    - 提供关系类型的自动补全建议
    - _Requirements: 9.6_
  
  - [x] 8.4 编写集成测试
    - 测试与builtin_relation_builder的集成
    - 测试与relation_store的集成
    - 测试与schema_manager的集成
    - 测试向后兼容性
    - _Requirements: 9.1, 9.3, 9.6_

- [x] 9. 创建初始化和管理工具
  - [x] 9.1 创建关系类型初始化脚本
    - 创建 `kg/relation/init_relation_types.js`
    - 从JSON文件加载关系类型到数据库
    - 支持增量更新
    - _Requirements: 11.2, 11.3_
  
  - [x] 9.2 创建关系类型管理API
    - 在 `routes/knowledgeGraphRoutes.js` 中添加关系类型相关路由
    - 实现GET /api/kg/relation-types（查询关系类型）
    - 实现POST /api/kg/relation-types（注册新关系类型）
    - 实现GET /api/kg/relation-types/:id（获取单个关系类型）
    - 实现GET /api/kg/relation-types/stats（获取统计信息）
    - _Requirements: 11.3, 12.5_
  
  - [x] 9.3 编写API测试
    - 测试所有API端点
    - 测试权限控制
    - 测试错误处理
    - _Requirements: 11.3_

- [x] 10. 创建文档和示例
  - [x] 10.1 创建关系类型使用文档
    - 创建 `kg/relation/RELATION_TYPES.md`
    - 说明每个领域的关系类型
    - 提供使用示例
    - _Requirements: 12.1, 12.2, 12.3_
  
  - [x] 10.2 创建API文档
    - 更新 `kg/API.md`
    - 添加关系类型相关API说明
    - _Requirements: 12.3_
  
  - [x] 10.3 创建示例代码
    - 创建 `kg/relation/relation_types_example.js`
    - 展示如何使用关系类型API
    - 展示如何创建和验证关系
    - _Requirements: 12.1_

- [x] 11. 最终集成测试和验证
  - [x] 11.1 运行完整的属性测试套件
    - 运行所有属性测试（最少100次迭代）
    - 验证所有正确性属性
    - _Requirements: All_
  
  - [x] 11.2 运行端到端测试
    - 测试完整的关系创建流程
    - 测试查询和过滤功能
    - 测试与现有功能的兼容性
    - _Requirements: 9.1, 9.3_
  
  - [x] 11.3 性能测试
    - 测试大量关系类型的加载性能
    - 测试查询性能
    - 优化索引和缓存
    - _Requirements: 11.6_

- [x] 12. Final Checkpoint - 确保所有测试通过
  - 确保所有单元测试通过
  - 确保所有属性测试通过
  - 确保所有集成测试通过
  - 如有问题，请向用户反馈

## Notes

- 所有任务都是必需的，确保从一开始就有全面的测试覆盖
- 每个任务都引用了具体的需求编号，便于追溯
- 属性测试验证通用正确性属性
- 单元测试验证具体示例和边界情况
- 集成测试确保与现有系统的兼容性
- Checkpoint任务确保增量验证
