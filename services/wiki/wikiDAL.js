const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function safeJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}

function toJsonString(value, fallbackJsonString) {
  if (value === null || value === undefined) return fallbackJsonString;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return fallbackJsonString;
  }
}

function normalizeSourcesArray(value) {
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
      const sourceUrl = item.sourceUrl ? String(item.sourceUrl) : item.url ? String(item.url) : null;
      const title = item.title ? String(item.title) : null;
      const sourceType = item.sourceType ? String(item.sourceType) : item.type ? String(item.type) : null;
      const sourceId = item.sourceId ? String(item.sourceId) : null;
      if (!id) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ id, sourceType, sourceId, sourceUrl, title });
    }
  }
  return out;
}

async function createSource(input) {
  const now = new Date();
  const data = {
    userId: String(input.userId),
    sourceType: String(input.sourceType),
    sourceId: input.sourceId ? String(input.sourceId) : null,
    sourceUrl: input.sourceUrl ? String(input.sourceUrl) : null,
    title: input.title ? String(input.title) : null,
    rawContent: input.rawContent ? String(input.rawContent) : null,
    contentHash: input.contentHash ? String(input.contentHash) : null,
    status: input.status ? String(input.status) : 'queued',
    progress: input.progress ? JSON.stringify(input.progress) : null,
    error: input.error ? String(input.error) : null,
    nextRunAt: input.nextRunAt || now,
    lockedAt: null,
    lockOwner: null,
    attemptCount: 0,
    lastAttemptAt: null,
    lastRunId: null,
    lastTraceId: null,
    lastDurationMs: null,
    lastExtractedAt: null,
  };

  return prisma.wikiSource.create({ data });
}

async function getSourceById(id) {
  return prisma.wikiSource.findUnique({ where: { id: String(id) } });
}

async function updateSource(id, patch) {
  const data = { ...patch };
  if (data.progress && typeof data.progress !== 'string') {
    data.progress = JSON.stringify(data.progress);
  }
  return prisma.wikiSource.update({
    where: { id: String(id) },
    data,
  });
}

async function tryLockSource(id, lockOwner, status = 'running') {
  const res = await prisma.wikiSource.updateMany({
    where: {
      id: String(id),
      lockedAt: null,
      status: { not: 'running' },
    },
    data: {
      lockedAt: new Date(),
      lockOwner: String(lockOwner),
      status: String(status),
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
      error: null,
      progress: JSON.stringify({ stage: 'claimed' }),
    },
  });
  return res.count === 1;
}

async function unlockSource(id, patch = {}) {
  const data = { ...patch, lockedAt: null, lockOwner: null };
  if (data.progress && typeof data.progress !== 'string') {
    data.progress = JSON.stringify(data.progress);
  }
  return prisma.wikiSource.update({
    where: { id: String(id) },
    data,
  });
}

async function findRunnableSources(limit = 1) {
  const now = new Date();
  return prisma.wikiSource.findMany({
    where: {
      status: 'queued',
      lockedAt: null,
      OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
    },
    orderBy: [{ nextRunAt: 'asc' }, { createdAt: 'asc' }],
    take: Math.max(1, Math.min(50, Number(limit) || 1)),
  });
}

async function createCompileRun(input) {
  return prisma.wikiCompileRun.create({
    data: {
      sourceId: String(input.sourceId),
      status: input.status ? String(input.status) : 'running',
      stage: input.stage ? String(input.stage) : null,
      traceId: input.traceId ? String(input.traceId) : null,
      metrics: input.metrics ? JSON.stringify(input.metrics) : null,
      error: input.error ? String(input.error) : null,
    },
  });
}

async function updateCompileRun(id, patch) {
  const data = { ...patch };
  if (data.metrics && typeof data.metrics !== 'string') {
    data.metrics = JSON.stringify(data.metrics);
  }
  return prisma.wikiCompileRun.update({
    where: { id: String(id) },
    data,
  });
}

async function listPages(userId, options = {}) {
  const { limit = 50, offset = 0, q, type } = options;
  const where = { userId: String(userId) };
  if (typeof type === 'string' && type.trim() && type.trim() !== 'all') {
    where.type = type.trim();
  }
  if (typeof q === 'string' && q.trim()) {
    const query = q.trim();
    where.OR = [
      { title: { contains: query } },
      { slug: { contains: query } },
      { summary: { contains: query } },
      { markdown: { contains: query } },
    ];
  }

  const pages = await prisma.wikiPage.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }],
    skip: Math.max(0, Number(offset) || 0),
    take: Math.max(1, Math.min(200, Number(limit) || 50)),
    select: {
      id: true,
      userId: true,
      slug: true,
      title: true,
      summary: true,
      type: true,
      tags: true,
      sources: true,
      related: true,
      confidence: true,
      markdown: true,
      html: true,
      embedding: true,
      version: true,
      status: true,
      lastCompiledAt: true,
      lastSourceId: true,
      lastRunId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const mapped = pages.map(p => ({
    ...p,
    embedding: p.embedding ? safeJson(p.embedding, null) : null,
    tags: safeJson(p.tags, []),
    sources: normalizeSourcesArray(safeJson(p.sources, [])),
    related: safeJson(p.related, []),
  }));

  const pageIds = mapped.map(p => p.id);
  if (!pageIds.length) return mapped;

  const refs = await prisma.wikiSourceRef.findMany({
    where: { pageId: { in: pageIds } },
    select: {
      pageId: true,
      source: {
        select: {
          id: true,
          sourceType: true,
          sourceId: true,
          sourceUrl: true,
          title: true,
        },
      },
    },
  });

  const byPageId = new Map();
  for (const r of refs) {
    const pageId = String(r.pageId);
    const list = byPageId.get(pageId) || [];
    const s = r.source;
    if (s?.id) {
      list.push({ id: s.id, sourceType: s.sourceType, sourceId: s.sourceId || null, sourceUrl: s.sourceUrl || null, title: s.title || null });
    }
    byPageId.set(pageId, list);
  }

  for (const p of mapped) {
    const fromRefs = normalizeSourcesArray(byPageId.get(p.id) || []);
    if (!Array.isArray(p.sources) || !p.sources.length) {
      p.sources = fromRefs;
    } else if (fromRefs.length) {
      p.sources = normalizeSourcesArray([...p.sources, ...fromRefs]);
    }
  }

  return mapped;
}

async function getPageBySlug(userId, slug) {
  return prisma.wikiPage.findUnique({
    where: {
      userId_slug: {
        userId: String(userId),
        slug: String(slug),
      },
    },
  });
}

async function upsertPageBySlug(userId, slug, patch) {
  const existing = await getPageBySlug(userId, slug);
  if (existing) {
    return prisma.wikiPage.update({
      where: { id: existing.id },
      data: {
        ...patch,
        tags: toJsonString(patch.tags, existing.tags || '[]'),
        sources: toJsonString(patch.sources, existing.sources || '[]'),
        related: toJsonString(patch.related, existing.related || '[]'),
        confidence: patch.confidence === undefined || patch.confidence === null ? existing.confidence : Number(patch.confidence),
        version: { increment: 1 },
      },
    });
  }
  return prisma.wikiPage.create({
    data: {
      userId: String(userId),
      slug: String(slug),
      title: String(patch.title || slug),
      summary: patch.summary || null,
      type: String(patch.type || 'concept'),
      tags: toJsonString(patch.tags, '[]'),
      sources: toJsonString(patch.sources, '[]'),
      related: toJsonString(patch.related, '[]'),
      confidence: patch.confidence === undefined || patch.confidence === null ? 0.5 : Number(patch.confidence),
      markdown: String(patch.markdown || ''),
      html: patch.html || null,
      embedding: patch.embedding || null,
      version: 1,
      status: patch.status || 'active',
      lastCompiledAt: patch.lastCompiledAt || null,
      lastSourceId: patch.lastSourceId || null,
      lastRunId: patch.lastRunId || null,
    },
  });
}

async function createSourceRef(input) {
  return prisma.wikiSourceRef.create({
    data: {
      sourceId: String(input.sourceId),
      pageId: String(input.pageId),
      kind: String(input.kind),
      score: input.score === undefined || input.score === null ? null : Number(input.score),
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

module.exports = {
  createSource,
  getSourceById,
  updateSource,
  tryLockSource,
  unlockSource,
  findRunnableSources,
  createCompileRun,
  updateCompileRun,
  listPages,
  getPageBySlug,
  upsertPageBySlug,
  createSourceRef,
  _prisma: prisma,
};
