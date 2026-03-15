const llmClient = require('./llmClient');
const memoryService = require('./memoryService');
const embeddingService = require('./embeddingService');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SYSTEM_PROMPT = `你是一个名为 "Hi Brain" 的 AI 助手，也是用户的精神伙伴 (Spiritual Partner)。
你的使命是协助用户记录灵感、串联知识，并提供有深度的见解。

请基于以下提供的【用户记忆】和【知识库上下文】来回答用户的问题。
如果上下文中没有相关信息，请诚实地说明，或者基于你的通用知识进行回答，但要标明这是通用知识。

回答风格要求：
1. 温暖、真诚、富有同理心。
2. 鼓励用户思考，而不是直接给出冷冰冰的答案。
3. 引用用户的过往记忆时，可以自然地提及（例如：“正如你之前提到的...”）。
4. 保持简洁，避免长篇大论，除非用户要求详细解释。
`;

class RAGService {
  tokenizeQuery(query) {
    return String(query || '')
      .split(/[\s，,。！？；;、|/]+/)
      .map(token => token.trim())
      .filter(token => token.length >= 2)
      .slice(0, 8);
  }

  stripHtmlToText(raw) {
    if (raw === null || raw === undefined) return '';
    return String(raw)
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  deriveTitle(content) {
    const plain = this.stripHtmlToText(content);
    return plain ? plain.slice(0, 24) : '无标题';
  }

  parseTags(rawTags) {
    if (Array.isArray(rawTags)) return rawTags.map(tag => String(tag).trim()).filter(Boolean);
    if (typeof rawTags === 'string') {
      const text = rawTags.trim();
      if (!text) return [];
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return this.parseTags(parsed);
      } catch (_) {}
      return text.split(/[，,\s|/]+/).map(tag => tag.trim()).filter(Boolean);
    }
    return [];
  }

  async searchUserNotes(userId, query) {
    const tokens = this.tokenizeQuery(query);
    const noteRows = await prisma.note.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 120,
      select: {
        id: true,
        content: true,
        tags: true,
        updatedAt: true
      }
    });

    if (!noteRows.length) {
      return [];
    }

    const normalizedQuery = String(query || '').toLowerCase();
    const scored = noteRows.map(note => {
      const plain = this.stripHtmlToText(note.content);
      const tags = this.parseTags(note.tags);
      const lowerPlain = plain.toLowerCase();
      const lowerTags = tags.map(tag => tag.toLowerCase());

      let score = 0;
      if (normalizedQuery && lowerPlain.includes(normalizedQuery)) score += 8;
      tokens.forEach(token => {
        const lowerToken = token.toLowerCase();
        if (lowerPlain.includes(lowerToken)) score += 3;
        if (lowerTags.some(tag => tag.includes(lowerToken))) score += 4;
      });
      if (score <= 0) return null;

      return {
        id: note.id,
        title: this.deriveTitle(note.content),
        excerpt: plain.slice(0, 220),
        tags,
        score,
        updatedAt: note.updatedAt
      };
    }).filter(Boolean);

    return scored
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      })
      .slice(0, 6);
  }

  /**
   * Search Knowledge Graph (Simple text match for now + Vector if available)
   * @param {string} userId 
   * @param {string} query 
   * @returns {Promise<string>} Formatted context string
   */
  async searchKnowledgeGraph(userId, query) {
    // 1. Search Cognitive Fragments (Vector Search simulated)
    // In a real implementation with pgvector, we'd use the embedding.
    // Here we simulate or use text search.
    
    // Simple text search on DocEntities and CognitiveFragments
    const entities = await prisma.docEntity.findMany({
      where: {
        docId: { in: (await prisma.document.findMany({ where: { userId }, select: { id: true } })).map(d => d.id) },
        OR: [
          { cleanedName: { contains: query } },
          { description: { contains: query } }
        ]
      },
      take: 5
    });

    const fragments = await prisma.cognitiveFragment.findMany({
      where: {
        userId,
        content: { contains: query }
      },
      take: 5
    });

    if (entities.length === 0 && fragments.length === 0) return '';

    let context = '【知识库上下文】:\n';
    if (entities.length > 0) {
      context += '相关实体:\n' + entities.map(e => `- ${e.cleanedName}: ${e.description}`).join('\n') + '\n';
    }
    if (fragments.length > 0) {
      context += '相关碎片:\n' + fragments.map(f => `- ${f.content}`).join('\n') + '\n';
    }
    return context;
  }

  /**
   * Generate RAG response
   * @param {string} userId 
   * @param {string} query 
   */
  async generateResponse(userId, query) {
    try {
      // 1. Parallel Retrieval: Memories + Knowledge Graph
      const [memories, kgContext, relatedNotes] = await Promise.all([
        memoryService.searchMemories(userId, query, 5),
        this.searchKnowledgeGraph(userId, query),
        this.searchUserNotes(userId, query)
      ]);

      // 2. Format Context
      let memoryContext = '';
      if (memories.length > 0) {
        memoryContext = '【用户记忆】:\n' + memories.map(m => `- ${m.content} (重要性: ${m.importance.toFixed(2)})`).join('\n') + '\n';
      }

      let notesContext = '';
      if (relatedNotes.length > 0) {
        notesContext = '【思库笔记】:\n' + relatedNotes
          .map((note, idx) => `- [${idx + 1}] ${note.title}｜标签: ${note.tags.join('、') || '无'}｜内容摘要: ${note.excerpt}`)
          .join('\n') + '\n';
      }

      const fullContext = `${memoryContext}\n${notesContext}\n${kgContext}`;

      // 3. Construct Prompt
      const userPrompt = `用户问题: ${query}\n\n参考信息:\n${fullContext}`;

      // 4. Call LLM
      const response = await llmClient.call(userPrompt, {
        systemPrompt: SYSTEM_PROMPT, // Note: llmClient.call needs to support systemPrompt or we prepend it
        temperature: 0.7
      });
      const finalResponse = typeof response === 'string' ? response.trim() : '';
      const fallbackResponse = relatedNotes.length > 0
        ? `我结合你的思库找到了这些相关笔记：${relatedNotes.slice(0, 3).map(n => `《${n.title}》`).join('、')}。你可以继续追问，我会基于这些内容展开。`
        : '我暂时没有检索到和你问题直接相关的思库内容。你可以换个关键词，或先新增一些相关笔记。';

      // 5. Asynchronously save this interaction to Episodic Memory if important
      // (This logic could be refined to only save high-quality interactions)
      // await memoryService.addMemory(userId, `用户问: ${query}\nAI答: ${response}`, 'episodic');

      return {
        answer: finalResponse || fallbackResponse,
        response: finalResponse || fallbackResponse,
        sources: {
          memories: memories.map(m => m.id),
          notes: relatedNotes.map(note => note.id),
          kg_entities: []
        },
        contextStats: {
          memories: memories.length,
          notes: relatedNotes.length,
          kgContextIncluded: Boolean(kgContext && kgContext.trim())
        }
      };

    } catch (error) {
      console.error('RAG Generation Error:', error);
      throw error;
    }
  }
}

module.exports = new RAGService();
