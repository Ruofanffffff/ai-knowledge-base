const shortVideoDAL = require('./shortVideoDAL');
const { fetchMeta } = require('./shortVideoMetaService');
const noteDAL = require('../notes/noteDAL');
const transcriptService = require('./shortVideoTranscriptService');
const pageExtractor = require('./shortVideoPageExtractor');
const imageOcr = require('./shortVideoImageOcrService');
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
    progress: { stage: 'extracting_text' },
  });

  const level = String(source.ingestLevel || 'L0').toUpperCase();
  const preferSubtitles = level === 'L2' || level === 'L3';
  const doAsrFallback = level === 'L3';
  const transcriptUrl = meta.finalUrl || source.originalUrl || source.normalizedUrl;
  let transcriptText = '';
  let transcriptMeta = null;
  let pageText = '';
  let pageImages = [];
  let ocrText = '';
  if (level !== 'L0' && transcriptUrl) {
    const r = await transcriptService
      .getTranscriptForUrl(transcriptUrl, { preferSubtitles, allowAsr: doAsrFallback })
      .catch((e) => ({ ok: false, error: String(e?.message || e || 'transcript failed') }));
    if (r?.ok && typeof r.text === 'string' && r.text.trim()) {
      transcriptText = r.text.trim();
      transcriptMeta = {
        origin: r.origin || null,
        lang: r.lang || null,
        title: r.title || null,
        duration: r.duration || null,
      };
      await shortVideoDAL.createArtifact({
        sourceId,
        kind: 'transcript',
        payload: transcriptText,
        metadata: transcriptMeta,
      });
    } else if (!doAsrFallback) {
      transcriptMeta = { ok: false, error: r?.error || 'no subtitles' };
      await shortVideoDAL.createArtifact({
        sourceId,
        kind: 'transcript',
        payload: '',
        metadata: transcriptMeta,
      });
    }
  }

  if (level !== 'L0' && transcriptUrl) {
    const platform = String(source.platform || '').toLowerCase();
    const page = await pageExtractor
      .extractPage(transcriptUrl, platform)
      .catch((e) => ({ ok: false, error: String(e?.message || e || 'page extract failed') }));
    if (page?.ok) {
      pageText = typeof page.text === 'string' ? page.text.trim() : '';
      pageImages = Array.isArray(page.imageUrls) ? page.imageUrls : [];
      if (pageText || pageImages.length) {
        await shortVideoDAL
          .createArtifact({
            sourceId,
            kind: 'page',
            payload: JSON.stringify({ title: page.title || '', text: pageText, imageUrls: pageImages.slice(0, 12) }),
            metadata: { platform, finalUrl: page.finalUrl || transcriptUrl, status: page.status || null },
          })
          .catch(() => {});
      }
    }
  }

  if ((level === 'L2' || level === 'L3') && pageImages.length) {
    const platform = String(source.platform || '').toLowerCase();
    const maxImages = platform === 'xhs' ? Math.min(24, pageImages.length) : 4;
    const o = await imageOcr.ocrImages(pageImages, { maxImages }).catch((e) => ({
      ok: false,
      text: '',
      items: [],
      error: String(e?.message || e || 'ocr failed'),
    }));
    if (o?.ok && typeof o.text === 'string' && o.text.trim()) {
      ocrText = o.text.trim();
    }
    await shortVideoDAL
      .createArtifact({
        sourceId,
        kind: 'ocr',
        payload: JSON.stringify({ ok: Boolean(o?.ok), text: ocrText, items: o?.items || [], error: o?.error || null }),
        metadata: { maxImages },
      })
      .catch(() => {});
  }

  await shortVideoDAL.updateSource(sourceId, {
    progress: { stage: 'generating_quick' },
  });

  const quick = await generateQuickNote(
    { title: meta.title, description: meta.description, image: meta.image, transcriptText, pageText, ocrText },
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
    content: renderMarkdownNote({ title: meta.title }, meta.finalUrl || source.originalUrl, quick, null, source.inputText || ''),
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
    { title: meta.title, description: meta.description, image: meta.image, transcriptText, pageText, ocrText },
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
    content: renderMarkdownNote({ title: meta.title }, meta.finalUrl || source.originalUrl, quick, refined, source.inputText || ''),
    tags,
    status: 'inbox',
  });

  await shortVideoDAL.updateSource(sourceId, {
    noteRefinedId: noteRefined.id,
  });

  if (noteQuick?.id) {
    await noteDAL.updateNote(noteQuick.id, { status: 'archived' }, source.userId).catch(() => {});
  }

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
