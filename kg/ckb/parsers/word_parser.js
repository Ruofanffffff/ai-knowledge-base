/**
 * Word Document Parser
 * 
 * Parses Word documents (.docx) into CKBs
 * Each paragraph or section becomes a CKB
 */

const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');
const { createCKB } = require('../ckb_factory');

/**
 * Parse Word document
 * @param {string} docId - Document ID
 * @param {string} filePath - File path
 * @returns {Promise<Array>} Array of CKBs
 */
async function parse(docId, filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;
    
    // Split by paragraphs (double newline)
    const paragraphs = text
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    const ckbs = [];
    let currentSection = null;
    let sectionLevel = 0;
    
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      
      // Detect if this is a heading (simple heuristic: short line, possibly numbered)
      const isHeading = paragraph.length < 100 && 
                       (paragraph.match(/^[\d\.]+\s/) || paragraph.match(/^[一二三四五六七八九十]+[、\.]/));
      
      if (isHeading) {
        // Update current section
        currentSection = paragraph;
        sectionLevel = detectSectionLevel(paragraph);
      } else {
        // Create CKB for this paragraph
        const ckb = createCKB({
          docId: docId,
          sourceType: 'word',
          sourceMeta: {
            file_name: path.basename(filePath),
            paragraph_index: i
          },
          structure: {
            section_title: currentSection,
            level: sectionLevel,
            parent_section: null  // TODO: Track parent sections
          },
          text: paragraph,
          language: 'zh',
          sourceConfidence: 0.9
        });
        
        if (ckb) {
          ckbs.push(ckb);
        }
      }
    }
    
    return ckbs;
    
  } catch (error) {
    console.error('Error parsing Word document:', error);
    throw error;
  }
}

/**
 * Detect section level from heading text
 * @param {string} heading - Heading text
 * @returns {number} Section level (1-5)
 */
function detectSectionLevel(heading) {
  // Match patterns like "1.", "1.1", "1.1.1"
  const match = heading.match(/^([\d\.]+)\s/);
  if (match) {
    const dots = (match[1].match(/\./g) || []).length;
    return Math.min(dots + 1, 5);
  }
  
  // Match Chinese numerals
  if (heading.match(/^[一二三四五六七八九十]+[、\.]/)) {
    return 1;
  }
  
  return 1;
}

module.exports = {
  parse
};
