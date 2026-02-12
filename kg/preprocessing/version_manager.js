/**
 * Document Index Version Manager
 * 
 * Manages versioning for document indices including:
 * - Version creation and tracking
 * - Version querying
 * - Version comparison
 * 
 * Requirements: 10.4
 */

const { PrismaClient } = require('@prisma/client');

/**
 * Version Manager Class
 * Handles document index version management
 */
class VersionManager {
  constructor(options = {}) {
    this.prisma = options.prisma || new PrismaClient();
  }

  /**
   * Get latest version number for a document
   * @param {string} docId - Document ID
   * @returns {Promise<number>} Latest version number (0 if no versions exist)
   */
  async getLatestVersion(docId) {
    const latestIndex = await this.prisma.documentIndex.findFirst({
      where: { docId },
      orderBy: { version: 'desc' },
      select: { version: true }
    });

    return latestIndex ? latestIndex.version : 0;
  }

  /**
   * Get document index by version
   * @param {string} docId - Document ID
   * @param {number} version - Version number
   * @returns {Promise<Object|null>} Document index or null if not found
   */
  async getVersion(docId, version) {
    const index = await this.prisma.documentIndex.findFirst({
      where: {
        docId,
        version
      }
    });

    if (!index) {
      return null;
    }

    return this._formatIndex(index);
  }

  /**
   * Get all versions for a document
   * @param {string} docId - Document ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of document indices
   */
  async getAllVersions(docId, options = {}) {
    const {
      orderBy = 'desc',
      skip = 0,
      take = 100
    } = options;

    const indices = await this.prisma.documentIndex.findMany({
      where: { docId },
      orderBy: { version: orderBy },
      skip,
      take
    });

    return indices.map(index => this._formatIndex(index));
  }

  /**
   * Compare two versions of a document index
   * @param {string} docId - Document ID
   * @param {number} version1 - First version number
   * @param {number} version2 - Second version number
   * @returns {Promise<Object>} Comparison result
   */
  async compareVersions(docId, version1, version2) {
    // Fetch both versions
    const [index1, index2] = await Promise.all([
      this.getVersion(docId, version1),
      this.getVersion(docId, version2)
    ]);

    if (!index1) {
      throw new Error(`Version ${version1} not found for document ${docId}`);
    }

    if (!index2) {
      throw new Error(`Version ${version2} not found for document ${docId}`);
    }

    // Compare indexed text
    const textComparison = this._compareText(
      index1.indexedText,
      index2.indexedText
    );

    // Compare metadata
    const metadataComparison = this._compareMetadata(
      index1.metadata,
      index2.metadata
    );

    // Compare facts
    const factsComparison = this._compareFacts(
      index1.indexedText,
      index2.indexedText
    );

    return {
      docId,
      version1: {
        version: version1,
        createdAt: index1.createdAt,
        factCount: index1.metadata.fact_count || 0,
        tokenCount: index1.metadata.token_count || 0
      },
      version2: {
        version: version2,
        createdAt: index2.createdAt,
        factCount: index2.metadata.fact_count || 0,
        tokenCount: index2.metadata.token_count || 0
      },
      comparison: {
        text: textComparison,
        metadata: metadataComparison,
        facts: factsComparison
      }
    };
  }

  /**
   * Create a new version of document index
   * @param {string} docId - Document ID
   * @param {Object} indexData - Index data
   * @returns {Promise<Object>} Created document index
   */
  async createVersion(docId, indexData) {
    // Get next version number
    const latestVersion = await this.getLatestVersion(docId);
    const nextVersion = latestVersion + 1;

    // Create new version
    const index = await this.prisma.documentIndex.create({
      data: {
        id: indexData.id,
        docId,
        indexedText: indexData.indexed_text,
        metadata: JSON.stringify(indexData.metadata),
        version: nextVersion
      }
    });

    return this._formatIndex(index);
  }

  /**
   * Delete a specific version
   * @param {string} docId - Document ID
   * @param {number} version - Version number
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteVersion(docId, version) {
    const result = await this.prisma.documentIndex.deleteMany({
      where: {
        docId,
        version
      }
    });

    return result.count > 0;
  }

  /**
   * Get version history summary
   * @param {string} docId - Document ID
   * @returns {Promise<Object>} Version history summary
   */
  async getVersionHistory(docId) {
    const versions = await this.getAllVersions(docId);

    if (versions.length === 0) {
      return {
        docId,
        totalVersions: 0,
        latestVersion: 0,
        firstCreated: null,
        lastUpdated: null,
        versions: []
      };
    }

    return {
      docId,
      totalVersions: versions.length,
      latestVersion: versions[0].version,
      firstCreated: versions[versions.length - 1].createdAt,
      lastUpdated: versions[0].updatedAt,
      versions: versions.map(v => ({
        version: v.version,
        factCount: v.metadata.fact_count || 0,
        tokenCount: v.metadata.token_count || 0,
        llmModel: v.metadata.llm_model || 'unknown',
        createdAt: v.createdAt
      }))
    };
  }

  /**
   * Format document index for output
   * @param {Object} index - Raw index from database
   * @returns {Object} Formatted index
   * @private
   */
  _formatIndex(index) {
    return {
      id: index.id,
      docId: index.docId,
      indexedText: index.indexedText,
      version: index.version,
      metadata: index.metadata ? JSON.parse(index.metadata) : {},
      createdAt: index.createdAt,
      updatedAt: index.updatedAt
    };
  }

  /**
   * Compare text between two versions
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {Object} Text comparison result
   * @private
   */
  _compareText(text1, text2) {
    const isSame = text1 === text2;
    
    if (isSame) {
      return {
        identical: true,
        similarity: 1.0,
        lengthDiff: 0
      };
    }

    // Calculate similarity using simple character-based comparison
    const similarity = this._calculateSimilarity(text1, text2);
    const lengthDiff = text2.length - text1.length;

    return {
      identical: false,
      similarity,
      lengthDiff,
      length1: text1.length,
      length2: text2.length
    };
  }

  /**
   * Compare metadata between two versions
   * @param {Object} meta1 - First metadata
   * @param {Object} meta2 - Second metadata
   * @returns {Object} Metadata comparison result
   * @private
   */
  _compareMetadata(meta1, meta2) {
    return {
      factCountDiff: (meta2.fact_count || 0) - (meta1.fact_count || 0),
      tokenCountDiff: (meta2.token_count || 0) - (meta1.token_count || 0),
      modelChanged: meta1.llm_model !== meta2.llm_model,
      model1: meta1.llm_model || 'unknown',
      model2: meta2.llm_model || 'unknown'
    };
  }

  /**
   * Compare facts between two versions
   * @param {string} text1 - First indexed text
   * @param {string} text2 - Second indexed text
   * @returns {Object} Facts comparison result
   * @private
   */
  _compareFacts(text1, text2) {
    const facts1 = this._extractFacts(text1);
    const facts2 = this._extractFacts(text2);

    // Find added, removed, and modified facts
    const added = [];
    const removed = [];
    const modified = [];
    const unchanged = [];

    // Create maps for easier comparison
    const facts1Map = new Map(facts1.map(f => [f.index, f.text]));
    const facts2Map = new Map(facts2.map(f => [f.index, f.text]));

    // Check for removed and modified facts
    for (const [index, text] of facts1Map) {
      if (!facts2Map.has(index)) {
        removed.push({ index, text });
      } else if (facts2Map.get(index) !== text) {
        modified.push({
          index,
          oldText: text,
          newText: facts2Map.get(index)
        });
      } else {
        unchanged.push({ index, text });
      }
    }

    // Check for added facts
    for (const [index, text] of facts2Map) {
      if (!facts1Map.has(index)) {
        added.push({ index, text });
      }
    }

    return {
      totalFacts1: facts1.length,
      totalFacts2: facts2.length,
      added: added.length,
      removed: removed.length,
      modified: modified.length,
      unchanged: unchanged.length,
      addedFacts: added,
      removedFacts: removed,
      modifiedFacts: modified
    };
  }

  /**
   * Extract facts from indexed text
   * @param {string} text - Indexed text
   * @returns {Array} Array of facts
   * @private
   */
  _extractFacts(text) {
    const facts = [];
    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(/^(\d+)[.)]\s+(.+)$/);

      if (match) {
        facts.push({
          index: parseInt(match[1], 10),
          text: match[2].trim()
        });
      }
    }

    return facts;
  }

  /**
   * Calculate text similarity (simple character-based)
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {number} Similarity score (0-1)
   * @private
   */
  _calculateSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    if (text1 === text2) return 1;

    // Use Levenshtein distance for similarity
    const maxLength = Math.max(text1.length, text2.length);
    if (maxLength === 0) return 1;

    const distance = this._levenshteinDistance(text1, text2);
    return 1 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Edit distance
   * @private
   */
  _levenshteinDistance(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return matrix[len1][len2];
  }
}

/**
 * Create version manager instance
 * @param {Object} options - Manager options
 * @returns {VersionManager} Manager instance
 */
function createVersionManager(options = {}) {
  return new VersionManager(options);
}

module.exports = {
  VersionManager,
  createVersionManager
};
