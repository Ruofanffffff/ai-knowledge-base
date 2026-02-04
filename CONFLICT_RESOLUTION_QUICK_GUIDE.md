# 冲突解决快速指南 🚀

## 🎯 推荐工作流 (5步法)

```bash
# 1️⃣ 沟通 - 告诉同伴你要改什么
"我准备修改server.js添加新API,你在改这个文件吗?"

# 2️⃣ 创建分支 - 不要直接在main上改
git checkout main
git pull origin main
git checkout -b feature/my-changes

# 3️⃣ 开发 - 在分支上工作
# ... 进行修改 ...
git add .
git commit -m "feat: 添加新功能"

# 4️⃣ 同步 - 定期合并main的更新
git fetch origin main
git merge origin/main
# 如果有冲突,现在就解决

# 5️⃣ PR - 创建Pull Request
git push origin feature/my-changes
# 在GitHub创建PR,等待review和合并
```

---

## ⚡ 遇到冲突怎么办?

### 情况A: 推送时被拒绝

```bash
# 错误: ! [rejected] main -> main (fetch first)

# 解决:
git pull origin main          # 拉取更新
# 如果有冲突,编辑文件解决
git add .                     # 标记已解决
git commit -m "merge: 解决冲突"
git push origin main          # 重新推送
```

### 情况B: 文件中出现冲突标记

```javascript
<<<<<<< HEAD
// 你的代码
const myFunction = () => {
  console.log('我的实现');
}
=======
// 同伴的代码
const myFunction = () => {
  console.log('同伴的实现');
}
>>>>>>> origin/main
```

**解决步骤:**

1. **分析** - 理解双方的修改意图
2. **决策** - 保留哪个?还是合并?
3. **编辑** - 删除标记,保留正确代码
4. **测试** - 确保功能正常
5. **提交** - git add + commit

**示例解决:**

```javascript
// 合并后的代码
const myFunction = () => {
  console.log('我的实现');
  console.log('同伴的实现');
}
```

---

## 💬 沟通模板

### 开始工作前

```
Hi @同伴,
我准备修改以下文件:
- server.js (添加KG API)
- routes/kgRoutes.js (新建)

预计今天完成,如果你也要改这些文件,我们协调一下时间。
```

### 发现冲突时

```
@同伴 发现冲突了:
文件: server.js
我的修改: 添加了XXX功能
你的修改: 添加了YYY功能

我建议: 保留双方的修改,我来合并,你review一下?
```

### 完成合并后

```
✅ 冲突已解决并推送到main
主要改动:
- 保留了双方的API端点
- 统一了错误处理格式
- 测试全部通过

请拉取最新代码: git pull origin main
```

---

## 🛠️ 常用命令速查

```bash
# 查看状态
git status                    # 查看当前状态
git log --oneline -5          # 查看最近5次提交
git diff                      # 查看未暂存的修改

# 同步代码
git fetch origin main         # 获取远程更新(不合并)
git pull origin main          # 获取并合并
git merge origin/main         # 合并远程main到当前分支

# 解决冲突
git status                    # 查看冲突文件
git add <file>                # 标记冲突已解决
git commit                    # 完成合并
git merge --abort             # 放弃合并

# 分支操作
git branch                    # 查看本地分支
git branch -a                 # 查看所有分支
git checkout -b feature/xxx   # 创建并切换分支
git push origin feature/xxx   # 推送分支

# 撤销操作
git restore <file>            # 撤销未暂存的修改
git restore --staged <file>   # 取消暂存
git reset --hard HEAD         # 撤销所有修改(危险!)
git stash                     # 暂存当前修改
git stash pop                 # 恢复暂存的修改
```

---

## 🚨 紧急情况处理

### 情况1: 推送了错误代码到main

```bash
# 方法1: Revert (推荐)
git revert <commit-hash>      # 创建一个反向提交
git push origin main

# 方法2: Reset (危险,需要团队协调)
git reset --hard <good-commit>
git push origin main --force
# ⚠️ 使用前必须通知所有人!
```

### 情况2: 冲突太复杂,想重新开始

```bash
# 1. 备份你的修改
git stash save "我的修改备份"

# 2. 重置到远程main
git fetch origin main
git reset --hard origin/main

# 3. 重新应用修改
git stash pop
# 或者手动重新实现功能
```

### 情况3: 不小心在main上修改了

```bash
# 还没提交:
git stash                     # 暂存修改
git checkout -b feature/xxx   # 创建新分支
git stash pop                 # 恢复修改

# 已经提交但没推送:
git reset --soft HEAD~1       # 撤销提交,保留修改
git checkout -b feature/xxx   # 创建新分支
git add .
git commit -m "feat: xxx"
```

---

## ✅ 最佳实践检查清单

### 开始工作前
- [ ] 和同伴沟通要修改的文件
- [ ] 拉取最新的main代码
- [ ] 创建feature分支

### 开发过程中
- [ ] 频繁提交(每完成一个小功能)
- [ ] 每天至少同步一次main
- [ ] 写清晰的commit message

### 提交前
- [ ] 运行测试确保通过
- [ ] 检查代码格式
- [ ] 更新相关文档
- [ ] 再次拉取main确保最新

### 创建PR后
- [ ] 写清楚PR描述
- [ ] 通知同伴review
- [ ] 及时回复review意见
- [ ] 合并后通知团队

---

## 🎓 记住这3个原则

1. **沟通优先** 
   - 开始前问一句,能避免90%的冲突

2. **小步快跑**
   - 频繁提交,小的PR更容易合并

3. **测试保障**
   - 合并前确保测试通过,不要破坏别人的代码

---

## 📞 需要帮助?

- 查看详细指南: `TEAM_COLLABORATION_GUIDE.md`
- Git官方文档: https://git-scm.com/doc
- 团队内部讨论: [你们的沟通渠道]

---

## 💡 一句话总结

**"先沟通,用分支,勤同步,小PR,多测试"**

这样就能避免99%的冲突问题! 🎉
