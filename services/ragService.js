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
  detectOverviewIntent(query) {
    const text = String(query || '').toLowerCase();
    if (!text) return null;

    const hasRecent = text.includes('最近') || text.includes('近期') || text.includes('近来') || text.includes('这段时间');
    const isListAsk =
      text.includes('有哪些') ||
      text.includes('有什么') ||
      text.includes('有啥') ||
      text.includes('列出') ||
      text.includes('清单') ||
      text.includes('都有哪些');

    if (!hasRecent || !isListAsk) return null;

    if (text.includes('笔记') || text.includes('便签')) return { type: 'recent_notes' };
    if (text.includes('文档') || text.includes('文件')) return { type: 'recent_documents' };
    if (text.includes('附件')) return { type: 'recent_attachments' };
    return { type: 'recent_all' };
  }
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

  async searchUserDocuments(userId, query) {
    const tokens = this.tokenizeQuery(query);
    const docs = await prisma.document.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 120,
      select: {
        id: true,
        title: true,
        content: true,
        updatedAt: true
      }
    });

    if (!docs.length) return [];

    const normalizedQuery = String(query || '').toLowerCase();
    const scored = docs.map(doc => {
      const title = String(doc.title || '').trim();
      const plain = this.stripHtmlToText(doc.content);
      const lowerTitle = title.toLowerCase();
      const lowerPlain = plain.toLowerCase();

      let score = 0;
      if (normalizedQuery && (lowerTitle.includes(normalizedQuery) || lowerPlain.includes(normalizedQuery))) score += 8;
      tokens.forEach(token => {
        const lowerToken = token.toLowerCase();
        if (lowerTitle.includes(lowerToken)) score += 5;
        if (lowerPlain.includes(lowerToken)) score += 3;
      });
      if (score <= 0) return null;

      return {
        id: doc.id,
        title: title || this.deriveTitle(doc.content),
        excerpt: plain.slice(0, 260),
        score,
        updatedAt: doc.updatedAt
      };
    }).filter(Boolean);

    return scored
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      })
      .slice(0, 4);
  }

  async searchUserAttachmentAnalyses(userId, query) {
    const tokens = this.tokenizeQuery(query);
    const rows = await prisma.attachmentAnalysis.findMany({
      where: { attachment: { note: { userId } } },
      orderBy: { createdAt: 'desc' },
      take: 160,
      select: {
        id: true,
        textContent: true,
        description: true,
        attachment: {
          select: {
            id: true,
            type: true,
            noteId: true,
            note: {
              select: {
                id: true,
                content: true,
                tags: true,
                updatedAt: true
              }
            }
          }
        }
      }
    });

    if (!rows.length) return [];

    const normalizedQuery = String(query || '').toLowerCase();
    const scored = rows.map(row => {
      const text = String(row.textContent || '').trim();
      const desc = String(row.description || '').trim();
      const lowerText = text.toLowerCase();
      const lowerDesc = desc.toLowerCase();
      const note = row.attachment?.note;
      const notePlain = note ? this.stripHtmlToText(note.content) : '';
      const tags = note ? this.parseTags(note.tags) : [];
      const lowerTags = tags.map(tag => tag.toLowerCase());

      let score = 0;
      if (normalizedQuery && (lowerText.includes(normalizedQuery) || lowerDesc.includes(normalizedQuery))) score += 8;
      tokens.forEach(token => {
        const lowerToken = token.toLowerCase();
        if (lowerText.includes(lowerToken)) score += 3;
        if (lowerDesc.includes(lowerToken)) score += 2;
        if (notePlain.toLowerCase().includes(lowerToken)) score += 1;
        if (lowerTags.some(tag => tag.includes(lowerToken))) score += 4;
      });
      if (score <= 0) return null;

      return {
        id: row.id,
        type: row.attachment?.type || 'DOCUMENT',
        noteId: row.attachment?.noteId || null,
        noteTitle: note ? this.deriveTitle(note.content) : '无标题',
        excerpt: (text || desc || '').slice(0, 260),
        tags,
        score,
        updatedAt: note?.updatedAt || row.attachment?.note?.updatedAt || null
      };
    }).filter(Boolean);

    return scored
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      })
      .slice(0, 4);
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
      const overviewIntent = this.detectOverviewIntent(query);
      if (overviewIntent?.type) {
        const take = 8;
        if (overviewIntent.type === 'recent_notes' || overviewIntent.type === 'recent_all') {
          const rows = await prisma.note.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
            take,
            select: { id: true, content: true, tags: true, updatedAt: true }
          });
          const items = rows.map((note, idx) => {
            const title = this.deriveTitle(note.content);
            const excerpt = this.stripHtmlToText(note.content).slice(0, 120);
            const tags = this.parseTags(note.tags);
            return `${idx + 1}. 《${title}》${tags.length ? `（${tags.slice(0, 4).join('、')}）` : ''}\n   ${excerpt}`;
          });
          const answer = items.length
            ? `你最近的笔记有这些（按更新时间倒序）：\n${items.join('\n')}\n\n你想我展开哪一条？可以直接回复序号或标题。`
            : '你最近还没有保存过笔记。你可以先创建一条，我再帮你回顾与串联。';
          return {
            answer,
            response: answer,
            sources: { notes: rows.map(r => r.id), documents: [], attachments: [], memories: [], kg_entities: [] },
            contextStats: { notes: rows.length, documents: 0, attachments: 0, memories: 0, kgContextIncluded: false }
          };
        }

        if (overviewIntent.type === 'recent_documents') {
          const rows = await prisma.document.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
            take,
            select: { id: true, title: true, content: true, updatedAt: true }
          });
          const items = rows.map((doc, idx) => {
            const title = String(doc.title || '').trim() || this.deriveTitle(doc.content);
            const excerpt = this.stripHtmlToText(doc.content).slice(0, 140);
            return `${idx + 1}. 《${title}》\n   ${excerpt}`;
          });
          const answer = items.length
            ? `你最近上传/编辑的文档有这些（按更新时间倒序）：\n${items.join('\n')}\n\n你想我总结哪一份？可以直接回复序号或标题。`
            : '你最近还没有文档。你可以先在思库里上传一份，我再帮你总结与串联。';
          return {
            answer,
            response: answer,
            sources: { notes: [], documents: rows.map(r => r.id), attachments: [], memories: [], kg_entities: [] },
            contextStats: { notes: 0, documents: rows.length, attachments: 0, memories: 0, kgContextIncluded: false }
          };
        }

        if (overviewIntent.type === 'recent_attachments') {
          const rows = await prisma.attachment.findMany({
            where: { note: { userId } },
            orderBy: { createdAt: 'desc' },
            take,
            select: {
              id: true,
              type: true,
              url: true,
              createdAt: true,
              noteId: true,
              analysis: { select: { textContent: true, description: true } }
            }
          });
          const items = rows.map((att, idx) => {
            const excerpt = String(att.analysis?.textContent || att.analysis?.description || '').trim().slice(0, 120);
            return `${idx + 1}. ${att.type}（noteId: ${att.noteId}）\n   ${excerpt || '（暂无解析内容）'}`;
          });
          const answer = items.length
            ? `你最近的附件有这些（按时间倒序）：\n${items.join('\n')}\n\n你想我展开哪一个？可以回复序号。`
            : '你最近还没有上传附件。';
          return {
            answer,
            response: answer,
            sources: { notes: [], documents: [], attachments: rows.map(r => r.id), memories: [], kg_entities: [] },
            contextStats: { notes: 0, documents: 0, attachments: rows.length, memories: 0, kgContextIncluded: false }
          };
        }
      }

      // 1. Parallel Retrieval: Memories + Knowledge Graph
      const [memories, kgContext, relatedNotes, relatedDocuments, relatedAttachments] = await Promise.all([
        memoryService.searchMemories(userId, query, 5),
        this.searchKnowledgeGraph(userId, query),
        this.searchUserNotes(userId, query),
        this.searchUserDocuments(userId, query),
        this.searchUserAttachmentAnalyses(userId, query)
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

      let documentsContext = '';
      if (relatedDocuments.length > 0) {
        documentsContext = '【思库文档】:\n' + relatedDocuments
          .map((doc, idx) => `- [${idx + 1}] ${doc.title}｜内容摘要: ${doc.excerpt}`)
          .join('\n') + '\n';
      }

      let attachmentsContext = '';
      if (relatedAttachments.length > 0) {
        attachmentsContext = '【思库附件】:\n' + relatedAttachments
          .map((att, idx) => `- [${idx + 1}] ${att.noteTitle}｜类型: ${att.type}｜标签: ${att.tags.join('、') || '无'}｜内容摘要: ${att.excerpt}`)
          .join('\n') + '\n';
      }

      const fullContext = `${memoryContext}\n${notesContext}\n${documentsContext}\n${attachmentsContext}\n${kgContext}`;

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
          documents: relatedDocuments.map(doc => doc.id),
          attachments: relatedAttachments.map(att => att.id),
          kg_entities: []
        },
        contextStats: {
          memories: memories.length,
          notes: relatedNotes.length,
          documents: relatedDocuments.length,
          attachments: relatedAttachments.length,
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
