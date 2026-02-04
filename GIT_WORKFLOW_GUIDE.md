# Git工作流程指南

## 当前分支状态

- **当前分支**: KnowlegeGraghpy (feature分支)
- **主分支**: main
- **状态**: 领先远程分支2个提交

## 推送代码到GitHub

### ✅ 安全推送 (推荐)

推送到feature分支**不会影响main分支**:

```bash
# 1. 查看当前状态
git status

# 2. 添加需要提交的文件
git add .gitignore
git add MERGE_SUMMARY.md
git add kg/DOCUMENTATION_UPDATE_SUMMARY.md
git add kg/pipeline/IMPLEMENTATION_SUMMARY.md

# 3. 提交更改
git commit -m "docs: 更新文档和gitignore配置"

# 4. 推送到feature分支
git push origin KnowlegeGraghpy
```

**结果**: 
- ✅ 只更新 `KnowlegeGraghpy` 分支
- ✅ `main` 分支完全不受影响
- ✅ 其他开发者可以看到你的工作

## 合并到Main分支

### 方式1: Pull Request (强烈推荐)

这是团队协作的标准方式:

```bash
# 1. 推送feature分支
git push origin KnowlegeGraghpy

# 2. 在GitHub网页上操作:
#    - 进入仓库页面
#    - 点击 "Pull requests"
#    - 点击 "New pull request"
#    - 选择: base: main <- compare: KnowlegeGraghpy
#    - 填写PR描述
#    - 创建PR

# 3. 等待Review和批准

# 4. 在GitHub上点击 "Merge pull request"
```

**优点**:
- 代码审查机会
- 可以讨论和改进
- 保留完整的历史记录
- CI/CD自动测试

### 方式2: 直接合并 (需谨慎)

仅在你是唯一开发者或紧急情况下使用:

```bash
# 1. 确保feature分支是最新的
git checkout KnowlegeGraghpy
git pull origin KnowlegeGraghpy

# 2. 切换到main分支
git checkout main

# 3. 拉取最新的main
git pull origin main

# 4. 合并feature分支
git merge KnowlegeGraghpy

# 5. 解决冲突(如果有)

# 6. 推送到远程main
git push origin main

# 7. 切回feature分支继续工作
git checkout KnowlegeGraghpy
```

## 不应该提交的文件

以下文件已添加到 `.gitignore`:

```
# 运行时数据
data/knowledge-graph.json
data/recommendations.json

# 数据库文件
prisma/knowledge-base.db
prisma/knowledge-base.db-journal

# 统计文件
kg/field_normalizer/.synonym_dict_stats.json
```

如果这些文件已经被追踪,需要移除:

```bash
# 从Git追踪中移除(但保留本地文件)
git rm --cached data/knowledge-graph.json
git rm --cached prisma/knowledge-base.db
git rm --cached kg/field_normalizer/.synonym_dict_stats.json

# 提交移除操作
git commit -m "chore: 从版本控制中移除运行时文件"
```

## 常见场景

### 场景1: 我想保存工作但不合并到main

```bash
# 直接推送到feature分支
git add .
git commit -m "feat: 你的功能描述"
git push origin KnowlegeGraghpy
```

### 场景2: main分支有新更新,我想同步

```bash
# 1. 提交当前工作
git add .
git commit -m "wip: 保存当前工作"

# 2. 拉取main的更新
git fetch origin main

# 3. 合并main到feature分支
git merge origin/main

# 4. 解决冲突(如果有)

# 5. 推送更新后的feature分支
git push origin KnowlegeGraghpy
```

### 场景3: 我想放弃某些更改

```bash
# 放弃单个文件的更改
git restore data/knowledge-graph.json

# 放弃所有未暂存的更改
git restore .

# 放弃已暂存但未提交的更改
git restore --staged .
```

## 最佳实践

1. **频繁提交** - 小步提交,便于回滚
2. **清晰的提交信息** - 使用约定式提交格式
3. **使用PR** - 即使是个人项目,也能保持代码质量
4. **定期同步main** - 避免分支差异过大
5. **不提交敏感信息** - 检查 .env 和密钥文件

## 提交信息格式

使用约定式提交:

```
feat: 添加新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 重构代码
test: 添加测试
chore: 构建/工具链更新
```

示例:
```bash
git commit -m "feat: 实现三阶段Schema匹配算法"
git commit -m "fix: 修复实体合并时的空指针异常"
git commit -m "docs: 更新API文档和使用指南"
```

## 紧急回滚

如果推送了错误的代码到main:

```bash
# 1. 查看提交历史
git log --oneline

# 2. 回滚到指定提交
git reset --hard <commit-hash>

# 3. 强制推送(危险操作!)
git push origin main --force

# 更安全的方式: 使用revert
git revert <commit-hash>
git push origin main
```

## 总结

- ✅ 推送到 `KnowlegeGraghpy` 分支是安全的
- ✅ 不会影响 `main` 分支
- ✅ 使用PR合并到main是最佳实践
- ⚠️ 注意不要提交运行时数据文件
