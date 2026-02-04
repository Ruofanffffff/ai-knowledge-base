/**
 * Relation Type Registry
 * 
 * Manages the registration and retrieval of relation types.
 * Provides indexing for efficient querying by domain, category, and entity type.
 * 
 * Design Reference: Relation Type Expansion
 * Requirements: 8.1, 8.2, 9.2
 */

const { validateRelationTypeDefinition } = require('./relation_type_definition');

/**
 * RelationTypeRegistry class
 * Manages all relation type definitions with efficient indexing
 */
class RelationTypeRegistry {
  constructor() {
    // Main storage: relationTypeId -> RelationTypeDefinition
    this.types = new Map();
    
    // Indexes for efficient querying
    this.domainIndex = new Map();     // domain -> Set<relationTypeId>
    this.categoryIndex = new Map();   // category -> Set<relationTypeId>
    this.entityTypeIndex = new Map(); // entityType -> Set<relationTypeId>
  }

  /**
   * Register a single relation type
   * 
   * @param {Object} relationType - RelationTypeDefinition to register
   * @throws {Error} If validation fails or relationTypeId already exists
   */
  register(relationType) {
    // Validate the relation type
    const validation = validateRelationTypeDefinition(relationType);
    if (!validation.valid) {
      throw new Error(`Invalid relation type: ${validation.errors.join(', ')}`);
    }

    const { relationTypeId } = relationType;

    // Check for duplicate IDs
    if (this.types.has(relationTypeId)) {
      throw new Error(`Relation type with ID '${relationTypeId}' already exists`);
    }

    // Store the relation type
    this.types.set(relationTypeId, relationType);

    // Update domain index
    if (!this.domainIndex.has(relationType.domain)) {
      this.domainIndex.set(relationType.domain, new Set());
    }
    this.domainIndex.get(relationType.domain).add(relationTypeId);

    // Update category index
    if (!this.categoryIndex.has(relationType.category)) {
      this.categoryIndex.set(relationType.category, new Set());
    }
    this.categoryIndex.get(relationType.category).add(relationTypeId);

    // Update entity type index for source types
    for (const entityType of relationType.sourceEntityTypes) {
      if (!this.entityTypeIndex.has(entityType)) {
        this.entityTypeIndex.set(entityType, new Set());
      }
      this.entityTypeIndex.get(entityType).add(relationTypeId);
    }

    // Update entity type index for target types
    for (const entityType of relationType.targetEntityTypes) {
      if (!this.entityTypeIndex.has(entityType)) {
        this.entityTypeIndex.set(entityType, new Set());
      }
      this.entityTypeIndex.get(entityType).add(relationTypeId);
    }
  }

  /**
   * Register multiple relation types in batch
   * 
   * @param {Array<Object>} relationTypes - Array of RelationTypeDefinitions
   * @returns {Object} Result with counts of successful and failed registrations
   */
  registerBatch(relationTypes) {
    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };

    for (const relationType of relationTypes) {
      try {
        this.register(relationType);
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          relationTypeId: relationType.relationTypeId,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Get a relation type by ID
   * 
   * @param {string} relationTypeId - The relation type ID
   * @returns {Object|null} The RelationTypeDefinition or null if not found
   */
  get(relationTypeId) {
    return this.types.get(relationTypeId) || null;
  }

  /**
   * Check if a relation type exists
   * 
   * @param {string} relationTypeId - The relation type ID
   * @returns {boolean} True if the relation type exists
   */
  has(relationTypeId) {
    return this.types.has(relationTypeId);
  }

  /**
   * Get all relation types
   * 
   * @returns {Array<Object>} Array of all RelationTypeDefinitions
   */
  getAll() {
    return Array.from(this.types.values());
  }

  /**
   * Get relation types by domain
   * 
   * @param {string} domain - The domain to filter by
   * @returns {Array<Object>} Array of RelationTypeDefinitions in the domain
   */
  getByDomain(domain) {
    const typeIds = this.domainIndex.get(domain);
    if (!typeIds) {
      return [];
    }

    return Array.from(typeIds).map(id => this.types.get(id));
  }

  /**
   * Get relation types by category
   * 
   * @param {string} category - The category to filter by
   * @returns {Array<Object>} Array of RelationTypeDefinitions in the category
   */
  getByCategory(category) {
    const typeIds = this.categoryIndex.get(category);
    if (!typeIds) {
      return [];
    }

    return Array.from(typeIds).map(id => this.types.get(id));
  }

  /**
   * Get relation types by entity type
   * 
   * @param {string} entityType - The entity type to filter by
   * @param {string} role - The role: 'source', 'target', or 'both'
   * @returns {Array<Object>} Array of RelationTypeDefinitions applicable to the entity type
   */
  getByEntityType(entityType, role = 'both') {
    const typeIds = this.entityTypeIndex.get(entityType);
    if (!typeIds) {
      return [];
    }

    const allTypes = Array.from(typeIds).map(id => this.types.get(id));

    if (role === 'both') {
      return allTypes;
    }

    // Filter by role
    return allTypes.filter(type => {
      if (role === 'source') {
        return type.sourceEntityTypes.includes(entityType);
      } else if (role === 'target') {
        return type.targetEntityTypes.includes(entityType);
      }
      return false;
    });
  }

  /**
   * Get statistics about the registry
   * 
   * @returns {Object} Statistics object
   */
  getStats() {
    const byDomain = {};
    for (const [domain, typeIds] of this.domainIndex.entries()) {
      byDomain[domain] = typeIds.size;
    }

    const byCategory = {};
    for (const [category, typeIds] of this.categoryIndex.entries()) {
      byCategory[category] = typeIds.size;
    }

    return {
      total: this.types.size,
      byDomain,
      byCategory,
      entityTypes: this.entityTypeIndex.size
    };
  }

  /**
   * Clear all relation types from the registry
   */
  clear() {
    this.types.clear();
    this.domainIndex.clear();
    this.categoryIndex.clear();
    this.entityTypeIndex.clear();
  }

  /**
   * Remove a relation type by ID
   * 
   * @param {string} relationTypeId - The relation type ID to remove
   * @returns {boolean} True if the relation type was removed
   */
  remove(relationTypeId) {
    const relationType = this.types.get(relationTypeId);
    if (!relationType) {
      return false;
    }

    // Remove from main storage
    this.types.delete(relationTypeId);

    // Remove from domain index
    const domainSet = this.domainIndex.get(relationType.domain);
    if (domainSet) {
      domainSet.delete(relationTypeId);
      if (domainSet.size === 0) {
        this.domainIndex.delete(relationType.domain);
      }
    }

    // Remove from category index
    const categorySet = this.categoryIndex.get(relationType.category);
    if (categorySet) {
      categorySet.delete(relationTypeId);
      if (categorySet.size === 0) {
        this.categoryIndex.delete(relationType.category);
      }
    }

    // Remove from entity type index
    const allEntityTypes = [
      ...relationType.sourceEntityTypes,
      ...relationType.targetEntityTypes
    ];
    for (const entityType of allEntityTypes) {
      const entitySet = this.entityTypeIndex.get(entityType);
      if (entitySet) {
        entitySet.delete(relationTypeId);
        if (entitySet.size === 0) {
          this.entityTypeIndex.delete(entityType);
        }
      }
    }

    return true;
  }

  /**
   * Get the count of relation types
   * 
   * @returns {number} The number of registered relation types
   */
  count() {
    return this.types.size;
  }
}

module.exports = RelationTypeRegistry;
