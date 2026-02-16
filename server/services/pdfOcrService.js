const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

// 调用 Aliyun Qwen-VL 进行 OCR
async function analyzeWithQwenVL(base64Image) {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) {
    throw new Error('QWEN_API_KEY is not configured');
  }

  const content = [
    { type: "image_url", image_url: { url: base64Image } },
    { type: "text", text: "请OCR提取这张图片中的所有文字内容，保持原有结构。如果包含表格，请尽量还原表格结构。直接输出内容，不要包含'好的'等废话。" }
  ];

  try {
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "qwen-vl-max", // 使用 qwen-vl-max 以获得更好的 OCR 效果
        messages: [
          {
            role: "user",
            content: content
          }
        ]
      })
    });

    const result = await response.json();
    if (result.choices && result.choices.length > 0) {
      return result.choices[0].message.content;
    } else {
      console.error('Qwen-VL response error:', result);
      return '';
    }
  } catch (error) {
    console.error("API call failed:", error);
    return '';
  }
}

// PDF 转图片并进行 OCR
async function processPdfWithOcr(pdfPath) {
  try {
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    
    // 加载 PDF 文档
    const loadingTask = pdfjsLib.getDocument({
      data: data,
      disableFontFace: true,
      standardFontDataUrl: path.join(__dirname, '../../node_modules/pdfjs-dist/standard_fonts/')
    });

    const pdfDocument = await loadingTask.promise;
    const numPages = Math.min(pdfDocument.numPages, 5); // 限制处理前5页，避免过慢
    let fullText = '';

    console.log(`[OCR] PDF loaded, processing first ${numPages} pages...`);

    for (let i = 1; i <= numPages; i++) {
      try {
        const page = await pdfDocument.getPage(i);
        const scale = 2.0; 
        const viewport = page.getViewport({ scale });

        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          canvasFactory: {
            create: (width, height) => {
              const c = createCanvas(width, height);
              return {
                canvas: c,
                context: c.getContext('2d'),
              };
            },
            reset: (ctx, width, height) => {
              ctx.canvas.width = width;
              ctx.canvas.height = height;
            },
            destroy: (ctx) => {
              ctx.canvas = null;
            },
          }
        };

        await page.render(renderContext).promise;

        // 转换为 Base64
        const imageBuffer = canvas.toBuffer('image/jpeg', { quality: 0.8 });
        const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
        
        // 调用 Qwen-VL
        console.log(`[OCR] Sending page ${i} to Qwen-VL...`);
        const pageText = await analyzeWithQwenVL(base64Image);
        fullText += `\n--- Page ${i} ---\n${pageText}`;
        
      } catch (pageError) {
        console.error(`[OCR] Error processing page ${i}:`, pageError);
      }
    }

    return fullText;
  } catch (error) {
    console.error('[OCR] PDF processing failed:', error);
    return '';
  }
}

module.exports = {
  processPdfWithOcr
};
