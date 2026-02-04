# 前端故障排除指南

## 常见问题

### 1. 控制台出现 `sqlcipher_attribute is Expected` 错误

**问题描述：**
浏览器控制台显示多个 `sqlcipher_attribute is Expected` 错误。

**原因：**
这些错误通常由以下原因引起：
- 浏览器扩展（如密码管理器、广告拦截器等）尝试访问页面对象的不存在属性
- React DevTools 或其他开发工具的兼容性问题
- 某些浏览器扩展尝试注入代码到页面中

**解决方案：**

1. **禁用浏览器扩展**
   - 打开浏览器的隐身/无痕模式（通常会禁用扩展）
   - 或者逐个禁用扩展来找出问题源

2. **清除浏览器缓存**
   ```bash
   # Chrome/Edge: Ctrl+Shift+Delete
   # 选择"缓存的图像和文件"
   ```

3. **更新浏览器**
   - 确保使用最新版本的 Chrome、Edge 或 Firefox

4. **代码层面的修复**
   - 我们已经在 `client/src/main.tsx` 中添加了错误过滤器
   - 在 `client/src/components/ErrorBoundary.tsx` 中添加了错误边界
   - 这些修改会自动过滤掉这类错误

### 2. DevTools 在中文环境下不可用

**问题描述：**
Chrome DevTools 提示 "DevTools is not available in Chinese"

**解决方案：**
1. 打开 Chrome 设置
2. 搜索 "语言" (Language)
3. 将英语添加到首选语言列表
4. 重启浏览器

或者：
- 使用 `--lang=en` 参数启动 Chrome
- 在 DevTools 设置中切换语言

### 3. 图形可视化页面交互问题

**问题描述：**
知识图谱页面的节点拖拽不工作

**解决方案：**
我们已经重构了 Graph 组件，使用原生的鼠标事件而不是 framer-motion 的 drag API：
- 节点现在可以通过鼠标拖拽移动
- 缩放功能通过工具栏按钮实现
- 悬停效果正常工作

## 开发建议

### 推荐的浏览器设置

1. **使用最新版本的浏览器**
   - Chrome 120+
   - Edge 120+
   - Firefox 120+

2. **开发时禁用不必要的扩展**
   - 保留 React DevTools
   - 禁用广告拦截器
   - 禁用密码管理器的自动填充

3. **使用隐身模式进行测试**
   - 可以快速排除扩展引起的问题

### 调试技巧

1. **查看真实错误**
   ```javascript
   // 在控制台中运行
   console.error = console.error.bind(console);
   ```

2. **检查网络请求**
   - 打开 DevTools Network 标签
   - 查看 API 请求是否成功
   - 检查响应状态码

3. **React DevTools**
   - 安装 React DevTools 扩展
   - 查看组件树和状态
   - 使用 Profiler 分析性能

## 性能优化

### 如果页面加载缓慢

1. **清除缓存**
   ```bash
   npm run build
   ```

2. **检查网络**
   - 确保后端服务器正在运行
   - 检查 API 端点是否可访问

3. **优化构建**
   ```bash
   # 生产构建
   npm run build
   npm run preview
   ```

## 联系支持

如果问题仍然存在：
1. 检查 GitHub Issues
2. 查看项目文档
3. 联系开发团队
