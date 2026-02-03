/**
 * Structure Analyzer
 * 
 * Analyzes document structure and identifies all structural units
 * Supports Word, PDF, Excel, and Markdown documents
 */

const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Analyze document structure
 * @param {string} docId - Document ID
 * @param {string} filePath - File path
 * @param {string} fileType - File type (word, pdf, excel, markdown)
 * @returns {Promise<Object>} DocumentStructure
 */
async function analyzeDocument(docId, filePath, fileType) {
  let structure;
  
  switch (fileType.toLowerCase()) {
    case 'word':
    case 'docx':
      structure = await analyzeWordDocument(docId, filePath);
      break;
    case 'pdf':
      structure = await analyzePdfDocument(docId, filePath);
      break;
    case 'excel':
    case 'xlsx':
      structure = await analyzeExcelDocument(docId, filePath);
      break;
    case 'markdown':
    case 'md':
      structure = await analyzeMarkdownDocument(docId, filePath);
      break;
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
  
  // Save to database
  await prisma.documentStructure.create({
    data: {
      docId: docId,
      fileType: fileType,
      totalUnits: structure.total_units,
      units: JSON.stringify(structure.units),
      hierarchy: JSON.stringify(structure.hierarchy)
    }
  });
  
  return structure;
}

/**
 * Analyze Word document structure
 * @param {string} docId - Document ID
 * @param {string} filePath - File path
 * @returns {Promise<Object>} DocumentStructure
 */
async function analyzeWordDocument(docId, filePath) {
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;
  
  const paragraphs = text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
  
  const units = [];
  const hierarchyStack = [{ unit_id: 'root', type: 'document', children: [], processed: false }];
  let currentSection = null;
  let sectionLevel = 0;
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const isEmpty = paragraph.length === 0;
    
    // Detect if this is a heading
    const isHeading = paragraph.length < 100 && 
                     (paragraph.match(/^[\d\.]+\s/) || 
                      paragraph.match(/^[一二三四五六七八九十]+[、\.]/));
    
    const unitId = uuidv4();
    const level = isHeading ? detectSectionLevel(paragraph) : sectionLevel + 1;
    
    const unit = {
      unit_id: unitId,
      type: isHeading ? 'heading' : 'paragraph',
      content: paragraph,
      level: level,
      parent_id: currentSection,
      is_empty: isEmpty,
      should_filter: false,
      filter_reason: null
    };
    
    units.push(unit);
    
    // Update hierarchy
    if (isHeading) {
      currentSection = unitId;
      sectionLevel = level;
      
      // Find appropriate parent in hierarchy
      while (hierarchyStack.length > 1 && hierarchyStack[hierarchyStack.length - 1].level >= level) {
        hierarchyStack.pop();
      }
      
      const node = {
        unit_id: unitId,
        type: 'heading',
        level: level,
        children: [],
        processed: false
      };
      
      hierarchyStack[hierarchyStack.length - 1].children.push(node);
      hierarchyStack.push(node);
    } else {
      // Add paragraph to current section
      const node = {
        unit_id: unitId,
        type: 'paragraph',
        children: [],
        processed: false
      };
      
      hierarchyStack[hierarchyStack.length - 1].children.push(node);
    }
  }
  
  return {
    doc_id: docId,
    file_type: 'word',
    total_units: units.length,
    units: units,
    hierarchy: {
      root: hierarchyStack[0]
    }
  };
}

/**
 * Analyze PDF document structure
 * @param {string} docId - Document ID
 * @param {string} filePath - File path
 * @returns {Promise<Object>} DocumentStructure
 */
async function analyzePdfDocument(docId, filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  
  const text = data.text;
  const paragraphs = text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
  
  const units = [];
  const root = { unit_id: 'root', type: 'document', children: [], processed: false };
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const isEmpty = paragraph.length === 0;
    const unitId = uuidv4();
    
    const unit = {
      unit_id: unitId,
      type: 'paragraph',
      content: paragraph,
      level: 1,
      parent_id: null,
      is_empty: isEmpty,
      should_filter: false,
      filter_reason: null
    };
    
    units.push(unit);
    
    root.children.push({
      unit_id: unitId,
      type: 'paragraph',
      children: [],
      processed: false
    });
  }
  
  return {
    doc_id: docId,
    file_type: 'pdf',
    total_units: units.length,
    units: units,
    hierarchy: { root }
  };
}

/**
 * Analyze Excel document structure
 * @param {string} docId - Document ID
 * @param {string} filePath - File path
 * @returns {Promise<Object>} DocumentStructure
 */
async function analyzeExcelDocument(docId, filePath) {
  const workbook = XLSX.readFile(filePath);
  const units = [];
  const root = { unit_id: 'root', type: 'document', children: [], processed: false };
  
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length === 0) continue;
    
    const sheetId = uuidv4();
    const sheetNode = {
      unit_id: sheetId,
      type: 'sheet',
      children: [],
      processed: false
    };
    
    root.children.push(sheetNode);
    
    // Detect header row
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
      
      if (!row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
        continue;
      }
      
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
      
      const unitId = uuidv4();
      const unit = {
        unit_id: unitId,
        type: 'table_row',
        content: rowText,
        level: 2,
        parent_id: sheetId,
        is_empty: false,
        should_filter: false,
        filter_reason: null
      };
      
      units.push(unit);
      
      sheetNode.children.push({
        unit_id: unitId,
        type: 'table_row',
        children: [],
        processed: false
      });
    }
  }
  
  return {
    doc_id: docId,
    file_type: 'excel',
    total_units: units.length,
    units: units,
    hierarchy: { root }
  };
}

/**
 * Analyze Markdown document structure
 * @param {string} docId - Document ID
 * @param {string} filePath - File path
 * @returns {Promise<Object>} DocumentStructure
 */
async function analyzeMarkdownDocument(docId, filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split('\n');
  
  const units = [];
  const hierarchyStack = [{ unit_id: 'root', type: 'document', children: [], processed: false }];
  let currentSection = null;
  let currentParagraph = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Heading
    if (line.startsWith('#')) {
      // Save previous paragraph if exists
      if (currentParagraph.length > 0) {
        const unitId = uuidv4();
        const content = currentParagraph.join('\n');
        
        units.push({
          unit_id: unitId,
          type: 'paragraph',
          content: content,
          level: hierarchyStack.length,
          parent_id: currentSection,
          is_empty: false,
          should_filter: false,
          filter_reason: null
        });
        
        hierarchyStack[hierarchyStack.length - 1].children.push({
          unit_id: unitId,
          type: 'paragraph',
          children: [],
          processed: false
        });
        
        currentParagraph = [];
      }
      
      const level = line.match(/^#+/)[0].length;
      const content = line.replace(/^#+\s*/, '');
      const unitId = uuidv4();
      
      units.push({
        unit_id: unitId,
        type: 'heading',
        content: content,
        level: level,
        parent_id: currentSection,
        is_empty: false,
        should_filter: false,
        filter_reason: null
      });
      
      // Update hierarchy
      while (hierarchyStack.length > level) {
        hierarchyStack.pop();
      }
      
      const node = {
        unit_id: unitId,
        type: 'heading',
        level: level,
        children: [],
        processed: false
      };
      
      hierarchyStack[hierarchyStack.length - 1].children.push(node);
      hierarchyStack.push(node);
      
      currentSection = unitId;
    }
    // Code block
    else if (line.startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      
      const unitId = uuidv4();
      const content = codeLines.join('\n');
      
      units.push({
        unit_id: unitId,
        type: 'code_block',
        content: content,
        level: hierarchyStack.length,
        parent_id: currentSection,
        is_empty: content.length === 0,
        should_filter: false,
        filter_reason: null
      });
      
      hierarchyStack[hierarchyStack.length - 1].children.push({
        unit_id: unitId,
        type: 'code_block',
        children: [],
        processed: false
      });
    }
    // List item
    else if (line.match(/^[\*\-\+]\s/) || line.match(/^\d+\.\s/)) {
      const unitId = uuidv4();
      const content = line.replace(/^[\*\-\+\d\.]\s*/, '');
      
      units.push({
        unit_id: unitId,
        type: 'list_item',
        content: content,
        level: hierarchyStack.length,
        parent_id: currentSection,
        is_empty: false,
        should_filter: false,
        filter_reason: null
      });
      
      hierarchyStack[hierarchyStack.length - 1].children.push({
        unit_id: unitId,
        type: 'list_item',
        children: [],
        processed: false
      });
    }
    // Regular paragraph
    else if (line.length > 0) {
      currentParagraph.push(line);
    }
    // Empty line - end of paragraph
    else if (currentParagraph.length > 0) {
      const unitId = uuidv4();
      const content = currentParagraph.join('\n');
      
      units.push({
        unit_id: unitId,
        type: 'paragraph',
        content: content,
        level: hierarchyStack.length,
        parent_id: currentSection,
        is_empty: false,
        should_filter: false,
        filter_reason: null
      });
      
      hierarchyStack[hierarchyStack.length - 1].children.push({
        unit_id: unitId,
        type: 'paragraph',
        children: [],
        processed: false
      });
      
      currentParagraph = [];
    }
  }
  
  // Save last paragraph if exists
  if (currentParagraph.length > 0) {
    const unitId = uuidv4();
    const content = currentParagraph.join('\n');
    
    units.push({
      unit_id: unitId,
      type: 'paragraph',
      content: content,
      level: hierarchyStack.length,
      parent_id: currentSection,
      is_empty: false,
      should_filter: false,
      filter_reason: null
    });
    
    hierarchyStack[hierarchyStack.length - 1].children.push({
      unit_id: unitId,
      type: 'paragraph',
      children: [],
      processed: false
    });
  }
  
  return {
    doc_id: docId,
    file_type: 'markdown',
    total_units: units.length,
    units: units,
    hierarchy: { root: hierarchyStack[0] }
  };
}

/**
 * Count structural units
 * @param {Object} structure - DocumentStructure
 * @returns {number} Total count
 */
function countStructuralUnits(structure) {
  return structure.units.filter(u => !u.is_empty).length;
}

/**
 * Extract hierarchy tree
 * @param {Object} structure - DocumentStructure
 * @returns {Object} HierarchyTree
 */
function extractHierarchy(structure) {
  return structure.hierarchy;
}

/**
 * Detect section level from heading text
 * @param {string} heading - Heading text
 * @returns {number} Section level (1-5)
 */
function detectSectionLevel(heading) {
  const match = heading.match(/^([\d\.]+)\s/);
  if (match) {
    const dots = (match[1].match(/\./g) || []).length;
    return Math.min(dots + 1, 5);
  }
  
  if (heading.match(/^[一二三四五六七八九十]+[、\.]/)) {
    return 1;
  }
  
  return 1;
}

module.exports = {
  analyzeDocument,
  analyzeWordDocument,
  analyzePdfDocument,
  analyzeExcelDocument,
  analyzeMarkdownDocument,
  countStructuralUnits,
  extractHierarchy
};
