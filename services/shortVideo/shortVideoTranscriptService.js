const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const axios = require('axios');
const ffmpegPath = require('ffmpeg-static');
const { YtDlpWrap } = require('yt-dlp-wrap');
const dashscopeRealtimeAsr = require('../stt/dashscopeRealtimeAsr');
const OpenAI = require('openai');
const { parseSrtToText, parseVttToText } = require('./shortVideoSubtitleParser');

function nowId() {
  return `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function pickSubtitleCandidate(info) {
  const pickFrom = (obj) => {
    if (!obj || typeof obj !== 'object') return [];
    const langs = Object.keys(obj);
    const preferred = [
      'zh-Hans',
      'zh_CN',
      'zh-CN',
      'zh',
      'zh-Hant',
      'zh_TW',
      'zh-TW',
      'en',
    ];
    const ordered = [...preferred.filter((x) => langs.includes(x)), ...langs.filter((x) => !preferred.includes(x))];
    const out = [];
    for (const lang of ordered) {
      const arr = Array.isArray(obj[lang]) ? obj[lang] : [];
      for (const item of arr) {
        if (!item || typeof item !== 'object') continue;
        const url = typeof item.url === 'string' ? item.url : '';
        const ext = typeof item.ext === 'string' ? item.ext : '';
        if (!url) continue;
        out.push({ lang, url, ext });
      }
    }
    return out;
  };

  const manual = pickFrom(info?.subtitles);
  const auto = pickFrom(info?.automatic_captions);
  const orderExt = (candidates) => {
    const scoreExt = (ext) => {
      const e = String(ext || '').toLowerCase();
      if (e === 'vtt') return 3;
      if (e === 'srt') return 2;
      if (e === 'ttml') return 1;
      return 0;
    };
    return candidates.sort((a, b) => scoreExt(b.ext) - scoreExt(a.ext));
  };

  const bestManual = orderExt(manual)[0];
  if (bestManual) return { ...bestManual, source: 'subtitles' };
  const bestAuto = orderExt(auto)[0];
  if (bestAuto) return { ...bestAuto, source: 'auto_captions' };
  return null;
}

async function downloadText(url) {
  const res = await axios.get(url, { responseType: 'text', timeout: 20000 });
  return String(res?.data || '');
}

function parseCaptionByExt(ext, raw) {
  const e = String(ext || '').toLowerCase();
  if (e === 'vtt') return parseVttToText(raw);
  if (e === 'srt') return parseSrtToText(raw);
  return parseVttToText(raw);
}

function spawnCapture(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d.toString('utf8')));
    child.stderr.on('data', (d) => (err += d.toString('utf8')));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve({ out, err });
      reject(new Error(`command failed: ${cmd} ${args.join(' ')}\n${err || out}`));
    });
  });
}

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

async function listFiles(dir) {
  const names = await fsp.readdir(dir).catch(() => []);
  return names.map((n) => path.join(dir, n));
}

async function fileExists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function getYtDlpBinaryPath() {
  const wrap = new YtDlpWrap();
  const bin = await wrap.getYtDlpPath().catch(() => null);
  if (bin && typeof bin === 'string' && bin.trim()) return bin;
  const p = await wrap.downloadFromGithub().catch(() => null);
  if (p && typeof p === 'string' && p.trim()) return p;
  const last = await wrap.getYtDlpPath().catch(() => null);
  if (last && typeof last === 'string' && last.trim()) return last;
  throw new Error('yt-dlp 不可用');
}

async function fetchYtDlpInfo(url) {
  const bin = await getYtDlpBinaryPath();
  const { out } = await spawnCapture(bin, ['-J', '--no-warnings', '--no-playlist', '--skip-download', url], { timeout: 120000 });
  const json = safeJsonParse(out);
  if (!json) throw new Error('yt-dlp 输出解析失败');
  return json;
}

async function downloadBestAudio(url, targetDir) {
  const bin = await getYtDlpBinaryPath();
  await ensureDir(targetDir);
  const outTpl = path.join(targetDir, '%(id)s.%(ext)s');
  await spawnCapture(bin, ['--no-warnings', '--no-playlist', '-f', 'bestaudio/best', '-o', outTpl, url], { timeout: 300000 });
  const files = await listFiles(targetDir);
  const media = files.filter((p) => !p.endsWith('.part') && !p.endsWith('.ytdl'));
  if (!media.length) throw new Error('未找到下载产物');
  media.sort((a, b) => a.length - b.length);
  return media[0];
}

async function toPcm16kMono(inputPath, outputPcmPath) {
  if (!ffmpegPath) throw new Error('ffmpeg 不可用');
  await spawnCapture(
    ffmpegPath,
    [
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-f',
      's16le',
      '-acodec',
      'pcm_s16le',
      '-af',
      'highpass=f=80,lowpass=f=8000',
      outputPcmPath,
    ],
    { timeout: 300000 }
  );
  return outputPcmPath;
}

async function pcmToWavFile(pcmPath, wavPath) {
  const pcm = await fsp.readFile(pcmPath);
  const sampleRate = 16000;
  const channels = 1;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.length;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcm.copy(buffer, 44);
  await fsp.writeFile(wavPath, buffer);
  return wavPath;
}

async function transcribeWithOpenAIWhisper(wavPath) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const client = new OpenAI({ apiKey });
  const file = fs.createReadStream(wavPath);
  const out = await client.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    response_format: 'text',
    temperature: 0,
  });
  return String(out || '').trim();
}

async function transcribeWithDashscope(pcmPath) {
  const apiKey = process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY;
  if (!apiKey) return null;
  const token = `sv-${nowId()}`;
  const session = await dashscopeRealtimeAsr.createOrGetSession(token, { apiKey, sampleRate: 16000 });
  const pcm = await fsp.readFile(pcmPath);
  const chunkSize = 32000;
  let lastText = '';
  for (let offset = 0; offset < pcm.length; offset += chunkSize) {
    const chunk = pcm.subarray(offset, offset + chunkSize);
    await session.sendPcmChunk(chunk);
    const next = await session.waitForTextChange(lastText, 1200).catch(() => '');
    if (next && typeof next === 'string') lastText = next;
  }
  const final = await session.waitForTextChange(lastText, 3000).catch(() => '');
  if (final && typeof final === 'string') lastText = final;
  return String(lastText || '').trim();
}

async function cleanupDir(dir) {
  if (!dir) return;
  const exists = await fileExists(dir);
  if (!exists) return;
  await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
}

async function getTranscriptForUrl(url, { preferSubtitles = true, allowAsr = true } = {}) {
  const workDir = path.join(os.tmpdir(), `shisi-sv-${nowId()}`);
  await ensureDir(workDir);
  try {
    const info = await fetchYtDlpInfo(url);
    const cand = preferSubtitles ? pickSubtitleCandidate(info) : null;
    if (cand) {
      const raw = await downloadText(cand.url);
      const text = parseCaptionByExt(cand.ext, raw);
      if (text && text.length >= 40) {
        return {
          ok: true,
          origin: cand.source,
          lang: cand.lang,
          title: info?.title || null,
          duration: typeof info?.duration === 'number' ? info.duration : null,
          text,
        };
      }
    }

    if (!allowAsr) {
      return {
        ok: false,
        origin: null,
        lang: null,
        title: info?.title || null,
        duration: typeof info?.duration === 'number' ? info.duration : null,
        text: '',
        error: '无字幕且已禁用 ASR',
      };
    }

    const mediaDir = path.join(workDir, 'media');
    const mediaPath = await downloadBestAudio(url, mediaDir);
    const pcmPath = path.join(workDir, 'audio.pcm');
    await toPcm16kMono(mediaPath, pcmPath);
    const wavPath = path.join(workDir, 'audio.wav');
    await pcmToWavFile(pcmPath, wavPath);

    const byWhisper = await transcribeWithOpenAIWhisper(wavPath);
    if (byWhisper) {
      return {
        ok: true,
        origin: 'asr_whisper',
        lang: null,
        title: info?.title || null,
        duration: typeof info?.duration === 'number' ? info.duration : null,
        text: byWhisper,
      };
    }

    const byDashscope = await transcribeWithDashscope(pcmPath);
    if (byDashscope) {
      return {
        ok: true,
        origin: 'asr_dashscope',
        lang: null,
        title: info?.title || null,
        duration: typeof info?.duration === 'number' ? info.duration : null,
        text: byDashscope,
      };
    }

    return {
      ok: false,
      origin: null,
      lang: null,
      title: info?.title || null,
      duration: typeof info?.duration === 'number' ? info.duration : null,
      text: '',
      error: '无可用 ASR 配置（OPENAI_API_KEY 或 DASHSCOPE_API_KEY/QWEN_API_KEY）',
    };
  } finally {
    await cleanupDir(workDir);
  }
}

module.exports = {
  getTranscriptForUrl,
  _pickSubtitleCandidate: pickSubtitleCandidate,
};
