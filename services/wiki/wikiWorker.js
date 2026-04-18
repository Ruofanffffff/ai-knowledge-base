const wikiDAL = require('./wikiDAL');
const wikiService = require('./wikiService');

let timer = null;
let running = false;
let tickLock = false;

function isWikiEnabled() {
  const v = String(process.env.WIKI_ENABLED ?? '1').trim().toLowerCase();
  return v !== '0' && v !== 'false' && v !== 'off' && v !== 'no';
}

async function tick() {
  if (tickLock) return;
  tickLock = true;
  try {
    const list = await wikiDAL.findRunnableSources(1);
    if (!list.length) return;
    const source = list[0];
    await wikiService.compileSourceById(source.id).catch(() => {});
  } finally {
    tickLock = false;
  }
}

function start() {
  if (running) return;
  if (!isWikiEnabled()) return;
  if (String(process.env.WIKI_WORKER_DISABLED || '').trim() === '1') return;
  running = true;
  timer = setInterval(() => {
    tick().catch(() => {});
  }, 3000);
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
