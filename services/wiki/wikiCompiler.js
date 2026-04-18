const crypto = require('crypto');

function stableHash(text) {
  return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

function stripMarkdown(md) {
  return String(md || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/[#>*_~\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function minimallyRedactRawContent(text) {
  let s = String(text || '');

  s = s.replace(/\b[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}\b/g, (m) => {
    const at = m.indexOf('@');
    if (at <= 0) return m;
    const local = m.slice(0, at);
    const domain = m.slice(at + 1);
    const first = local.slice(0, 1) || '*';
    return `${first}***@${domain}`;
  });

  s = s.replace(/(^|[^\d])(\+?86[-\s]?)?(1[3-9]\d)[-\s]?(\d{4})[-\s]?(\d{4})(?=[^\d]|$)/g, (m, pre, country, head, _mid, tail) => {
    const p = pre || '';
    const c = country || '';
    const t = String(tail || '').replace(/[^\d]/g, '');
    return `${p}${c}${head}****${t || tail}`;
  });

  s = s.replace(/(^|[^\d])(\d{15}|\d{17}[\dXx])(?=[^\d]|$)/g, (m, pre, id) => {
    const p = pre || '';
    const v = String(id || '');
    const prefix = v.slice(0, 3);
    const suffix = v.slice(-4);
    const masked = `${prefix}${'*'.repeat(Math.max(0, v.length - 7))}${suffix}`;
    return `${p}${masked}`;
  });

  return s;
}

function safeJsonParse(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (Number.isNaN(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function normalizePageType(value, fallback = 'concept') {
  const t = String(value || '').trim().toLowerCase();
  const allowed = new Set(['concept', 'entity', 'source', 'comparison', 'insight', 'meta']);
  if (allowed.has(t)) return t;
  return fallback;
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value
      .map(v => String(v || '').trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return [];
    return s
      .split(/[,，\n]/g)
      .map(v => v.trim())
      .filter(Boolean);
  }
  return [];
}

function uniqueStrings(value) {
  const out = [];
  const seen = new Set();
  for (const s of normalizeStringArray(value)) {
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

function normalizeSources(value) {
  const arr = Array.isArray(value) ? value : [];
  const out = [];
  const seen = new Set();
  for (const item of arr) {
    if (!item) continue;
    if (typeof item === 'string') {
      const id = item.trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ id });
      continue;
    }
    if (typeof item === 'object') {
      const id = item.id ? String(item.id).trim() : '';
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        sourceType: item.sourceType ? String(item.sourceType) : item.type ? String(item.type) : null,
        sourceId: item.sourceId ? String(item.sourceId) : null,
        sourceUrl: item.sourceUrl ? String(item.sourceUrl) : item.url ? String(item.url) : null,
        title: item.title ? String(item.title) : null,
      });
    }
  }
  return out;
}

function mergeSources(existingSources, incomingSources) {
  const merged = normalizeSources([...(normalizeSources(existingSources) || []), ...(normalizeSources(incomingSources) || [])]);
  return merged;
}

function guessTypeFromSlugOrTitle(slug, title) {
  const s = String(slug || '').toLowerCase().trim();
  const t = String(title || '').toLowerCase().trim();
  const candidates = ['concept', 'entity', 'source', 'comparison', 'insight', 'meta'];
  for (const k of candidates) {
    if (s === k || s.startsWith(`${k}-`)) return k;
    if (t === k || t.startsWith(`${k}:`) || t.startsWith(`${k}：`)) return k;
  }
  return 'concept';
}

function slugify(title, fallbackSeed) {
  const raw = String(title || '').trim();
  const cleaned = raw
    .toLowerCase()
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/[^\p{Letter}\p{Number}\u4e00-\u9fff]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  if (cleaned) return cleaned;
  const seed = fallbackSeed || raw || String(Date.now());
  return `page-${stableHash(seed).slice(0, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function clampText(input, maxChars) {
  const text = String(input || '');
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}

class WikiCompiler {
  constructor(opts) {
    this.llmClient = opts.llmClient;
    this.embeddingService = opts.embeddingService;
    this.dal = opts.dal;
    this.lockOwner = opts.lockOwner || `wiki-compiler:${process.pid}`;
    this.matchThreshold = typeof opts.matchThreshold === 'number' ? opts.matchThreshold : 0.82;
  }

  async compileSourceById(sourceId, options = {}) {
    const claimed = await this.dal.tryLockSource(sourceId, this.lockOwner, 'running');
    if (!claimed) {
      const source = await this.dal.getSourceById(sourceId);
      return { status: 'skipped', reason: 'not_claimed', source };
    }

    const traceId = crypto.randomUUID();
    const run = await this.dal.createCompileRun({ sourceId, traceId, stage: 'extract', status: 'running' });
    const metrics = {
      traceId,
      startedAt: nowIso(),
      stages: {},
      pages: { created: 0, updated: 0, matched: 0 },
      candidates: 0,
      errors: [],
    };

    const t0 = Date.now();
    try {
      await this.dal.updateSource(sourceId, { lastTraceId: traceId, lastRunId: run.id, progress: { stage: 'extract' } });

      const source = await this.dal.getSourceById(sourceId);
      if (!source) {
        throw new Error('WikiSource not found');
      }

      const extracted = await this.extract(source, options);
      metrics.stages.extract = { ms: extracted.ms, bytes: extracted.bytes, hash: extracted.contentHash };
      await this.dal.updateSource(sourceId, {
        rawContent: extracted.rawContent,
        contentHash: extracted.contentHash,
        lastExtractedAt: new Date(),
        progress: { stage: 'match' },
      });
      await this.dal.updateCompileRun(run.id, { stage: 'match', metrics });

      const { candidates, ms: matchInputMs, llm } = await this.generateCandidates(source, extracted, options);
      metrics.stages.llmExtract = { ms: matchInputMs };
      metrics.candidates = candidates.length;
      await this.dal.updateSource(sourceId, { progress: { stage: 'match', candidates: candidates.length } });
      if (llm) {
        const patch = {};
        const total = llm?.usage?.totalTokens;
        if (typeof total === 'number' && !Number.isNaN(total)) {
          patch.llmTotalTokens = total;
          if (typeof llm?.usage?.promptTokens === 'number' && !Number.isNaN(llm.usage.promptTokens)) {
            patch.llmPromptTokens = llm.usage.promptTokens;
          }
          if (typeof llm?.usage?.completionTokens === 'number' && !Number.isNaN(llm.usage.completionTokens)) {
            patch.llmCompletionTokens = llm.usage.completionTokens;
          }
        } else if (typeof llm?.inputChars === 'number' && !Number.isNaN(llm.inputChars)) {
          patch.llmInputChars = llm.inputChars;
        }
        if (Object.keys(patch).length) {
          await this.dal.updateCompileRun(run.id, patch);
        }
      }

      const matchRes = await this.match(source.userId, candidates);
      metrics.stages.match = { ms: matchRes.ms, threshold: this.matchThreshold };
      await this.dal.updateSource(sourceId, { progress: { stage: 'merge' } });
      await this.dal.updateCompileRun(run.id, { stage: 'merge', metrics });

      const merged = await this.merge(source, candidates, matchRes.matches, run, options);
      metrics.stages.merge = { ms: merged.ms };
      metrics.pages.created = merged.created;
      metrics.pages.updated = merged.updated;
      metrics.pages.matched = matchRes.matches.filter(m => m.matchSlug).length;

      await this.dal.updateSource(sourceId, { progress: { stage: 'render' } });
      await this.dal.updateCompileRun(run.id, { stage: 'render', metrics });

      const rendered = await this.render(source, merged.pages, run, options);
      metrics.stages.render = { ms: rendered.ms };

      const durationMs = Date.now() - t0;
      metrics.completedAt = nowIso();
      metrics.durationMs = durationMs;

      await this.dal.updateCompileRun(run.id, {
        status: 'succeeded',
        stage: 'done',
        completedAt: new Date(),
        metrics,
        error: null,
      });

      await this.dal.unlockSource(sourceId, {
        status: 'succeeded',
        progress: { stage: 'done', pages: { created: merged.created, updated: merged.updated } },
        error: null,
        lastCompiledAt: new Date(),
        lastRunId: run.id,
        lastTraceId: traceId,
        lastDurationMs: durationMs,
      });

      return { status: 'succeeded', sourceId, runId: run.id, traceId, pages: rendered.pages };
    } catch (e) {
      const durationMs = Date.now() - t0;
      metrics.completedAt = nowIso();
      metrics.durationMs = durationMs;
      metrics.errors.push(String(e?.message || e || 'compile_failed'));

      await this.dal.updateCompileRun(run.id, {
        status: 'failed',
        stage: 'failed',
        completedAt: new Date(),
        metrics,
        error: String(e?.message || e || 'compile_failed'),
      });

      await this.dal.unlockSource(sourceId, {
        status: 'failed',
        progress: { stage: 'failed' },
        error: String(e?.message || e || 'compile_failed'),
        lastRunId: run.id,
        lastTraceId: traceId,
        lastDurationMs: durationMs,
      });

      try {
        const source = await this.dal.getSourceById(sourceId);
        if (!source?.userId) throw new Error('missing_userId');
        const now = new Date();
        const errorText = String(e?.message || e || 'compile_failed');
        const lines = [
          `# failure-log`,
          ``,
          `- time: ${now.toISOString()}`,
          `- sourceId: ${String(sourceId)}`,
          `- runId: ${String(run.id)}`,
          `- traceId: ${String(traceId)}`,
          `- error: ${errorText}`,
        ];
        if (source) {
          if (source.sourceType) lines.push(`- sourceType: ${String(source.sourceType)}`);
          if (source.sourceUrl) lines.push(`- sourceUrl: ${String(source.sourceUrl)}`);
          if (source.sourceId) lines.push(`- sourceRefId: ${String(source.sourceId)}`);
          if (source.title) lines.push(`- sourceTitle: ${String(source.title)}`);
        }
        await this.dal.upsertPageBySlug(source.userId, 'meta-failure-log', {
          title: 'failure-log',
          summary: errorText.slice(0, 200) || null,
          type: 'meta',
          tags: ['failure-log'],
          related: [],
          sources: [{
            id: source.id,
            sourceType: source.sourceType,
            sourceId: source.sourceId || null,
            sourceUrl: source.sourceUrl || null,
            title: source.title || null,
          }],
          confidence: 1,
          markdown: `${lines.join('\n')}\n`,
          lastCompiledAt: now,
          lastSourceId: source.id,
          lastRunId: run.id,
        });
      } catch {}

      return { status: 'failed', sourceId, runId: run.id, traceId, error: String(e?.message || e || 'compile_failed') };
    }
  }

  async extract(source, options = {}) {
    const t0 = Date.now();
    const sourceType = String(source.sourceType || '');
    let rawContent = source.rawContent;
    let title = source.title;

    if (options.rawContent) {
      rawContent = String(options.rawContent);
    }

    if (options.title) {
      title = String(options.title);
    }

    if (!rawContent) {
      if (sourceType === 'document' && source.sourceId) {
        const doc = await this.dal._prisma.document.findUnique({ where: { id: String(source.sourceId) } });
        rawContent = doc?.content || '';
        title = title || doc?.title || null;
      } else if (sourceType === 'note' && source.sourceId) {
        const note = await this.dal._prisma.note.findUnique({ where: { id: String(source.sourceId) } });
        rawContent = note?.content || '';
        title = title || null;
      } else if (sourceType === 'url' && source.sourceUrl) {
        const res = await fetch(String(source.sourceUrl), { method: 'GET' });
        rawContent = await res.text();
      }
    }

    rawContent = String(rawContent || '').trim();
    if (!rawContent) {
      throw new Error('empty_source_content');
    }

    const contentHash = stableHash(rawContent);
    const ms = Date.now() - t0;
    return { rawContent, title, contentHash, bytes: Buffer.byteLength(rawContent, 'utf8'), ms };
  }

  async generateCandidates(source, extracted, options = {}) {
    const t0 = Date.now();
    const llmRawContent = minimallyRedactRawContent(extracted.rawContent);
    const content = clampText(llmRawContent, 12000);
    const hintTitle = extracted.title || source.title || '';
    const systemPrompt = '你是一个严谨的知识整理器。只输出 JSON，不要输出任何额外文本。';
    const prompt = [
      '请把以下来源内容编译为若干 wiki 页面候选，要求：',
      '1) 输出 JSON，结构为 {"pages":[...]}',
      '2) pages 每项包含: title, slug(可选), type, tags, related, confidence, sources, summary(可选), markdown',
      '3) type 只能是 concept/entity/source/comparison/insight/meta 之一',
      '4) tags/related/sources 都是数组；tags/related 为字符串数组；sources 为引用数组',
      '5) sources 每项包含: id(来源ID，可用下面提供的来源ID), sourceType, sourceId, sourceUrl, title',
      '6) confidence 为 0-1 的数字，表示该页面内容可靠度',
      '7) markdown 使用标准 Markdown，包含清晰的小节标题',
      '8) 尽量按主题拆分为 1-6 页；内容很短时允许 1 页',
      '9) 每页 sources 至少包含一个引用到本次来源（下方提供来源ID）',
      '',
      `来源ID：${String(source.id)}`,
      `来源标题：${hintTitle}`,
      `来源类型：${String(source.sourceType || '')}`,
      `来源URL：${String(source.sourceUrl || '')}`,
      '',
      '来源内容：',
      content,
    ].join('\n');

    let data;
    let usage = null;
    const inputChars = prompt.length;
    try {
      if (typeof this.llmClient.callJSONWithMeta === 'function') {
        const res = await this.llmClient.callJSONWithMeta(prompt, { systemPrompt, temperature: 0.2, maxTokens: 2500 });
        data = res?.data;
        usage = res?.usage || null;
      } else {
        data = await this.llmClient.callJSON(prompt, { systemPrompt, temperature: 0.2, maxTokens: 2500 });
      }
    } catch (e) {
      const fallbackMd = `# ${hintTitle || 'Wiki'}\n\n${content}\n`;
      const pages = [{
        title: hintTitle || 'Wiki',
        slug: slugify(hintTitle || 'wiki', extracted.contentHash),
        type: 'source',
        tags: [],
        related: [],
        confidence: 0.5,
        sources: [{
          id: source.id,
          sourceType: source.sourceType,
          sourceId: source.sourceId || null,
          sourceUrl: source.sourceUrl || null,
          title: hintTitle || source.title || null,
        }],
        summary: null,
        markdown: fallbackMd,
      }];
      return { candidates: pages, ms: Date.now() - t0, llm: { usage: null, inputChars } };
    }

    const pages = Array.isArray(data?.pages) ? data.pages : [];
    const normalized = [];
    for (const p of pages) {
      const title = String(p?.title || hintTitle || 'Wiki').trim() || 'Wiki';
      const markdown = String(p?.markdown || '').trim();
      if (!markdown) continue;
      const slug = String(p?.slug || '').trim() || slugify(title, extracted.contentHash);
      const summary = p?.summary ? String(p.summary).trim() : null;
      const type = normalizePageType(p?.type, guessTypeFromSlugOrTitle(slug, title));
      const tags = uniqueStrings(p?.tags);
      const related = uniqueStrings(p?.related);
      const confidence = clampNumber(p?.confidence, 0, 1, 0.5);
      const sources = normalizeSources(p?.sources);
      const ensuredSources = sources.length ? sources : [{
        id: source.id,
        sourceType: source.sourceType,
        sourceId: source.sourceId || null,
        sourceUrl: source.sourceUrl || null,
        title: hintTitle || source.title || null,
      }];
      normalized.push({ title, slug, type, tags, related, confidence, sources: ensuredSources, summary, markdown });
    }
    if (!normalized.length) {
      const fallbackMd = `# ${hintTitle || 'Wiki'}\n\n${content}\n`;
      normalized.push({
        title: hintTitle || 'Wiki',
        slug: slugify(hintTitle || 'wiki', extracted.contentHash),
        type: 'source',
        tags: [],
        related: [],
        confidence: 0.5,
        sources: [{
          id: source.id,
          sourceType: source.sourceType,
          sourceId: source.sourceId || null,
          sourceUrl: source.sourceUrl || null,
          title: hintTitle || source.title || null,
        }],
        summary: null,
        markdown: fallbackMd,
      });
    }
    return { candidates: normalized, ms: Date.now() - t0, llm: { usage, inputChars } };
  }

  async match(userId, candidates) {
    const t0 = Date.now();
    const pages = await this.dal.listPages(userId, { limit: 200 });
    const existing = pages.map(p => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      summary: p.summary,
      markdown: p.markdown,
      embedding: p.embedding,
      version: p.version,
    }));

    const matches = [];
    for (const c of candidates) {
      const direct = existing.find(e => e.slug === c.slug);
      if (direct) {
        matches.push({ candidateSlug: c.slug, matchSlug: direct.slug, matchPageId: direct.id, score: 1.0 });
        continue;
      }

      const queryText = `${c.title}\n${c.summary || stripMarkdown(c.markdown).slice(0, 400)}`;
      const emb = await this.embeddingService.generateEmbedding(queryText);
      if (!emb) {
        matches.push({ candidateSlug: c.slug, matchSlug: null, matchPageId: null, score: null });
        continue;
      }

      let best = null;
      for (const e of existing) {
        let eEmb = e.embedding;
        if (!Array.isArray(eEmb)) {
          eEmb = safeJsonParse(e.embedding, null);
        }
        if (!Array.isArray(eEmb) || !eEmb.length) continue;
        const s = this.embeddingService.cosineSimilarity(emb, eEmb);
        if (!best || s > best.score) best = { slug: e.slug, id: e.id, score: s };
      }

      if (best && best.score >= this.matchThreshold) {
        matches.push({ candidateSlug: c.slug, matchSlug: best.slug, matchPageId: best.id, score: best.score });
      } else {
        matches.push({ candidateSlug: c.slug, matchSlug: null, matchPageId: null, score: best ? best.score : null });
      }
    }

    return { matches, ms: Date.now() - t0 };
  }

  async merge(source, candidates, matches, run, options = {}) {
    const t0 = Date.now();
    const bySlug = new Map(matches.map(m => [m.candidateSlug, m]));
    const outPages = [];
    let created = 0;
    let updated = 0;

    for (const c of candidates) {
      const m = bySlug.get(c.slug);
      const matchPageId = m?.matchPageId || null;
      const matchSlug = m?.matchSlug || null;
      const now = new Date();

      if (matchPageId && matchSlug) {
        const existing = await this.dal.getPageBySlug(source.userId, matchSlug);
        const mergedMarkdown = await this.mergeMarkdown(existing?.markdown || '', c.markdown, {
          title: existing?.title || c.title,
          force: !!options.force,
        });

        const summary = c.summary || stripMarkdown(mergedMarkdown).slice(0, 200) || null;
        const embedding = await this.embeddingService.generateEmbedding(`${c.title}\n${summary || ''}`);
        const existingTags = safeJsonParse(existing?.tags, []);
        const existingRelated = safeJsonParse(existing?.related, []);
        const existingSources = safeJsonParse(existing?.sources, []);
        const page = await this.dal.upsertPageBySlug(source.userId, matchSlug, {
          title: existing?.title || c.title,
          summary,
          markdown: mergedMarkdown,
          embedding: embedding ? JSON.stringify(embedding) : existing?.embedding || null,
          type: normalizePageType(c.type, normalizePageType(existing?.type, guessTypeFromSlugOrTitle(matchSlug, existing?.title || c.title))),
          tags: uniqueStrings([...(Array.isArray(existingTags) ? existingTags : []), ...(Array.isArray(c.tags) ? c.tags : [])]),
          related: uniqueStrings([...(Array.isArray(existingRelated) ? existingRelated : []), ...(Array.isArray(c.related) ? c.related : [])]),
          sources: mergeSources(existingSources, c.sources),
          confidence: clampNumber(c.confidence, 0, 1, existing?.confidence === undefined || existing?.confidence === null ? 0.5 : Number(existing.confidence)),
          lastCompiledAt: now,
          lastSourceId: source.id,
          lastRunId: run.id,
        });
        updated += 1;
        await this.dal.createSourceRef({
          sourceId: source.id,
          pageId: page.id,
          kind: 'update',
          score: m?.score || null,
          metadata: { candidateSlug: c.slug, matchedSlug: matchSlug, stage: 'merge' },
        });
        outPages.push(page);
      } else {
        const finalSlug = await this.ensureUniqueSlug(source.userId, c.slug, c.title, source.id);
        const summary = c.summary || stripMarkdown(c.markdown).slice(0, 200) || null;
        const embedding = await this.embeddingService.generateEmbedding(`${c.title}\n${summary || ''}`);
        const page = await this.dal.upsertPageBySlug(source.userId, finalSlug, {
          title: c.title,
          summary,
          markdown: c.markdown,
          embedding: embedding ? JSON.stringify(embedding) : null,
          type: normalizePageType(c.type, guessTypeFromSlugOrTitle(finalSlug, c.title)),
          tags: uniqueStrings(c.tags),
          related: uniqueStrings(c.related),
          sources: normalizeSources(c.sources),
          confidence: clampNumber(c.confidence, 0, 1, 0.5),
          lastCompiledAt: now,
          lastSourceId: source.id,
          lastRunId: run.id,
        });
        created += 1;
        await this.dal.createSourceRef({
          sourceId: source.id,
          pageId: page.id,
          kind: 'create',
          score: m?.score || null,
          metadata: { candidateSlug: c.slug, finalSlug, stage: 'merge' },
        });
        outPages.push(page);
      }
    }

    return { pages: outPages, created, updated, ms: Date.now() - t0 };
  }

  async render(source, pages, run) {
    const t0 = Date.now();
    const out = [];
    for (const p of pages) {
      const page = await this.dal.upsertPageBySlug(source.userId, p.slug, {
        title: p.title,
        summary: p.summary || null,
        markdown: p.markdown,
        html: p.html || null,
        embedding: p.embedding || null,
        lastCompiledAt: new Date(),
        lastSourceId: source.id,
        lastRunId: run.id,
      });
      out.push(page);
    }
    return { pages: out, ms: Date.now() - t0 };
  }

  async mergeMarkdown(existingMarkdown, incomingMarkdown, opts = {}) {
    if (!existingMarkdown || opts.force) return String(incomingMarkdown || '');
    const systemPrompt = '你是一个严谨的 wiki 合并器。只输出合并后的 Markdown，不要输出任何额外文本。';
    const prompt = [
      `页面标题：${String(opts.title || '').trim()}`,
      '',
      '已有内容：',
      clampText(existingMarkdown, 12000),
      '',
      '新增内容：',
      clampText(incomingMarkdown, 12000),
      '',
      '合并要求：',
      '1) 去重，保留更完整、更准确的信息',
      '2) 结构清晰，保持 Markdown 标题层级一致',
      '3) 不要添加“合并说明”“总结”等额外段落，除非内容本身需要',
    ].join('\n');

    const text = await this.llmClient.call(prompt, { systemPrompt, temperature: 0.2, maxTokens: 2500 });
    const merged = String(text || '').trim();
    return merged || String(incomingMarkdown || '');
  }

  async ensureUniqueSlug(userId, desiredSlug, title, seed) {
    let slug = String(desiredSlug || '').trim() || slugify(title, seed);
    let n = 0;
    while (true) {
      const existing = await this.dal.getPageBySlug(userId, slug);
      if (!existing) return slug;
      n += 1;
      const suffix = stableHash(`${seed || ''}:${slug}:${n}`).slice(0, 6);
      slug = `${slug.slice(0, 54)}-${suffix}`;
    }
  }
}

module.exports = {
  WikiCompiler,
  slugify,
  stripMarkdown,
  stableHash,
};
