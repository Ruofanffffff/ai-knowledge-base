/**
 * CKB Parser
 * 
 * Parses various document formats into CKB (Contextual Knowledge Blocks)
 */

const { createCKB } = require('./ckb_factory');
const wordParser = require('./parsers/word_parser');
const pdfParser = require('./parsers/pdf_parser');
const excelParser = require('./parsers/excel_parser');

/**
 * Parse document into CKBs
 * @param {string} docId - Document ID
 * @param {string} filePath - File path
 * @param {string} fileType - File type (word, pdf, excel, image, video)
 * @returns {Promise<Array>} Array of CKBs
 */
async function parseDocument(docId, filePath, fileType) {
  console.log(`Parsing document: ${docId}, type: ${fileType}`);
  
  let ckbs = [];
  
  try {
    switch (fileType.toLowerCase()) {
      case 'word':
      case 'docx':
      case 'doc':
        ckbs = await wordParser.parse(docId, filePath);
        break;
      
      case 'pdf':
        ckbs = await pdfParser.parse(docId, filePath);
        break;
      
      case 'excel':
      case 'xlsx':
      case 'xls':
        ckbs = await excelParser.parse(docId, filePath);
        break;
      
      case 'image':
      case 'jpg':
      case 'jpeg':
      case 'png':
        // TODO: Implement image parser with OCR
        console.warn('Image parsing not yet implemented');
        break;
      
      case 'video':
      case 'mp4':
      case 'avi':
        // TODO: Implement video parser with ASR
        console.warn('Video parsing not yet implemented');
        break;
      
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
    
    console.log(`Parsed ${ckbs.length} CKBs from document ${docId}`);
    return ckbs;
    
  } catch (error) {
    console.error(`Error parsing document ${docId}:`, error);
    throw error;
  }
}

module.exports = {
  parseDocument,
  createCKB
};
