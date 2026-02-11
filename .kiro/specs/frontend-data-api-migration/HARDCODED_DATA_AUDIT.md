# 硬编码数据审计报告

## 审计日期
2026-02-09

## 发现的硬编码数据

### 1. Dashboard.tsx - recentDocs 数组

**位置**: `client/src/pages/Dashboard.tsx`, 第 29 行

**数据内容**:
```typescript
const recentDocs = [
  { id: 1, title: 'AI 研究战略 2024', type: 'doc', updated: '2 小时前', tags: ['战略', 'AI'] },
  { id: 2, title: '神经网络架构', type: 'doc', updated: '5 小时前', tags: ['技术', '深度学习'] },
  { id: 3, title: '项目头脑风暴', type: 'folder', updated: '昨天', items: 12 },
  { id: 4, title: '竞品分析', type: 'doc', updated: '2 天前', tags: ['商业'] },
];
```

**分析**:
- 这是演示数据，应该从后端 API 获取
- 后端已有 `/api/documents` 端点可以提供文档列表
- 需要迁移到使用 `apiService.getDocuments()` 并按更新时间排序取前 N 条

**建议操作**: 迁移到 API

---

### 2. Community.tsx - tabs 数组

**位置**: `client/src/pages/Community.tsx`, 第 166 行

**数据内容**:
```typescript
const tabs = ['Top Day', 'Likes', 'Styles', 'Images', 'Videos'];
```

**分析**:
- 这是 UI 导航标签，属于静态配置数据
- 不需要从后端 API 获取
- 这是前端 UI 组件的一部分，不属于业务数据

**建议操作**: 保留（不需要迁移）

---

### 3. Community.tsx - initialArtworks 数组

**位置**: `client/src/pages/Community.tsx`, 第 17 行

**数据内容**:
```typescript
const initialArtworks: ArtWork[] = [
  // 14 个艺术作品对象，包含 id, url, title, author, avatar, likes, isLiked, prompt
];
```

**分析**:
- 这是社区艺术作品的演示数据
- 后端目前没有对应的 API 端点（没有 `/api/artworks` 或 `/api/community` 端点）
- Community 页面似乎是一个独立的功能模块，可能需要单独的后端支持

**建议操作**: 
- **选项 1**: 如果 Community 功能不在当前 spec 范围内，可以暂时保留
- **选项 2**: 如果需要迁移，需要先在后端创建相应的 API 端点
- **当前决策**: 标记为"需要后端支持"，暂不迁移

---

### 4. DocumentsList.tsx - sizes 数组

**位置**: `client/src/pages/DocumentsList.tsx`, 第 45 行

**数据内容**:
```typescript
const sizes = ['B', 'KB', 'MB', 'GB'];
```

**分析**:
- 这是文件大小格式化的常量数组
- 属于工具函数的一部分，不是业务数据
- 不需要从后端 API 获取

**建议操作**: 保留（不需要迁移）

---

## 总结

### 需要迁移的硬编码数据
1. **Dashboard.tsx - recentDocs**: 需要迁移到 `/api/documents` API

### 不需要迁移的数据
1. **Community.tsx - tabs**: UI 配置数据
2. **DocumentsList.tsx - sizes**: 工具函数常量

### 需要后端支持的数据
1. **Community.tsx - initialArtworks**: 需要创建 `/api/artworks` 或 `/api/community` 端点

---

## 下一步行动

1. ✅ 完成审计并记录发现
2. ⏭️ 迁移 Dashboard.tsx 的 recentDocs 到 API
3. ⏭️ 搜索 demo 数据函数（Task 11.2）
4. ⏭️ 编写属性测试验证无硬编码数据（Task 11.3）


---

## Demo 数据函数审计 (Task 11.2)

### 搜索结果

已搜索以下模式：
- `function.*demo` 或 `const.*demo.*=.*(` 或 `demo.*=.*function`
- `function.*mock` 或 `const.*mock.*=.*(` 或 `mock.*=.*function`
- `generateDemo*`
- `getDemo*`

### 发现

✅ **未发现任何 demo 数据生成函数**

所有之前的 demo 数据函数（如 `getDemoNodes()`, `getDemoLinks()` 等）已在之前的任务中被成功删除。

测试文件中的 mock 函数（如 `mockFetch`, `mockOnNavigate`）是正常的测试辅助函数，不属于需要清理的范围。

### 结论

前端代码库中已经没有 demo 数据生成函数，Task 11.2 完成。
