# 个人智能知识库AI功能实现方案

## 一、AI功能架构概述

系统的AI功能采用**本地优先**的设计原则，所有核心AI功能都在本地运行，确保数据隐私和离线可用性。AI层由以下核心组件构成：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                AI功能层                                     │
├───────────────────────┬───────────────────────┬─────────────────────────────┤
│    语义搜索引擎       │    智能标签系统       │    知识图谱构建             │
│ （SentenceTransformers）│（关键词提取+主题模型）│（实体识别+关系提取）       │
├───────────────────────┼───────────────────────┼─────────────────────────────┤
│    智能问答系统       │    关联推荐引擎       │    可选：本地大语言模型     │
│ （问答匹配+答案生成）   │（内容/协同过滤）     │（Ollama + Llama 2）         │
└───────────────────────┴───────────────────────┴─────────────────────────────┘
```

## 二、语义搜索实现方案

### 1. 技术栈
- **SentenceTransformers**：用于生成文本嵌入向量
- **ChromaDB**：本地向量数据库，用于存储和查询嵌入
- **all-MiniLM-L6-v2**：轻量级嵌入模型（384维向量，支持中文）

### 2. 实现流程

```
内容导入 → 文档分块 → 嵌入生成 → 向量存储 → 查询输入 → 查询嵌入 → 向量匹配 → 结果返回
```

### 3. 详细步骤

#### 3.1 文本嵌入生成
```javascript
// 1. 初始化嵌入模型
import { SentenceTransformers } from 'sentence-transformers';

const model = new SentenceTransformers('all-MiniLM-L6-v2');

// 2. 文档分块处理
function chunkText(text, chunkSize = 512, overlap = 64) {
  const words = text.split(' ');
  const chunks = [];
  
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    chunks.push(chunk);
  }
  
  return chunks;
}

// 3. 生成嵌入向量
async function generateEmbeddings(content) {
  const chunks = chunkText(content);
  const embeddings = await model.encode(chunks);
  
  return chunks.map((chunk, index) => ({
    chunk,
    embedding: embeddings[index],
    chunkId: index
  }));
}
```

#### 3.2 向量存储与查询
```javascript
// 1. 初始化ChromaDB集合
import { ChromaClient } from 'chromadb';

const client = new ChromaClient({
  path: './chromadb_data' // 本地存储路径
});

const collection = await client.getOrCreateCollection({
  name: 'content_embeddings',
  metadata: { 'embedding_function': 'all-MiniLM-L6-v2' }
});

// 2. 存储向量
async function storeEmbeddings(contentId, embeddings) {
  await collection.add({
    ids: embeddings.map((_, index) => `${contentId}_chunk_${index}`),
    embeddings: embeddings.map(e => e.embedding),
    documents: embeddings.map(e => e.chunk),
    metadatas: embeddings.map(e => ({
      contentId,
      chunkId: e.chunkId
    }))
  });
}

// 3. 语义搜索查询
async function semanticSearch(query, topK = 10) {
  // 生成查询向量
  const queryEmbedding = await model.encode([query]);
  
  // 在向量数据库中搜索
  const results = await collection.query({
    queryEmbeddings: queryEmbedding,
    nResults: topK,
    include: ['documents', 'metadatas', 'distances']
  });
  
  // 处理结果
  return results.ids[0].map((id, index) => ({
    id,
    contentId: results.metadatas[0][index].contentId,
    chunk: results.documents[0][index],
    score: 1 - results.distances[0][index] // 转换为相似度得分
  }));
}
```

#### 3.3 结果优化
- **混合排序**：结合语义相似度得分和关键词匹配度
- **高亮显示**：使用TF-IDF或BM25算法高亮匹配片段
- **结果聚合**：将同一文档的多个相关分块合并显示

## 三、智能标签系统

### 1. 技术栈
- **NLP.js**：用于关键词提取和实体识别
- **TextRank算法**：用于提取关键短语

### 2. 实现流程

```
内容导入 → 文本预处理 → 关键词提取 → 主题识别 → 标签生成 → 标签推荐
```

### 3. 详细步骤

#### 3.1 关键词提取
```javascript
// 使用NLP.js进行关键词提取
import { NlpManager } from 'node-nlp';

const manager = new NlpManager({ languages: ['zh'] });

async function extractKeywords(text, topN = 10) {
  // 文本预处理：去除停用词、标点符号
  const processedText = text.toLowerCase().replace(/[^\w\s]/g, '');
  
  // 使用TextRank算法提取关键词
  const keywords = await manager.extractKeywords(processedText, topN);
  
  return keywords.map(k => k.text);
}
```

#### 3.2 主题识别与标签推荐
```javascript
// 主题识别与标签生成
async function generateTags(content, existingTags = []) {
  // 提取关键词
  const keywords = await extractKeywords(content, 15);
  
  // 识别实体（书、人、项目等）
  const entities = await recognizeEntities(content);
  
  // 合并关键词和实体作为候选标签
  const candidateTags = [...keywords, ...entities.map(e => e.text)];
  
  // 过滤和去重
  const filteredTags = [...new Set(candidateTags)]
    .filter(tag => tag.length > 1) // 过滤过短标签
    .slice(0, 10); // 限制标签数量
  
  // 与现有标签匹配，优先推荐已有标签
  const matchedExistingTags = existingTags.filter(tag => 
    candidateTags.some(ct => tag.toLowerCase().includes(ct.toLowerCase()))
  );
  
  return [...matchedExistingTags, ...filteredTags].slice(0, 10);
}
```

## 四、知识图谱构建

### 1. 技术栈
- **spaCy.js**：用于实体识别和关系抽取
- **NLP.js**：辅助实体分类
- **SQLite**：存储实体和关系数据

### 2. 实现流程

```
内容导入 → 实体识别 → 实体分类 → 关系提取 → 图谱存储 → 图谱查询
```

### 3. 详细步骤

#### 3.1 实体识别与分类
```javascript
// 使用spaCy.js进行实体识别
import spacy from 'spacy';

// 加载中文模型
const nlp = await spacy.load('zh_core_web_sm');

async function recognizeEntities(text) {
  const doc = await nlp(text);
  
  // 实体分类映射
  const entityTypeMap = {
    'PERSON': 'person',
    'ORG': 'organization',
    'GPE': 'location',
    'WORK_OF_ART': 'book',
    'PRODUCT': 'product'
  };
  
  const entities = [];
  
  for (const ent of doc.ents) {
    entities.push({
      text: ent.text,
      type: entityTypeMap[ent.label_] || 'concept',
      start: ent.start_char,
      end: ent.end_char
    });
  }
  
  return entities;
}
```

#### 3.2 关系提取与图谱构建
```javascript
// 关系提取算法
async function extractRelations(text, entities) {
  const relations = [];
  
  // 简单的基于规则的关系提取示例
  // 实际实现中可以使用更复杂的依赖解析或预训练模型
  const sentences = text.split(/[。！？]/);
  
  for (const sentence of sentences) {
    for (let i = 0; i < entities.length; i++) {
      for (let j = 0; j < entities.length; j++) {
        if (i === j) continue;
        
        const ent1 = entities[i];
        const ent2 = entities[j];
        
        // 检查两个实体是否在同一句子中
        if (sentence.includes(ent1.text) && sentence.includes(ent2.text)) {
          // 简单的关系类型判断
          let relationType = 'related_to';
          
          if (sentence.includes('写了') && ent1.type === 'person' && ent2.type === 'book') {
            relationType = 'authored';
          } else if (sentence.includes('包含') || sentence.includes('涉及')) {
            relationType = 'includes';
          }
          
          relations.push({
            source: ent1.text,
            target: ent2.text,
            relationType,
            sentence
          });
        }
      }
    }
  }
  
  return relations;
}

// 存储实体和关系到数据库
async function storeKnowledgeGraph(entities, relations, contentId) {
  // 存储实体
  for (const entity of entities) {
    await prisma.entity.upsert({
      where: { name: entity.text },
      update: {
        type: entity.type,
        description: entity.description || '',
        updatedAt: new Date()
      },
      create: {
        name: entity.text,
        type: entity.type,
        description: entity.description || '',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  }
  
  // 存储实体与内容的关联
  for (const entity of entities) {
    await prisma.contentEntity.upsert({
      where: {
        content_id_entity_id: {
          content_id: contentId,
          entity_id: (await prisma.entity.findUnique({ where: { name: entity.text } })).id
        }
      },
      create: {
        content_id: contentId,
        entity_id: (await prisma.entity.findUnique({ where: { name: entity.text } })).id,
        start_pos: entity.start,
        end_pos: entity.end,
        created_at: new Date()
      }
    });
  }
  
  // 存储关系
  for (const relation of relations) {
    const sourceEntity = await prisma.entity.findUnique({ where: { name: relation.source } });
    const targetEntity = await prisma.entity.findUnique({ where: { name: relation.target } });
    
    if (sourceEntity && targetEntity) {
      await prisma.entityRelation.upsert({
        where: {
          source_id_target_id_relation_type: {
            source_id: sourceEntity.id,
            target_id: targetEntity.id,
            relation_type: relation.relationType
          }
        },
        update: {
          strength: { increment: 0.1 }, // 关系强度累积
          updatedAt: new Date()
        },
        create: {
          source_id: sourceEntity.id,
          target_id: targetEntity.id,
          relation_type: relation.relationType,
          strength: 1.0,
          description: relation.sentence,
          createdAt: new Date()
        }
      });
    }
  }
}
```

## 五、智能问答系统

### 1. 技术栈
- **SentenceTransformers**：用于问题与文档的相似度匹配
- **可选：Ollama + Llama 2**：用于高级答案生成（未来扩展）

### 2. 实现流程

```
用户提问 → 问题预处理 → 语义搜索相关文档 → 答案提取 → 答案格式化 → 显示答案（含来源）
```

### 3. 详细步骤

```javascript
// 智能问答实现
async function answerQuestion(question) {
  // 1. 语义搜索相关文档
  const searchResults = await semanticSearch(question, 5);
  
  if (searchResults.length === 0) {
    return { answer: '抱歉，我没有找到相关答案。', sources: [] };
  }
  
  // 2. 提取相关文档内容
  const contentIds = [...new Set(searchResults.map(r => r.contentId))];
  const contents = await prisma.content.findMany({
    where: { id: { in: contentIds } },
    select: { id: true, title: true, content: true, file_path: true }
  });
  
  // 3. 答案提取（简单实现）
  // 实际实现中可以使用更复杂的文本抽取技术或本地LLM
  const relevantContent = searchResults.map(result => {
    const content = contents.find(c => c.id === result.contentId);
    return {
      title: content?.title || '未知文档',
      content: result.chunk,
      contentId: result.contentId
    };
  });
  
  // 4. 格式化答案
  const answer = `根据我的知识库，以下是关于您问题的相关信息：\n\n${relevantContent.map(item => `- ${item.title}: ${item.content}`).join('\n\n')}`;
  
  // 5. 构建来源列表
  const sources = relevantContent.map(item => ({
    id: item.contentId,
    title: item.title
  }));
  
  return { answer, sources };
}
```

## 六、关联推荐系统

### 1. 技术栈
- **SentenceTransformers**：用于内容相似度计算
- **用户行为分析**：基于查看、搜索历史的协同过滤

### 2. 实现流程

```
用户当前上下文 → 内容相似度计算 → 用户行为分析 → 混合推荐 → 显示推荐结果
```

### 3. 详细步骤

```javascript
// 关联推荐实现
async function getRelatedContent(currentContentId, topK = 5) {
  // 1. 基于内容的推荐（内容相似度）
  const currentContent = await prisma.content.findUnique({
    where: { id: currentContentId },
    select: { content: true, tags: true, entities: true }
  });
  
  if (!currentContent) return [];
  
  // 生成当前内容的嵌入向量
  const currentEmbedding = await model.encode([currentContent.content || '']);
  
  // 搜索相似内容
  const similarContents = await collection.query({
    queryEmbeddings: currentEmbedding,
    nResults: topK * 2, // 获取更多结果用于过滤
    include: ['metadatas']
  });
  
  // 过滤掉当前内容本身
  const filteredContentIds = similarContents.metadatas[0]
    .filter(m => m.contentId !== currentContentId)
    .map(m => m.contentId)
    .slice(0, topK);
  
  // 2. 基于标签和实体的推荐
  const currentTags = currentContent.tags.map(t => t.tag_id);
  const currentEntities = currentContent.entities.map(e => e.entity_id);
  
  // 查找有共同标签或实体的内容
  const relatedByTagsAndEntities = await prisma.content.findMany({
    where: {
      id: { not: currentContentId },
      OR: [
        { tags: { some: { tag_id: { in: currentTags } } } },
        { entities: { some: { entity_id: { in: currentEntities } } } }
      ]
    },
    select: { id: true, title: true },
    take: topK
  });
  
  // 3. 混合推荐（合并结果并去重）
  const allRecommendedIds = [...filteredContentIds, ...relatedByTagsAndEntities.map(c => c.id)];
  const uniqueIds = [...new Set(allRecommendedIds)];
  
  // 获取最终推荐内容
  const recommendedContents = await prisma.content.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, title: true, summary: true, file_type: true, created_at: true },
    take: topK
  });
  
  return recommendedContents;
}
```

## 七、性能优化策略

### 1. 模型优化
- **模型量化**：使用8位量化技术减少模型大小和内存占用
- **模型缓存**：将常用模型缓存到内存，避免重复加载
- **按需加载**：仅在需要时加载特定AI功能的模型

### 2. 处理优化
- **批量处理**：对大量文档进行批量嵌入生成和处理
- **异步处理**：使用异步任务队列处理耗时的AI操作
- **进度反馈**：为长时间运行的任务提供进度条

### 3. 缓存策略
- **嵌入缓存**：缓存已生成的嵌入向量，避免重复计算
- **搜索结果缓存**：缓存频繁查询的搜索结果
- **实体关系缓存**：缓存常用的实体和关系数据

## 八、未来扩展：本地大语言模型集成

当需要更高级的AI功能时，可以集成本地大语言模型：

```javascript
// Ollama + Llama 2 集成示例
import { Ollama } from 'ollama';

const ollama = new Ollama({
  host: 'http://localhost:11434' // Ollama默认端口
});

// 检查本地模型是否可用
async function checkLocalModel() {
  try {
    const models = await ollama.list();
    return models.includes('llama2:7b');
  } catch (error) {
    console.error('Ollama未运行或模型不可用:', error);
    return false;
  }
}

// 使用本地LLM增强智能问答
async function answerQuestionWithLLM(question, relevantContent) {
  const prompt = `根据以下信息回答问题：\n\n${relevantContent.map(item => `- ${item.title}: ${item.content}`).join('\n\n')}\n\n问题：${question}\n\n请基于上述信息提供简洁准确的答案，并注明信息来源。`;
  
  const response = await ollama.generate({
    model: 'llama2:7b',
    prompt,
    options: {
      temperature: 0.7,
      max_tokens: 512
    }
  });
  
  return response.response;
}
```

## 九、AI功能本地优先设计原则

1. **数据隐私**：所有AI处理都在本地进行，数据不离开用户设备
2. **离线可用**：核心AI功能（语义搜索、智能标签、基础问答）在无网络环境下可用
3. **资源效率**：选择轻量级模型，优化内存和CPU占用
4. **可配置性**：允许用户调整AI功能的性能和精度平衡
5. **透明性**：提供AI功能的工作原理说明和结果可信度指标

## 十、实现优先级规划

### 第一阶段（1-3个月）
- [x] 语义搜索基本功能
- [x] 智能标签生成
- [x] 基础实体识别

### 第二阶段（3-6个月）
- [x] 知识图谱构建与可视化
- [x] 智能问答系统
- [x] 关联推荐功能

### 第三阶段（6个月以上）
- [ ] 本地大语言模型集成
- [ ] 高级文本生成功能
- [ ] 自定义模型训练支持