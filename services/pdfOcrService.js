const { uploadFile, parseFileContent } = require('./aliyunFileService');

// 使用阿里云百炼 (Qwen-Long) 直接解析 PDF 文件
// 替代旧的 pdf-poppler -> image -> qwen-vl 方案
async function processPdfWithOcr(pdfPath) {
  try {
    console.log(`[OCR] Starting PDF processing via Aliyun Bailian: ${pdfPath}`);
    
    // 1. 上传文件到阿里云
    const fileId = await uploadFile(pdfPath);
    
    // 2. 调用 Qwen-Long 进行解析
    const fullText = await parseFileContent(fileId);
    
    return fullText;
  } catch (error) {
    console.error('[OCR] PDF processing failed:', error);
    // 返回空字符串让上层逻辑处理兜底
    return '';
  }
}

module.exports = {
  processPdfWithOcr
};
