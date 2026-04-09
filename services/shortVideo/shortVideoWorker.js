const shortVideoDAL = require('./shortVideoDAL');
const { fetchMeta } = require('./shortVideoMetaService');
const noteDAL = require('../notes/noteDAL');
const {
  generateQuickNote,
  generateRefinedNote,
  renderMarkdownNote,
  generateEmbeddingForQuick,
} = require('./shortVideoSummarizer');

let timer = null;
let running = false;
let tickLock = false;

async function processOne(source) {
  const sourceId = source.id;
  await shortVideoDAL.updateSource(sourceId, {
    status: 'running',
    progress: { stage: 'extracting_meta' },
    error: null,
  });

  const meta = await fetchMeta(source.normalizedUrl);
  await shortVideoDAL.createArtifact({
    sourceId,
    kind: 'meta',
    payload: JSON.stringify(meta),
    metadata: { status: meta.status, finalUrl: meta.finalUrl },
  });

  await shortVideoDAL.updateSource(sourceId, {
    progress: { stage: 'generating_quick' },
  });

  const quick = await generateQuickNote(
    { title: meta.title, description: meta.description, image: meta.image },
    source.inputText || ''
  );

  await shortVideoDAL.createArtifact({
    sourceId,
    kind: 'quick',
    payload: JSON.stringify(quick),
    metadata: { model: 'qwen-plus' },
  });

  const tags = Array.from(new Set(['短视频', source.platform, ...(quick.topics || [])])).filter(Boolean);
  const noteQuick = await noteDAL.createNote({
    userId: source.userId,
    content: renderMarkdownNote({ title: meta.title }, meta.finalUrl || source.originalUrl, quick, null),
    tags,
    status: 'inbox',
  });

  await shortVideoDAL.updateSource(sourceId, {
    noteQuickId: noteQuick.id,
  });

  await shortVideoDAL.updateSource(sourceId, {
    progress: { stage: 'generating_refined' },
  });

  const refined = await generateRefinedNote(
    { title: meta.title, description: meta.description, image: meta.image },
    source.inputText || '',
    quick
  );

  await shortVideoDAL.createArtifact({
    sourceId,
    kind: 'refined',
    payload: JSON.stringify(refined),
    metadata: { model: 'qwen-plus' },
  });

  const noteRefined = await noteDAL.createNote({
    userId: source.userId,
    content: renderMarkdownNote({ title: meta.title }, meta.finalUrl || source.originalUrl, quick, refined),
    tags,
    status: 'inbox',
  });

  await shortVideoDAL.updateSource(sourceId, {
    noteRefinedId: noteRefined.id,
  });

  await shortVideoDAL.updateSource(sourceId, {
    progress: { stage: 'embedding' },
  });

  const embedding = await generateEmbeddingForQuick(quick);
  if (embedding) {
    await shortVideoDAL.createArtifact({
      sourceId,
      kind: 'embedding',
      payload: JSON.stringify(embedding),
      metadata: { model: 'text-embedding-v3' },
    });
  }

  await shortVideoDAL.updateSource(sourceId, {
    status: 'succeeded',
    progress: { stage: 'done' },
  });
}

async function tick() {
  if (tickLock) return;
  tickLock = true;
  try {
    const list = await shortVideoDAL.findQueuedSources(1);
    if (!list.length) return;
    const source = list[0];
    try {
      await processOne(source);
    } catch (e) {
      await shortVideoDAL.updateSource(source.id, {
        status: 'failed',
        progress: { stage: 'failed' },
        error: String(e?.message || e || '处理失败'),
      });
    }
  } finally {
    tickLock = false;
  }
}

function start() {
  if (running) return;
  if (String(process.env.SHORT_VIDEO_WORKER_DISABLED || '').trim() === '1') return;
  running = true;
  timer = setInterval(() => {
    tick().catch(() => {});
  }, 2500);
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
};

