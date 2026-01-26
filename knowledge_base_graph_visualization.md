# 个人智能知识库知识图谱可视化方案

## 一、知识图谱概述

知识图谱是一个将知识以实体（节点）和关系（边）的形式组织起来的可视化网络。在个人智能知识库中，知识图谱能够直观地展示不同知识点之间的关联关系，帮助用户发现知识之间的联系，提升知识理解和应用能力。

## 二、核心功能需求

### 1. 实体识别与提取
- 自动识别文档中的核心实体：概念、人物、项目、书籍、日期等
- 支持自定义实体类型
- 实体信息自动补全

### 2. 关系抽取与构建
- 自动提取实体之间的关系：父子关系、关联关系、引用关系等
- 支持手动添加和编辑关系
- 关系强度计算（基于共现频率等指标）

### 3. 可视化展示
- 节点-边网络展示
- 实体分类颜色编码
- 关系类型样式区分
- 缩放、平移、拖拽交互

### 4. 交互功能
- 节点点击展开详情
- 关系点击展示说明
- 过滤和搜索功能
- 节点聚集和解散

### 5. 导出与分享
- 图谱导出为图片（PNG、SVG）
- 图谱结构导出为JSON

## 三、技术实现方案

### 1. 实体识别与提取

#### 技术选型
- **前端**：spaCy.js + NLP.js（轻量级NLP库，支持本地运行）
- **后端**：Node.js + NLP.js（批量处理时使用）

#### 实现代码

```javascript
// 实体识别核心代码（前端示例）
const { NLP } = require('nlp.js');

async function extractEntities(content) {
  const nlp = new NLP();
  await nlp.load({ languages: ['zh', 'en'] });
  
  const result = await nlp.process('zh', content);
  const entities = [];
  
  // 提取实体
  if (result.entities) {
    entities.push(...result.entities.map(entity => ({
      text: entity.sourceText,
      type: entity.entity,
      confidence: entity.score
    })));
  }
  
  // 提取自定义实体类型（概念、项目等）
  const customEntities = extractCustomEntities(content);
  entities.push(...customEntities);
  
  return entities;
}

// 提取自定义实体类型
function extractCustomEntities(content) {
  const entities = [];
  // 概念识别：通常是名词短语
  const conceptRegex = /(?:[\u4e00-\u9fa5]+[的]?){2,}/g;
  let match;
  while ((match = conceptRegex.exec(content)) !== null) {
    entities.push({
      text: match[0],
      type: 'CONCEPT',
      confidence: 0.8
    });
  }
  return entities;
}
```

### 2. 关系抽取与构建

#### 技术选型
- **前端**：D3.js（构建可视化网络）
- **后端**：SQLite（存储实体和关系数据）

#### 数据模型

```prisma
// 实体表
model Entity {
  id          String   @id @default(uuid())
  name        String
  type        String   // CONCEPT, PERSON, PROJECT, BOOK, DATE, etc.
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // 关系
  relationsAsSource EntityRelation[] @relation("SourceEntity")
  relationsAsTarget EntityRelation[] @relation("TargetEntity")
}

// 关系表
model EntityRelation {
  id          String   @id @default(uuid())
  sourceId    String
  targetId    String
  type        String   // PARENT, ASSOCIATION, REFERENCE, etc.
  strength    Float    // 0-1之间的关系强度
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // 外键
  source      Entity   @relation("SourceEntity", fields: [sourceId], references: [id], onDelete: Cascade)
  target      Entity   @relation("TargetEntity", fields: [targetId], references: [id], onDelete: Cascade)
}
```

#### 关系抽取代码

```javascript
// 关系抽取核心代码（后端示例）
async function extractRelations(content, entities) {
  const relations = [];
  
  // 基于共现频率计算实体间关系强度
  const entityPairs = [];
  
  // 生成所有实体对
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      entityPairs.push([entities[i], entities[j]]);
    }
  }
  
  // 计算每对实体的共现频率
  for (const [entity1, entity2] of entityPairs) {
    const regex1 = new RegExp(escapeRegExp(entity1.text), 'g');
    const regex2 = new RegExp(escapeRegExp(entity2.text), 'g');
    
    const matches1 = content.match(regex1);
    const matches2 = content.match(regex2);
    
    if (matches1 && matches2) {
      // 计算共现频率（简化示例）
      const cooccurrence = calculateCooccurrence(content, entity1.text, entity2.text);
      const strength = Math.min(cooccurrence / 10, 1.0); // 归一化到0-1
      
      if (strength > 0.1) { // 设置关系强度阈值
        relations.push({
          sourceId: entity1.id,
          targetId: entity2.id,
          type: 'ASSOCIATION',
          strength: strength,
          description: `共现频率: ${cooccurrence}`
        });
      }
    }
  }
  
  return relations;
}

// 计算两个实体在文本中的共现频率
function calculateCooccurrence(text, term1, term2) {
  // 简化实现：计算两个术语在同一行或段落中出现的次数
  const lines = text.split(/[\n\r]/);
  let cooccurrence = 0;
  
  for (const line of lines) {
    if (line.includes(term1) && line.includes(term2)) {
      cooccurrence++;
    }
  }
  
  return cooccurrence;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

### 3. 可视化展示实现

#### 技术选型
- **前端**：D3.js v7（强大的图形可视化库）
- **组件**：React + D3.js 结合使用

#### 实现代码

```javascript
// 知识图谱可视化组件（React + D3.js）
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const KnowledgeGraph = ({ entities, relations }) => {
  const svgRef = useRef(null);
  
  useEffect(() => {
    if (!entities || !relations || entities.length === 0) return;
    
    const width = 800;
    const height = 600;
    
    // 清除之前的可视化
    d3.select(svgRef.current).selectAll('*').remove();
    
    // 创建SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .style('border', '1px solid #ccc');
    
    // 创建缩放行为
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    
    svg.call(zoom);
    
    // 创建图形组
    const g = svg.append('g');
    
    // 创建力导向图布局
    const simulation = d3.forceSimulation(entities)
      .force('link', d3.forceLink(relations).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));
    
    // 定义实体类型颜色映射
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10)
      .domain(['CONCEPT', 'PERSON', 'PROJECT', 'BOOK', 'DATE']);
    
    // 创建连接线
    const links = g.append('g')
      .selectAll('line')
      .data(relations)
      .enter().append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => Math.sqrt(d.strength) * 2);
    
    // 创建节点组
    const node = g.append('g')
      .selectAll('.node')
      .data(entities)
      .enter().append('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));
    
    // 创建节点圆
    node.append('circle')
      .attr('r', 20)
      .attr('fill', d => colorScale(d.type) || '#ccc');
    
    // 创建节点文本
    node.append('text')
      .attr('dy', 30)
      .attr('text-anchor', 'middle')
      .text(d => d.name.length > 10 ? d.name.substring(0, 10) + '...' : d.name);
    
    // 添加节点点击事件
    node.on('click', (event, d) => {
      console.log('Node clicked:', d);
      // 显示节点详情
      showNodeDetails(d);
    });
    
    // 更新位置
    simulation.on('tick', () => {
      links
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      
      node
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });
    
    // 拖拽事件处理函数
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
    
    // 显示节点详情
    function showNodeDetails(node) {
      // 实现节点详情展示逻辑
      alert(`节点: ${node.name}\n类型: ${node.type}\n描述: ${node.description || '无'}`);
    }
    
  }, [entities, relations]);
  
  return (
    <svg ref={svgRef}></svg>
  );
};

export default KnowledgeGraph;
```

## 四、数据存储设计

### 1. 实体表（Entity）
| 字段名 | 数据类型 | 描述 |
|-------|---------|------|
| id | String | 实体唯一标识（UUID） |
| name | String | 实体名称 |
| type | String | 实体类型 |
| description | String | 实体描述 |
| metadata | JSON | 实体元数据 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

### 2. 关系表（EntityRelation）
| 字段名 | 数据类型 | 描述 |
|-------|---------|------|
| id | String | 关系唯一标识（UUID） |
| sourceId | String | 源实体ID |
| targetId | String | 目标实体ID |
| type | String | 关系类型 |
| strength | Float | 关系强度（0-1） |
| description | String | 关系描述 |
| metadata | JSON | 关系元数据 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

## 五、界面设计与交互流程

### 1. 主界面布局
```
┌─────────────────────────────────────────────────┐
│ 工具栏：缩放、过滤、导出、设置                  │
├─────────────────────────────────────────────────┤
│                                                 │
│                                                 │
│                知识图谱可视化区域                │
│                                                 │
│                                                 │
├─────────────────────────────────────────────────┤
│ 实体详情面板：展示选中实体的详细信息和相关关系  │
└─────────────────────────────────────────────────┘
```

### 2. 交互流程

#### 实体识别与构建流程
```
文档导入/编辑 → 实体识别服务 → 关系抽取服务 → 图谱构建 → 可视化展示
```

#### 用户交互流程
```
用户打开图谱 → 浏览图谱结构 → 点击实体 → 查看详情 → 过滤/搜索 → 导出/分享
```

## 六、性能优化策略

### 1. 数据量优化
- 实体数量限制：默认展示前1000个重要实体
- 关系数量限制：默认展示前5000条强关系
- 支持按需加载更多实体和关系

### 2. 渲染优化
- 使用D3.js的分层渲染
- 节点聚集显示（大量节点时）
- 懒加载节点详情

### 3. 计算优化
- 实体识别和关系抽取在后台线程执行
- 使用Web Workers进行计算密集型操作
- 关系强度计算缓存

## 七、未来扩展方向

1. **知识图谱增强**
   - 支持时序可视化（时间维度）
   - 支持多维度知识图谱
   - 实体情感分析和可视化

2. **AI增强**
   - 基于知识图谱的推理功能
   - 智能推荐实体和关系
   - 图谱结构自动优化

3. **协作功能**
   - 多用户共享知识图谱
   - 图谱版本控制
   - 协同编辑功能

4. **集成扩展**
   - 与外部知识图谱对接（如Wikipedia、DBpedia）
   - 支持导入外部图谱数据
   - 图谱API接口提供

## 八、总结

知识图谱可视化是个人智能知识库的核心智能功能之一，通过D3.js实现的交互式图谱能够直观展示知识之间的关联关系，帮助用户更好地理解和应用知识。本方案采用本地优先的技术栈，确保在无网络环境下也能正常使用核心功能，同时支持未来的功能扩展和性能优化。