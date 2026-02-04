# 个人智能知识库 - Android App

基于Capacitor框架封装的Android移动应用，完全复用Web端功能和界面。

## 功能特性

- ✅ 完整的Web端功能移植
- ✅ 响应式设计，自适应各种屏幕尺寸
- ✅ 触摸优化，提供原生应用体验
- ✅ 支持横竖屏切换
- ✅ 适配刘海屏等特殊屏幕
- ✅ 流畅的动画和过渡效果

## 技术栈

- **前端框架**: React + TypeScript + Vite
- **UI组件库**: Ant Design
- **移动端框架**: Capacitor
- **路由**: React Router
- **状态管理**: Zustand
- **数据可视化**: D3.js

## 快速开始

### 环境要求

- Node.js >= 16.x
- npm >= 8.x
- Android Studio (用于构建和调试)
- Android SDK >= API 21 (Android 5.0)

### 安装依赖

```bash
npm install
cd client
npm install
cd ..
```

### 开发模式

1. 启动开发服务器并实时预览：

```bash
npm run android:dev
```

2. 或者分步操作：

```bash
# 终端1: 启动前端开发服务器
cd client && npm run dev

# 终端2: 在Android设备上运行
npm run android:run
```

### 构建生产版本

```bash
npm run android:build
```

构建完成后，APK文件位于：
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### 其他命令

```bash
# 同步代码到Android平台
npm run android:sync

# 在Android Studio中打开项目
npm run android:open

# 在连接的Android设备上运行
npm run android:run
```

## 项目结构

```
.
├── client/                 # React前端项目
│   ├── src/
│   │   ├── pages/         # 页面组件
│   │   ├── App.tsx       # 主应用组件
│   │   └── index.css     # 全局样式（包含响应式设计）
│   └── dist/             # 构建输出目录
├── android/               # Android原生项目
│   └── app/
│       └── src/main/
│           └── assets/    # Web资源
├── capacitor.config.json  # Capacitor配置文件
├── build-android.sh       # Android构建脚本
└── dev-android.sh        # Android开发脚本
```

## 响应式设计

### 断点设置

- **桌面端**: > 768px
- **平板端**: 768px - 480px
- **手机端**: < 480px

### 自适应特性

1. **字体大小**: 根据屏幕尺寸自动调整
2. **布局**: 桌面端显示侧边栏，移动端显示汉堡菜单
3. **触摸优化**: 按钮和输入框最小高度44px，便于触摸操作
4. **横竖屏适配**: 自动调整布局和间距
5. **安全区域**: 适配刘海屏等特殊屏幕

### 测试不同屏幕尺寸

在Chrome开发者工具中：
1. 打开开发者工具 (F12)
2. 点击设备工具栏图标 (Ctrl+Shift+M)
3. 选择不同的设备预设或自定义尺寸

## Android Studio调试

1. 打开Android Studio
2. 选择 "Open an Existing Project"
3. 导航到项目的 `android/` 目录
4. 等待Gradle同步完成
5. 点击 Run 按钮或使用快捷键 Shift+F10

## 常见问题

### 构建失败

确保已安装Android SDK和必要的构建工具：

```bash
# 检查Android SDK路径
echo $ANDROID_HOME

# 如果未设置，在 ~/.bashrc 或 ~/.zshrc 中添加：
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

### 设备连接问题

```bash
# 检查连接的设备
adb devices

# 如果设备未显示，尝试：
adb kill-server
adb start-server
```

### 热重载不工作

确保开发服务器在运行，并且设备可以通过局域网访问：

```bash
# 查看本地IP地址
ipconfig getifaddr en0

# 在capacitor.config.json中配置服务器地址
```

## 性能优化

### 代码分割

使用动态导入减少初始加载体积：

```typescript
const Home = lazy(() => import('./pages/Home'))
const Search = lazy(() => import('./pages/Search'))
```

### 图片优化

- 使用WebP格式
- 压缩图片大小
- 使用懒加载

### 缓存策略

- 启用Service Worker缓存
- 使用localStorage存储用户偏好设置

## 发布到应用商店

### 生成签名密钥

```bash
keytool -genkey -v -keystore my-release-key.keystore -alias alias_name -keyalg RSA -keysize 2048 -validity 10000
```

### 配置签名

在 `android/app/build.gradle` 中配置签名信息。

### 构建发布版本

```bash
cd android
./gradlew assembleRelease
```

### 上传到Google Play

1. 创建Google Play开发者账号
2. 创建应用并填写应用信息
3. 上传APK或AAB文件
4. 填写商店列表信息
5. 提交审核

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！