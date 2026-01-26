# 个人智能知识库部署与扩展方案

## 一、部署方案概述

个人智能知识库采用Electron桌面应用架构，支持跨平台（Windows/macOS/Linux）部署。本方案将详细介绍本地安装部署流程、CI/CD持续集成方案、性能优化策略以及未来的扩展架构设计，确保系统的稳定性、可扩展性和良好的用户体验。

## 二、本地安装部署流程

### 1. 环境准备

#### 系统要求
| 操作系统 | 最低配置 | 推荐配置 |
|---------|---------|---------|
| Windows | Windows 10+，4GB RAM，2GB 磁盘空间 | Windows 11，8GB RAM，10GB 磁盘空间 |
| macOS | macOS 10.14+，4GB RAM，2GB 磁盘空间 | macOS 12+，8GB RAM，10GB 磁盘空间 |
| Linux | Ubuntu 18.04+，4GB RAM，2GB 磁盘空间 | Ubuntu 20.04+，8GB RAM，10GB 磁盘空间 |

#### 依赖安装
- Node.js 16.x 或 18.x
- npm 8.x 或 9.x
- Git（可选，用于克隆代码库）

### 2. 安装方式

#### 方式一：预编译安装包（推荐）

```bash
# Windows
# 下载 .exe 安装包，双击运行安装

# macOS
# 下载 .dmg 安装包，拖拽到 Applications 文件夹

# Linux (Debian/Ubuntu)
dpkg -i knowledge-base_1.0.0_amd64.deb

# Linux (RedHat/CentOS)
rpm -ivh knowledge-base-1.0.0-1.x86_64.rpm
```

#### 方式二：源码编译安装

```bash
# 克隆代码库
git clone https://github.com/yourusername/knowledge-base.git
cd knowledge-base

# 安装依赖
npm install

# 构建应用
npm run build

# 运行应用
npm run start

# 打包应用（生成安装包）
npm run make
```

### 3. 初始配置

首次运行应用时的配置流程：

1. **选择数据存储位置**
   - 默认：用户文档目录下的 `knowledge-base` 文件夹
   - 支持自定义存储路径

2. **选择语言**
   - 支持中文、英文等多语言

3. **AI模型下载**
   - 自动下载轻量级本地AI模型（约500MB）
   - 支持离线使用的核心功能

4. **导入现有数据（可选）**
   - 支持导入Markdown、JSON等格式的现有知识库

## 三、CI/CD持续集成方案

### 1. 持续集成流程

```
代码提交 → 自动测试 → 代码质量检查 → 构建应用 → 生成安装包 → 发布版本
```

### 2. 技术选型

- **CI/CD平台**：GitHub Actions
- **测试框架**：Jest + React Testing Library
- **代码质量**：ESLint + Prettier + TypeScript
- **构建工具**：Electron Forge + Vite

### 3. GitHub Actions配置

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18.x'
    - run: npm install
    - run: npm run test
    - run: npm run lint
    - run: npm run typecheck

  build:
    needs: test
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18.x'
    - run: npm install
    - run: npm run make
    - name: Upload artifacts
      uses: actions/upload-artifact@v3
      with:
        name: installers-${{ matrix.os }}
        path: out/make/*

  release:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
    - uses: actions/checkout@v3
    - name: Download artifacts
      uses: actions/download-artifact@v3
    - name: Create Release
      id: create_release
      uses: actions/create-release@v1
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      with:
        tag_name: v${{ github.run_number }}
        release_name: Release v${{ github.run_number }}
        draft: false
        prerelease: false
    - name: Upload Release Assets
      uses: actions/upload-release-asset@v1
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      with:
        upload_url: ${{ steps.create_release.outputs.upload_url }}
        asset_path: ./installers-*/
        asset_name: knowledge-base-v${{ github.run_number }}-${{ matrix.os }}.zip
        asset_content_type: application/zip
```

## 四、性能优化策略

### 1. 前端性能优化

#### 代码分割
```javascript
// 使用React.lazy进行组件懒加载
import { lazy, Suspense } from 'react';

const KnowledgeGraph = lazy(() => import('./KnowledgeGraph'));
const Editor = lazy(() => import('./Editor'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/graph" element={<KnowledgeGraph />} />
        <Route path="/edit" element={<Editor />} />
      </Routes>
    </Suspense>
  );
}
```

#### 图片优化
```javascript
// 使用Sharp进行图片压缩和格式转换
const sharp = require('sharp');

async function optimizeImage(inputPath, outputPath) {
  await sharp(inputPath)
    .resize(800, 600, { fit: 'inside' })
    .jpeg({ quality: 80 })
    .toFile(outputPath);
}
```

#### 状态管理优化
```javascript
// 使用Zustand的选择器功能减少不必要的重渲染
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useStore = create(persist(
  (set, get) => ({
    documents: [],
    searchResults: [],
    addDocument: (document) => set(state => ({ 
      documents: [...state.documents, document] 
    })),
    setSearchResults: (results) => set({ searchResults: results }),
  }),
  { name: 'knowledge-base-storage' }
));

// 组件中使用选择器
function SearchResults() {
  const searchResults = useStore(state => state.searchResults);
  // 仅当searchResults变化时重新渲染
  return <div>{/* 渲染搜索结果 */}</div>;
}
```

### 2. 后端性能优化

#### 数据库索引优化
```sql
-- SQLite索引优化示例
CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title);
CREATE INDEX IF NOT EXISTS idx_documents_createdAt ON documents(createdAt);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents(tags);
CREATE INDEX IF NOT EXISTS idx_relations_sourceId ON relations(sourceId);
CREATE INDEX IF NOT EXISTS idx_relations_targetId ON relations(targetId);
```

#### 缓存策略
```javascript
// 使用内存缓存减少数据库查询
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 3600 }); // 缓存1小时

async function getDocument(id) {
  // 先从缓存获取
  const cachedDocument = cache.get(`document:${id}`);
  if (cachedDocument) {
    return cachedDocument;
  }
  
  // 缓存未命中，从数据库查询
  const document = await prisma.document.findUnique({ where: { id } });
  
  // 存入缓存
  cache.set(`document:${id}`, document);
  
  return document;
}
```

#### 异步处理
```javascript
// 使用worker_threads处理耗时任务
const { Worker } = require('worker_threads');

function processLargeFile(filePath) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./file-processor.js', {
      workerData: { filePath }
    });
    
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker exited with code ${code}`));
      }
    });
  });
}
```

### 3. AI性能优化

#### 模型优化
```javascript
// 使用更小的AI模型
const { SentenceTransformer } = require('sentence-transformers');

// 使用轻量级模型（约40MB）
const model = new SentenceTransformer('all-MiniLM-L6-v2', {
  device: 'cpu', // 确保在CPU上运行
  cacheFolder: './models' // 自定义模型缓存位置
});

// 批量处理嵌入
async function generateEmbeddings(documents) {
  // 批量处理，每次10个文档
  const batchSize = 10;
  const embeddings = [];
  
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    const batchEmbeddings = await model.encode(batch);
    embeddings.push(...batchEmbeddings);
  }
  
  return embeddings;
}
```

#### 结果缓存
```javascript
// 缓存语义搜索结果
async function semanticSearch(query, topK = 10) {
  const cacheKey = `search:${hash(query)}:${topK}`;
  const cachedResults = cache.get(cacheKey);
  
  if (cachedResults) {
    return cachedResults;
  }
  
  const queryEmbedding = await model.encode([query]);
  const results = await collection.query({
    queryEmbeddings: queryEmbedding,
    nResults: topK,
    include: ['documents', 'metadatas', 'distances']
  });
  
  const formattedResults = results.ids[0].map((id, index) => ({
    id,
    contentId: results.metadatas[0][index].contentId,
    chunk: results.documents[0][index],
    score: 1 - results.distances[0][index]
  }));
  
  // 缓存搜索结果10分钟
  cache.set(cacheKey, formattedResults, 600);
  
  return formattedResults;
}
```

## 五、扩展架构设计

### 1. 模块化扩展架构

```
┌─────────────────────────────────────────────────────────┐
│                     主应用程序                          │
├─────────────────────────────────────────────────────────┤
│ 核心模块 │ 扩展模块接口 │ 插件系统 │ 配置管理 │ 升级系统 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  │ 插件A   │  │ 插件B   │  │ 插件C   │  │ 插件D   │     │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2. 插件系统设计

#### 插件接口规范

```javascript
// 插件接口定义
interface KnowledgeBasePlugin {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  
  // 插件初始化
  initialize: (api: PluginAPI) => Promise<void>;
  
  // 插件销毁
  destroy: () => Promise<void>;
  
  // 插件配置
  config: Record<string, any>;
  
  // 扩展点实现
  extensions: {
    documentImport?: DocumentImportExtension;
    documentExport?: DocumentExportExtension;
    aiService?: AIServiceExtension;
    uiComponent?: UIComponentExtension;
  };
}

// 插件API接口
interface PluginAPI {
  // 文档操作
  documents: {
    get: (id: string) => Promise<Document>;
    getAll: (filters?: DocumentFilters) => Promise<Document[]>;
    create: (document: Omit<Document, 'id'>) => Promise<Document>;
    update: (id: string, document: Partial<Document>) => Promise<Document>;
    delete: (id: string) => Promise<void>;
  };
  
  // AI服务
  ai: {
    generateEmbedding: (text: string) => Promise<number[]>;
    extractEntities: (text: string) => Promise<Entity[]>;
    semanticSearch: (query: string, topK?: number) => Promise<SearchResult[]>;
  };
  
  // UI扩展
  ui: {
    registerComponent: (component: React.ReactNode, location: UILocation) => void;
    addMenuItem: (menuItem: MenuItem) => void;
  };
}
```

#### 插件开发示例

```javascript
// PDF导入插件示例
const pdfParse = require('pdf-parse');
const { TesseractWorker } = require('tesseract.js');

const PDFImportPlugin = {
  id: 'pdf-import-plugin',
  name: 'PDF导入插件',
  version: '1.0.0',
  author: 'Your Name',
  description: '支持PDF文档的导入和解析',
  
  async initialize(api) {
    this.api = api;
    console.log('PDF导入插件初始化完成');
  },
  
  async destroy() {
    console.log('PDF导入插件已销毁');
  },
  
  config: {
    ocrEnabled: true,
    ocrLanguage: 'chi_sim+eng'
  },
  
  extensions: {
    documentImport: {
      supportedFormats: ['.pdf'],
      async importFile(filePath) {
        const worker = new TesseractWorker();
        
        try {
          const dataBuffer = fs.readFileSync(filePath);
          const pdfData = await pdfParse(dataBuffer);
          
          let content = pdfData.text;
          let isScanned = false;
          
          // 判断是否为扫描版PDF
          if (content.trim().length < 100 && pdfData.numpages > 0) {
            isScanned = true;
            const { data: { text } } = await worker.recognize(filePath, this.config.ocrLanguage);
            content = text;
          }
          
          // 创建文档
          const document = {
            title: path.basename(filePath, '.pdf'),
            content: content,
            type: 'document',
            fileType: 'pdf',
            metadata: {
              pageCount: pdfData.numpages,
              isScanned: isScanned,
              originalPath: filePath
            },
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          return await this.api.documents.create(document);
        } finally {
          await worker.terminate();
        }
      }
    }
  }
};

module.exports = PDFImportPlugin;
```

### 3. 未来扩展方向

#### 云服务集成
```javascript
// 云同步服务示例
async function syncWithCloud() {
  const cloudService = getCloudService();
  const localChanges = await getLocalChangesSinceLastSync();
  
  // 上传本地变更
  for (const change of localChanges) {
    await cloudService.uploadChange(change);
  }
  
  // 下载云端变更
  const cloudChanges = await cloudService.getChangesSinceLastSync();
  for (const change of cloudChanges) {
    await applyCloudChange(change);
  }
  
  // 更新同步时间戳
  await updateLastSyncTime();
}
```

#### 多设备同步
```javascript
// 设备同步配置
const syncConfig = {
  enabled: true,
  syncInterval: 3600000, // 每小时同步一次
  syncOnQuit: true,
  conflictResolution: 'keepBoth', // 冲突解决策略
  encrypted: true, // 数据加密传输
  syncItems: ['documents', 'tags', 'relations', 'settings']
};
```

#### 高级AI功能扩展
```javascript
// 本地大语言模型集成示例
const ollama = require('ollama');

async function generateAnswerWithLLM(question, context) {
  const response = await ollama.generate({
    model: 'llama2:7b-chat',
    prompt: `基于以下上下文回答问题:\n\n${context}\n\n问题: ${question}\n\n请基于上下文准确回答，不要添加额外信息。`,
    options: {
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 512
    }
  });
  
  return response.text;
}
```

## 六、维护与升级策略

### 1. 版本管理

采用语义化版本控制（SemVer）：
- **主版本号（Major）**：不兼容的API变更
- **次版本号（Minor）**：向下兼容的功能性新增
- **修订号（Patch）**：向下兼容的问题修正

### 2. 升级机制

#### 自动更新
```javascript
// Electron自动更新配置
const { autoUpdater } = require('electron-updater');

function setupAutoUpdater() {
  // 配置更新服务器
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'yourusername',
    repo: 'knowledge-base',
    releaseType: 'release'
  });
  
  // 检查更新
  autoUpdater.checkForUpdates();
  
  // 更新事件监听
  autoUpdater.on('update-available', () => {
    console.log('发现新版本');
    // 显示更新提示
  });
  
  autoUpdater.on('update-downloaded', () => {
    console.log('更新已下载完成');
    // 提示用户安装更新
    autoUpdater.quitAndInstall();
  });
  
  autoUpdater.on('update-not-available', () => {
    console.log('当前已是最新版本');
  });
  
  autoUpdater.on('error', (error) => {
    console.error('更新检查失败:', error);
  });
}
```

#### 手动更新
- 通过应用内的「检查更新」功能
- 从官网下载最新版本安装包

### 3. 备份与恢复

#### 自动备份
```javascript
// 自动备份功能
const cron = require('node-cron');

// 每天凌晨2点自动备份
cron.schedule('0 2 * * *', async () => {
  await createBackup();
});

async function createBackup() {
  const backupDir = path.join(userDataPath, 'backups');
  const backupFilename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
  const backupPath = path.join(backupDir, backupFilename);
  
  // 创建备份目录
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  // 备份数据库
  await backupDatabase(backupPath);
  
  // 备份文件
  await backupFiles(backupPath);
  
  // 清理旧备份（保留最近7天）
  await cleanupOldBackups(backupDir, 7);
}
```

#### 手动备份与恢复
- 应用内提供「备份」和「恢复」功能
- 支持选择备份文件进行恢复
- 恢复前自动创建当前状态的备份

## 七、总结

本部署与扩展方案详细介绍了个人智能知识库的安装部署流程、CI/CD持续集成方案、性能优化策略以及未来的扩展架构设计。方案采用本地优先的原则，确保在无网络环境下也能正常使用核心功能，同时通过插件系统和模块化设计支持未来的功能扩展和性能优化。

通过GitHub Actions实现的自动化构建和发布流程，确保了应用的质量和稳定性；通过缓存策略、数据库优化和AI模型优化，提升了系统的性能；通过插件系统和云服务集成，为未来的功能扩展提供了灵活的架构支持。

该方案既满足了当前个人智能知识库的需求，也为未来的发展提供了清晰的方向和技术支持。