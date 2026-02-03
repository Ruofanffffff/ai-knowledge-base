/**
 * Excel Document Parser
 * 
 * Parses Excel documents into CKBs
 * Each row becomes a CKB (after detecting header)
 */

const XLSX = require('xlsx');
const path = require('path');
const { createCKB } = require('../ckb_factory');

/**
 * Parse Excel document
 * @param {string} docId - Document ID
 * @param {string} filePath - File path
 * @returns {Promise<Array>} Array of CKBs
 */
async function parse(docId, filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const ckbs = [];
    
    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length === 0) continue;
      
      // Detect header row (first non-empty row)
      let headerRow = null;
      let dataStartIndex = 0;
      
      for (let i = 0; i < jsonData.length; i++) {
        if (jsonData[i].some(cell => cell !== null && cell !== undefined && cell !== '')) {
          headerRow = jsonData[i];
          dataStartIndex = i + 1;
          break;
        }
      }
      
      if (!headerRow) continue;
      
      // Process data rows
      for (let i = dataStartIndex; i < jsonData.length; i++) {
        const row = jsonData[i];
        
        // Skip empty rows
        if (!row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
          continue;
        }
        
        // Create text representation of the row
        const rowText = headerRow
          .map((header, index) => {
            const value = row[index];
            if (value !== null && value !== undefined && value !== '') {
              return `${header}: ${value}`;
            }
            return null;
          })
          .filter(item => item !== null)
          .join(', ');
        
        if (rowText.length === 0) continue;
        
        const ckb = createCKB({
          docId: docId,
          sourceType: 'excel',
          sourceMeta: {
            file_name: path.basename(filePath),
            sheet: sheetName,
            row: i + 1,
            cell_range: `A${i + 1}:${String.fromCharCode(65 + headerRow.length - 1)}${i + 1}`
          },
          structure: {
            section_title: sheetName,
            level: 1
          },
          text: rowText,
          language: 'zh',
          sourceConfidence: 0.95  // High confidence for structured data
        });
        
        if (ckb) {
          ckbs.push(ckb);
        }
      }
    }
    
    return ckbs;
    
  } catch (error) {
    console.error('Error parsing Excel document:', error);
    throw error;
  }
}

module.exports = {
  parse
};
