# 个人智能知识库数据导入和解析功能规划

## 一、导入功能概述

数据导入是知识库的核心功能之一，需要支持多种文件格式的批量导入和解析。系统将提供直观的导入界面和高效的解析引擎，确保用户能够轻松将分散的知识资产整合到知识库中。

## 二、导入流程设计

```
用户选择文件 → 文件验证 → 批量导入 → 格式检测 → 解析处理 → 元数据提取 → 内容存储 → 嵌入生成 → 完成通知
```

### 1. 文件选择与验证
- **支持的文件格式**：.md, .docx, .pdf, .txt
- **批量导入**：支持选择单个文件或整个文件夹
- **文件验证**：检查文件格式、大小、完整性
- **重复检测**：根据文件名、内容哈希检测重复文件

### 2. 导入界面
```
┌───────────────────────────────────────────────────────────────────────────┐
│                              导入界面                                     │
├───────────────────────────────────────────────────────────────────────────┤
│  [ 选择文件 ] [ 选择文件夹 ] [ 开始导入 ] [ 取消 ]                       │
├───────────────────────────────────────────────────────────────────────────┤
│                              导入列表                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  文件名            大小       状态           进度                    │ │
│  │  ────────────────────────────────────────────────────────────────── │ │
│  │  文档1.md         10KB      等待中           0%                     │ │
│  │  文档2.pdf        500KB     解析中           50%                    │ │
│  │  文档3.docx       200KB     导入成功         100%                   │ │
│  │  文档4.txt        5KB       解析失败         0%                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
├───────────────────────────────────────────────────────────────────────────┤
│                              导入设置                                     │
│  [ ] 自动生成标签     [ ] 提取实体     [ ] 生成摘要     [ ] 启用OCR       │ │
└───────────────────────────────────────────────────────────────────────────┘
```

## 三、多格式解析方案

### 1. Markdown (.md) 解析

**技术栈**：
- **marked**：Markdown解析器
- **gray-matter**：YAML前置元数据解析

**解析流程**：
1. 读取Markdown文件内容
2. 使用gray-matter解析文件开头的YAML元数据（标题、标签、作者等）
3. 使用marked解析正文内容为HTML或AST
4. 提取标题、段落、列表、代码块、图片、链接等元素
5. 构建文档结构

**实现示例**：
```javascript
import { marked } from 'marked';
import matter from 'gray-matter';
import fs from 'fs';

function parseMarkdown(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // 解析YAML元数据
  const { data, content: body } = matter(content);
  
  // 解析正文为HTML
  const html = marked(body);
  
  // 提取文档结构
  const tokens = marked.lexer(body);
  const headings = tokens.filter(token => token.type === 'heading');
  const images = tokens.filter(token => token.type === 'image');
  
  return {
    metadata: {
      title: data.title || headings[0]?.text || '无标题',
      tags: data.tags || [],
      author: data.author,
      source_url: data.source_url,
      created_at: data.created_at || new Date()
    },
    content: {
      raw: content,
      html,
      structure: {
        headings,
        images
      }
    },
    file_info: {
      file_path: filePath,
      file_type: 'md',
      size: fs.statSync(filePath).size
    }
  };
}
```

### 2. Word (.docx) 解析

**技术栈**：
- **docx**：Node.js的docx解析库
- **jszip**：处理zip压缩文件

**解析流程**：
1. 读取docx文件（本质是zip压缩文件）
2. 解析document.xml获取文档内容
3. 提取段落、标题、表格、图片等元素
4. 转换为Markdown或HTML格式
5. 提取文档属性（作者、创建时间等）

**实现示例**：
```javascript
import { Document, Packer, Paragraph, TextRun } from 'docx';
import fs from 'fs';

function parseDocx(filePath) {
  const content = fs.readFileSync(filePath);
  
  // 使用docx库解析文件
  const doc = new Document(content);
  
  // 提取文档属性
  const properties = doc.getCoreProperties();
  
  // 提取段落和标题
  const paragraphs = doc.getBody().getParagraphs();
  let markdownContent = '';
  
  paragraphs.forEach(paragraph => {
    const text = paragraph.getText();
    const headingLevel = paragraph.getHeadingLevel();
    
    if (headingLevel > 0) {
      markdownContent += `${'#'.repeat(headingLevel)} ${text}\n\n`;
    } else {
      markdownContent += `${text}\n\n`;
    }
  });
  
  // 提取表格
  const tables = doc.getBody().getTables();
  tables.forEach(table => {
    markdownContent += '|';
    // 处理表格内容...
  });
  
  // 提取图片
  const images = doc.getImages();
  const imagePaths = images.map((image, index) => {
    const imagePath = `/tmp/docx_image_${index}.png`;
    fs.writeFileSync(imagePath, image.getData());
    return imagePath;
  });
  
  return {
    metadata: {
      title: properties.getTitle() || '无标题',
      author: properties.getCreator(),
      created_at: properties.getCreated(),
      updated_at: properties.getModified()
    },
    content: {
      raw: markdownContent,
      html: marked(markdownContent),
      images: imagePaths
    },
    file_info: {
      file_path: filePath,
      file_type: 'docx',
      size: fs.statSync(filePath).size
    }
  };
}
```

### 3. PDF (.pdf) 解析

**技术栈**：
- **pdf-parse**：解析可搜索PDF
- **Tesseract.js**：OCR文字识别（扫描版PDF）
- **pdf-lib**：PDF操作库

**解析流程**：
1. 检测PDF类型（可搜索或扫描版）
2. 可搜索PDF：使用pdf-parse直接提取文本
3. 扫描版PDF：使用Tesseract.js进行OCR识别
4. 提取文档属性、书签、图片
5. 处理多页PDF

**实现示例**：
```javascript
import pdfParse from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import fs from 'fs';

async function parsePdf(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  
  // 尝试直接解析PDF文本
  const pdfData = await pdfParse(dataBuffer);
  
  let content = pdfData.text;
  let isScanned = false;
  
  // 判断是否为扫描版PDF（文字内容很少但有图片）
  if (content.trim().length < 100 && pdfData.numpages > 0) {
    isScanned = true;
    
    // 使用OCR进行文字识别
    const worker = await createWorker('chi_sim+eng');
    const { data: { text } } = await worker.recognize(filePath);
    content = text;
    await worker.terminate();
  }
  
  return {
    metadata: {
      title: pdfData.info.Title || '无标题',
      author: pdfData.info.Author,
      created_at: pdfData.info.CreationDate,
      updated_at: pdfData.info.ModDate
    },
    content: {
      raw: content,
      html: marked(content),
      num_pages: pdfData.numpages,
      is_scanned: isScanned
    },
    file_info: {
      file_path: filePath,
      file_type: 'pdf',
      size: fs.statSync(filePath).size
    }
  };
}
```

### 4. Text (.txt) 解析

**技术栈**：
- **自定义解析器**：简单的文本处理

**解析流程**：
1. 读取文本文件内容
2. 检测编码（UTF-8, GBK等）
3. 提取标题（第一行或特定格式）
4. 简单的结构分析（段落、列表）
5. 转换为Markdown格式

**实现示例**：
```javascript
import fs from 'fs';
import iconv from 'iconv-lite';

function parseTxt(filePath) {
  // 尝试用UTF-8读取，失败则使用GBK
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    const buffer = fs.readFileSync(filePath);
    content = iconv.decode(buffer, 'gbk');
  }
  
  // 提取标题（第一行）
  const lines = content.split('\n');
  const title = lines[0].trim() || '无标题';
  
  // 简单的Markdown转换
  let markdownContent = `# ${title}\n\n`;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line) {
      markdownContent += `${line}\n\n`;
    }
  }
  
  return {
    metadata: {
      title,
      created_at: new Date(fs.statSync(filePath).birthtime)
    },
    content: {
      raw: content,
      html: marked(markdownContent)
    },
    file_info: {
      file_path: filePath,
      file_type: 'txt',
      size: fs.statSync(filePath).size
    }
  };
}
```

## 四、数据提取与处理

### 1. 正文提取
- **Markdown**：直接提取或解析为HTML
- **Word**：提取段落、标题，转换为Markdown
- **PDF**：直接提取或OCR识别
- **Text**：提取所有文本内容

### 2. 图片提取与处理
- **支持的图片格式**：jpg, png, gif, svg
- **提取方法**：
  - Markdown：从图片标签中提取
  - Word：从docx文件中提取嵌入图片
  - PDF：提取页面中的图片
- **图片处理**：
  - 压缩优化（使用Sharp库）
  - 格式统一（转换为PNG）
  - 存储管理（唯一命名，存储到文件系统）

### 3. 表格提取与处理
- **提取方法**：
  - Markdown：解析表格语法
  - Word：提取表格结构和内容
  - PDF：使用表格识别库（如tabula-js）
- **表格转换**：转换为Markdown表格或HTML表格
- **存储方式**：嵌入文档内容或单独存储

### 4. OCR文字识别
- **适用场景**：扫描版PDF、图片中的文字
- **技术栈**：Tesseract.js（支持中文）
- **识别语言**：中文（简体/繁体）、英文
- **精度优化**：
  - 图片预处理（灰度化、降噪、增强）
  - 批量处理优化
  - 结果后处理（纠正识别错误）

## 五、元数据处理

### 1. 自动提取元数据
- **通用元数据**：标题、作者、创建时间、修改时间、文件大小、文件类型
- **格式特定元数据**：
  - Markdown：YAML前置元数据
  - Word：文档属性（公司、类别等）
  - PDF：文档属性（主题、关键词等）

### 2. 手动补充元数据
- **提供界面**：让用户手动补充或修改元数据
- **支持的元数据**：标签、来源链接、摘要、分类
- **批量编辑**：支持对多个文档批量编辑元数据

### 3. 元数据存储
- 存储到SQLite数据库的Content表
- 与文档内容建立关联
- 支持元数据的搜索和筛选

## 六、错误处理与日志

### 1. 解析错误处理
- **错误类型**：格式不支持、文件损坏、权限不足、内存不足
- **处理策略**：
  - 记录错误日志
  - 跳过错误文件，继续处理其他文件
  - 向用户显示错误信息和建议
  - 提供重试机制

### 2. 导入日志
- **日志内容**：导入时间、文件列表、处理结果、错误信息
- **日志存储**：存储到本地日志文件
- **日志查看**：提供日志查看界面，支持筛选和搜索

### 3. 恢复机制
- 导入中断时的恢复
- 部分成功时的状态管理
- 失败文档的重新导入

## 七、导出功能设计

### 1. 导出格式支持
- **Markdown (.md)**：最常用的导出格式
- **PDF (.pdf)**：适合分享和打印
- **Word (.docx)**：适合进一步编辑
- **JSON (.json)**：适合数据备份和迁移

### 2. 导出流程
```
选择导出内容 → 设置导出选项 → 生成导出文件 → 下载导出文件
```

### 3. 导出选项
- **内容选择**：选择单个文档或多个文档
- **格式选择**：选择导出格式
- **包含选项**：
  - 包含元数据
  - 包含图片
  - 包含表格
  - 包含标签
- **文件命名**：自定义文件名格式

### 4. 批量导出
- 支持选择整个文件夹或标签下的所有文档
- 生成压缩包（.zip）包含多个文档
- 显示导出进度和状态

## 八、性能优化

### 1. 解析性能
- **异步处理**：使用异步IO和多线程处理
- **批量处理**：批量解析和存储，减少IO开销
- **内存优化**：大文件分块处理，避免内存溢出

### 2. 导入速度
- **并行导入**：同时处理多个文件
- **进度反馈**：实时显示导入进度
- **后台处理**：长时间导入任务在后台运行

### 3. 存储优化
- **内容压缩**：对大文档进行压缩存储
- **重复数据删除**：识别和删除重复内容
- **索引优化**：为常用查询建立索引

## 九、未来扩展

### 1. 更多格式支持
- Evernote导出文件
- OneNote导出文件
- 网页内容（通过浏览器插件）
- 微信聊天记录
- 思维导图文件

### 2. 高级功能
- 自动分类（基于内容和标签）
- 内容清洗（去除重复内容、格式转换）
- 批量编辑（批量修改元数据、标签）
- 导入模板（定义导入规则和映射）

### 3. 第三方集成
- 百度网盘
- Dropbox
- Google Drive
- 印象笔记
- Notion

## 十、实现优先级

### 第一阶段（1-2个月）
- [x] Markdown (.md) 解析
- [x] Text (.txt) 解析
- [x] 基本的Word (.docx) 解析
- [x] 基本的PDF (.pdf) 解析
- [x] 批量导入功能
- [x] 元数据自动提取

### 第二阶段（2-3个月）
- [x] 高级Word解析（表格、图片提取）
- [x] 高级PDF解析（OCR支持）
- [x] 图片和表格处理
- [x] 导入进度显示
- [x] 错误处理和日志

### 第三阶段（3-4个月）
- [x] 导出功能（多格式支持）
- [x] 批量导出和压缩
- [x] 性能优化
- [x] 导入模板
- [x] 第三方集成准备