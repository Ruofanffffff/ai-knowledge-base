/**
 * Evidence Locator
 * 
 * Locates entities and relations in the original document text,
 * providing precise evidence for knowledge graph elements.
 */

/**
 * Evidence Locator class
 */
class EvidenceLocator {
  constructor(options = {}) {
    this.options = {
      contextWindow: options.contextWindow || 100, // Characters before/after
      maxEvidence: options.maxEvidence || 3, // Max evidence instances per entity
      minMatchLength: options.minMatchLength || 3, // Min chars for fuzzy match
      ...options
    };
  }

  /**
   * Locate an entity in CKBs
   * @param {Object} entity - Entity object with name and fields
   * @param {Array} ckbs - Array of CKB objects
   * @returns {Object} Evidence object with locations
   */
  locateEntity(entity, ckbs) {
    if (!entity || !entity.canonical_name) {
      return this._createEmptyEvidence('entity');
    }

    const evidence = {
      type: 'entity',
      entityId: entity.id || entity.canonical_name,
      entityName: entity.canonical_name,
      locations: [],
      confidence: 0
    };

    // Search for entity name in CKBs
    for (const ckb of ckbs) {
      // Skip CKBs without content
      if (!ckb || !ckb.content || !ckb.content.text) {
        continue;
      }
      
      if (!ckb.chunks || ckb.chunks.length === 0) {
        // Fallback to full text if no chunks
        const locations = this._findInText(
          entity.canonical_name,
          ckb.content.text,
          ckb.ckb_id
        );
        evidence.locations.push(...locations);
      } else {
        // Search in chunks
        for (const chunk of ckb.chunks) {
          const locations = this._findInText(
            entity.canonical_name,
            chunk.text,
            ckb.ckb_id,
            chunk.id
          );
          evidence.locations.push(...locations);
        }
      }
    }

    // Limit to max evidence
    evidence.locations = evidence.locations.slice(0, this.options.maxEvidence);
    
    // Calculate confidence based on number of matches
    evidence.confidence = Math.min(evidence.locations.length / 2, 1.0);

    return evidence;
  }

  /**
   * Locate a relation in CKBs
   * @param {Object} relation - Relation object with source and target
   * @param {Object} sourceEntity - Source entity object
   * @param {Object} targetEntity - Target entity object
   * @param {Array} ckbs - Array of CKB objects
   * @returns {Object} Evidence object with locations
   */
  locateRelation(relation, sourceEntity, targetEntity, ckbs) {
    if (!relation || !sourceEntity || !targetEntity) {
      return this._createEmptyEvidence('relation');
    }

    const evidence = {
      type: 'relation',
      relationId: relation.id || `${sourceEntity.canonical_name}-${targetEntity.canonical_name}`,
      relationType: relation.type,
      sourceEntity: sourceEntity.canonical_name,
      targetEntity: targetEntity.canonical_name,
      locations: [],
      confidence: 0
    };

    // Search for co-occurrence of source and target entities
    for (const ckb of ckbs) {
      // Skip CKBs without content
      if (!ckb || !ckb.content || !ckb.content.text) {
        continue;
      }
      
      if (!ckb.chunks || ckb.chunks.length === 0) {
        // Fallback to full text
        const locations = this._findCooccurrence(
          sourceEntity.canonical_name,
          targetEntity.canonical_name,
          ckb.content.text,
          ckb.ckb_id
        );
        evidence.locations.push(...locations);
      } else {
        // Search in chunks
        for (const chunk of ckb.chunks) {
          const locations = this._findCooccurrence(
            sourceEntity.canonical_name,
            targetEntity.canonical_name,
            chunk.text,
            ckb.ckb_id,
            chunk.id
          );
          evidence.locations.push(...locations);
        }
      }
    }

    // Limit to max evidence
    evidence.locations = evidence.locations.slice(0, this.options.maxEvidence);
    
    // Calculate confidence
    evidence.confidence = Math.min(evidence.locations.length / 2, 1.0);

    return evidence;
  }

  /**
   * Get context around an entity
   * @param {Object} entity - Entity object
   * @param {Array} ckbs - Array of CKB objects
   * @param {Object} options - Options for context extraction
   * @returns {Object} Context object
   */
  getEntityContext(entity, ckbs, options = {}) {
    const contextWindow = options.contextWindow || this.options.contextWindow;
    const evidence = this.locateEntity(entity, ckbs);

    if (evidence.locations.length === 0) {
      return {
        entity: entity.canonical_name,
        contexts: [],
        fullText: this._getFullText(ckbs)
      };
    }

    const contexts = evidence.locations.map(loc => {
      const text = this._getTextFromLocation(loc, ckbs);
      const start = Math.max(0, loc.start - contextWindow);
      const end = Math.min(text.length, loc.end + contextWindow);
      
      return {
        text: text.substring(start, end),
        highlight: {
          start: loc.start - start,
          end: loc.end - start
        },
        ckbId: loc.ckbId,
        chunkId: loc.chunkId
      };
    });

    return {
      entity: entity.canonical_name,
      contexts,
      fullText: this._getFullText(ckbs)
    };
  }

  /**
   * Find text in a string
   * @private
   */
  _findInText(searchText, text, ckbId, chunkId = null) {
    const locations = [];
    
    if (!text || !searchText) {
      return locations;
    }

    // Case-insensitive search
    const lowerText = text.toLowerCase();
    const lowerSearch = searchText.toLowerCase();
    
    let index = lowerText.indexOf(lowerSearch);
    while (index !== -1 && locations.length < this.options.maxEvidence) {
      locations.push({
        ckbId,
        chunkId,
        start: index,
        end: index + searchText.length,
        matchedText: text.substring(index, index + searchText.length)
      });
      
      index = lowerText.indexOf(lowerSearch, index + 1);
    }

    return locations;
  }

  /**
   * Find co-occurrence of two entities
   * @private
   */
  _findCooccurrence(source, target, text, ckbId, chunkId = null) {
    const locations = [];
    
    if (!text || !source || !target) {
      return locations;
    }

    const lowerText = text.toLowerCase();
    const lowerSource = source.toLowerCase();
    const lowerTarget = target.toLowerCase();
    
    // Find all occurrences of source
    let sourceIndex = lowerText.indexOf(lowerSource);
    while (sourceIndex !== -1) {
      // Find target near source
      let targetIndex = lowerText.indexOf(lowerTarget);
      while (targetIndex !== -1) {
        // Check if they're close enough (within same chunk/sentence)
        const distance = Math.abs(targetIndex - sourceIndex);
        if (distance < 500 && distance > 0) { // Within 500 chars
          const start = Math.min(sourceIndex, targetIndex);
          const end = Math.max(
            sourceIndex + source.length,
            targetIndex + target.length
          );
          
          locations.push({
            ckbId,
            chunkId,
            start,
            end,
            matchedText: text.substring(start, end),
            sourcePos: sourceIndex,
            targetPos: targetIndex,
            distance
          });
          
          if (locations.length >= this.options.maxEvidence) {
            return locations;
          }
        }
        
        targetIndex = lowerText.indexOf(lowerTarget, targetIndex + 1);
      }
      
      sourceIndex = lowerText.indexOf(lowerSource, sourceIndex + 1);
    }

    return locations;
  }

  /**
   * Get text from a location
   * @private
   */
  _getTextFromLocation(location, ckbs) {
    const ckb = ckbs.find(c => c.ckb_id === location.ckbId);
    if (!ckb) {
      return '';
    }

    if (location.chunkId && ckb.chunks) {
      const chunk = ckb.chunks.find(ch => ch.id === location.chunkId);
      return chunk ? chunk.text : ckb.content.text;
    }

    return ckb.content.text;
  }

  /**
   * Get full text from CKBs
   * @private
   */
  _getFullText(ckbs) {
    return ckbs
      .filter(ckb => ckb && ckb.content && ckb.content.text)
      .map(ckb => ckb.content.text)
      .join('\n\n');
  }

  /**
   * Create empty evidence object
   * @private
   */
  _createEmptyEvidence(type) {
    return {
      type,
      locations: [],
      confidence: 0
    };
  }
}

module.exports = {
  EvidenceLocator
};
