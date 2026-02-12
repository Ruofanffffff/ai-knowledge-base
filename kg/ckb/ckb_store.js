/**
 * CKB Store
 * 
 * Handles CKB persistence and retrieval
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Helper function to deserialize CKB JSON fields
 * @param {Object} ckb - Raw CKB from database
 * @returns {Object} CKB with parsed JSON fields
 */
function deserializeCKB(ckb) {
  if (!ckb) return null;
  
  return {
    ...ckb,
    sourceMeta: JSON.parse(ckb.sourceMeta),
    structure: JSON.parse(ckb.structure),
    content: JSON.parse(ckb.content),
    quality: JSON.parse(ckb.quality),
    timestamps: JSON.parse(ckb.timestamps)
  };
}

/**
 * Save CKB to database
 * @param {Object} ckb - CKB object
 * @returns {Promise<Object>} Saved CKB
 */
async function saveCKB(ckb) {
  try {
    const saved = await prisma.cKB.create({
      data: {
        id: ckb.ckb_id,
        docId: String(ckb.doc_id), // Convert to string for Prisma schema compatibility
        sourceType: ckb.source_type,
        sourceMeta: JSON.stringify(ckb.source_meta),
        structure: JSON.stringify(ckb.structure),
        content: JSON.stringify(ckb.content),
        quality: JSON.stringify(ckb.quality),
        timestamps: JSON.stringify(ckb.timestamps)
      }
    });
    
    // Parse JSON strings back to objects for return
    return deserializeCKB(saved);
  } catch (error) {
    console.error('Error saving CKB:', error);
    throw error;
  }
}

/**
 * Save multiple CKBs
 * @param {Array} ckbs - Array of CKB objects
 * @returns {Promise<Array>} Saved CKBs
 */
async function saveCKBs(ckbs) {
  try {
    const saved = await prisma.$transaction(
      ckbs.map(ckb => 
        prisma.cKB.create({
          data: {
            id: ckb.ckb_id,
            docId: String(ckb.doc_id), // Convert to string for Prisma schema compatibility
            sourceType: ckb.source_type,
            sourceMeta: JSON.stringify(ckb.source_meta),
            structure: JSON.stringify(ckb.structure),
            content: JSON.stringify(ckb.content),
            quality: JSON.stringify(ckb.quality),
            timestamps: JSON.stringify(ckb.timestamps)
          }
        })
      )
    );
    
    // Parse JSON strings back to objects for return
    return saved.map(deserializeCKB);
  } catch (error) {
    console.error('Error saving CKBs:', error);
    throw error;
  }
}

/**
 * Get CKB by ID
 * @param {string} ckbId - CKB ID
 * @returns {Promise<Object>} CKB object
 */
async function getCKB(ckbId) {
  try {
    const ckb = await prisma.cKB.findUnique({
      where: { id: ckbId }
    });
    
    return ckb ? deserializeCKB(ckb) : null;
  } catch (error) {
    console.error('Error getting CKB:', error);
    throw error;
  }
}

/**
 * Get CKBs by document ID
 * @param {string} docId - Document ID
 * @returns {Promise<Array>} Array of CKBs
 */
async function getCKBsByDocument(docId) {
  try {
    const ckbs = await prisma.cKB.findMany({
      where: { docId: String(docId) }, // Convert to string for Prisma schema compatibility
      orderBy: { createdAt: 'asc' }
    });
    
    return ckbs.map(deserializeCKB);
  } catch (error) {
    console.error('Error getting CKBs by document:', error);
    throw error;
  }
}

/**
 * Get CKBs by source type
 * @param {string} sourceType - Source type (word, pdf, excel, etc.)
 * @returns {Promise<Array>} Array of CKBs
 */
async function getCKBsBySourceType(sourceType) {
  try {
    const ckbs = await prisma.cKB.findMany({
      where: { sourceType: sourceType },
      orderBy: { createdAt: 'desc' }
    });
    
    return ckbs.map(deserializeCKB);
  } catch (error) {
    console.error('Error getting CKBs by source type:', error);
    throw error;
  }
}

/**
 * Delete CKB by ID
 * @param {string} ckbId - CKB ID
 * @returns {Promise<void>}
 */
async function deleteCKB(ckbId) {
  try {
    await prisma.cKB.delete({
      where: { id: ckbId }
    });
  } catch (error) {
    console.error('Error deleting CKB:', error);
    throw error;
  }
}

/**
 * Delete CKBs by document ID
 * @param {string} docId - Document ID
 * @returns {Promise<void>}
 */
async function deleteCKBsByDocument(docId) {
  try {
    await prisma.cKB.deleteMany({
      where: { docId: String(docId) } // Convert to string for Prisma schema compatibility
    });
  } catch (error) {
    console.error('Error deleting CKBs by document:', error);
    throw error;
  }
}

/**
 * Get all CKBs
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of CKBs
 */
async function getAllCKBs(options = {}) {
  try {
    const { skip = 0, take = 100 } = options;
    
    const ckbs = await prisma.cKB.findMany({
      skip: skip,
      take: take,
      orderBy: { createdAt: 'desc' }
    });
    
    return ckbs.map(deserializeCKB);
  } catch (error) {
    console.error('Error getting all CKBs:', error);
    throw error;
  }
}

/**
 * Count CKBs
 * @param {Object} where - Where clause
 * @returns {Promise<number>} Count
 */
async function countCKBs(where = {}) {
  try {
    const count = await prisma.cKB.count({ where });
    return count;
  } catch (error) {
    console.error('Error counting CKBs:', error);
    throw error;
  }
}

module.exports = {
  saveCKB,
  saveCKBs,
  getCKB,
  getCKBsByDocument,
  getCKBsBySourceType,
  deleteCKB,
  deleteCKBsByDocument,
  getAllCKBs,
  countCKBs
};
