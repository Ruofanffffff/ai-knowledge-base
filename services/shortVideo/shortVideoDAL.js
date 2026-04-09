const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function safeParseJson(text, fallback) {
  try {
    if (!text) return fallback;
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function normalizeSource(row) {
  if (!row) return null;
  return {
    ...row,
    progress: safeParseJson(row.progress, null),
  };
}

function normalizeArtifact(row) {
  if (!row) return null;
  return {
    ...row,
    metadata: safeParseJson(row.metadata, {}),
  };
}

function normalizeDigest(row) {
  if (!row) return null;
  return {
    ...row,
    content: safeParseJson(row.content, null),
  };
}

async function createSource(input) {
  const created = await prisma.shortVideoSource.create({
    data: {
      userId: input.userId,
      platform: input.platform,
      originalUrl: input.originalUrl,
      normalizedUrl: input.normalizedUrl,
      inputText: input.inputText || null,
      ingestLevel: input.ingestLevel || 'L0',
      status: input.status || 'queued',
      progress: input.progress ? JSON.stringify(input.progress) : null,
    },
  });
  return normalizeSource(created);
}

async function getSourceById(id) {
  const row = await prisma.shortVideoSource.findUnique({
    where: { id },
  });
  return normalizeSource(row);
}

async function listSourcesByUser(userId, options = {}) {
  const where = { userId };
  if (options.status) where.status = options.status;
  const rows = await prisma.shortVideoSource.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: options.limit || 50,
  });
  return rows.map(normalizeSource);
}

async function countSourcesSince(userId, since) {
  return prisma.shortVideoSource.count({
    where: {
      userId,
      createdAt: { gte: since },
    },
  });
}

async function findLatestByUrl(userId, normalizedUrl) {
  const row = await prisma.shortVideoSource.findFirst({
    where: { userId, normalizedUrl },
    orderBy: { createdAt: 'desc' },
  });
  return normalizeSource(row);
}

async function updateSource(id, patch) {
  const row = await prisma.shortVideoSource.update({
    where: { id },
    data: {
      platform: patch.platform,
      normalizedUrl: patch.normalizedUrl,
      inputText: patch.inputText,
      ingestLevel: patch.ingestLevel,
      status: patch.status,
      progress: patch.progress !== undefined ? (patch.progress ? JSON.stringify(patch.progress) : null) : undefined,
      error: patch.error,
      noteQuickId: patch.noteQuickId,
      noteRefinedId: patch.noteRefinedId,
    },
  });
  return normalizeSource(row);
}

async function findQueuedSources(limit = 3) {
  const rows = await prisma.shortVideoSource.findMany({
    where: { status: 'queued' },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
  return rows.map(normalizeSource);
}

async function cancelSource(id, userId) {
  const row = await prisma.shortVideoSource.updateMany({
    where: { id, userId, status: { in: ['queued', 'running'] } },
    data: { status: 'canceled', progress: JSON.stringify({ stage: 'canceled' }) },
  });
  return row.count > 0;
}

async function retrySource(id, userId) {
  const row = await prisma.shortVideoSource.updateMany({
    where: { id, userId, status: { in: ['failed', 'canceled'] } },
    data: { status: 'queued', error: null, progress: JSON.stringify({ stage: 'queued' }) },
  });
  return row.count > 0;
}

async function deleteSource(id, userId) {
  const existing = await prisma.shortVideoSource.findFirst({ where: { id, userId } });
  if (!existing) return null;
  await prisma.shortVideoSource.delete({ where: { id } });
  return normalizeSource(existing);
}

async function createArtifact(input) {
  const row = await prisma.shortVideoArtifact.create({
    data: {
      sourceId: input.sourceId,
      kind: input.kind,
      payload: input.payload,
      metadata: JSON.stringify(input.metadata || {}),
      version: input.version || 1,
    },
  });
  return normalizeArtifact(row);
}

async function listArtifacts(sourceId) {
  const rows = await prisma.shortVideoArtifact.findMany({
    where: { sourceId },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(normalizeArtifact);
}

async function getDigestSetting(userId) {
  const row = await prisma.shortVideoDigestSetting.findUnique({
    where: { userId },
  });
  return row || null;
}

async function upsertDigestSetting(userId, patch) {
  const row = await prisma.shortVideoDigestSetting.upsert({
    where: { userId },
    update: {
      enabled: patch.enabled,
      hour: patch.hour,
      minute: patch.minute,
      timezone: patch.timezone,
    },
    create: {
      userId,
      enabled: patch.enabled ?? true,
      hour: patch.hour ?? 20,
      minute: patch.minute ?? 0,
      timezone: patch.timezone || 'Asia/Shanghai',
    },
  });
  return row;
}

async function createDailyDigest(input) {
  const row = await prisma.shortVideoDailyDigest.create({
    data: {
      userId: input.userId,
      date: input.date,
      content: JSON.stringify(input.content || {}),
      status: input.status || 'ready',
    },
  });
  return normalizeDigest(row);
}

async function getDailyDigest(userId, date) {
  const row = await prisma.shortVideoDailyDigest.findUnique({
    where: { userId_date: { userId, date } },
  });
  return normalizeDigest(row);
}

async function listRecentSources(userId, since) {
  const rows = await prisma.shortVideoSource.findMany({
    where: {
      userId,
      createdAt: { gte: since },
      status: 'succeeded',
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return rows.map(normalizeSource);
}

async function listEnabledDigestSettings() {
  const rows = await prisma.shortVideoDigestSetting.findMany({
    where: { enabled: true },
  });
  return rows;
}

module.exports = {
  createSource,
  getSourceById,
  listSourcesByUser,
  countSourcesSince,
  findLatestByUrl,
  updateSource,
  findQueuedSources,
  cancelSource,
  retrySource,
  deleteSource,
  createArtifact,
  listArtifacts,
  getDigestSetting,
  upsertDigestSetting,
  createDailyDigest,
  getDailyDigest,
  listRecentSources,
  listEnabledDigestSettings,
};
