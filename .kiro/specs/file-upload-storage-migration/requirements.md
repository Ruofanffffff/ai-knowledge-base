# Requirements Document

## Introduction

本文档定义了文件上传存储迁移功能的需求。该功能将废弃现有的 JSON 文件存储方案，改用数据库存储文档元数据，并实现文件重复检测功能，在检测到重复文件时提供用户交互选项。

## Glossary

- **System**: 文件上传存储系统
- **Document_Metadata**: 文档元数据，包括文件名、大小、hash、上传时间等信息
- **File_Hash**: 文件内容的 SHA-256 哈希值，用于唯一标识文件内容
- **Database**: PostgreSQL 数据库，通过 Prisma ORM 访问
- **Legacy_Storage**: 现有的 JSON 文件存储方案（documents.json）
- **Upload_API**: 处理文件上传的后端 API 端点
- **Frontend**: React + TypeScript 前端应用
- **Duplicate_Detection**: 文件重复检测机制
- **User_Action**: 用户对重复文件的处理选择（覆盖、重命名、取消）

## Requirements

### Requirement 1: 数据库存储迁移

**User Story:** 作为系统管理员，我希望将文档元数据从 JSON 文件迁移到数据库，以便提高数据可靠性和查询性能。

#### Acceptance Criteria

1. THE System SHALL store all Document_Metadata in the Database using Prisma ORM
2. WHEN a document is uploaded, THE System SHALL persist Document_Metadata to the Database immediately
3. WHEN the system starts, THE System SHALL load Document_Metadata from the Database instead of Legacy_Storage
4. THE System SHALL calculate and store File_Hash for each uploaded document
5. WHERE Legacy_Storage exists, THE System SHALL provide a migration utility to transfer existing data to the Database

### Requirement 2: 文件重复检测

**User Story:** 作为用户，我希望系统能检测重复文件，以便避免重复上传相同内容。

#### Acceptance Criteria

1. WHEN a file is uploaded, THE System SHALL calculate the File_Hash of the file content
2. WHEN File_Hash is calculated, THE System SHALL query the Database to check if a document with the same File_Hash exists
3. IF a document with the same File_Hash exists, THEN THE System SHALL identify it as a duplicate
4. THE System SHALL use SHA-256 algorithm for File_Hash calculation
5. WHEN checking for duplicates, THE System SHALL compare both File_Hash and file size for accuracy

### Requirement 3: 重复文件用户交互

**User Story:** 作为用户，当上传重复文件时，我希望能选择如何处理，以便根据实际需求决定操作。

#### Acceptance Criteria

1. WHEN a duplicate file is detected, THE System SHALL return duplicate information to the Frontend
2. WHEN duplicate information is received, THE Frontend SHALL display a modal dialog with three options
3. THE Frontend SHALL provide an "覆盖现有文件" option that replaces the existing document
4. THE Frontend SHALL provide a "保存为新文件" option that automatically renames the file
5. THE Frontend SHALL provide a "取消上传" option that cancels the upload operation
6. WHEN user selects "覆盖现有文件", THE System SHALL update the existing Document_Metadata and replace the physical file
7. WHEN user selects "保存为新文件", THE System SHALL generate a unique filename and create a new document entry
8. WHEN user selects "取消上传", THE System SHALL delete the uploaded file and return success status

### Requirement 4: API 设计

**User Story:** 作为前端开发者，我希望有清晰的 API 接口，以便实现文件上传和重复处理功能。

#### Acceptance Criteria

1. THE Upload_API SHALL accept multipart/form-data file uploads
2. WHEN a file is uploaded, THE Upload_API SHALL return upload status and document information
3. IF a duplicate is detected, THEN THE Upload_API SHALL return a specific response indicating duplicate status with existing document details
4. THE System SHALL provide an API endpoint to handle User_Action for duplicate files
5. WHEN User_Action is received, THE System SHALL process the action and return the result
6. THE Upload_API SHALL return appropriate HTTP status codes for different scenarios (200 for success, 409 for duplicate, 400 for errors)

### Requirement 5: 向后兼容性

**User Story:** 作为系统维护者，我希望迁移过程平滑，以便不影响现有功能和数据。

#### Acceptance Criteria

1. WHERE Legacy_Storage exists, THE System SHALL support reading from both Legacy_Storage and Database during migration period
2. THE System SHALL provide a migration script that validates data integrity after migration
3. WHEN migration is complete, THE System SHALL archive Legacy_Storage files instead of deleting them
4. THE System SHALL maintain the same API response format for existing endpoints
5. WHEN errors occur during migration, THE System SHALL log detailed error information and continue processing remaining records

### Requirement 6: 文件名重命名策略

**User Story:** 作为用户，当选择保存为新文件时，我希望系统能智能地重命名文件，以便清楚地识别文件版本。

#### Acceptance Criteria

1. WHEN generating a new filename, THE System SHALL append a numeric suffix to the original filename
2. THE System SHALL preserve the file extension when renaming
3. WHEN a filename with suffix already exists, THE System SHALL increment the suffix until a unique name is found
4. THE System SHALL use the format "filename (n).ext" where n is a positive integer
5. THE System SHALL validate that the generated filename does not exceed system path length limits

### Requirement 7: 错误处理和数据完整性

**User Story:** 作为系统管理员，我希望系统能妥善处理错误情况，以便保证数据完整性。

#### Acceptance Criteria

1. IF File_Hash calculation fails, THEN THE System SHALL reject the upload and return an error message
2. IF Database write fails, THEN THE System SHALL delete the uploaded physical file to maintain consistency
3. WHEN a file operation fails, THE System SHALL rollback any partial changes
4. THE System SHALL validate file size limits before processing uploads
5. WHEN duplicate detection fails, THE System SHALL log the error and proceed with normal upload flow
6. THE System SHALL implement transaction management for database operations involving multiple steps

### Requirement 8: 性能优化

**User Story:** 作为用户，我希望文件上传过程快速高效，以便提升使用体验。

#### Acceptance Criteria

1. THE System SHALL calculate File_Hash using streaming to avoid loading entire file into memory
2. THE System SHALL create database indexes on File_Hash and file size columns for fast duplicate detection
3. WHEN processing large files, THE System SHALL provide upload progress feedback
4. THE System SHALL implement connection pooling for Database access
5. THE System SHALL cache frequently accessed Document_Metadata to reduce database queries
