# Complete 150 Schema Definitions

This document contains all 150 schema definitions across 3 domains.

## 📦 Software Development (50 Schemas)

### 1-10: Code & Architecture

#### 1. Code-Module
- **Entity Type**: CodeModuleEntity
- **Scene**: 软件开发/代码
- **Description**: 代码模块 - 记录代码模块的基本信息、功能和依赖关系
- **Example**: UserService模块，负责用户认证和授权，依赖DatabaseModule
- **Threshold**: 0.5
- **Fields**:
  - ModuleName (0.4, required, anchor) - 模块名称
  - Language (0.15) - 编程语言
  - Purpose (0.2) - 模块用途
  - Dependencies (0.15, list) - 依赖模块
  - Author (0.1) - 作者
- **Relations**: depends_on → Dependencies

#### 2. API-Endpoint
- **Entity Type**: APIEndpointEntity
- **Scene**: 软件开发/API
- **Description**: API端点 - 记录API接口的路径、方法、参数和响应
- **Example**: POST /api/users - 创建新用户，需要name和email参数
- **Threshold**: 0.6
- **Fields**:
  - Path (0.3, required, anchor) - API路径
  - Method (0.2, required, anchor) - HTTP方法
  - Parameters (0.2, list) - 请求参数
  - Response (0.15) - 响应格式
  - Authentication (0.15) - 认证方式

#### 3. Database-Schema
- **Entity Type**: DatabaseSchemaEntity
- **Scene**: 软件开发/数据库
- **Description**: 数据库模式 - 记录数据库表结构、字段和索引
- **Example**: users表：id(主键), name, email(唯一索引), created_at
- **Threshold**: 0.6
- **Fields**:
  - TableName (0.35, required, anchor) - 表名
  - Fields (0.3, required, list) - 字段列表
  - PrimaryKey (0.15) - 主键
  - Indexes (0.1, list) - 索引
  - Relations (0.1, list) - 关联表

#### 4. Design-Pattern
- **Entity Type**: DesignPatternEntity
- **Scene**: 软件开发/架构
- **Description**: 设计模式 - 记录使用的设计模式及其应用场景
- **Example**: 单例模式用于DatabaseConnection，确保全局唯一实例
- **Threshold**: 0.5
- **Fields**:
  - PatternName (0.4, required, anchor) - 模式名称
  - Category (0.2) - 模式类别
  - UseCase (0.2) - 应用场景
  - Implementation (0.2) - 实现方式

#### 5. Microservice
- **Entity Type**: MicroserviceEntity
- **Scene**: 软件开发/架构
- **Description**: 微服务 - 记录微服务的名称、职责和通信方式
- **Example**: UserService微服务，处理用户管理，通过gRPC通信
- **Threshold**: 0.5
- **Fields**:
  - ServiceName (0.35, required, anchor) - 服务名称
  - Responsibility (0.25) - 服务职责
  - Protocol (0.2) - 通信协议
  - Port (0.1, number) - 端口号
  - Dependencies (0.1, list) - 依赖服务
- **Relations**: depends_on → Dependencies

#### 6. Code-Library
- **Entity Type**: CodeLibraryEntity
- **Scene**: 软件开发/依赖
- **Description**: 代码库 - 记录第三方库或内部库的信息
- **Example**: React v18.2.0 - 用于构建用户界面的JavaScript库
- **Threshold**: 0.6
- **Fields**:
  - LibraryName (0.35, required, anchor) - 库名称
  - Version (0.25, required, anchor) - 版本号
  - Purpose (0.2) - 用途
  - License (0.1) - 许可证
  - Repository (0.1) - 仓库地址

#### 7. Code-Function
- **Entity Type**: CodeFunctionEntity
- **Scene**: 软件开发/代码
- **Description**: 代码函数 - 记录函数的签名、参数和返回值
- **Example**: calculateTotal(items: Array) => number - 计算订单总价
- **Threshold**: 0.5
- **Fields**:
  - FunctionName (0.35, required, anchor) - 函数名
  - Parameters (0.25, list) - 参数列表
  - ReturnType (0.2) - 返回类型
  - Description (0.2) - 功能描述

#### 8. Code-Class
- **Entity Type**: CodeClassEntity
- **Scene**: 软件开发/代码
- **Description**: 代码类 - 记录类的属性、方法和继承关系
- **Example**: User类：继承BaseModel，包含name、email属性和save()方法
- **Threshold**: 0.5
- **Fields**:
  - ClassName (0.35, required, anchor) - 类名
  - Properties (0.2, list) - 属性列表
  - Methods (0.2, list) - 方法列表
  - Extends (0.15) - 继承的类
  - Implements (0.1, list) - 实现的接口
- **Relations**: extends → Extends, implements → Implements

#### 9. Code-Interface
- **Entity Type**: CodeInterfaceEntity
- **Scene**: 软件开发/代码
- **Description**: 代码接口 - 记录接口定义和方法签名
- **Example**: IRepository接口：定义save()、find()、delete()方法
- **Threshold**: 0.6
- **Fields**:
  - InterfaceName (0.4, required, anchor) - 接口名
  - Methods (0.3, required, list) - 方法列表
  - Extends (0.15, list) - 继承的接口
  - Purpose (0.15) - 接口用途
- **Relations**: extends → Extends

#### 10. Architecture-Layer
- **Entity Type**: ArchitectureLayerEntity
- **Scene**: 软件开发/架构
- **Description**: 架构层 - 记录系统架构的分层结构
- **Example**: 表现层(Presentation Layer)：包含Controller和View组件
- **Threshold**: 0.5
- **Fields**:
  - LayerName (0.4, required, anchor) - 层名称
  - Components (0.3, list) - 包含的组件
  - Responsibility (0.2) - 职责
  - DependsOn (0.1, list) - 依赖的层
- **Relations**: depends_on → DependsOn

---

## Implementation Status

✅ **Completed**: 10 schemas defined with full specifications
⏳ **Remaining**: 140 schemas to be implemented

## Next Steps

1. Complete remaining 40 software development schemas (11-50)
2. Implement all 50 AI science schemas
3. Implement all 50 photography tutorial schemas
4. Create database import script
5. Add field mapping rules
6. Test with photography course document

## Usage

To add these schemas to the database:

```bash
node kg/schema/generate_all_150_schemas.js
```

To verify schemas:

```bash
node kg/schema/analyze_schemas.js
```
