# Design Document: CKB智能分片与上下文优化

## Overview

本设计通过智能分片、精准上下文提取和证据定位，优化CKB在LLM调用中的使用方式。核心思想：**不传递完整文档，只传递相关片段**。

### 核心优化策略

1. **智能分片（Smart Chunking）**：将文档分割为语义连贯的chunks，建立索引
2. **相关性检索（Relevance Retrieval）**：基于任务需求，检索最相关的chunks
3. **动态上下文窗口（Dynamic Context Window）**：根据任务复杂度动态调整上下文大小
4. **批量优化（Batch Optimization）**：合并相似任务，减少LLM调用次数
5. **精准证据定位（Evidence Localization）**：记录实体/关系的精确位置

### 优化效果预期

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| Token消耗 | 100% | 15-30% | 减少70-85% |
| 处理时延 | 100% | 25-40% | 减少60-75% |
| 准确性 | 100% | 98%+ | 保持 |

## Architecture

### System Context

```
文档输入 → CKB解析 → 智能分片 → 索引构建
                              ↓
                         相关性检索 ← 任务需求
                              ↓
                         上下文优化 → LLM调用
                              ↓
                         证据定位 → 结果存储
```

### Component Overview

**新增组件**：
- `kg/ckb/chunk_manager.js`: Chunk管理器
- `kg/ckb/context_optimizer.js`: 上下文优化器
- `kg/ckb/relevance_scorer.js`: 相关性评分器
- `kg/ckb/evidence_locator.js`: 证据定位器
- `kg/ckb/chunk_index.js`: Chunk索引（基于向量数据库）

**修改组件**：
- `kg/ckb/ckb_factory.js`: 增加分片逻辑
- `kg/field_extractor/llm_extractor.js`: 使用优化后的上下文
- `kg/entity/entity_builder.js`: 使用优化后的上下文
- `kg/relation/semantic_relation_builder.js`: 使用优化后的上下文

## Data Models

### Enhanced CKB Model

```javascript
{
  ckb_id: "ckb_123",
  doc_id: "doc_456",
  content: {
    text: "完整文本...",  // 保留向后兼容
    title: "文档标题"
  },
  // 🆕 新增：分片信息
  chunks: [
    {
      chunk_id: "chunk_1",
      text: "第一段文本内容...",
      start_offset: 0,
      end_offset: 150,
      chunk_type: "paragraph",  // paragraph, sentence, heading, list_item
      semantic_summary: "描述地下水位变化",
      embedding: [0.1, 0.2, ...],  // 768维向量
      metadata: {
        paragraph_index: 0,
        sentence_count: 3,
        entity_density: 0.15,  // 实体密度
        keyword_density: 0.08
      }
    },
    // ... more chunks
  ],
  // 🆕 新增：结构信息
  structure: {
    chunk_graph: {
      // chunk之间的关系
      edges: [
        { from: "chunk_1", to: "chunk_2", relation: "follows" },
        { from: "chunk_3", to: "chunk_4", relation: "elaborates" }
      ]
    },
    hierarchy: {
      // 文档层级结构
      headings: [
        { chunk_id: "chunk_0", level: 1, text: "第一章" },
        { chunk_id: "chunk_5", level: 2, text: "1.1 背景" }
      ]
    }
  },
  quality: { ... },
  timestamps: { ... }
}
```

### Entity Evidence Model

```javascript
{
  entity_id: "entity_123",
  canonical_name: "阿里C区_水位_2025-01",
  // 🆕 新增：证据定位
  evidence: {
    ckb_id: "ckb_456",
    chunk_ids: ["chunk_2", "chunk_3"],  // 实体信息所在的chunks
    text_positions: [
      {
        chunk_id: "chunk_2",
        start_offset: 45,
        end_offset: 58,
        matched_text: "阿里C区水位"
      }
    ],
    context_window: {
      // 用于生成实体名称的上下文
      chunks: ["chunk_1", "chunk_2", "chunk_3"],
      total_tokens: 250
    }
  },
  // ... other fields
}
```



## Core Components

### 1. Chunk Manager

**Purpose**: 管理CKB的分片创建、存储和检索

**Location**: `kg/ckb/chunk_manager.js`

**Interface**:
```javascript
class ChunkManager {
  /**
   * 将CKB文本分割为chunks
   * @param {Object} ckb - CKB对象
   * @param {Object} options - 分片选项
   * @returns {Array<Chunk>} Chunks数组
   */
  async chunkCKB(ckb, options = {})
  
  /**
   * 根据chunk_ids检索chunks
   * @param {Array<string>} chunkIds - Chunk IDs
   * @returns {Promise<Array<Chunk>>} Chunks
   */
  async getChunks(chunkIds)
  
  /**
   * 获取chunk的相邻chunks
   * @param {string} chunkId - Chunk ID
   * @param {number} window - 窗口大小（前后各N个）
   * @returns {Promise<Array<Chunk>>} 相邻chunks
   */
  async getAdjacentChunks(chunkId, window = 1)
}
```

**Chunking Strategies**:

1. **Paragraph Chunking** (默认，适用于结构化文档):
   ```javascript
   // 按段落分割，保持语义完整性
   const chunks = text.split(/\n\n+/).map((para, i) => ({
     chunk_id: `chunk_${i}`,
     text: para.trim(),
     chunk_type: 'paragraph',
     start_offset: calculateOffset(text, para),
     end_offset: calculateOffset(text, para) + para.length
   }));
   ```

2. **Sentence Chunking** (适用于长段落):
   ```javascript
   // 使用NLP库分句
   const sentences = nlp(text).sentences().out('array');
   const chunks = sentences.map((sent, i) => ({
     chunk_id: `chunk_${i}`,
     text: sent,
     chunk_type: 'sentence',
     ...
   }));
   ```

3. **Semantic Chunking** (适用于无明显结构的长文本):
   ```javascript
   // 基于语义相似度分割
   const embeddings = await getEmbeddings(sentences);
   const chunks = semanticSegmentation(sentences, embeddings, threshold=0.7);
   ```

4. **Fixed-Length Chunking** (兜底策略):
   ```javascript
   // 固定长度分割，避免在句子中间切断
   const chunks = splitByLength(text, maxLength=500, overlap=50);
   ```

### 2. Context Optimizer

**Purpose**: 根据任务需求，智能选择最相关的chunks作为LLM上下文

**Location**: `kg/ckb/context_optimizer.js`

**Interface**:
```javascript
class ContextOptimizer {
  /**
   * 为字段提取任务优化上下文
   * @param {Object} ckb - CKB对象
   * @param {Object} options - 优化选项
   * @returns {Promise<Object>} { context, chunks, token_count }
   */
  async optimizeForFieldExtraction(ckb, options = {})
  
  /**
   * 为实体名称生成优化上下文
   * @param {Object} entity - 实体对象
   * @param {Object} ckb - CKB对象
   * @returns {Promise<Object>} { context, chunks, token_count }
   */
  async optimizeForEntityNaming(entity, ckb)
  
  /**
   * 为关系抽取优化上下文
   * @param {Array} entities - 实体列表
   * @param {Object} ckb - CKB对象
   * @returns {Promise<Object>} { context, chunks, token_count }
   */
  async optimizeForRelationExtraction(entities, ckb)
}
```

**Optimization Algorithm**:

```javascript
async optimizeForFieldExtraction(ckb, options = {}) {
  const {
    maxTokens = 600,  // 最大token数
    minChunks = 3,    // 最少chunk数
    relevanceThreshold = 0.5
  } = options;
  
  // Step 1: 计算每个chunk的相关性评分
  const scoredChunks = await this.relevanceScorer.scoreChunks(
    ckb.chunks,
    { task: 'field_extraction', keywords: extractKeywords(ckb) }
  );
  
  // Step 2: 按评分排序
  scoredChunks.sort((a, b) => b.score - a.score);
  
  // Step 3: 选择chunks直到达到token限制
  const selectedChunks = [];
  let totalTokens = 0;
  
  for (const chunk of scoredChunks) {
    if (chunk.score < relevanceThreshold && selectedChunks.length >= minChunks) {
      break;  // 已有足够chunks且评分过低
    }
    
    const chunkTokens = estimateTokens(chunk.text);
    if (totalTokens + chunkTokens > maxTokens && selectedChunks.length >= minChunks) {
      break;  // 超过token限制
    }
    
    selectedChunks.push(chunk);
    totalTokens += chunkTokens;
  }
  
  // Step 4: 按原文顺序重排（保持上下文连贯性）
  selectedChunks.sort((a, b) => a.start_offset - b.start_offset);
  
  // Step 5: 构建上下文文本
  const context = selectedChunks.map(c => c.text).join('\n\n');
  
  return {
    context,
    chunks: selectedChunks.map(c => c.chunk_id),
    token_count: totalTokens,
    optimization_ratio: totalTokens / estimateTokens(ckb.content.text)
  };
}
```

### 3. Relevance Scorer

**Purpose**: 计算chunk与任务的相关性评分

**Location**: `kg/ckb/relevance_scorer.js`

**Interface**:
```javascript
class RelevanceScorer {
  /**
   * 为chunks计算相关性评分
   * @param {Array<Chunk>} chunks - Chunks
   * @param {Object} context - 任务上下文
   * @returns {Promise<Array>} Scored chunks
   */
  async scoreChunks(chunks, context)
  
  /**
   * 基于关键词的评分
   * @param {Chunk} chunk - Chunk
   * @param {Array<string>} keywords - 关键词
   * @returns {number} Score (0-1)
   */
  scoreByKeywords(chunk, keywords)
  
  /**
   * 基于语义相似度的评分
   * @param {Chunk} chunk - Chunk
   * @param {string} query - 查询文本
   * @returns {Promise<number>} Score (0-1)
   */
  async scoreBySemantic(chunk, query)
}
```

**Scoring Algorithms**:

1. **Keyword-Based Scoring** (快速，0 tokens):
   ```javascript
   scoreByKeywords(chunk, keywords) {
     const chunkText = chunk.text.toLowerCase();
     let score = 0;
     
     for (const keyword of keywords) {
       const count = (chunkText.match(new RegExp(keyword, 'gi')) || []).length;
       score += count * 0.1;  // 每次匹配+0.1分
     }
     
     // 归一化到0-1
     return Math.min(score, 1.0);
   }
   ```

2. **TF-IDF Scoring** (中速，0 tokens):
   ```javascript
   scoreByTFIDF(chunk, query) {
     const chunkVector = this.tfidfVectorizer.transform(chunk.text);
     const queryVector = this.tfidfVectorizer.transform(query);
     return cosineSimilarity(chunkVector, queryVector);
   }
   ```

3. **Semantic Similarity** (慢速，需要embedding):
   ```javascript
   async scoreBySemantic(chunk, query) {
     if (!chunk.embedding) {
       chunk.embedding = await this.embedder.embed(chunk.text);
     }
     const queryEmbedding = await this.embedder.embed(query);
     return cosineSimilarity(chunk.embedding, queryEmbedding);
   }
   ```

4. **Hybrid Scoring** (推荐):
   ```javascript
   async scoreHybrid(chunk, context) {
     const keywordScore = this.scoreByKeywords(chunk, context.keywords);
     const tfidfScore = this.scoreByTFIDF(chunk, context.query);
     const semanticScore = await this.scoreBySemantic(chunk, context.query);
     
     // 加权组合
     return 0.3 * keywordScore + 0.3 * tfidfScore + 0.4 * semanticScore;
   }
   ```

### 4. Evidence Locator

**Purpose**: 精准定位实体/关系在CKB中的位置

**Location**: `kg/ckb/evidence_locator.js`

**Interface**:
```javascript
class EvidenceLocator {
  /**
   * 定位实体在CKB中的位置
   * @param {Object} entity - 实体对象
   * @param {Object} ckb - CKB对象
   * @returns {Promise<Object>} Evidence信息
   */
  async locateEntity(entity, ckb)
  
  /**
   * 定位关系证据在CKB中的位置
   * @param {Object} relation - 关系对象
   * @param {Object} ckb - CKB对象
   * @returns {Promise<Object>} Evidence信息
   */
  async locateRelation(relation, ckb)
  
  /**
   * 根据entity_id检索原文片段
   * @param {string} entityId - Entity ID
   * @returns {Promise<Object>} { text, chunks, highlights }
   */
  async getEntityContext(entityId)
}
```

**Localization Algorithm**:

```javascript
async locateEntity(entity, ckb) {
  const entityFields = entity.fields || entity.attributes;
  const matchedChunks = [];
  
  // Step 1: 在每个chunk中搜索实体字段值
  for (const chunk of ckb.chunks) {
    let matchCount = 0;
    const positions = [];
    
    for (const [fieldName, fieldValue] of Object.entries(entityFields)) {
      const regex = new RegExp(escapeRegex(fieldValue), 'gi');
      const matches = [...chunk.text.matchAll(regex)];
      
      if (matches.length > 0) {
        matchCount++;
        positions.push({
          field: fieldName,
          value: fieldValue,
          start_offset: chunk.start_offset + matches[0].index,
          end_offset: chunk.start_offset + matches[0].index + fieldValue.length
        });
      }
    }
    
    if (matchCount > 0) {
      matchedChunks.push({
        chunk_id: chunk.chunk_id,
        match_count: matchCount,
        positions: positions
      });
    }
  }
  
  // Step 2: 选择匹配度最高的chunks
  matchedChunks.sort((a, b) => b.match_count - a.match_count);
  const topChunks = matchedChunks.slice(0, 3);
  
  // Step 3: 构建evidence对象
  return {
    ckb_id: ckb.ckb_id,
    chunk_ids: topChunks.map(c => c.chunk_id),
    text_positions: topChunks.flatMap(c => c.positions),
    confidence: topChunks[0].match_count / Object.keys(entityFields).length
  };
}
```



## Integration with Existing Modules

### 1. Field Extractor Integration

**Before (优化前)**:
```javascript
// kg/field_extractor/llm_extractor.js
async function extractFieldsWithLLM(ckb, options) {
  const text = ckb.content.text;  // 传递完整文本，2000-4000 tokens
  const prompt = `从以下文本中提取字段:\n${text}\n...`;
  const response = await llmClient.call(prompt);
  return parseFields(response);
}
```

**After (优化后)**:
```javascript
// kg/field_extractor/llm_extractor.js
async function extractFieldsWithLLM(ckb, options) {
  // 🆕 使用上下文优化器
  const { context, chunks, token_count } = await contextOptimizer.optimizeForFieldExtraction(ckb, {
    maxTokens: 600,  // 减少到600 tokens
    minChunks: 3
  });
  
  const prompt = `从以下文本中提取字段:\n${context}\n...`;
  const response = await llmClient.call(prompt);
  
  // 🆕 记录优化效果
  console.log(`Token优化: ${token_count} / ${estimateTokens(ckb.content.text)} = ${(token_count / estimateTokens(ckb.content.text) * 100).toFixed(1)}%`);
  
  return parseFields(response);
}
```

**Token Savings**: 2000-4000 → 300-600 tokens (减少70-85%)

### 2. Entity Builder Integration

**Before (优化前)**:
```javascript
// kg/entity/entity_builder.js
async function enhanceNameWithLLM(rawName, schema, ckb, llmClient) {
  const prompt = `标准化实体名称:
原始名称: ${rawName}
上下文: ${ckb.content.text}  // 完整文本，500-1000 tokens
...`;
  const response = await llmClient.callJSON(prompt);
  return response;
}
```

**After (优化后)**:
```javascript
// kg/entity/entity_builder.js
async function enhanceNameWithLLM(rawName, schema, ckb, llmClient, entity) {
  // 🆕 定位实体相关的chunks
  const evidence = await evidenceLocator.locateEntity(entity, ckb);
  
  // 🆕 获取相关chunks + 相邻chunks作为上下文
  const contextChunks = await chunkManager.getChunks(evidence.chunk_ids);
  const adjacentChunks = await Promise.all(
    evidence.chunk_ids.map(id => chunkManager.getAdjacentChunks(id, 1))
  );
  const allChunks = [...contextChunks, ...adjacentChunks.flat()];
  const uniqueChunks = [...new Set(allChunks.map(c => c.chunk_id))].map(id => 
    allChunks.find(c => c.chunk_id === id)
  );
  
  const context = uniqueChunks.map(c => c.text).join('\n');
  
  const prompt = `标准化实体名称:
原始名称: ${rawName}
上下文: ${context}  // 精简上下文，100-200 tokens
...`;
  const response = await llmClient.callJSON(prompt);
  return response;
}
```

**Token Savings**: 500-1000 → 100-200 tokens (减少75-80%)

### 3. Relation Builder Integration

**Before (优化前)**:
```javascript
// kg/relation/semantic_relation_builder.js
async function extractRelationsWithLLM(ckb, entities, options) {
  const text = ckb.content.text;  // 完整文本，1500-3000 tokens
  const prompt = `从文本中识别关系:\n文本: ${text}\n实体: ${entities.map(e => e.canonical_name).join(', ')}\n...`;
  const response = await llmClient.call(prompt);
  return parseRelations(response);
}
```

**After (优化后)**:
```javascript
// kg/relation/semantic_relation_builder.js
async function extractRelationsWithLLM(ckb, entities, options) {
  // 🆕 定位所有实体所在的chunks
  const entityChunkIds = new Set();
  for (const entity of entities) {
    const evidence = await evidenceLocator.locateEntity(entity, ckb);
    evidence.chunk_ids.forEach(id => entityChunkIds.add(id));
  }
  
  // 🆕 获取相关chunks
  const chunks = await chunkManager.getChunks([...entityChunkIds]);
  const context = chunks.map(c => c.text).join('\n');
  
  const prompt = `从文本中识别关系:\n文本: ${context}\n实体: ${entities.map(e => e.canonical_name).join(', ')}\n...`;
  const response = await llmClient.call(prompt);
  
  // 🆕 为每个关系定位证据
  const relations = parseRelations(response);
  for (const relation of relations) {
    relation.evidence = await evidenceLocator.locateRelation(relation, ckb);
  }
  
  return relations;
}
```

**Token Savings**: 1500-3000 → 300-600 tokens (减少75-80%)

## Performance Analysis

### Token Consumption Breakdown

**优化前（Baseline）**:
```
单文档处理（10,000字）:
├─ 字段提取: 3000 tokens
├─ Schema匹配: 500 tokens (不涉及全文)
├─ 实体名称生成 (5个实体): 5 × 800 = 4000 tokens
├─ 关系抽取: 2500 tokens
└─ 总计: 10,000 tokens
```

**优化后（Optimized）**:
```
单文档处理（10,000字）:
├─ CKB分片: 0 tokens (一次性操作)
├─ 字段提取: 500 tokens (减少83%)
├─ Schema匹配: 500 tokens (不变)
├─ 实体名称生成 (5个实体): 5 × 150 = 750 tokens (减少81%)
├─ 关系抽取: 500 tokens (减少80%)
└─ 总计: 2,250 tokens (减少77.5%)
```

### Latency Analysis

**优化前**:
```
单文档处理时延:
├─ 字段提取: 3s (LLM调用)
├─ Schema匹配: 0.5s
├─ 实体名称生成: 5 × 1s = 5s (串行LLM调用)
├─ 关系抽取: 2.5s (LLM调用)
└─ 总计: 11s
```

**优化后**:
```
单文档处理时延:
├─ CKB分片: 0.2s (一次性操作)
├─ 字段提取: 1s (LLM调用，prompt更短)
├─ Schema匹配: 0.5s
├─ 实体名称生成: 5 × 0.4s = 2s (串行LLM调用，prompt更短)
├─ 关系抽取: 1s (LLM调用，prompt更短)
└─ 总计: 4.7s (减少57%)
```

### Accuracy Impact Analysis

**测试方法**:
1. 在100个测试文档上对比优化前后的准确性
2. 指标：字段提取F1、实体识别F1、关系抽取F1
3. 可接受的准确性下降：≤2%

**预期结果**:
| 指标 | 优化前 | 优化后 | 变化 |
|------|--------|--------|------|
| 字段提取F1 | 0.85 | 0.84 | -1.2% ✅ |
| 实体识别F1 | 0.80 | 0.79 | -1.3% ✅ |
| 关系抽取F1 | 0.75 | 0.74 | -1.3% ✅ |

**准确性保障机制**:
1. **动态窗口扩展**: 当检测到上下文不足时，自动扩展窗口
2. **相关性阈值调整**: 根据任务复杂度动态调整阈值
3. **降级策略**: 在准确性下降超过阈值时，回退到全文传递

## Configuration

### Environment Variables

```bash
# 启用/禁用智能分片
ENABLE_CKB_CHUNKING=true

# 分片策略
CKB_CHUNKING_STRATEGY=paragraph  # paragraph, sentence, semantic, fixed

# 上下文优化
ENABLE_CONTEXT_OPTIMIZATION=true
MAX_CONTEXT_TOKENS=600
MIN_CONTEXT_CHUNKS=3
RELEVANCE_THRESHOLD=0.5

# 相关性评分算法
RELEVANCE_SCORING_METHOD=hybrid  # keyword, tfidf, semantic, hybrid

# 证据定位
ENABLE_EVIDENCE_LOCALIZATION=true

# 性能监控
ENABLE_TOKEN_TRACKING=true
ENABLE_OPTIMIZATION_METRICS=true
```

### Runtime Configuration

```javascript
// kg/ckb/config.js
module.exports = {
  chunking: {
    enabled: process.env.ENABLE_CKB_CHUNKING === 'true',
    strategy: process.env.CKB_CHUNKING_STRATEGY || 'paragraph',
    options: {
      paragraph: {
        minLength: 50,
        maxLength: 500
      },
      sentence: {
        minLength: 20,
        maxLength: 100
      },
      semantic: {
        similarityThreshold: 0.7,
        minChunkSize: 100
      },
      fixed: {
        chunkSize: 500,
        overlap: 50
      }
    }
  },
  contextOptimization: {
    enabled: process.env.ENABLE_CONTEXT_OPTIMIZATION === 'true',
    maxTokens: parseInt(process.env.MAX_CONTEXT_TOKENS) || 600,
    minChunks: parseInt(process.env.MIN_CONTEXT_CHUNKS) || 3,
    relevanceThreshold: parseFloat(process.env.RELEVANCE_THRESHOLD) || 0.5
  },
  relevanceScoring: {
    method: process.env.RELEVANCE_SCORING_METHOD || 'hybrid',
    weights: {
      keyword: 0.3,
      tfidf: 0.3,
      semantic: 0.4
    }
  },
  evidenceLocalization: {
    enabled: process.env.ENABLE_EVIDENCE_LOCALIZATION === 'true',
    maxChunksPerEntity: 3
  }
};
```

## Migration Strategy

### Phase 1: 基础设施搭建（Week 1-2）
- 实现Chunk Manager和基础分片算法
- 实现Relevance Scorer（keyword + TF-IDF）
- 更新CKB数据模型，保持向后兼容

### Phase 2: 上下文优化（Week 3-4）
- 实现Context Optimizer
- 集成到Field Extractor
- A/B测试，验证token节省和准确性

### Phase 3: 证据定位（Week 5-6）
- 实现Evidence Locator
- 集成到Entity Builder和Relation Builder
- 实现"查看原文"功能

### Phase 4: 高级优化（Week 7-8）
- 实现语义相似度评分（需要embedding）
- 实现批量优化
- 性能调优和监控

### Phase 5: 生产部署（Week 9-10）
- 灰度发布（10% → 50% → 100%）
- 监控token消耗和准确性
- 根据反馈调整参数

## Monitoring and Metrics

### Key Metrics

1. **Token Consumption**:
   - Total tokens per document
   - Tokens by module (extraction, entity, relation)
   - Optimization ratio (optimized / baseline)

2. **Latency**:
   - End-to-end processing time
   - LLM call latency
   - Chunking overhead

3. **Accuracy**:
   - Field extraction F1
   - Entity recognition F1
   - Relation extraction F1

4. **System Health**:
   - Chunking success rate
   - Context optimization success rate
   - Evidence localization success rate

### Dashboards

```javascript
// 实时监控仪表板
{
  "token_savings": {
    "baseline_tokens": 10000,
    "optimized_tokens": 2250,
    "savings_ratio": 0.775,
    "cost_savings_usd": 0.015  // 假设$0.002/1K tokens
  },
  "latency_improvement": {
    "baseline_latency_ms": 11000,
    "optimized_latency_ms": 4700,
    "improvement_ratio": 0.573
  },
  "accuracy_impact": {
    "field_extraction_f1": { "before": 0.85, "after": 0.84, "delta": -0.01 },
    "entity_recognition_f1": { "before": 0.80, "after": 0.79, "delta": -0.01 },
    "relation_extraction_f1": { "before": 0.75, "after": 0.74, "delta": -0.01 }
  }
}
```



## Additional Features

### 5. CKB Quality Scoring

**Purpose**: 为每个CKB和chunk评估可信度，用于冲突解决和证据排序

**Location**: `kg/ckb/quality_scorer.js`

**Interface**:
```javascript
class QualityScorer {
  /**
   * 评估CKB的整体质量
   * @param {Object} ckb - CKB对象
   * @returns {Object} { overall_score, dimensions }
   */
  scoreCKB(ckb)
  
  /**
   * 评估chunk的质量
   * @param {Chunk} chunk - Chunk对象
   * @returns {Object} { quality_score, factors }
   */
  scoreChunk(chunk)
  
  /**
   * 对比多个CKB的证据强度
   * @param {Array<Object>} ckbs - CKB列表
   * @param {Object} context - 对比上下文
   * @returns {Array} 按证据强度排序的CKBs
   */
  compareEvidenceStrength(ckbs, context)
}
```

**Quality Dimensions**:

1. **Source Confidence** (来源可信度):
   ```javascript
   // 基于文档来源评分
   const sourceScores = {
     'official_document': 0.95,
     'verified_source': 0.85,
     'user_upload': 0.70,
     'web_scraping': 0.60
   };
   ```

2. **Content Completeness** (内容完整性):
   ```javascript
   // 基于结构完整性评分
   const completenessScore = {
     hasTitle: 0.2,
     hasStructure: 0.3,
     hasMetadata: 0.2,
     textLength: 0.3  // 适中长度得分高
   };
   ```

3. **Information Density** (信息密度):
   ```javascript
   // 基于实体和关键词密度评分
   const densityScore = 
     0.5 * entityDensity +  // 实体密度
     0.3 * keywordDensity + // 关键词密度
     0.2 * uniqueTermRatio; // 独特词汇比例
   ```

4. **Temporal Freshness** (时效性):
   ```javascript
   // 基于文档创建/更新时间评分
   const ageInDays = (Date.now() - ckb.timestamps.created_at) / (1000 * 60 * 60 * 24);
   const freshnessScore = Math.exp(-ageInDays / 365);  // 指数衰减
   ```

**Enhanced CKB Model with Quality**:
```javascript
{
  ckb_id: "ckb_123",
  // ... existing fields
  quality: {
    source_confidence: 0.9,
    // 🆕 新增：详细质量评分
    quality_scores: {
      overall: 0.85,
      source: 0.90,
      completeness: 0.85,
      density: 0.80,
      freshness: 0.85
    },
    quality_factors: {
      has_title: true,
      has_structure: true,
      entity_count: 15,
      keyword_count: 25,
      text_length: 2500,
      age_days: 30
    }
  }
}
```

### 6. Evidence Conflict Resolver

**Purpose**: 在冲突解决时，对比不同CKB的证据强度

**Location**: `kg/ckb/evidence_conflict_resolver.js`

**Interface**:
```javascript
class EvidenceConflictResolver {
  /**
   * 解决实体冲突，基于CKB证据强度
   * @param {Array<Object>} conflictingEntities - 冲突的实体
   * @returns {Promise<Object>} { resolvedEntity, reasoning }
   */
  async resolveEntityConflict(conflictingEntities)
  
  /**
   * 解决关系冲突，基于CKB证据强度
   * @param {Array<Object>} conflictingRelations - 冲突的关系
   * @returns {Promise<Object>} { resolvedRelation, reasoning }
   */
  async resolveRelationConflict(conflictingRelations)
  
  /**
   * 对比证据强度
   * @param {Array<Object>} evidences - 证据列表
   * @returns {Array} 按强度排序的证据
   */
  rankEvidenceByStrength(evidences)
}
```

**Conflict Resolution Algorithm**:

```javascript
async resolveEntityConflict(conflictingEntities) {
  // Step 1: 收集所有实体的CKB证据
  const evidenceMap = new Map();
  
  for (const entity of conflictingEntities) {
    const ckbs = await Promise.all(
      entity.supported_by.map(id => ckbStore.getCKB(id))
    );
    
    evidenceMap.set(entity.entity_id, {
      entity: entity,
      ckbs: ckbs,
      totalQuality: ckbs.reduce((sum, ckb) => 
        sum + ckb.quality.quality_scores.overall, 0
      ),
      avgQuality: ckbs.reduce((sum, ckb) => 
        sum + ckb.quality.quality_scores.overall, 0
      ) / ckbs.length,
      ckbCount: ckbs.length
    });
  }
  
  // Step 2: 计算证据强度评分
  const rankedEvidence = Array.from(evidenceMap.values())
    .map(ev => ({
      ...ev,
      strengthScore: this.calculateEvidenceStrength(ev)
    }))
    .sort((a, b) => b.strengthScore - a.strengthScore);
  
  // Step 3: 选择证据最强的实体
  const strongest = rankedEvidence[0];
  
  // Step 4: 合并其他实体的信息（如果质量接近）
  const resolvedEntity = { ...strongest.entity };
  
  for (const ev of rankedEvidence.slice(1)) {
    if (ev.strengthScore / strongest.strengthScore > 0.8) {
      // 质量接近，合并属性
      resolvedEntity.attributes = {
        ...resolvedEntity.attributes,
        ...ev.entity.attributes
      };
      resolvedEntity.supported_by.push(...ev.entity.supported_by);
    }
  }
  
  return {
    resolvedEntity,
    reasoning: {
      selectedEntity: strongest.entity.entity_id,
      strengthScore: strongest.strengthScore,
      mergedEntities: rankedEvidence.slice(1)
        .filter(ev => ev.strengthScore / strongest.strengthScore > 0.8)
        .map(ev => ev.entity.entity_id)
    }
  };
}

calculateEvidenceStrength(evidence) {
  // 综合评分公式
  return (
    0.4 * evidence.avgQuality +      // 平均质量权重40%
    0.3 * Math.log(evidence.ckbCount + 1) / Math.log(10) +  // CKB数量权重30%（对数缩放）
    0.3 * evidence.totalQuality / 10  // 总质量权重30%（归一化）
  );
}
```

**Integration with Entity Builder**:

```javascript
// kg/entity/entity_builder.js (修改)
async function mergeOrCreateEntity(newEntity, existingEntities, options = {}) {
  // ... existing code
  
  // 🆕 如果发现冲突，使用证据强度解决
  if (similarMatches.length > 1) {
    const conflictingEntities = [newEntity, ...similarMatches];
    const resolution = await evidenceConflictResolver.resolveEntityConflict(conflictingEntities);
    
    return {
      action: 'merged',
      entity: resolution.resolvedEntity,
      method: 'evidence_strength',
      reasoning: resolution.reasoning
    };
  }
  
  // ... existing code
}
```

### 7. Evidence Chain Visualizer

**Purpose**: 可视化证据链，展示实体/关系的证据来源和推理路径

**Location**: `kg/ckb/evidence_visualizer.js`

**Interface**:
```javascript
class EvidenceVisualizer {
  /**
   * 生成实体的证据链
   * @param {string} entityId - Entity ID
   * @returns {Promise<Object>} Evidence chain graph
   */
  async generateEntityEvidenceChain(entityId)
  
  /**
   * 生成关系的证据链
   * @param {string} relationId - Relation ID
   * @returns {Promise<Object>} Evidence chain graph
   */
  async generateRelationEvidenceChain(relationId)
  
  /**
   * 导出为可视化格式
   * @param {Object} evidenceChain - Evidence chain
   * @param {string} format - 'json' | 'graphviz' | 'd3'
   * @returns {string} Formatted output
   */
  exportEvidenceChain(evidenceChain, format = 'json')
}
```

**Evidence Chain Data Model**:

```javascript
{
  entity_id: "entity_123",
  entity_name: "阿里C区_水位_2025-01",
  evidence_chain: {
    nodes: [
      {
        id: "ckb_456",
        type: "ckb",
        label: "原始文档",
        quality_score: 0.85,
        metadata: {
          doc_id: "doc_789",
          title: "地下水位监测报告",
          created_at: "2025-01-15"
        }
      },
      {
        id: "chunk_2",
        type: "chunk",
        label: "第2段",
        text: "阿里C区2025年1月水位下降10米...",
        relevance_score: 0.92
      },
      {
        id: "field_area",
        type: "field",
        label: "区域字段",
        value: "阿里C区",
        confidence: 0.90
      },
      {
        id: "entity_123",
        type: "entity",
        label: "阿里C区_水位_2025-01",
        confidence: 0.85
      }
    ],
    edges: [
      { from: "ckb_456", to: "chunk_2", relation: "contains" },
      { from: "chunk_2", to: "field_area", relation: "extracted_from" },
      { from: "field_area", to: "entity_123", relation: "builds" }
    ],
    metadata: {
      total_quality: 0.85,
      evidence_strength: 0.88,
      confidence_path: [0.85, 0.92, 0.90, 0.85]
    }
  }
}
```

**Visualization Output (D3.js format)**:

```javascript
async generateEntityEvidenceChain(entityId) {
  // Step 1: 获取实体
  const entity = await entityStore.getEntity(entityId);
  
  // Step 2: 获取所有支持的CKBs
  const ckbs = await Promise.all(
    entity.supported_by.map(id => ckbStore.getCKB(id))
  );
  
  // Step 3: 获取证据定位信息
  const evidence = entity.evidence;
  const chunks = await chunkManager.getChunks(evidence.chunk_ids);
  
  // Step 4: 构建证据链图
  const nodes = [];
  const edges = [];
  
  // 添加CKB节点
  for (const ckb of ckbs) {
    nodes.push({
      id: ckb.ckb_id,
      type: 'ckb',
      label: ckb.content.title,
      quality_score: ckb.quality.quality_scores.overall,
      metadata: {
        doc_id: ckb.doc_id,
        created_at: ckb.timestamps.created_at
      }
    });
  }
  
  // 添加Chunk节点
  for (const chunk of chunks) {
    nodes.push({
      id: chunk.chunk_id,
      type: 'chunk',
      label: `Chunk ${chunk.chunk_id}`,
      text: chunk.text.substring(0, 100) + '...',
      relevance_score: chunk.metadata.entity_density
    });
    
    // 添加CKB -> Chunk边
    edges.push({
      from: chunk.ckb_id,
      to: chunk.chunk_id,
      relation: 'contains'
    });
  }
  
  // 添加Field节点
  for (const [fieldName, fieldValue] of Object.entries(entity.fields)) {
    const fieldId = `field_${fieldName}`;
    nodes.push({
      id: fieldId,
      type: 'field',
      label: fieldName,
      value: fieldValue,
      confidence: 0.9  // 可以从field extraction结果获取
    });
    
    // 添加Chunk -> Field边
    for (const chunk of chunks) {
      if (chunk.text.includes(fieldValue)) {
        edges.push({
          from: chunk.chunk_id,
          to: fieldId,
          relation: 'extracted_from'
        });
      }
    }
  }
  
  // 添加Entity节点
  nodes.push({
    id: entity.entity_id,
    type: 'entity',
    label: entity.canonical_name,
    confidence: entity.confidence
  });
  
  // 添加Field -> Entity边
  for (const fieldName of Object.keys(entity.fields)) {
    edges.push({
      from: `field_${fieldName}`,
      to: entity.entity_id,
      relation: 'builds'
    });
  }
  
  return {
    entity_id: entityId,
    entity_name: entity.canonical_name,
    evidence_chain: {
      nodes,
      edges,
      metadata: {
        total_quality: ckbs.reduce((sum, ckb) => 
          sum + ckb.quality.quality_scores.overall, 0
        ) / ckbs.length,
        evidence_strength: this.calculateEvidenceStrength({
          ckbs,
          chunks,
          entity
        }),
        confidence_path: [
          ...ckbs.map(ckb => ckb.quality.quality_scores.overall),
          ...chunks.map(c => c.metadata.entity_density),
          entity.confidence
        ]
      }
    }
  };
}
```

**API Endpoints**:

```javascript
// routes/evidenceRoutes.js
router.get('/api/entities/:id/evidence-chain', async (req, res) => {
  const { id } = req.params;
  const { format = 'json' } = req.query;
  
  const evidenceChain = await evidenceVisualizer.generateEntityEvidenceChain(id);
  const output = evidenceVisualizer.exportEvidenceChain(evidenceChain, format);
  
  res.json(output);
});

router.get('/api/relations/:id/evidence-chain', async (req, res) => {
  const { id } = req.params;
  const { format = 'json' } = req.query;
  
  const evidenceChain = await evidenceVisualizer.generateRelationEvidenceChain(id);
  const output = evidenceVisualizer.exportEvidenceChain(evidenceChain, format);
  
  res.json(output);
});
```

**Frontend Integration Example**:

```javascript
// 前端可视化示例（使用D3.js）
async function visualizeEvidenceChain(entityId) {
  const response = await fetch(`/api/entities/${entityId}/evidence-chain?format=d3`);
  const data = await response.json();
  
  // 使用D3.js渲染证据链图
  const svg = d3.select('#evidence-chain-viz');
  const simulation = d3.forceSimulation(data.evidence_chain.nodes)
    .force('link', d3.forceLink(data.evidence_chain.edges).id(d => d.id))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2));
  
  // 渲染节点和边...
}
```

