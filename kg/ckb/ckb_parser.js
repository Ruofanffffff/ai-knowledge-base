/**
 * CKB Parser
 * 
 * Parses various document formats into CKB (Contextual Knowledge Blocks)
 */

const { createCKB } = require('./ckb_factory');
let wordParser;
let pdfParser;
let excelParser;

// 尝试加载解析器模块，处理模块加载失败的情况
try {
  wordParser = require('./parsers/word_parser');
} catch (error) {
  console.warn('Word parser module not available:', error.message);
  wordParser = null;
}

try {
  pdfParser = require('./parsers/pdf_parser');
} catch (error) {
  console.warn('PDF parser module not available:', error.message);
  pdfParser = null;
}

try {
  excelParser = require('./parsers/excel_parser');
} catch (error) {
  console.warn('Excel parser module not available:', error.message);
  excelParser = null;
}

/**
 * Parse document into CKBs
 * @param {string} docId - Document ID
 * @param {string} filePath - File path
 * @param {string} fileType - File type (word, pdf, excel, image, video)
 * @returns {Promise<Array>} Array of CKBs
 */
async function parseDocument(docId, filePath, fileType) {
  // Clean file type: remove dot and convert to lowercase
  let cleanFileType = fileType || '';
  if (cleanFileType.startsWith('.')) {
    cleanFileType = cleanFileType.substring(1).toLowerCase();
  }
  
  console.log(`Parsing document: ${docId}, type: ${cleanFileType}`);
  
  let ckbs = [];
  
  try {
    // Ensure cleanFileType is properly formatted
    const finalFileType = cleanFileType.toLowerCase().replace(/^\./, '');
    
    switch (finalFileType) {
      case 'word':
      case 'docx':
      case 'doc':
        if (wordParser) {
          ckbs = await wordParser.parse(docId, filePath);
        } else {
          console.warn('Word parser not available');
        }
        break;
      
      case 'pdf':
        if (pdfParser) {
          ckbs = await pdfParser.parse(docId, filePath);
        } else {
          console.warn('PDF parser not available');
        }
        break;
      
      case 'excel':
      case 'xlsx':
      case 'xls':
        if (excelParser) {
          ckbs = await excelParser.parse(docId, filePath);
        } else {
          console.warn('Excel parser not available');
        }
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
      
      case 'text':
      case 'txt':
      case 'md':
      case 'markdown':
        // Parse text and markdown files
        ckbs = await parseTextFile(docId, filePath, finalFileType);
        break;
      
      default:
        throw new Error(`Unsupported file type: ${finalFileType} (original: ${fileType}, clean: ${cleanFileType})`);
    }
    
    console.log(`Parsed ${ckbs.length} CKBs from document ${docId}`);
    return ckbs;
    
  } catch (error) {
    console.error(`Error parsing document ${docId}:`, error);
    throw error;
  }
}

/**
 * Parse text or markdown file into CKBs
 * @param {string} docId - Document ID
 * @param {string} filePath - File path
 * @param {string} fileType - File type
 * @returns {Promise<Array>} Array of CKBs
 */
async function parseTextFile(docId, filePath, fileType) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    let content = '';
    let sourceFile = '';
    
    if (filePath && fs.existsSync(filePath)) {
      // Read from file system if file exists
      content = fs.readFileSync(filePath, 'utf8');
      sourceFile = path.basename(filePath);
    } else {
      // Fallback to reading from database if file path is not available
      const sqlite3 = require('sqlite3').verbose();
      const dbPath = path.join(__dirname, '../../data/users.db');
      const db = new sqlite3.Database(dbPath);
      
      await new Promise((resolve, reject) => {
        db.get('SELECT content FROM documents WHERE id = ?', [docId], (err, row) => {
          if (err) {
            reject(err);
          } else if (row && row.content) {
            content = row.content;
            resolve();
          } else {
            reject(new Error('No content found for document'));
          }
        });
      });
      
      db.close();
      sourceFile = `document_${docId}`;
    }
    
    // Split into paragraphs or sections
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    const ckbs = [];
    
    paragraphs.forEach((paragraph, index) => {
      const trimmedParagraph = paragraph.trim();
      
      if (trimmedParagraph.length > 0 && docId) {
        const ckb = createCKB({
          docId: docId,
          sourceType: 'text',
          sourceMeta: {
            source_file: sourceFile,
            paragraph_index: index,
            char_count: trimmedParagraph.length,
            word_count: trimmedParagraph.split(/\s+/).length
          },
          text: trimmedParagraph,
          sourceConfidence: 0.9 // High confidence for text files
        });
        
        ckbs.push(ckb);
      }
    });
    
    return ckbs;
  } catch (error) {
    console.error(`Error parsing text file ${filePath}:`, error);
    throw error;
  }
}

module.exports = {
  parseDocument,
  createCKB,
  parseTextFile
};
