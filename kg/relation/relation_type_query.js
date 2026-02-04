/**
 * Relation Type Query
 * 
 * Provides query and search capabilities for relation types.
 * Supports filtering by domain, category, entity types, and keyword search.
 * 
 * Design Reference: Relation Type Expansion
 * Requirements: 8.4, 8.5
 */

/**
 * Query filters structure
 * @typedef {Object} QueryFilters
 * @property {string} [domain] - Filter by domain
 * @property {string} [category] - Filter by category
 * @property {string} [entityType] - Filter by entity type (source or target)
 * @property {boolean} [isDirectional] - Filter by directionality
 * @property {boolean} [isTemporal] - Filter by temporal property
 * @property {boolean} [active] - Filter by active status
 */

/**
 * Hierarchy node structure
 * @typedef {Object} HierarchyNode
 * @property {Object} relationType - The relation type definition
 * @property {HierarchyNode|null} parent - Parent node (if has parentType)
 * @property {HierarchyNode[]} children - Child nodes (types that inherit from this)
 */

/**
 * RelationTypeQuery class
 * Provides advanced query and search capabilities for relation types
 */
class RelationTypeQuery {
  /**
   * @param {Object} registry - RelationTypeRegistry instance
   */
  constructor(registry) {
    this.registry = registry;
  }

  /**
   * Query relation types with filters
   * 
   * @param {QueryFilters} filters - Query filters
   * @returns {Array<Object>} Array of matching RelationTypeDefinitions
   */
  query(filters = {}) {
    let results = this.registry.getAll();

    // Filter by domain
    if (filters.domain) {
      results = results.filter(rt => rt.domain === filters.domain);
    }

    // Filter by category
    if (filters.category) {
      results = results.filter(rt => rt.category === filters.category);
    }

    // Filter by entity type (checks both source and target)
    if (filters.entityType) {
      results = results.filter(rt => 
        rt.sourceEntityTypes.includes(filters.entityType) ||
        rt.targetEntityTypes.includes(filters.entityType)
      );
    }

    // Filter by directionality
    if (filters.isDirectional !== undefined) {
      results = results.filter(rt => rt.isDirectional === filters.isDirectional);
    }

    // Filter by temporal property
    if (filters.isTemporal !== undefined) {
      results = results.filter(rt => rt.isTemporal === filters.isTemporal);
    }

    // Filter by active status
    if (filters.active !== undefined) {
      results = results.filter(rt => rt.active === filters.active);
    }

    return results;
  }

  /**
   * Search relation types by keyword
   * Searches in name, displayName, and description fields
   * 
   * @param {string} keyword - Search keyword
   * @returns {Array<Object>} Array of matching RelationTypeDefinitions
   */
  search(keyword) {
    if (!keyword || typeof keyword !== 'string') {
      return [];
    }

    const lowerKeyword = keyword.toLowerCase();
    const allTypes = this.registry.getAll();

    return allTypes.filter(rt => {
      // Search in name (English)
      if (rt.name && rt.name.toLowerCase().includes(lowerKeyword)) {
        return true;
      }

      // Search in displayName (Chinese)
      if (rt.displayName && rt.displayName.includes(keyword)) {
        return true;
      }

      // Search in description
      if (rt.description && rt.description.toLowerCase().includes(lowerKeyword)) {
        return true;
      }

      // Search in relationTypeId
      if (rt.relationTypeId && rt.relationTypeId.toLowerCase().includes(lowerKeyword)) {
        return true;
      }

      return false;
    });
  }

  /**
   * Get relation type hierarchy
   * Returns the hierarchy tree for a given relation type
   * 
   * @param {string} relationTypeId - Relation type ID
   * @returns {HierarchyNode|null} Hierarchy node or null if not found
   */
  getHierarchy(relationTypeId) {
    const relationType = this.registry.get(relationTypeId);
    
    if (!relationType) {
      return null;
    }

    // Build the hierarchy node
    const node = {
      relationType,
      parent: null,
      children: []
    };

    // Find parent if exists
    if (relationType.parentType) {
      const parentType = this.registry.get(relationType.parentType);
      if (parentType) {
        node.parent = {
          relationType: parentType,
          parent: null,
          children: []
        };
      }
    }

    // Find children (types that have this as parent)
    const allTypes = this.registry.getAll();
    const children = allTypes.filter(rt => rt.parentType === relationTypeId);
    
    node.children = children.map(childType => ({
      relationType: childType,
      parent: node,
      children: []
    }));

    return node;
  }

  /**
   * Get compatible relation types for given source and target entity types
   * 
   * @param {string} sourceEntityType - Source entity type
   * @param {string} targetEntityType - Target entity type
   * @returns {Array<Object>} Array of compatible RelationTypeDefinitions
   */
  getCompatibleTypes(sourceEntityType, targetEntityType) {
    if (!sourceEntityType || !targetEntityType) {
      return [];
    }

    const allTypes = this.registry.getAll();

    return allTypes.filter(rt => 
      rt.sourceEntityTypes.includes(sourceEntityType) &&
      rt.targetEntityTypes.includes(targetEntityType)
    );
  }

  /**
   * Get relation types by domain
   * 
   * @param {string} domain - Domain name
   * @returns {Array<Object>} Array of RelationTypeDefinitions in the domain
   */
  getByDomain(domain) {
    return this.registry.getByDomain(domain);
  }

  /**
   * Get relation types by category
   * 
   * @param {string} category - Category name
   * @returns {Array<Object>} Array of RelationTypeDefinitions in the category
   */
  getByCategory(category) {
    return this.registry.getByCategory(category);
  }

  /**
   * Get relation types by entity type
   * 
   * @param {string} entityType - Entity type
   * @param {string} role - Role: 'source', 'target', or 'both'
   * @returns {Array<Object>} Array of RelationTypeDefinitions
   */
  getByEntityType(entityType, role = 'both') {
    return this.registry.getByEntityType(entityType, role);
  }

  /**
   * Get all domains with their relation type counts
   * 
   * @returns {Object} Map of domain -> count
   */
  getDomainStats() {
    const allTypes = this.registry.getAll();
    const stats = {};

    for (const rt of allTypes) {
      if (!stats[rt.domain]) {
        stats[rt.domain] = 0;
      }
      stats[rt.domain]++;
    }

    return stats;
  }

  /**
   * Get all categories with their relation type counts
   * 
   * @returns {Object} Map of category -> count
   */
  getCategoryStats() {
    const allTypes = this.registry.getAll();
    const stats = {};

    for (const rt of allTypes) {
      if (!stats[rt.category]) {
        stats[rt.category] = 0;
      }
      stats[rt.category]++;
    }

    return stats;
  }

  /**
   * Get relation types that support a specific feature
   * 
   * @param {string} feature - Feature name: 'confidence', 'temporal', 'directional'
   * @returns {Array<Object>} Array of RelationTypeDefinitions
   */
  getByFeature(feature) {
    const allTypes = this.registry.getAll();

    switch (feature) {
      case 'confidence':
        return allTypes.filter(rt => rt.supportsConfidence);
      case 'temporal':
        return allTypes.filter(rt => rt.isTemporal);
      case 'directional':
        return allTypes.filter(rt => rt.isDirectional);
      case 'bidirectional':
        return allTypes.filter(rt => !rt.isDirectional);
      default:
        return [];
    }
  }

  /**
   * Get relation types that can connect two specific entity types
   * (considers both directions for bidirectional relations)
   * 
   * @param {string} entityType1 - First entity type
   * @param {string} entityType2 - Second entity type
   * @returns {Array<Object>} Array of RelationTypeDefinitions
   */
  getConnectingTypes(entityType1, entityType2) {
    if (!entityType1 || !entityType2) {
      return [];
    }

    const allTypes = this.registry.getAll();
    const results = [];

    for (const rt of allTypes) {
      // Check forward direction
      if (rt.sourceEntityTypes.includes(entityType1) &&
          rt.targetEntityTypes.includes(entityType2)) {
        results.push(rt);
        continue;
      }

      // Check reverse direction for bidirectional relations
      if (!rt.isDirectional &&
          rt.sourceEntityTypes.includes(entityType2) &&
          rt.targetEntityTypes.includes(entityType1)) {
        results.push(rt);
      }
    }

    return results;
  }

  /**
   * Get similar relation types based on entity type compatibility
   * 
   * @param {string} relationTypeId - Reference relation type ID
   * @returns {Array<Object>} Array of similar RelationTypeDefinitions
   */
  getSimilarTypes(relationTypeId) {
    const relationType = this.registry.get(relationTypeId);
    
    if (!relationType) {
      return [];
    }

    const allTypes = this.registry.getAll();
    const similar = [];

    for (const rt of allTypes) {
      // Skip the same type
      if (rt.relationTypeId === relationTypeId) {
        continue;
      }

      // Check if entity types overlap
      const sourceOverlap = rt.sourceEntityTypes.some(et => 
        relationType.sourceEntityTypes.includes(et)
      );
      const targetOverlap = rt.targetEntityTypes.some(et => 
        relationType.targetEntityTypes.includes(et)
      );

      if (sourceOverlap && targetOverlap) {
        similar.push(rt);
      }
    }

    return similar;
  }

  /**
   * Advanced search with multiple criteria
   * 
   * @param {Object} criteria - Search criteria
   * @param {string} [criteria.keyword] - Keyword to search
   * @param {string} [criteria.domain] - Domain filter
   * @param {string} [criteria.category] - Category filter
   * @param {string} [criteria.entityType] - Entity type filter
   * @param {boolean} [criteria.isDirectional] - Directionality filter
   * @param {boolean} [criteria.isTemporal] - Temporal filter
   * @returns {Array<Object>} Array of matching RelationTypeDefinitions
   */
  advancedSearch(criteria) {
    let results = this.registry.getAll();

    // Apply keyword search first if provided
    if (criteria.keyword) {
      const keywordResults = this.search(criteria.keyword);
      const keywordIds = new Set(keywordResults.map(rt => rt.relationTypeId));
      results = results.filter(rt => keywordIds.has(rt.relationTypeId));
    }

    // Apply filters
    const filters = {
      domain: criteria.domain,
      category: criteria.category,
      entityType: criteria.entityType,
      isDirectional: criteria.isDirectional,
      isTemporal: criteria.isTemporal
    };

    // Remove undefined filters
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) {
        delete filters[key];
      }
    });

    // Apply remaining filters
    if (Object.keys(filters).length > 0) {
      const filteredResults = this.query(filters);
      const filteredIds = new Set(filteredResults.map(rt => rt.relationTypeId));
      results = results.filter(rt => filteredIds.has(rt.relationTypeId));
    }

    return results;
  }

  /**
   * Get relation type recommendations for a given context
   * 
   * @param {Object} context - Context information
   * @param {string} [context.sourceEntityType] - Source entity type
   * @param {string} [context.targetEntityType] - Target entity type
   * @param {string} [context.domain] - Preferred domain
   * @param {number} [limit=10] - Maximum number of recommendations
   * @returns {Array<Object>} Array of recommended RelationTypeDefinitions
   */
  getRecommendations(context, limit = 10) {
    let candidates = this.registry.getAll();

    // Filter by entity types if provided
    if (context.sourceEntityType && context.targetEntityType) {
      candidates = this.getCompatibleTypes(
        context.sourceEntityType,
        context.targetEntityType
      );
    } else if (context.sourceEntityType) {
      candidates = this.getByEntityType(context.sourceEntityType, 'source');
    } else if (context.targetEntityType) {
      candidates = this.getByEntityType(context.targetEntityType, 'target');
    }

    // Prioritize by domain if provided
    if (context.domain) {
      const domainTypes = candidates.filter(rt => rt.domain === context.domain);
      const otherTypes = candidates.filter(rt => rt.domain !== context.domain);
      candidates = [...domainTypes, ...otherTypes];
    }

    // Return limited results
    return candidates.slice(0, limit);
  }
}

module.exports = RelationTypeQuery;
