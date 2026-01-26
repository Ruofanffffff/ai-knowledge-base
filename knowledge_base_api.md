# 个人智能知识库后端API接口规范

## 一、API设计原则

- **RESTful风格**：使用HTTP方法和URL表示资源操作
- **统一响应格式**：所有API返回统一的JSON格式
- **版本控制**：使用URL前缀（如/api/v1）进行版本控制
- **错误处理**：提供详细的错误码和错误信息
- **权限控制**：基于Token的身份验证和权限管理
- **文档化**：使用OpenAPI/Swagger进行API文档化

## 二、基础信息

### 1. 版本信息
- **当前版本**：v1
- **API前缀**：/api/v1

### 2. 响应格式

#### 2.1 成功响应
```json
{
  "success": true,
  "data": {}, // 响应数据
  "message": "操作成功",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### 2.2 错误响应
```json
{
  "success": false,
  "error": {
    "code": 400, // 错误码
    "message": "参数错误", // 错误信息
    "details": {} // 详细错误信息
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 3. 错误码

| 错误码 | 描述 |
|-------|------|
| 400 | 参数错误 |
| 401 | 未授权 |
| 403 | 禁止访问 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
| 501 | 功能未实现 |

## 三、内容管理API

### 1. 文档操作

#### 1.1 创建文档
- **URL**：/api/v1/contents
- **方法**：POST
- **请求体**：
  ```json
  {
    "title": "文档标题",
    "content": "文档内容",
    "file_type": "md",
    "tags": ["标签1", "标签2"],
    "author": "作者",
    "source_url": "来源链接"
  }
  ```
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "id": "content_id",
      "title": "文档标题",
      "content": "文档内容",
      "file_type": "md",
      "tags": ["标签1", "标签2"],
      "author": "作者",
      "source_url": "来源链接",
      "created_at": "2024-01-01T12:00:00.000Z",
      "updated_at": "2024-01-01T12:00:00.000Z"
    },
    "message": "文档创建成功"
  }
  ```

#### 1.2 获取文档列表
- **URL**：/api/v1/contents
- **方法**：GET
- **查询参数**：
  - page: 页码（默认1）
  - limit: 每页数量（默认10）
  - search: 关键词搜索
  - file_type: 文件类型过滤
  - tag: 标签过滤
  - sort_by: 排序字段（默认created_at）
  - sort_order: 排序顺序（asc/desc，默认desc）
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "contents": [
        {
          "id": "content_id",
          "title": "文档标题",
          "file_type": "md",
          "tags": ["标签1", "标签2"],
          "author": "作者",
          "summary": "文档摘要",
          "created_at": "2024-01-01T12:00:00.000Z",
          "updated_at": "2024-01-01T12:00:00.000Z"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 10,
        "total": 100,
        "total_pages": 10
      }
    },
    "message": "获取文档列表成功"
  }
  ```

#### 1.3 获取文档详情
- **URL**：/api/v1/contents/:id
- **方法**：GET
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "id": "content_id",
      "title": "文档标题",
      "content": "文档内容",
      "file_type": "md",
      "tags": ["标签1", "标签2"],
      "author": "作者",
      "source_url": "来源链接",
      "summary": "文档摘要",
      "created_at": "2024-01-01T12:00:00.000Z",
      "updated_at": "2024-01-01T12:00:00.000Z"
    },
    "message": "获取文档详情成功"
  }
  ```

#### 1.4 更新文档
- **URL**：/api/v1/contents/:id
- **方法**：PUT
- **请求体**：
  ```json
  {
    "title": "新文档标题",
    "content": "新文档内容",
    "tags": ["新标签1", "新标签2"],
    "author": "新作者",
    "source_url": "新来源链接"
  }
  ```
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "id": "content_id",
      "title": "新文档标题",
      "content": "新文档内容",
      "file_type": "md",
      "tags": ["新标签1", "新标签2"],
      "author": "新作者",
      "source_url": "新来源链接",
      "created_at": "2024-01-01T12:00:00.000Z",
      "updated_at": "2024-01-01T13:00:00.000Z"
    },
    "message": "文档更新成功"
  }
  ```

#### 1.5 删除文档
- **URL**：/api/v1/contents/:id
- **方法**：DELETE
- **响应**：
  ```json
  {
    "success": true,
    "data": null,
    "message": "文档删除成功"
  }
  ```

### 2. 标签管理

#### 2.1 获取所有标签
- **URL**：/api/v1/tags
- **方法**：GET
- **查询参数**：
  - search: 关键词搜索
  - limit: 返回数量（默认100）
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "tags": [
        {
          "id": "tag_id",
          "name": "标签1",
          "description": "标签描述",
          "color": "#000000",
          "created_at": "2024-01-01T12:00:00.000Z"
        }
      ]
    },
    "message": "获取标签列表成功"
  }
  ```

#### 2.2 创建标签
- **URL**：/api/v1/tags
- **方法**：POST
- **请求体**：
  ```json
  {
    "name": "新标签",
    "description": "标签描述",
    "color": "#000000"
  }
  ```
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "id": "tag_id",
      "name": "新标签",
      "description": "标签描述",
      "color": "#000000",
      "created_at": "2024-01-01T12:00:00.000Z"
    },
    "message": "标签创建成功"
  }
  ```

#### 2.3 更新标签
- **URL**：/api/v1/tags/:id
- **方法**：PUT
- **请求体**：
  ```json
  {
    "name": "更新后的标签",
    "description": "更新后的描述",
    "color": "#FF0000"
  }
  ```
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "id": "tag_id",
      "name": "更新后的标签",
      "description": "更新后的描述",
      "color": "#FF0000",
      "created_at": "2024-01-01T12:00:00.000Z",
      "updated_at": "2024-01-01T13:00:00.000Z"
    },
    "message": "标签更新成功"
  }
  ```

#### 2.4 删除标签
- **URL**：/api/v1/tags/:id
- **方法**：DELETE
- **响应**：
  ```json
  {
    "success": true,
    "data": null,
    "message": "标签删除成功"
  }
  ```

## 四、搜索API

### 1. 语义搜索
- **URL**：/api/v1/search/semantic
- **方法**：POST
- **请求体**：
  ```json
  {
    "query": "用户增长的方法",
    "top_k": 10,
    "filters": {
      "file_type": ["md", "docx"],
      "tags": ["用户增长"]
    }
  }
  ```
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "results": [
        {
          "id": "search_result_id",
          "content_id": "content_id",
          "title": "用户增长策略文档",
          "content": "...相关内容片段...",
          "highlight": "...[用户增长]...",
          "score": 0.95,
          "file_type": "md",
          "tags": ["用户增长", "策略"],
          "created_at": "2024-01-01T12:00:00.000Z"
        }
      ]
    },
    "message": "语义搜索成功"
  }
  ```

### 2. 关键词搜索
- **URL**：/api/v1/search/keyword
- **方法**：POST
- **请求体**：
  ```json
  {
    "query": "用户增长",
    "top_k": 10,
    "filters": {
      "file_type": ["md", "docx"],
      "tags": ["策略"]
    }
  }
  ```
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "results": [
        {
          "id": "search_result_id",
          "content_id": "content_id",
          "title": "用户增长策略文档",
          "content": "...相关内容片段...",
          "highlight": "...[用户增长]...",
          "score": 0.90,
          "file_type": "md",
          "tags": ["用户增长", "策略"],
          "created_at": "2024-01-01T12:00:00.000Z"
        }
      ]
    },
    "message": "关键词搜索成功"
  }
  ```

### 3. 搜索历史
- **URL**：/api/v1/search/history
- **方法**：GET
- **查询参数**：
  - page: 页码（默认1）
  - limit: 每页数量（默认20）
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "history": [
        {
          "id": "history_id",
          "query": "用户增长的方法",
          "query_type": "semantic",
          "results_count": 10,
          "created_at": "2024-01-01T12:00:00.000Z"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 50,
        "total_pages": 3
      }
    },
    "message": "获取搜索历史成功"
  }
  ```

## 五、AI功能API

### 1. 智能标签
- **URL**：/api/v1/ai/tags/suggest
- **方法**：POST
- **请求体**：
  ```json
  {
    "content": "文档内容",
    "title": "文档标题",
    "existing_tags": ["现有标签1"]
  }
  ```
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "suggested_tags": [
        {
          "name": "建议标签1",
          "score": 0.95
        },
        {
          "name": "建议标签2",
          "score": 0.85
        }
      ]
    },
    "message": "获取智能标签建议成功"
  }
  ```

### 2. 知识图谱

#### 2.1 获取实体列表
- **URL**：/api/v1/ai/knowledge-graph/entities
- **方法**：GET
- **查询参数**：
  - type: 实体类型过滤
  - search: 关键词搜索
  - limit: 返回数量（默认50）
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "entities": [
        {
          "id": "entity_id",
          "name": "用户增长",
          "type": "concept",
          "description": "用户增长的概念和方法",
          "relations_count": 10,
          "contents_count": 5
        }
      ]
    },
    "message": "获取实体列表成功"
  }
  ```

#### 2.2 获取实体详情
- **URL**：/api/v1/ai/knowledge-graph/entities/:id
- **方法**：GET
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "entity": {
        "id": "entity_id",
        "name": "用户增长",
        "type": "concept",
        "description": "用户增长的概念和方法",
        "relations": [
          {
            "id": "relation_id",
            "target_id": "target_entity_id",
            "target_name": "增长黑客",
            "relation_type": "related_to",
            "strength": 0.9
          }
        ],
        "contents": [
          {
            "id": "content_id",
            "title": "用户增长策略文档"
          }
        ]
      }
    },
    "message": "获取实体详情成功"
  }
  ```

#### 2.3 获取实体关系图
- **URL**：/api/v1/ai/knowledge-graph/graph
- **方法**：GET
- **查询参数**：
  - center_entity_id: 中心实体ID（可选）
  - depth: 关系深度（默认2）
  - limit: 返回实体数量（默认100）
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "nodes": [
        {
          "id": "entity_id",
          "name": "用户增长",
          "type": "concept",
          "size": 10
        }
      ],
      "edges": [
        {
          "id": "relation_id",
          "source": "entity_id",
          "target": "target_entity_id",
          "relation_type": "related_to",
          "strength": 0.9,
          "color": "#000000"
        }
      ]
    },
    "message": "获取知识图谱成功"
  }
  ```

### 3. 智能问答
- **URL**：/api/v1/ai/qa
- **方法**：POST
- **请求体**：
  ```json
  {
    "question": "我去年关于用户增长都总结了哪些方法？"
  }
  ```
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "answer": "根据您的知识库，去年您总结的用户增长方法包括：1. 内容营销；2. 社交媒体推广；3.  referral计划；4. 优化用户体验。",
      "sources": [
        {
          "id": "content_id",
          "title": "2023年用户增长总结",
          "type": "md"
        }
      ]
    },
    "message": "智能问答成功"
  }
  ```

### 4. 关联推荐
- **URL**：/api/v1/ai/recommendations/related
- **方法**：GET
- **查询参数**：
  - content_id: 参考文档ID
  - top_k: 返回数量（默认5）
  - type: 推荐类型（content, entity）
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "recommendations": [
        {
          "id": "content_id",
          "title": "相关文档标题",
          "type": "content",
          "score": 0.90,
          "reason": "与当前文档主题相关",
          "created_at": "2024-01-01T12:00:00.000Z"
        }
      ]
    },
    "message": "获取关联推荐成功"
  }
  ```

## 六、用户管理API

### 1. 登录
- **URL**：/api/v1/user/login
- **方法**：POST
- **请求体**：
  ```json
  {
    "password": "用户密码"
  }
  ```
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "token": "jwt_token",
      "user": {
        "id": "user_id",
        "name": "用户名",
        "email": "用户邮箱"
      },
      "settings": {
        "theme": "light",
        "language": "zh-CN"
      }
    },
    "message": "登录成功"
  }
  ```

### 2. 退出
- **URL**：/api/v1/user/logout
- **方法**：POST
- **响应**：
  ```json
  {
    "success": true,
    "data": null,
    "message": "退出成功"
  }
  ```

### 3. 设置管理

#### 3.1 获取设置
- **URL**：/api/v1/user/settings
- **方法**：GET
- **查询参数**：
  - category: 设置类别过滤
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "settings": [
        {
          "id": "setting_id",
          "key": "theme",
          "value": "light",
          "category": "appearance",
          "description": "界面主题"
        }
      ]
    },
    "message": "获取设置成功"
  }
  ```

#### 3.2 更新设置
- **URL**：/api/v1/user/settings
- **方法**：PUT
- **请求体**：
  ```json
  {
    "settings": [
      {
        "key": "theme",
        "value": "dark"
      },
      {
        "key": "language",
        "value": "en-US"
      }
    ]
  }
  ```
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "settings": [
        {
          "id": "setting_id",
          "key": "theme",
          "value": "dark",
          "category": "appearance",
          "description": "界面主题"
        },
        {
          "id": "setting_id2",
          "key": "language",
          "value": "en-US",
          "category": "general",
          "description": "语言设置"
        }
      ]
    },
    "message": "更新设置成功"
  }
  ```

## 七、导入/导出API

### 1. 导入文件
- **URL**：/api/v1/import/files
- **方法**：POST
- **请求参数**：
  - files: 上传的文件（multipart/form-data）
  - auto_tag: 是否自动生成标签（默认false）
  - extract_entities: 是否提取实体（默认false）
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "imported_files": [
        {
          "file_name": "文档1.md",
          "content_id": "content_id",
          "status": "success"
        }
      ],
      "failed_files": [
        {
          "file_name": "文档2.pdf",
          "error": "解析失败"
        }
      ]
    },
    "message": "文件导入完成"
  }
  ```

### 2. 导出内容
- **URL**：/api/v1/export/contents
- **方法**：POST
- **请求体**：
  ```json
  {
    "content_ids": ["content_id1", "content_id2"],
    "format": "md", // md, pdf, docx, json
    "include_metadata": true
  }
  ```
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "download_url": "/api/v1/export/download/export_id",
      "file_name": "export_20240101.zip"
    },
    "message": "内容导出成功"
  }
  ```

### 3. 下载导出文件
- **URL**：/api/v1/export/download/:export_id
- **方法**：GET
- **响应**：文件下载（二进制）

## 八、备份/恢复API

### 1. 创建备份
- **URL**：/api/v1/backup/create
- **方法**：POST
- **请求体**：
  ```json
  {
    "name": "备份名称",
    "description": "备份描述",
    "include_files": true,
    "include_database": true
  }
  ```
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "backup_id": "backup_id",
      "name": "备份名称",
      "file_path": "/backups/backup_20240101.zip",
      "size": 1024000, // 字节
      "created_at": "2024-01-01T12:00:00.000Z"
    },
    "message": "备份创建成功"
  }
  ```

### 2. 获取备份列表
- **URL**：/api/v1/backup/list
- **方法**：GET
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "backups": [
        {
          "id": "backup_id",
          "name": "备份名称",
          "description": "备份描述",
          "file_path": "/backups/backup_20240101.zip",
          "size": 1024000,
          "created_at": "2024-01-01T12:00:00.000Z"
        }
      ]
    },
    "message": "获取备份列表成功"
  }
  ```

### 3. 恢复备份
- **URL**：/api/v1/backup/restore/:backup_id
- **方法**：POST
- **请求体**：
  ```json
  {
    "restore_files": true,
    "restore_database": true,
    "overwrite": false
  }
  ```
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "restore_id": "restore_id",
      "status": "success",
      "message": "恢复完成"
    },
    "message": "备份恢复成功"
  }
  ```

## 六、权限管理

### 1. 权限列表
| 权限名称 | 描述 | API路径 |
|---------|------|--------|
| CONTENT_READ | 读取内容 | /api/v1/contents/* |
| CONTENT_WRITE | 创建/更新/删除内容 | /api/v1/contents/* (POST/PUT/DELETE) |
| TAG_MANAGE | 管理标签 | /api/v1/tags/* |
| SEARCH | 使用搜索功能 | /api/v1/search/* |
| AI_ACCESS | 使用AI功能 | /api/v1/ai/* |
| USER_SETTINGS | 管理用户设置 | /api/v1/user/settings/* |
| IMPORT_EXPORT | 导入/导出功能 | /api/v1/import/*, /api/v1/export/* |
| BACKUP_RESTORE | 备份/恢复功能 | /api/v1/backup/* |

### 2. 角色定义
| 角色名称 | 权限 |
|---------|------|
| 普通用户 | CONTENT_READ, SEARCH, AI_ACCESS, USER_SETTINGS |
| 高级用户 | 普通用户权限 + CONTENT_WRITE, TAG_MANAGE |
| 管理员 | 所有权限 |

## 七、API版本控制

- **当前版本**：v1
- **版本更新策略**：
  - 不兼容的API更改将增加主版本号（如v2）
  - 兼容的API更改将增加次版本号（如v1.1）
  - 文档更新将增加修订版本号（如v1.0.1）

## 八、错误码表

| 错误码 | 描述 | HTTP状态码 |
|-------|------|-----------|
| 10001 | 无效的请求参数 | 400 |
| 10002 | 资源不存在 | 404 |
| 10003 | 未授权访问 | 401 |
| 10004 | 禁止访问 | 403 |
| 10005 | 数据库操作失败 | 500 |
| 10006 | 文件操作失败 | 500 |
| 10007 | AI处理失败 | 500 |
| 10008 | 备份/恢复失败 | 500 |
| 10009 | 导入/导出失败 | 500 |
| 10010 | 服务器内部错误 | 500 |