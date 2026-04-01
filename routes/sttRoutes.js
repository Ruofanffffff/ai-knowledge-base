const express = require('express');
const jwt = require('jsonwebtoken');
const OpenAI = require('openai');
const { toFile } = require('openai');
const { authMiddleware: userAuthMiddleware } = require('../services/authService');
const { authMiddleware: sttAuthMiddleware } = require('../middleware/sttAuthMiddleware');

const router = express.Router();

const STT_JWT_SECRET = process.env.STT_JWT_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const STT_JWT_EXPIRES_IN = process.env.STT_JWT_EXPIRES_IN || '5m';

function stripDataUrlPrefix(base64) {
  const text = String(base64 || '');
  const comma = text.indexOf(',');
  if (text.startsWith('data:') && comma !== -1) return text.slice(comma + 1);
  return text;
}

function pcm16leToWavBuffer(pcm16leBuffer, sampleRate, channels) {
  const numChannels = Number(channels || 1);
  const sr = Number(sampleRate || 16000);
  const bitsPerSample = 16;
  const byteRate = sr * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcm16leBuffer.length;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sr, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm16leBuffer]);
}

router.post('/token', userAuthMiddleware, async (req, res) => {
  try {
    const token = jwt.sign(
      { typ: 'stt', userId: req.userId },
      STT_JWT_SECRET,
      { expiresIn: STT_JWT_EXPIRES_IN }
    );
    res.json({ success: true, data: { token, expiresIn: STT_JWT_EXPIRES_IN } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

router.post('/chunk', sttAuthMiddleware, async (req, res) => {
  try {
    const pcm16leBase64 = req.body?.pcm16leBase64 || req.body?.audioBase64 || req.body?.base64;
    if (!pcm16leBase64) {
      return res.status(400).json({ success: false, error: 'Missing required parameter: pcm16leBase64' });
    }

    const sampleRate = Number(req.body?.sampleRate || 16000);
    const channels = Number(req.body?.channels || 1);
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid parameter: sampleRate' });
    }
    if (!Number.isFinite(channels) || channels <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid parameter: channels' });
    }

    const pcmBuffer = Buffer.from(stripDataUrlPrefix(pcm16leBase64), 'base64');
    if (!pcmBuffer.length) {
      return res.status(400).json({ success: false, error: 'Invalid audio data' });
    }
    if (pcmBuffer.length % 2 !== 0) {
      return res.status(400).json({ success: false, error: 'Invalid pcm16le length' });
    }

    const wavBuffer = pcm16leToWavBuffer(pcmBuffer, sampleRate, channels);

    const apiKey = process.env.OPENAI_API_KEY || process.env.QWEN_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'OPENAI_API_KEY 或 QWEN_API_KEY 未配置' });
    }

    const client = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL || (process.env.OPENAI_API_KEY ? undefined : 'https://dashscope.aliyuncs.com/compatible-mode/v1'),
    });

    const model = req.body?.model || process.env.OPENAI_STT_MODEL || 'whisper-1';
    const language = req.body?.language;
    const prompt = req.body?.prompt;

    const file = await toFile(wavBuffer, 'audio.wav', { type: 'audio/wav' });
    const transcription = await client.audio.transcriptions.create({
      file,
      model,
      language,
      prompt,
    });

    res.json({
      success: true,
      data: {
        text: transcription?.text || '',
        model,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

module.exports = router;
