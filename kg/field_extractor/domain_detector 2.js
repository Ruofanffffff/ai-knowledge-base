/**
 * Domain Detector
 * 
 * Fast, rule-based domain detection without LLM calls
 * Detects document domain based on keyword matching and density analysis
 * 
 * Performance requirement: < 10ms per detection
 */

const { DOMAIN_KEYWORDS, SUPPORTED_DOMAINS } = require('./extraction_config');

/**
 * Detect document domain from CKB content
 * @param {Object} ckb - CKB object with content and metadata
 * @returns {Object} Domain classification result
 */
function detectDomain(ckb) {
  const startTime = Date.now();
  
  try {
    // Extract text content
    const text = ckb.content?.text || '';
    
    // Handle empty content
    if (!text || text.trim().length === 0) {
      return {
        domain: 'general',
        confidence: 1.0,
        keywords: [],
        executionTime: Date.now() - startTime,
        metadata: {
          keywordCount: 0,
          totalWords: 0,
          keywordDensity: 0,
          reason: 'Empty content defaults to general'
        }
      };
    }
    
    // Calculate keyword matches for each domain
    const domainScores = {};
    const domainMatches = {};
    
    for (const domain of SUPPORTED_DOMAINS) {
      if (domain === 'general') continue; // Skip general domain
      
      const keywords = getDomainKeywords(domain);
      const matches = [];
      let matchCount = 0;
      
      for (const keyword of keywords) {
        // Count occurrences of keyword in text
        const regex = new RegExp(keyword, 'g');
        const occurrences = (text.match(regex) || []).length;
        
        if (occurrences > 0) {
          matches.push(keyword);
          matchCount += occurrences;
        }
      }
      
      domainScores[domain] = matchCount;
      domainMatches[domain] = matches;
    }
    
    // Find domain with highest score
    let bestDomain = 'general';
    let bestScore = 0;
    let bestMatches = [];
    
    for (const [domain, score] of Object.entries(domainScores)) {
      if (score > bestScore) {
        bestScore = score;
        bestDomain = domain;
        bestMatches = domainMatches[domain];
      }
    }
    
    // Calculate keyword density
    const totalWords = text.length; // Approximate word count
    const keywordDensity = totalWords > 0 ? bestScore / totalWords : 0;
    
    // Calculate confidence based on keyword density
    // High density (> 5%) = high confidence
    // Medium density (2-5%) = medium confidence
    // Low density (< 2%) = low confidence, default to general
    let confidence = 0;
    let finalDomain = bestDomain;
    
    if (keywordDensity >= 0.05) {
      confidence = 0.95;
    } else if (keywordDensity >= 0.02) {
      confidence = 0.75;
    } else {
      // Too few keywords, default to general
      confidence = 1.0;
      finalDomain = 'general';
      bestMatches = [];
    }
    
    const executionTime = Date.now() - startTime;
    
    return {
      domain: finalDomain,
      confidence,
      keywords: bestMatches,
      executionTime,
      metadata: {
        keywordCount: bestScore,
        totalWords,
        keywordDensity,
        allScores: domainScores,
        reason: keywordDensity < 0.02 
          ? 'Keyword density too low, defaulting to general'
          : `Detected ${finalDomain} domain with ${(keywordDensity * 100).toFixed(2)}% keyword density`
      }
    };
  } catch (error) {
    // Record error
    const performanceMonitor = require('../utils/performance_monitor');
    performanceMonitor.recordError({
      type: 'domain_detection_error',
      module: 'domain_detector',
      operation: 'detectDomain',
      message: error.message,
      ckb_id: ckb.ckb_id,
      doc_id: ckb.doc_id,
      stack: error.stack
    });
    
    // Return default domain on error
    return {
      domain: 'general',
      confidence: 1.0,
      keywords: [],
      executionTime: Date.now() - startTime,
      error: error.message,
      metadata: {
        keywordCount: 0,
        totalWords: 0,
        keywordDensity: 0,
        reason: 'Error during detection, defaulting to general'
      }
    };
  }
}

/**
 * Get domain-specific keywords
 * @param {string} domain - Domain name
 * @returns {Array<string>} Keywords for the domain
 */
function getDomainKeywords(domain) {
  return DOMAIN_KEYWORDS[domain] || [];
}

/**
 * Detect domain from text (convenience function)
 * @param {string} text - Text content
 * @returns {Object} Domain classification result
 */
function detectDomainFromText(text) {
  return detectDomain({
    content: { text }
  });
}

/**
 * Check if content matches a specific domain
 * @param {Object} ckb - CKB object
 * @param {string} targetDomain - Domain to check
 * @param {number} minConfidence - Minimum confidence threshold (0-1)
 * @returns {boolean} Whether content matches the domain
 */
function matchesDomain(ckb, targetDomain, minConfidence = 0.7) {
  const result = detectDomain(ckb);
  return result.domain === targetDomain && result.confidence >= minConfidence;
}

/**
 * Get all domain scores for content
 * @param {Object} ckb - CKB object
 * @returns {Object} Scores for all domains
 */
function getAllDomainScores(ckb) {
  const result = detectDomain(ckb);
  return result.metadata.allScores || {};
}

module.exports = {
  detectDomain,
  getDomainKeywords,
  detectDomainFromText,
  matchesDomain,
  getAllDomainScores
};
