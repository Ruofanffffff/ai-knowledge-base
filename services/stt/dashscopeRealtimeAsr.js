const WebSocket = require('ws');
const crypto = require('crypto');

const DEFAULT_WS_URL = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference/';
const DEFAULT_MODEL = 'paraformer-realtime-v2';

function nowMs() {
  return Date.now();
}

function genTaskId32() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 32);
}

class DashScopeRealtimeAsrSession {
  constructor({ apiKey, wsUrl, model, sampleRate }) {
    this.apiKey = apiKey;
    this.wsUrl = wsUrl || DEFAULT_WS_URL;
    this.model = model || DEFAULT_MODEL;
    this.sampleRate = Number(sampleRate || 16000);

    this.ws = null;
    this.taskId = genTaskId32();
    this.started = false;
    this.closed = false;

    this.lastText = '';
    this.lastFinalText = '';
    this.lastEventAt = 0;
    this.lastChunkAt = 0;
    this.pendingAudio = [];

    this.waiting = [];
  }

  async connect() {
    if (this.ws) return;
    const ws = new WebSocket(this.wsUrl, {
      headers: {
        Authorization: `bearer ${this.apiKey}`,
      },
    });
    this.ws = ws;

    ws.on('message', (data) => {
      try {
        const text = typeof data === 'string' ? data : data.toString('utf8');
        const msg = JSON.parse(text);
        const event = msg?.header?.event;
        if (event === 'task-started') {
          this.started = true;
          this.lastEventAt = nowMs();
          for (const buf of this.pendingAudio) {
            try {
              ws.send(buf);
            } catch {}
          }
          this.pendingAudio = [];
          this._notifyWaiters();
          return;
        }
        if (event === 'result-generated') {
          this.lastEventAt = nowMs();
          const sentence = msg?.payload?.output?.sentence;
          const t = typeof sentence?.text === 'string' ? sentence.text : '';
          if (t) {
            this.lastText = t;
            if (sentence?.end_time !== null && sentence?.end_time !== undefined) {
              this.lastFinalText = t;
            }
          }
          this._notifyWaiters();
          return;
        }
        if (event === 'task-finished' || event === 'task-failed') {
          this.lastEventAt = nowMs();
          this.close();
        }
      } catch {}
    });

    ws.on('open', () => {
      const runTask = {
        header: {
          action: 'run-task',
          task_id: this.taskId,
          streaming: 'duplex',
        },
        payload: {
          task_group: 'audio',
          task: 'asr',
          function: 'recognition',
          model: this.model,
          parameters: {
            format: 'pcm',
            sample_rate: this.sampleRate,
            punctuation_prediction_enabled: true,
            inverse_text_normalization_enabled: true,
            semantic_punctuation_enabled: false,
            max_sentence_silence: 800,
          },
          input: {},
        },
      };
      try {
        ws.send(JSON.stringify(runTask));
      } catch {}
    });

    ws.on('close', () => {
      this.closed = true;
      this._notifyWaiters();
    });

    ws.on('error', () => {
      this.closed = true;
      this._notifyWaiters();
    });
  }

  _notifyWaiters() {
    const list = this.waiting.splice(0, this.waiting.length);
    for (const fn of list) {
      try {
        fn();
      } catch {}
    }
  }

  async sendPcmChunk(pcm16leBuffer) {
    await this.connect();
    this.lastChunkAt = nowMs();
    if (!this.ws || this.closed) throw new Error('ASR 连接已关闭');
    if (!this.started) {
      this.pendingAudio.push(pcm16leBuffer);
      return;
    }
    this.ws.send(pcm16leBuffer);
  }

  async waitForTextChange(prevText, timeoutMs) {
    const start = nowMs();
    while (!this.closed && nowMs() - start < timeoutMs) {
      if (this.lastText && this.lastText !== prevText) return this.lastText;
      await new Promise((r) => {
        const t = setTimeout(r, 60);
        this.waiting.push(() => {
          clearTimeout(t);
          r();
        });
      });
    }
    return this.lastText || '';
  }

  finish() {
    if (!this.ws || this.closed) return;
    try {
      this.ws.send(
        JSON.stringify({
          header: { action: 'finish-task', task_id: this.taskId, streaming: 'duplex' },
          payload: { input: {} },
        })
      );
    } catch {}
  }

  close() {
    if (!this.ws) return;
    if (this.closed) return;
    this.closed = true;
    try {
      this.ws.close();
    } catch {}
    this._notifyWaiters();
  }
}

const sessions = new Map();
let janitorTimer = null;

function getSession(token) {
  return sessions.get(token) || null;
}

function upsertSession(token, session) {
  sessions.set(token, session);
  if (!janitorTimer) {
    janitorTimer = setInterval(() => {
      const now = nowMs();
      for (const [k, s] of sessions.entries()) {
        if (s.closed) {
          sessions.delete(k);
          continue;
        }
        if (s.lastChunkAt && now - s.lastChunkAt > 1800) {
          s.finish();
          s.close();
          sessions.delete(k);
        }
      }
    }, 800);
    if (janitorTimer.unref) janitorTimer.unref();
  }
}

function deleteSession(token) {
  const s = sessions.get(token);
  if (s) {
    try {
      s.finish();
    } catch {}
    try {
      s.close();
    } catch {}
  }
  sessions.delete(token);
}

function createOrGetSession(token, options) {
  const existing = getSession(token);
  if (existing && !existing.closed) return existing;
  const apiKey = String(options?.apiKey || '').trim();
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY 未配置');
  const session = new DashScopeRealtimeAsrSession({
    apiKey,
    wsUrl: options?.wsUrl,
    model: options?.model,
    sampleRate: options?.sampleRate,
  });
  upsertSession(token, session);
  return session;
}

module.exports = {
  createOrGetSession,
  deleteSession,
};

