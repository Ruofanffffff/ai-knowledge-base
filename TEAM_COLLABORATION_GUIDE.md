# 团队协作与冲突处理指南

## 📋 目录
1. [推荐的协作工作流](#推荐的协作工作流)
2. [如何避免冲突](#如何避免冲突)
3. [冲突处理步骤](#冲突处理步骤)
4. [实战场景](#实战场景)
5. [沟通最佳实践](#沟通最佳实践)

---

## 🎯 推荐的协作工作流

### 方案A: Feature分支 + Pull Request (强烈推荐)

这是最安全、最专业的方式:

```bash
# 1. 从最新的main创建新的feature分支
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# 2. 在feature分支上开发
# ... 进行你的修改 ...

# 3. 定期同步main的更新
git fetch origin main
git merge origin/main
# 或使用 rebase: git rebase origin/main

# 4. 推送到远程feature分支
git push origin feature/your-feature-name

# 5. 在GitHub创建Pull Request
# 从 feature/your-feature-name -> main

# 6. 等待review和合并
```

**优点:**
- ✅ 不会直接影响main分支
- ✅ 可以进行代码审查
- ✅ 冲突在合并前就能发现
- ✅ 保持main分支稳定
- ✅ 有完整的讨论记录

### 方案B: 直接在main上工作 (需要协调)

如果团队规模小且沟通顺畅:

```bash
# 1. 开始工作前先拉取最新代码
git checkout main
git pull origin main

# 2. 进行修改
# ... 你的工作 ...

# 3. 提交前再次拉取(重要!)
git pull origin main

# 4. 如果有冲突,解决后再推送
git add .
git commit -m "your message"
git push origin main
```

**缺点:**
- ⚠️ 容易产生冲突
- ⚠️ 可能推送有问题的代码
- ⚠️ 难以回滚

---

## 🛡️ 如何避免冲突

### 1. 沟通协调 (最重要!)

**在开始修改前:**

```markdown
# 在团队群/项目管理工具中发消息:

"大家好,我准备修改以下文件:
- server.js (添加新的API端点)
- routes/userRoutes.js (用户路由重构)
- package.json (添加新依赖)

预计今天下午完成,如果你们也要改这些文件,请告诉我,我们协调一下。"
```

### 2. 模块化开发

**按功能模块划分:**

```
你负责:
- kg/ 目录 (知识图谱)
- routes/knowledgeGraphRoutes.js

同伴负责:
- client/ 目录 (前端)
- routes/authRoutes.js
```

### 3. 频繁同步

```bash
# 每天开始工作前
git pull origin main

# 每次提交前
git pull origin main

# 设置定时提醒(每2-3小时)
git fetch origin main
git status
```

### 4. 使用分支保护规则

在GitHub仓库设置中:
- Settings -> Branches -> Add rule
- 要求PR审查
- 要求CI测试通过
- 禁止直接推送到main

---

## 🔧 冲突处理步骤

### 场景1: 推送时发现冲突

```bash
# 你尝试推送
git push origin main

# 错误信息:
# ! [rejected]        main -> main (fetch first)
# error: failed to push some refs
```

**解决步骤:**

```bash
# 1. 拉取远程更新
git pull origin main

# 2. Git会提示冲突
# CONFLICT (content): Merge conflict in server.js
# Automatic merge failed; fix conflicts and then commit the result.

# 3. 查看冲突文件
git status

# 4. 打开冲突文件,会看到:
<<<<<<< HEAD
你的代码
=======
同伴的代码
>>>>>>> origin/main

# 5. 手动解决冲突(保留需要的代码)
# 删除冲突标记,保留正确的代码

# 6. 标记为已解决
git add server.js

# 7. 完成合并
git commit -m "merge: 解决与同伴的冲突"

# 8. 推送
git push origin main
```

### 场景2: Pull Request中的冲突

```bash
# GitHub会显示: "This branch has conflicts that must be resolved"

# 方法1: 在本地解决
git checkout feature/your-feature
git pull origin main
# 解决冲突
git add .
git commit -m "resolve conflicts with main"
git push origin feature/your-feature

# 方法2: 使用GitHub的冲突编辑器
# 在PR页面点击 "Resolve conflicts"
# 在网页上编辑解决冲突
```

### 场景3: 复杂冲突

如果冲突太多或太复杂:

```bash
# 1. 备份你的更改
git stash save "我的修改备份"

# 2. 重置到远程main
git fetch origin main
git reset --hard origin/main

# 3. 重新应用你的更改
git stash pop

# 4. 手动重新实现你的功能
# (这次基于最新的代码)

# 5. 测试确保没问题
npm test

# 6. 提交推送
git add .
git commit -m "feat: 基于最新main重新实现功能"
git push origin main
```

---

## 💡 实战场景

### 场景A: 你和同伴同时修改server.js

**最佳实践:**

```bash
# 你的工作流:
# 1. 创建feature分支
git checkout -b feature/add-kg-api

# 2. 只修改你负责的部分
# 在server.js中添加KG相关的路由

# 3. 推送feature分支
git push origin feature/add-kg-api

# 4. 创建PR,等待合并

# 同伴的工作流:
# 1. 创建另一个feature分支
git checkout -b feature/add-auth-api

# 2. 修改auth相关的部分
# 3. 推送并创建PR

# 结果:
# - 两个PR可以独立review
# - 第一个合并后,第二个可能需要解决冲突
# - 但冲突范围小,容易解决
```

### 场景B: 紧急修复需要直接推送到main

```bash
# 1. 先通知团队
# "紧急修复:修复生产环境bug,需要直接推送main"

# 2. 拉取最新代码
git pull origin main

# 3. 快速修复
# ... 修改代码 ...

# 4. 测试
npm test

# 5. 提交推送
git add .
git commit -m "hotfix: 修复XXX严重bug"
git push origin main

# 6. 通知团队
# "已推送hotfix到main,请大家拉取最新代码"
```

### 场景C: 发现同伴的代码有问题

**不要直接修改,而是:**

```bash
# 1. 创建issue或在群里讨论
# "发现auth模块有个bug,我可以修复吗?"

# 2. 等待回复后再行动
# 如果同伴正在修改,让他修复
# 如果同伴同意,你创建PR修复

# 3. 创建修复分支
git checkout -b fix/auth-bug

# 4. 修复并创建PR
# 在PR中@同伴review
```

---

## 📞 沟通最佳实践

### 1. 建立协作规范

创建 `CONTRIBUTING.md`:

```markdown
# 协作规范

## 分支命名
- feature/功能名 - 新功能
- fix/bug名 - bug修复
- docs/文档名 - 文档更新
- refactor/模块名 - 重构

## 提交信息格式
feat: 新功能
fix: bug修复
docs: 文档
style: 格式
refactor: 重构
test: 测试
chore: 构建工具

## 工作流程
1. 从main创建feature分支
2. 开发并测试
3. 创建PR
4. 等待review
5. 合并到main

## 代码审查
- 所有PR需要至少1人review
- 修复review意见后才能合并
- 保持PR小而专注
```

### 2. 使用项目管理工具

**推荐工具:**
- GitHub Projects
- Trello
- Notion
- 飞书/钉钉

**任务分配示例:**

```
看板:
┌─────────────┬─────────────┬─────────────┐
│   待办      │   进行中    │   已完成    │
├─────────────┼─────────────┼─────────────┤
│ KG优化      │ Android适配 │ 用户认证    │
│ (你)        │ (同伴)      │ (已合并)    │
└─────────────┴─────────────┴─────────────┘
```

### 3. 定期同步会议

**每日站会 (5-10分钟):**
- 昨天做了什么
- 今天计划做什么
- 有什么阻碍

**每周回顾:**
- 本周完成的功能
- 遇到的问题
- 下周计划

### 4. 代码审查清单

**Review时检查:**
- [ ] 代码风格一致
- [ ] 没有明显bug
- [ ] 测试覆盖充分
- [ ] 文档已更新
- [ ] 没有敏感信息
- [ ] 性能没有明显下降

---

## 🚨 冲突处理决策树

```
遇到冲突?
    │
    ├─ 冲突小(1-2个文件,几行代码)
    │   └─> 直接解决,合并推送
    │
    ├─ 冲突中等(多个文件,但逻辑清晰)
    │   └─> 和同伴沟通,协商解决方案
    │
    └─ 冲突大(大量文件,逻辑复杂)
        └─> 开会讨论,可能需要重构
```

---

## 📝 冲突解决模板

### 沟通模板

```markdown
Hi [同伴名字],

我在合并代码时发现了冲突:
- 文件: server.js, routes/api.js
- 冲突原因: 我们都修改了API路由部分

我的修改:
- 添加了KG相关的API端点
- 修改了错误处理中间件

你的修改:
- 添加了Auth相关的API端点
- 修改了CORS配置

建议解决方案:
1. 保留双方的API端点
2. 合并错误处理和CORS配置
3. 我来处理合并,你review一下

你觉得怎么样?
```

### 冲突解决记录

```markdown
# 冲突解决记录

日期: 2026-02-04
文件: server.js
冲突方: 你 vs 同伴

## 冲突内容
- 你: 添加KG API
- 同伴: 添加Auth API

## 解决方案
- 保留双方的修改
- 调整代码顺序,KG在前,Auth在后
- 统一错误处理格式

## 测试结果
- ✅ 服务器启动正常
- ✅ KG API测试通过
- ✅ Auth API测试通过

## 经验教训
- 下次修改server.js前先沟通
- 考虑将路由拆分到独立文件
```

---

## 🎓 总结建议

### 对于你的情况:

**推荐方案:**

```bash
# 1. 和同伴沟通
"我想修改main分支的XXX功能,你最近在改什么?"

# 2. 确认没有冲突后,创建feature分支
git checkout main
git pull origin main
git checkout -b feature/your-changes

# 3. 进行修改
# ... 你的工作 ...

# 4. 定期同步main
git fetch origin main
git merge origin/main

# 5. 完成后创建PR
git push origin feature/your-changes
# 在GitHub创建PR

# 6. 通知同伴review
"PR已创建,请帮忙review一下"

# 7. 合并后通知
"已合并到main,请拉取最新代码"
```

### 关键原则:

1. **沟通第一** - 开始前、进行中、完成后都要沟通
2. **小步快跑** - 频繁提交,小的PR更容易review
3. **测试充分** - 合并前确保测试通过
4. **文档同步** - 更新相关文档
5. **互相尊重** - 理解对方的工作,协商解决冲突

### 工具推荐:

- **VS Code插件**: GitLens (可视化Git历史)
- **命令行工具**: tig (更好的git log)
- **冲突解决**: Meld, Beyond Compare
- **沟通工具**: Slack, Discord, 飞书

---

## 📚 延伸阅读

- [Git分支管理策略](https://nvie.com/posts/a-successful-git-branching-model/)
- [如何写好Commit Message](https://www.conventionalcommits.org/)
- [代码审查最佳实践](https://google.github.io/eng-practices/review/)
