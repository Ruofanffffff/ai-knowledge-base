const llmClient = require('../llmClient');
const embeddingService = require('../embeddingService');

function stripToPlainText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, '\'')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildInputText(meta, userText) {
  const parts = [];
  if (meta?.title) parts.push(`标题：${meta.title}`);
  if (meta?.description) parts.push(`简介：${meta.description}`);
  if (meta?.image) parts.push(`封面：${meta.image}`);
  if (meta?.transcriptText) parts.push(`转写文本（可能包含背景音乐等噪声，请只提取讲解内容）：\n${stripToPlainText(meta.transcriptText)}`);
  if (meta?.pageText) parts.push(`页面正文/笔记正文（如存在）：\n${stripToPlainText(meta.pageText)}`);
  if (meta?.ocrText) parts.push(`图片文字识别（如存在）：\n${stripToPlainText(meta.ocrText)}`);
  if (userText) parts.push(`用户提供的文案/笔记：${stripToPlainText(userText)}`);
  return parts.filter(Boolean).join('\n');
}

async function generateQuickNote(meta, userText, transcript) {
  if (!process.env.QWEN_API_KEY) throw new Error('QWEN_API_KEY 未配置');

  const input = buildInputText(meta, userText);
  const transcriptBlock = transcript
    ? `\n\n# 完整转录原文（基于此生成摘要和金句）：\n${stripToPlainText(transcript)}`
    : '';
  const prompt = [
    '你是拾思（Shisi）的内容整理助手。用户投递了一条短视频链接或分享文案（可能是长达几十分钟的音频/视频文案），请将其整理成“笔记”。',
    '要求：',
    '1) 只输出 JSON，不要输出任何多余文字。',
    '2) 必须进行深度总结：',
    '   - "title"：提取一个适合作为笔记标题的提炼（15字以内，直接概括核心主题）。',
    '   - "summary"：一段信息量充足的摘要（3-5句话），交代核心背景与结论。',
    '   - "content"：模块化、详尽的讲解。如果原内容较长，请分点、分段详尽阐述（支持Markdown格式）。绝对不要用一句话带过！',
    '   - "quotes"：提取至少 3-5 条最有价值的原文金句（必须是原汁原味的金句）。',
    '   - "nextAction"：具体、可落地的建议动作（写出1-2步具体该怎么做）。',
    '3) 如果信息不足，明确标注 unknown，不要编造事实。',
    '输出 JSON 格式：',
    '{',
    '  "title": "简短的提炼标题",',
    '  "summary": "摘要",',
    '  "content": "主要内容（模块化详细讲解）",',
    '  "quotes": ["金句1", "金句2", "金句3", "金句4"],',
    '  "nextAction": "建议动作"',
    '}',
    '',
    '# 短视频内容：',
    input || '（无）',
    transcriptBlock,
  ].join('\n');

  const out = await llmClient.callJSON(prompt, { temperature: 0.2, maxTokens: 900 });
  const title = typeof out?.title === 'string' ? out.title.trim() : '';
  const summary = typeof out?.summary === 'string' ? out.summary.trim() : '';
  const bullets = Array.isArray(out?.bullets) ? out.bullets.map((s) => String(s || '').trim()).filter(Boolean) : [];
  const quotes = Array.isArray(out?.quotes) ? out.quotes.map((s) => String(s || '').trim()).filter(Boolean) : [];
  const nextAction = typeof out?.nextAction === 'string' ? out.nextAction.trim() : '';
  const topics = Array.isArray(out?.topics) ? out.topics.map((s) => String(s || '').trim()).filter(Boolean) : [];

  return {
    title: title || '短视频速记',
    summary,
    bullets,
    quotes,
    nextAction,
    topics,
  };
}

async function generateRefinedNote(meta, userText, quick, transcript) {
  if (!process.env.QWEN_API_KEY) throw new Error('QWEN_API_KEY 未配置');

  const input = buildInputText(meta, userText);
  const transcriptHint = transcript
    ? `\n\n完整转录原文（参考）：\n${stripToPlainText(transcript).slice(0, 2000)}`
    : '';
  const prompt = [
    '你是拾思（Shisi）的内容整理助手。请将短视频内容整理成“精编版笔记”，用于后续复盘与行动。',
    '要求：',
    '1) 只输出 JSON，不要输出任何多余文字。',
    '2) 结构清晰：一句话洞察、关键要点、方法/步骤清单（如适用）、常见误区（如适用）、行动建议。',
    '3) 不要编造：缺失信息写 unknown。',
    '输出 JSON 格式：',
    '{',
    '  "insight": string,',
    '  "keyPoints": string[],',
    '  "steps": string[],',
    '  "pitfalls": string[],',
    '  "nextAction": string,',
    '  "topics": string[]',
    '}',
    '',
    '速记版（参考）：',
    JSON.stringify(quick || {}, null, 2),
    '',
    '输入：',
    input || '（无）',
    transcriptHint,
  ].join('\n');

  const out = await llmClient.callJSON(prompt, { temperature: 0.2, maxTokens: 1200 });
  return {
    insight: typeof out?.insight === 'string' ? out.insight.trim() : '',
    keyPoints: Array.isArray(out?.keyPoints) ? out.keyPoints.map((s) => String(s || '').trim()).filter(Boolean) : [],
    steps: Array.isArray(out?.steps) ? out.steps.map((s) => String(s || '').trim()).filter(Boolean) : [],
    pitfalls: Array.isArray(out?.pitfalls) ? out.pitfalls.map((s) => String(s || '').trim()).filter(Boolean) : [],
    nextAction: typeof out?.nextAction === 'string' ? out.nextAction.trim() : '',
    topics: Array.isArray(out?.topics) ? out.topics.map((s) => String(s || '').trim()).filter(Boolean) : [],
  };
}

function renderMarkdownNote(meta, url, quick, refined, originalText, transcript) {
  const lines = [];
  const title = (quick?.title || meta?.title || '短视频笔记').trim();
  lines.push(`# ${title}`);
  lines.push('');
  if (url) lines.push(`来源：${url}`);
  lines.push('');
  if (quick?.summary) {
    lines.push('## 摘要');
    lines.push(quick.summary);
    lines.push('');
  }
  if (quick?.content) {
    lines.push('## 主要内容（模块化详细讲解）');
    lines.push(quick.content);
    lines.push('');
  }
  if (Array.isArray(quick?.quotes) && quick.quotes.length) {
    lines.push('## 金句');
    for (const q of quick.quotes) lines.push(`- ${q}`);
    lines.push('');
  }
  if (quick?.nextAction) {
    lines.push('## 建议动作');
    lines.push(`- ${quick.nextAction}`);
    lines.push('');
  }
  // 原始文案区块：transcript + inputText
  const hasTranscript = transcript && transcript.trim();
  const hasInputText = originalText && originalText.trim();
  if (hasTranscript || hasInputText) {
    lines.push('## 原始文案');
    if (hasTranscript) {
      lines.push(transcript.trim());
      lines.push('');
    }
    if (hasInputText) {
      lines.push(`> 用户补充：${originalText.trim()}`);
      lines.push('');
    }
  }
  return lines.join('\n').trim() + '\n';
}

async function generateEmbeddingForQuick(quick) {
  const text = [quick?.title, quick?.summary, ...(quick?.bullets || [])].filter(Boolean).join('\n');
  if (!text) return null;
  const embedding = await embeddingService.generateEmbedding(text);
  return embedding;
}

module.exports = {
  fetchMetaInputText: buildInputText,
  generateQuickNote,
  generateRefinedNote,
  renderMarkdownNote,
  generateEmbeddingForQuick,
};
