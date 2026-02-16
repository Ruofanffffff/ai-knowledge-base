const fs = require('fs');
const OpenAI = require('openai');

// 初始化 Aliyun Bailian 客户端 (兼容 OpenAI)
// 使用环境变量 QWEN_API_KEY
const getClient = () => {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) {
    throw new Error('QWEN_API_KEY is not configured');
  }
  
  return new OpenAI({
    apiKey: apiKey,
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
  });
};

/**
 * 上传文件到 Aliyun Bailian
 * @param {string} filePath - 本地文件路径
 * @returns {Promise<string>} fileId - 阿里云返回的文件ID
 */
async function uploadFile(filePath) {
  try {
    const client = getClient();
    console.log(`[AliyunFile] Uploading file: ${filePath}`);
    
    const file = await client.files.create({
      file: fs.createReadStream(filePath),
      purpose: "file-extract"
    });
    
    console.log(`[AliyunFile] Upload success. File ID: ${file.id}`);
    return file.id;
  } catch (error) {
    console.error('[AliyunFile] Upload failed:', error);
    throw error;
  }
}

/**
 * 使用 Qwen-Long 模型解析文件内容
 * @param {string} fileId - 阿里云文件ID
 * @returns {Promise<string>} extractedText - 解析出的文本内容
 */
async function parseFileContent(fileId) {
  try {
    const client = getClient();
    console.log(`[AliyunFile] Parsing file content with qwen-long: ${fileId}`);
    
    // 使用 qwen-long 模型，通过 system prompt 传入 fileid
    const completion = await client.chat.completions.create({
      model: "qwen-long",
      messages: [
        {
          role: "system",
          content: `fileid://${fileId}` // 关键：阿里云特定的文件上下文传入方式
        },
        {
          role: "user",
          content: "请OCR提取这份文档中的所有文字内容，保持原有结构。如果包含表格，请尽量还原表格结构。直接输出内容，不要包含'好的'等废话。"
        }
      ],
      stream: false
    });
    
    if (completion.choices && completion.choices.length > 0) {
      const text = completion.choices[0].message.content;
      console.log(`[AliyunFile] Parse success. Text length: ${text.length}`);
      return text;
    } else {
      throw new Error('Empty response from qwen-long');
    }
  } catch (error) {
    console.error('[AliyunFile] Parse failed:', error);
    throw error;
  }
}

module.exports = {
  uploadFile,
  parseFileContent
};
