const llmClient = require('../llmClient');
const embeddingService = require('../embeddingService');
const wikiDAL = require('./wikiDAL');
const { WikiCompiler, stableHash } = require('./wikiCompiler');

const compiler = new WikiCompiler({
  llmClient,
  embeddingService,
  dal: wikiDAL,
});

async function compileSource(input) {
  const userId = String(input.userId);
  const sourceType = String(input.sourceType || '');
  if (!sourceType) throw new Error('sourceType is required');

  const rawContent = input.rawContent ? String(input.rawContent) : null;
  const contentHash = rawContent ? stableHash(rawContent) : null;

  const source = await wikiDAL.createSource({
    userId,
    sourceType,
    sourceId: input.sourceId || null,
    sourceUrl: input.sourceUrl || null,
    title: input.title || null,
    rawContent,
    contentHash,
    status: 'queued',
    progress: { stage: 'queued' },
    nextRunAt: new Date(),
  });

  const result = await compiler.compileSourceById(source.id, {
    title: input.title || null,
    rawContent: input.rawContent || null,
    force: !!input.force,
  });

  return { sourceId: source.id, ...result };
}

async function compileSourceById(sourceId, options = {}) {
  return compiler.compileSourceById(sourceId, options);
}

async function listPages(userId, options = {}) {
  return wikiDAL.listPages(userId, options);
}

function safeJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function extractWikiLinksFromMarkdown(markdown) {
  const md = String(markdown || '');
  const slugs = [];

  const wikiBracket = /\[\[([^\]]+)\]\]/g;
  for (const m of md.matchAll(wikiBracket)) {
    const s = String(m[1] || '').trim();
    if (s) slugs.push(s);
  }

  const wikiScheme = /\]\(wiki:([^)]+)\)/g;
  for (const m of md.matchAll(wikiScheme)) {
    const s = String(m[1] || '').trim();
    if (s) slugs.push(s);
  }

  const wikiPath = /\]\((?:\/wiki\/|#\/wiki\/)([^)#?]+)[^)]*\)/g;
  for (const m of md.matchAll(wikiPath)) {
    const raw = String(m[1] || '').trim();
    if (!raw) continue;
    try {
      slugs.push(decodeURIComponent(raw));
    } catch {
      slugs.push(raw);
    }
  }

  const out = [];
  const seen = new Set();
  for (const s of slugs) {
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

async function healthcheck(userId) {
  const uid = String(userId);
  const prisma = wikiDAL._prisma;
  const pages = await prisma.wikiPage.findMany({
    where: { userId: uid },
    select: { id: true, slug: true, title: true, markdown: true, related: true, type: true },
  });

  const slugSet = new Set(pages.map(p => String(p.slug)));
  const outboundBySlug = new Map();
  const inboundCount = new Map();
  const brokenLinks = [];

  for (const p of pages) {
    const related = safeJson(p.related, []);
    const fromRelated = Array.isArray(related) ? related.map(x => String(x || '').trim()).filter(Boolean) : [];
    const fromMd = extractWikiLinksFromMarkdown(p.markdown);
    const out = [];
    const seen = new Set();
    for (const s of [...fromRelated, ...fromMd]) {
      const k = s.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(s);
    }
    outboundBySlug.set(String(p.slug), out);

    for (const target of out) {
      if (!slugSet.has(target)) {
        brokenLinks.push({ from: String(p.slug), to: target });
        continue;
      }
      inboundCount.set(target, (inboundCount.get(target) || 0) + 1);
    }
  }

  const pageIds = pages.map(p => p.id);
  const refs = await prisma.wikiSourceRef.findMany({
    where: { pageId: { in: pageIds } },
    select: { pageId: true },
  });
  const pagesWithRefs = new Set(refs.map(r => String(r.pageId)));

  const noSourceOrphans = [];
  const isolatedOrphans = [];
  for (const p of pages) {
    const slug = String(p.slug);
    const outbound = outboundBySlug.get(slug) || [];
    const inbound = inboundCount.get(slug) || 0;
    const hasRefs = pagesWithRefs.has(String(p.id));
    if (!hasRefs) {
      noSourceOrphans.push({ slug, title: String(p.title || ''), type: String(p.type || '') });
      continue;
    }
    if (!inbound && !outbound.length) {
      isolatedOrphans.push({ slug, title: String(p.title || ''), type: String(p.type || '') });
    }
  }

  const dupGroups = await prisma.wikiPage.groupBy({
    by: ['slug'],
    _count: { slug: true },
    having: { slug: { _count: { gt: 1 } } },
  });
  const dupSlugs = dupGroups.map(g => String(g.slug));
  const dupRows = dupSlugs.length
    ? await prisma.wikiPage.findMany({
      where: { slug: { in: dupSlugs } },
      select: { slug: true, userId: true, id: true },
    })
    : [];
  const bySlug = new Map();
  for (const r of dupRows) {
    const s = String(r.slug);
    const list = bySlug.get(s) || [];
    list.push({ userId: String(r.userId), pageId: String(r.id) });
    bySlug.set(s, list);
  }
  const duplicateSlugs = [];
  for (const [slug, items] of bySlug.entries()) {
    if (items.some(i => i.userId === uid)) {
      duplicateSlugs.push({ slug, count: items.length, users: items.map(i => i.userId) });
    }
  }

  const ok = brokenLinks.length === 0 && noSourceOrphans.length === 0 && isolatedOrphans.length === 0 && duplicateSlugs.length === 0;
  return {
    ok,
    time: new Date().toISOString(),
    brokenLinks,
    orphanPages: { noSources: noSourceOrphans, isolated: isolatedOrphans },
    duplicateSlugs,
    stats: {
      pages: pages.length,
      brokenLinks: brokenLinks.length,
      orphanNoSources: noSourceOrphans.length,
      orphanIsolated: isolatedOrphans.length,
      duplicateSlugs: duplicateSlugs.length,
    },
  };
}

async function health() {
  const res = {
    ok: true,
    db: { ok: true },
    llm: { ok: true, provider: 'dashscope', model: 'qwen-plus', configured: !!process.env.QWEN_API_KEY },
    embedding: { ok: true, model: 'text-embedding-v3', configured: !!process.env.QWEN_API_KEY },
    time: new Date().toISOString(),
  };

  try {
    await wikiDAL._prisma.wikiPage.count();
  } catch (e) {
    res.ok = false;
    res.db.ok = false;
    res.db.error = String(e?.message || e || 'db_error');
  }

  if (!process.env.QWEN_API_KEY) {
    res.ok = false;
    res.llm.ok = false;
    res.embedding.ok = false;
  }

  return res;
}

async function getPage(userId, slug) {
  return wikiDAL.getPageBySlug(userId, slug);
}

module.exports = {
  compileSource,
  compileSourceById,
  listPages,
  healthcheck,
  health,
  _compiler: compiler,
  getPage,
};
