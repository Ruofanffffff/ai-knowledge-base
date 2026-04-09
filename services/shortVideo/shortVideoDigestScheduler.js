const llmClient = require('../llmClient');
const embeddingService = require('../embeddingService');
const shortVideoDAL = require('./shortVideoDAL');

let timer = null;
let running = false;
let tickLock = false;

function getDateParts(now, timeZone) {
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const yyyy = get('year');
  const mm = get('month');
  const dd = get('day');
  const hh = get('hour');
  const mi = get('minute');
  return {
    date: `${yyyy}-${mm}-${dd}`,
    hour: Number(hh),
    minute: Number(mi),
  };
}

function startOfDayInTz(now, timeZone) {
  const { date } = getDateParts(now, timeZone);
  const [y, m, d] = date.split('-').map((x) => Number(x));
  const utcMidnight = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const guess = new Date(utcMidnight.getTime());
  const localParts = getDateParts(guess, timeZone);
  const localDate = localParts.date;
  if (localDate === date) return guess;
  const deltaDays = localDate < date ? 1 : -1;
  return new Date(utcMidnight.getTime() + deltaDays * 24 * 3600 * 1000);
}

function cosine(a, b) {
  return embeddingService.cosineSimilarity(a, b);
}

function clusterBySimilarity(items, threshold) {
  const parent = new Map(items.map((it) => [it.id, it.id]));
  const find = (x) => {
    let p = parent.get(x);
    if (!p) return x;
    while (p !== parent.get(p)) p = parent.get(p);
    let cur = x;
    while (cur !== p) {
      const next = parent.get(cur);
      parent.set(cur, p);
      cur = next;
    }
    return p;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const ai = items[i];
      const bj = items[j];
      if (!ai.embedding || !bj.embedding) continue;
      const s = cosine(ai.embedding, bj.embedding);
      if (s >= threshold) union(ai.id, bj.id);
    }
  }

  const groups = new Map();
  for (const it of items) {
    const root = find(it.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(it);
  }
  return Array.from(groups.values()).sort((a, b) => b.length - a.length);
}

async function nameTopic(cluster) {
  const lines = cluster
    .slice(0, 6)
    .map((x) => `- ${x.title || '短视频'}: ${String(x.summary || '').slice(0, 80)}`)
    .join('\n');

  const prompt = [
    '你是拾思的“主题串联”助手。请为一组同主题短视频笔记生成主题卡片信息。',
    '要求：只输出 JSON，不要输出多余文字。',
    '输出：{"label":string,"oneLiner":string,"nextAction":string}',
    '输入：',
    lines || '（无）',
  ].join('\n');

  const out = await llmClient.callJSON(prompt, { temperature: 0.2, maxTokens: 500 });
  return {
    label: String(out?.label || '今日主题').trim() || '今日主题',
    oneLiner: String(out?.oneLiner || '').trim(),
    nextAction: String(out?.nextAction || '').trim(),
  };
}

async function buildDailyDigestForUser(userId, timeZone) {
  const now = new Date();
  const { date } = getDateParts(now, timeZone);
  const exists = await shortVideoDAL.getDailyDigest(userId, date);
  if (exists) return null;

  const since = startOfDayInTz(now, timeZone);
  const sources = await shortVideoDAL.listRecentSources(userId, since);
  if (!sources.length) return null;

  const items = [];
  for (const s of sources.slice(0, 60)) {
    const artifacts = await shortVideoDAL.listArtifacts(s.id);
    const quick = artifacts.find((a) => a.kind === 'quick');
    const embedding = artifacts.find((a) => a.kind === 'embedding');
    const quickObj = quick ? JSON.parse(quick.payload) : null;
    const emb = embedding ? JSON.parse(embedding.payload) : null;
    items.push({
      id: s.id,
      sourceId: s.id,
      noteId: s.noteRefinedId || s.noteQuickId || null,
      title: String(quickObj?.title || '').trim(),
      summary: String(quickObj?.summary || '').trim(),
      embedding: Array.isArray(emb) ? emb : null,
    });
  }

  const clusters = clusterBySimilarity(items, 0.78).slice(0, 3);
  const topics = [];
  for (const c of clusters) {
    const header = await nameTopic(c);
    topics.push({
      ...header,
      items: c
        .slice(0, 5)
        .map((x) => ({ sourceId: x.sourceId, noteId: x.noteId, title: x.title || '短视频笔记', summary: x.summary })),
    });
  }

  const digest = await shortVideoDAL.createDailyDigest({
    userId,
    date,
    content: { date, topics },
    status: 'ready',
  });
  return digest;
}

async function tick() {
  if (tickLock) return;
  tickLock = true;
  try {
    const now = new Date();
    const settings = await shortVideoDAL.listEnabledDigestSettings();
    for (const s of settings) {
      const tz = String(s.timezone || 'Asia/Shanghai');
      const parts = getDateParts(now, tz);
      if (parts.hour !== s.hour || parts.minute !== s.minute) continue;
      await buildDailyDigestForUser(s.userId, tz).catch(() => {});
    }
  } finally {
    tickLock = false;
  }
}

function start() {
  if (running) return;
  if (String(process.env.SHORT_VIDEO_DIGEST_DISABLED || '').trim() === '1') return;
  running = true;
  timer = setInterval(() => {
    tick().catch(() => {});
  }, 45000);
  if (timer.unref) timer.unref();
}

function stop() {
  running = false;
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = {
  start,
  stop,
  buildDailyDigestForUser,
};

