# Implementation Plan: File Upload Deduplication

## Overview

本实现计划将文件上传去重功能分解为可执行的编码任务。实现将分为四个主要阶段：数据库迁移、后端服务实现、前端组件开发和集成测试。每个任务都包含具体的实现步骤和需求引用。

## Tasks

- [ ] 1. 数据库 Schema 更新和迁移
  - [x] 1.1 创建数据库迁移脚本
    - 在 `database/` 目录创建 `migrateDocumentsTable.js`
    - 添加 `hash VARCHAR(64)` 列到 documents 表
    - 添加 `size INTEGER` 列到 documents 表
    - 创建索引：`CREATE INDEX idx_documents_hash ON documents(hash)`
    - 创建索引：`CREATE INDEX idx_documents_user_filename ON documents(user_id, title)`
    - 包含回滚逻辑（删除列和索引）
    - _Requirements: 2.1, 2.4, 8.4_

  - [x] 1.2 编写数据库迁移测试
    - 测试迁移脚本成功执行
    - 测试索引创建成功
    - 测试回滚功能
    - 测试现有数据不受影响
    - _Requirements: 2.5_

  - [x] 1.3 执行数据库迁移
    - 备份现有数据库
    - 在开发环境执行迁移
    - 验证 schema 更新成功
    - 更新 `initUserDB.js` 以包含新列和索引
    - _Requirements: 2.1, 2.4_

- [ ] 2. 实现后端核心服务
  - [x] 2.1 实现 FileHashService
    - 创建 `services/fileHashService.js`
    - 实现 `calculateHash(filePath, algorithm)` 方法
    - 实现 `calculateHashStreaming(filePath, threshold)` 方法用于大文件
    - 使用 Node.js crypto 模块
    - 对于 > 10MB 文件使用流式处理
    - 返回小写十六进制 hash 字符串
    - 错误处理：返回 null 并记录日志
    - _Requirements: 3.1, 3.2, 8.1_

  - [x] 2.2 编写 FileHashService 属性测试
    - **Property 1: Hash Calculation Consistency**
    - **Validates: Requirements 3.1, 3.2**
    - 生成随机文件内容，计算 hash 两次，验证相等
    - 测试流式和非流式方法产生相同结果
    - 测试不同大小文件（< 10MB 和 > 10MB）

  - [x] 2.3 编写 FileHashService 单元测试
    - 测试小文件 hash 计算
    - 测试大文件流式 hash 计算
    - 测试错误处理（文件不存在、读取失败）
    - 测试 hash 格式（小写十六进制）
    - _Requirements: 3.1, 3.2, 9.5_

  - [x] 2.4 实现 DocumentStorageService
    - 创建 `services/documentStorageService.js`
    - 实现 `saveDocument(metadata, tempFilePath)` 方法
    - 实现 `updateDocument(documentId, metadata, tempFilePath)` 方法
    - 实现 `deleteDocument(documentId)` 方法
    - 实现 `findByHash(hash, userId)` 方法
    - 实现 `findByFilename(filename, userId)` 方法
    - 使用数据库事务确保原子性
    - 在提交前验证文件存在
    - 使用 prepared statements 防止 SQL 注入
    - _Requirements: 2.1, 2.3, 9.1, 9.2, 9.3_

  - [x] 2.5 编写 DocumentStorageService 属性测试
    - **Property 4: Transaction Atomicity**
    - **Validates: Requirements 9.1, 9.2**
    - 模拟数据库失败，验证没有部分数据保存
    - **Property 8: Hash Storage Format Consistency**
    - **Validates: Requirements 9.5**
    - 生成随机文件，保存文档，验证 hash 是小写十六进制

  - [x] 2.6 编写 DocumentStorageService 单元测试
    - 测试文档保存成功
    - 测试文档更新成功
    - 测试文档删除成功
    - 测试按 hash 查询
    - 测试按文件名查询
    - 测试事务回滚
    - 测试文件验证
    - _Requirements: 2.1, 2.3, 9.1, 9.2, 9.3_

  - [x] 2.7 实现 DeduplicationService
    - 创建 `services/deduplicationService.js`
    - 实现 `checkDuplicate(hash, filename, userId)` 方法
    - 返回 `DuplicateCheckResult` 对象
    - 检测内容重复（hash 匹配）
    - 检测文件名重复（filename 匹配）
    - 区分重复类型：'none', 'content', 'filename', 'both'
    - 实现 `handleDuplicateAction(action, newFile, existingFileId)` 方法
    - 处理 'replace' 动作：删除旧文件，保存新文件
    - 处理 'keep-both' 动作：生成唯一文件名（添加时间戳）
    - 处理 'cancel' 动作：删除临时文件
    - _Requirements: 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 5.5, 5.6, 5.7_

  - [ ] 2.8 编写 DeduplicationService 属性测试
    - **Property 2: Duplicate Detection Accuracy**
    - **Validates: Requirements 3.3, 3.4**
    - 生成随机文件内容，用两个不同名称保存，验证检测到内容重复
    - **Property 3: Filename Duplicate Detection**
    - **Validates: Requirements 4.1, 4.2, 4.3**
    - 生成随机文件名，保存两个同名文件，验证检测到文件名重复
    - **Property 5: File Replacement Integrity**
    - **Validates: Requirements 5.5, 9.4**
    - 模拟替换失败，验证旧文件未被删除
    - **Property 6: Unique Filename Generation**
    - **Validates: Requirements 5.6**
    - 生成随机文件名，多次触发 "keep-both"，验证所有文件名唯一

  - [ ] 2.9 编写 DeduplicationService 单元测试
    - 测试内容重复检测
    - 测试文件名重复检测
    - 测试完全重复检测（内容和文件名都匹配）
    - 测试 replace 动作
    - 测试 keep-both 动作和唯一文件名生成
    - 测试 cancel 动作和临时文件清理
    - _Requirements: 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 5.5, 5.6, 5.7_

- [ ] 3. 修复和增强文件上传端点
  - [x] 3.1 修复 handleFileUpload 中的 userDb 连接问题
    - 在 `server.js` 中定位 `handleFileUpload` 函数（第 823 行）
    - 确保 `userDb` 正确传递到函数作用域
    - 验证数据库连接在使用前已初始化
    - 添加数据库连接检查和错误处理
    - _Requirements: 1.1, 1.2_

  - [x] 3.2 集成 FileHashService 到上传流程
    - 在文件保存到临时位置后调用 `FileHashService.calculateHash()`
    - 将 hash 值存储在文件元数据中
    - 处理 hash 计算失败的情况（优雅降级）
    - _Requirements: 3.1, 3.2, 7.3_

  - [x] 3.3 集成 DeduplicationService 到上传流程
    - 在 hash 计算后调用 `DeduplicationService.checkDuplicate()`
    - 如果检测到重复，返回重复信息而不是立即保存
    - 生成临时文件 ID 用于后续处理
    - 将临时文件信息存储在内存中（使用 Map）
    - _Requirements: 3.3, 3.4, 4.1, 4.2, 4.3_

  - [x] 3.4 更新 POST /api/upload 响应格式
    - 无重复时：返回成功响应和文档元数据
    - 有重复时：返回 `duplicate: true` 和现有文件信息
    - 包含 `tempFileId` 用于后续重复解决
    - 包含 `duplicateType` 指示重复类型
    - _Requirements: 3.3, 3.4, 4.1, 4.2_

  - [x] 3.5 实现 POST /api/upload/resolve-duplicate 端点
    - 创建新的路由处理器
    - 接收 `action`, `tempFileId`, `existingFileId` 参数
    - 从内存中检索临时文件信息
    - 调用 `DeduplicationService.handleDuplicateAction()`
    - 返回最终文档元数据或错误
    - 清理临时文件信息
    - _Requirements: 5.5, 5.6, 5.7_

  - [ ] 3.6 编写上传端点集成测试
    - 测试完整上传流程（无重复）
    - 测试重复检测响应
    - 测试 resolve-duplicate 端点的所有动作
    - 测试错误处理
    - _Requirements: 1.1, 1.2, 3.3, 3.4, 5.5, 5.6, 5.7_

- [ ] 4. 实现临时文件管理
  - [x] 4.1 创建临时文件管理器
    - 创建 `services/tempFileManager.js`
    - 实现临时文件存储（内存 Map）
    - 实现 `storeTempFile(fileInfo)` 方法
    - 实现 `getTempFile(tempFileId)` 方法
    - 实现 `deleteTempFile(tempFileId)` 方法
    - 设置过期时间（1 小时）
    - _Requirements: 7.6_

  - [x] 4.2 实现临时文件清理任务
    - 创建后台清理任务（每 15 分钟运行）
    - 检查过期的临时文件
    - 删除过期的临时文件（文件系统和内存）
    - 记录清理日志
    - _Requirements: 7.6_

  - [ ] 4.3 编写临时文件管理属性测试
    - **Property 7: Temp File Cleanup**
    - **Validates: Requirements 5.7, 7.6**
    - 上传并取消随机文件，验证所有临时文件被清理

  - [ ] 4.4 编写临时文件管理单元测试
    - 测试临时文件存储
    - 测试临时文件检索
    - 测试临时文件删除
    - 测试过期检测
    - 测试清理任务
    - _Requirements: 7.6_

- [ ] 5. Checkpoint - 后端功能验证
  - 确保所有后端服务正常工作
  - 运行所有后端测试
  - 手动测试上传 API
  - 如有问题请询问用户

- [x] 6. 实现前端重复检测模态框
  - [x] 6.1 创建 DuplicateDetectionModal 组件
    - 在 `client/src/components/` 创建 `DuplicateDetectionModal.tsx`
    - 定义 `DuplicateModalProps` 接口
    - 实现模态框 UI（紫色主题、圆角、阴影）
    - 显示新文件和现有文件的对比信息
    - 显示文件名、大小、上传时间
    - 根据 `duplicateType` 显示不同的提示信息
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 6.2 添加三个操作按钮
    - "覆盖现有文件" 按钮（红色/警告色）
    - "保存为新文件" 按钮（紫色/主色）
    - "取消上传" 按钮（灰色/次要色）
    - 每个按钮调用 `onResolve` 回调并传递相应动作
    - _Requirements: 5.3, 5.5, 5.6, 5.7_

  - [x] 6.3 添加 Framer Motion 动画
    - 模态框淡入淡出动画
    - 模态框缩放动画（从 0.95 到 1）
    - 背景遮罩淡入淡出
    - 按钮悬停和点击动画
    - _Requirements: 5.8_

  - [x] 6.4 添加键盘快捷键支持
    - Esc 键关闭模态框（等同于取消）
    - Enter 键确认默认动作（保存为新文件）
    - Tab 键在按钮间切换
    - _Requirements: 5.3_

  - [ ] 6.5 编写 DuplicateDetectionModal 单元测试
    - 测试模态框渲染
    - 测试按钮点击回调
    - 测试键盘快捷键
    - 测试不同 duplicateType 的显示
    - 测试动画
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [ ] 7. 增强前端上传进度跟踪
  - [x] 7.1 修改 UploadFile 接口
    - 在 `DocumentsList.tsx` 中更新 `UploadFile` 接口
    - 添加 `speed?: number` 字段（bytes per second）
    - 添加 `estimatedTime?: number` 字段（seconds remaining）
    - 添加 `checking-duplicate` 状态
    - _Requirements: 6.1, 6.4_

  - [x] 7.2 实现真实上传进度跟踪
    - 使用 XMLHttpRequest 替代 fetch API
    - 监听 `progress` 事件获取真实上传进度
    - 计算上传速度（bytes per second）
    - 计算预计剩余时间
    - 更新进度条显示真实进度
    - _Requirements: 6.2, 6.4_

  - [x] 7.3 实现并发上传管理
    - 创建上传队列
    - 限制同时上传数量为 3
    - 当一个上传完成时，从队列启动下一个
    - 显示等待中的文件状态
    - _Requirements: 6.3, 8.3_

  - [x] 7.4 添加上传速度和剩余时间显示
    - 在进度条下方显示上传速度（KB/s 或 MB/s）
    - 显示预计剩余时间（格式化为易读形式）
    - 动态更新这些信息
    - _Requirements: 6.4_

  - [x] 7.5 添加完成和错误状态显示
    - 上传完成后显示绿色勾选图标
    - 显示完成指示器 2 秒后移除
    - 错误时显示红色错误图标和重试按钮
    - _Requirements: 6.5, 6.6_

  - [ ] 7.6 编写上传进度属性测试
    - **Property 9: Progress Accuracy**
    - **Validates: Requirements 6.2**
    - 模拟随机进度事件，验证进度百分比计算正确
    - **Property 10: Concurrent Upload Limit**
    - **Validates: Requirements 8.3**
    - 触发随机数量的并发上传，验证最多 3 个同时活跃

  - [ ] 7.7 编写上传进度单元测试
    - 测试进度计算
    - 测试速度计算
    - 测试剩余时间估算
    - 测试并发限制
    - 测试队列管理
    - _Requirements: 6.2, 6.3, 6.4, 8.3_

- [x] 8. 集成重复检测到上传流程
  - [x] 8.1 更新 API 服务方法
    - 在 `client/src/services/api.ts` 中更新 `uploadDocument` 方法
    - 处理重复检测响应
    - 添加 `resolveDuplicate` 方法调用新端点
    - 返回适当的响应类型
    - _Requirements: 3.3, 3.4, 5.5, 5.6, 5.7_

  - [x] 8.2 在 DocumentsList 中集成重复检测流程
    - 修改 `handleFiles` 函数
    - 检测上传响应中的 `duplicate` 标志
    - 如果有重复，显示 `DuplicateDetectionModal`
    - 暂停上传进度显示，显示 "checking-duplicate" 状态
    - 处理用户的重复解决选择
    - 根据用户选择调用 `resolveDuplicate` API
    - 继续或取消上传流程
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6, 5.7_

  - [x] 8.3 添加错误处理和重试逻辑
    - 处理网络错误（连接超时、中断）
    - 显示用户友好的中文错误消息
    - 添加重试按钮
    - 实现指数退避重试（最多 3 次）
    - 处理磁盘空间不足错误
    - 处理数据库错误
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ] 8.4 编写前端集成测试
    - 测试完整上传流程（无重复）
    - 测试重复检测和模态框显示
    - 测试用户选择 "覆盖现有文件"
    - 测试用户选择 "保存为新文件"
    - 测试用户选择 "取消上传"
    - 测试错误处理和重试
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6, 5.7, 7.1, 7.2_

- [ ] 9. Checkpoint - 前端功能验证
  - 确保所有前端组件正常工作
  - 运行所有前端测试
  - 手动测试上传 UI
  - 测试重复检测模态框
  - 如有问题请询问用户

- [ ] 10. 端到端集成测试
  - [ ] 10.1 编写端到端测试套件
    - 测试完整上传流程（从文件选择到保存）
    - 测试重复文件上传和所有解决选项
    - 测试多文件并发上传
    - 测试大文件上传（> 100MB）
    - 测试各种文件类型
    - 测试错误场景（网络中断、磁盘满）
    - 测试临时文件清理
    - _Requirements: All_

  - [ ] 10.2 性能测试
    - 测试 hash 计算性能（100MB 文件 < 2s）
    - 测试重复检测查询性能（< 50ms）
    - 测试上传 API 响应时间（< 500ms）
    - 测试并发上传性能
    - _Requirements: 8.1, 8.2, 8.4, 8.5_

- [ ] 11. 文档和部署准备
  - [ ] 11.1 更新 API 文档
    - 记录 POST /api/upload 的新响应格式
    - 记录 POST /api/upload/resolve-duplicate 端点
    - 提供请求/响应示例
    - 记录错误代码和消息

  - [ ] 11.2 创建部署指南
    - 记录数据库迁移步骤
    - 记录环境变量配置
    - 记录部署前检查清单
    - 记录回滚计划

  - [ ] 11.3 创建用户指南
    - 记录如何上传文件
    - 记录如何处理重复文件
    - 提供截图和示例
    - 记录常见问题解答

- [ ] 12. Final Checkpoint - 完整系统验证
  - 运行所有测试（单元、属性、集成、端到端）
  - 执行完整的手动测试
  - 验证性能指标
  - 检查错误处理
  - 验证数据完整性
  - 确认向后兼容性
  - 如有问题请询问用户，否则功能完成

## Notes

- 标记 `*` 的任务是可选的测试任务，可以跳过以加快 MVP 开发
- 每个任务都引用了具体的需求以确保可追溯性
- Checkpoint 任务确保增量验证
- 属性测试验证通用正确性属性
- 单元测试验证具体示例和边界情况
- 集成测试验证端到端流程
- 所有测试应使用 fast-check 库进行属性测试，每个测试至少运行 100 次迭代
