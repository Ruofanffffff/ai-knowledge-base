# Requirements Document

## Introduction

本文档定义了文件上传去重功能的需求。该功能旨在修复当前的文件上传失败问题，将存储方案从 JSON 文件迁移到 SQLite 数据库，并实现基于内容和文件名的重复文件检测机制。当检测到重复文件时，系统将提供用户友好的模态框让用户选择处理方式。

## Glossary

- **File_Upload_System**: 负责处理文件上传、存储和元数据管理的后端系统
- **Deduplication_Engine**: 负责检测重复文件的组件，基于文件内容 hash 和文件名
- **Storage_Layer**: SQLite 数据库存储层，替代原有的 JSON 文件存储
- **Duplicate_Modal**: 前端模态框组件，用于向用户展示重复文件信息并收集用户决策
- **Hash_Calculator**: 使用 Node.js crypto 模块计算文件内容 hash 的组件
- **Upload_Progress_Tracker**: 跟踪和显示文件上传进度的组件
- **User**: 上传文件的用户
- **Document_Metadata**: 文件的元数据，包括文件名、大小、上传时间、hash 值等

## Requirements

### Requirement 1: 修复文件上传失败问题

**User Story:** 作为用户，我希望文件上传功能正常工作，这样我才能成功上传文件到系统中。

#### Acceptance Criteria

1. WHEN a file is uploaded, THE File_Upload_System SHALL correctly pass the userDb connection to the handleFileUpload function
2. WHEN the handleFileUpload function is invoked, THE File_Upload_System SHALL successfully store file metadata without returning 500 errors
3. IF the userDb connection is missing or invalid, THEN THE File_Upload_System SHALL return a descriptive error message with status code 500
4. WHEN a file upload completes successfully, THE File_Upload_System SHALL return status code 200 with the document metadata

### Requirement 2: 迁移到 SQLite 存储

**User Story:** 作为系统管理员，我希望使用 SQLite 数据库存储文件元数据，这样可以提高数据可靠性和查询性能。

#### Acceptance Criteria

1. THE Storage_Layer SHALL store all document metadata in the SQLite database defined in database/initUserDB.js
2. THE File_Upload_System SHALL NOT use mockDocuments array or documents.json file for new uploads
3. WHEN querying documents, THE Storage_Layer SHALL retrieve data from the SQLite database
4. WHEN the system starts, THE Storage_Layer SHALL ensure the documents table exists with the correct schema
5. THE Storage_Layer SHALL maintain backward compatibility by preserving existing uploaded files and their metadata

### Requirement 3: 基于内容 Hash 的重复检测

**User Story:** 作为用户，我希望系统能检测到内容相同的文件，即使文件名不同，这样可以避免存储重复内容。

#### Acceptance Criteria

1. WHEN a file is uploaded, THE Hash_Calculator SHALL compute a hash value of the file content using Node.js crypto module
2. THE Hash_Calculator SHALL use streaming hash calculation for files larger than 10MB to optimize memory usage
3. WHEN a hash is computed, THE Deduplication_Engine SHALL query the database for existing files with the same hash value
4. IF a file with the same hash exists, THEN THE Deduplication_Engine SHALL identify it as a content duplicate
5. THE Storage_Layer SHALL store the hash value with each document metadata record

### Requirement 4: 基于文件名的重复检测

**User Story:** 作为用户，我希望系统能检测到文件名相同的文件，这样可以避免意外覆盖现有文件。

#### Acceptance Criteria

1. WHEN a file is uploaded, THE Deduplication_Engine SHALL query the database for existing files with the same filename
2. IF a file with the same filename exists, THEN THE Deduplication_Engine SHALL identify it as a filename duplicate
3. THE Deduplication_Engine SHALL check for filename duplicates within the same user's document collection
4. WHEN both content and filename match, THE Deduplication_Engine SHALL report it as a complete duplicate

### Requirement 5: 重复文件处理模态框

**User Story:** 作为用户，当上传重复文件时，我希望看到清晰的提示和选项，这样我可以决定如何处理重复文件。

#### Acceptance Criteria

1. WHEN a duplicate file is detected, THE Duplicate_Modal SHALL display to the user before completing the upload
2. THE Duplicate_Modal SHALL show the existing file's information including filename, file size, and upload timestamp
3. THE Duplicate_Modal SHALL provide three options: "覆盖现有文件", "保存为新文件", and "取消上传"
4. THE Duplicate_Modal SHALL use the existing design language with purple theme, rounded corners, and shadows
5. WHEN the user selects "覆盖现有文件", THE File_Upload_System SHALL replace the existing file and update its metadata
6. WHEN the user selects "保存为新文件", THE File_Upload_System SHALL save the file with a unique filename
7. WHEN the user selects "取消上传", THE File_Upload_System SHALL abort the upload and clean up temporary files
8. THE Duplicate_Modal SHALL use Framer Motion for smooth animations when appearing and disappearing

### Requirement 6: 上传进度显示优化

**User Story:** 作为用户，我希望看到真实的文件上传进度，这样我可以了解上传状态和预计完成时间。

#### Acceptance Criteria

1. WHEN a file upload starts, THE Upload_Progress_Tracker SHALL display a progress bar showing the upload percentage
2. THE Upload_Progress_Tracker SHALL update the progress bar based on actual bytes uploaded, not simulated progress
3. WHEN multiple files are uploaded concurrently, THE Upload_Progress_Tracker SHALL display individual progress for each file
4. THE Upload_Progress_Tracker SHALL show the current upload speed and estimated time remaining
5. WHEN an upload completes, THE Upload_Progress_Tracker SHALL show a completion indicator for 2 seconds before removing the progress bar
6. IF an upload fails, THEN THE Upload_Progress_Tracker SHALL display an error message with retry option

### Requirement 7: 错误处理和边界情况

**User Story:** 作为用户，我希望系统能优雅地处理各种错误情况，这样即使出现问题也能得到清晰的反馈。

#### Acceptance Criteria

1. IF network connection is interrupted during upload, THEN THE File_Upload_System SHALL detect the interruption and notify the user
2. IF disk space is insufficient, THEN THE File_Upload_System SHALL return an error before attempting to save the file
3. IF the hash calculation fails, THEN THE File_Upload_System SHALL log the error and proceed without deduplication check
4. IF the database query fails during duplicate check, THEN THE File_Upload_System SHALL log the error and allow the upload to proceed
5. WHEN any error occurs, THE File_Upload_System SHALL provide user-friendly error messages in Chinese
6. THE File_Upload_System SHALL clean up temporary files when uploads fail or are cancelled

### Requirement 8: 性能优化

**User Story:** 作为用户，我希望文件上传过程快速高效，即使上传大文件也不会导致系统卡顿。

#### Acceptance Criteria

1. THE Hash_Calculator SHALL use streaming processing for files larger than 10MB to avoid loading entire files into memory
2. THE Deduplication_Engine SHALL perform database queries asynchronously without blocking the upload process
3. WHEN multiple files are uploaded, THE File_Upload_System SHALL process them concurrently with a maximum of 3 simultaneous uploads
4. THE Storage_Layer SHALL use database indexes on hash and filename columns to optimize duplicate detection queries
5. THE File_Upload_System SHALL respond to duplicate detection within 500ms for files under 100MB

### Requirement 9: 数据完整性和一致性

**User Story:** 作为系统管理员，我希望确保数据的完整性和一致性，这样可以避免数据损坏或丢失。

#### Acceptance Criteria

1. WHEN a file is uploaded, THE Storage_Layer SHALL use database transactions to ensure atomic operations
2. IF a file save operation fails after metadata is written, THEN THE Storage_Layer SHALL rollback the database transaction
3. THE Storage_Layer SHALL validate that the uploaded file exists on disk before committing the metadata to the database
4. WHEN a file is replaced due to user choosing "覆盖现有文件", THE File_Upload_System SHALL delete the old file only after the new file is successfully saved
5. THE Storage_Layer SHALL ensure that hash values are stored in a consistent format (lowercase hexadecimal)
