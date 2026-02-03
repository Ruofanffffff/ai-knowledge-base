/**
 * PDF Document Parser
 * 
 * Parses PDF documents into CKBs
 * Each paragraph becomes a CKB
 */

const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const { createCKB } = require('../ckb_factory');

/**
 * Parse PDF document
 * @param {string} docId - Document ID
 * @param {string} filePath - File path
 * @returns {Promise<Array>} Array of CKBs
 */
async function parse(docId, filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    
    const text = data.text;
    const numPages = data.numpages;
    
    // Split by paragraphs
    const paragraphs = text
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    const ckbs = [];
    
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      
      // Estimate page number (rough approximation)
      const estimatedPage = Math.ceil((i + 1) / (paragraphs.length / numPages));
      
      const ckb = createCKB({
        docId: docId,
        sourceType: 'pdf',
        sourceMeta: {
          file_name: path.basename(filePath),
          page: estimatedPage,
          total_pages: numPages
        },
        structure: {
          section_title: null,
          level: 0
        },
        text: paragraph,
        language: 'zh',
        sourceConfidence: 0.85  // Slightly lower than Word due to potential formatting issues
      });
      
      if (ckb) {
        ckbs.push(ckb);
      }
    }
    
    return ckbs;
    
  } catch (error) {
    console.error('Error parsing PDF document:', error);
    throw error;
  }
}

module.exports = {
  parse
};
