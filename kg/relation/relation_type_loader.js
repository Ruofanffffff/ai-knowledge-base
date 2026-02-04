/**
 * Relation Type Loader
 * 
 * Loads relation type definitions from JSON files and other sources.
 * Handles normalization, validation, and inheritance resolution.
 * 
 * Design Reference: Relation Type Expansion
 * Requirements: 11.1, 11.2, 11.4
 */

const fs = require('fs');
const path = require('path');
const { normalizeRelationTypeDefinition, validateRelationTypeDefinition } = require('./relation_type_definition');

/**
 * RelationTypeLoader class
 * Loads and processes relation type definitions
 */
class RelationTypeLoader {
  constructor() {
    this.loadedFiles = new Set();
  }

  /**
   * Load relation types from a JSON file
   * 
   * @param {string} filePath - Path to the JSON file
   * @returns {Array<Object>} Array of RelationTypeDefinitions
   * @throws {Error} If file cannot be read or parsed
   */
  loadFromFile(filePath) {
    try {
      // Read file
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
      const fileContent = fs.readFileSync(absolutePath, 'utf8');
      
      // Parse JSON
      const data = JSON.parse(fileContent);
      
      // Track loaded file
      this.loadedFiles.add(absolutePath);
      
      // Extract relation types from the structure
      const relationTypes = this._extractRelationTypes(data);
      
      // Normalize and validate
      const normalized = relationTypes.map(type => this.normalize(type));
      
      // Resolve inheritance
      const resolved = this.resolveInheritance(normalized);
      
      return resolved;
    } catch (error) {
      throw new Error(`Failed to load relation types from ${filePath}: ${error.message}`);
    }
  }

  /**
   * Load relation types from an array of objects
   * 
   * @param {Array<Object>} definitions - Array of relation type definition objects
   * @returns {Array<Object>} Array of normalized RelationTypeDefinitions
   */
  loadFromArray(definitions) {
    if (!Array.isArray(definitions)) {
      throw new Error('Definitions must be an array');
    }

    // Normalize each definition
    const normalized = definitions.map(def => this.normalize(def));
    
    // Resolve inheritance
    const resolved = this.resolveInheritance(normalized);
    
    return resolved;
  }

  /**
   * Normalize a relation type definition
   * Ensures all fields have proper defaults and types
   * 
   * @param {Object} definition - Raw relation type definition
   * @returns {Object} Normalized RelationTypeDefinition
   * @throws {Error} If validation fails after normalization
   */
  normalize(definition) {
    // Normalize the definition
    const normalized = normalizeRelationTypeDefinition(definition);
    
    // Validate after normalization
    const validation = validateRelationTypeDefinition(normalized);
    if (!validation.valid) {
      throw new Error(`Invalid relation type definition: ${validation.errors.join(', ')}`);
    }
    
    return normalized;
  }

  /**
   * Resolve inheritance relationships between relation types
   * Child types inherit properties from parent types
   * 
   * @param {Array<Object>} definitions - Array of RelationTypeDefinitions
   * @returns {Array<Object>} Array of RelationTypeDefinitions with inheritance resolved
   */
  resolveInheritance(definitions) {
    // Create a map for quick lookup
    const typeMap = new Map();
    for (const def of definitions) {
      typeMap.set(def.relationTypeId, def);
    }

    // Resolve inheritance for each type
    const resolved = definitions.map(def => {
      if (!def.parentType) {
        return def;
      }

      // Find parent
      const parent = typeMap.get(def.parentType);
      if (!parent) {
        console.warn(`Parent type '${def.parentType}' not found for '${def.relationTypeId}'`);
        return def;
      }

      // Merge with parent (child properties override parent properties)
      return this._mergeWithParent(def, parent);
    });

    return resolved;
  }

  /**
   * Extract relation types from a structured JSON object
   * Supports the hierarchical structure: domains -> categories -> types
   * 
   * @param {Object} data - Parsed JSON data
   * @returns {Array<Object>} Array of relation type definitions
   * @private
   */
  _extractRelationTypes(data) {
    const relationTypes = [];

    // Handle flat array format
    if (Array.isArray(data)) {
      return data;
    }

    // Handle direct types array
    if (data.types && Array.isArray(data.types)) {
      return data.types;
    }

    // Handle hierarchical format: domains -> categories -> types
    if (data.domains) {
      for (const [domainKey, domainData] of Object.entries(data.domains)) {
        if (domainData.categories) {
          for (const [categoryKey, categoryData] of Object.entries(domainData.categories)) {
            if (categoryData.types && Array.isArray(categoryData.types)) {
              // Add domain and category to each type
              for (const type of categoryData.types) {
                relationTypes.push({
                  ...type,
                  domain: type.domain || domainKey,
                  category: type.category || categoryKey
                });
              }
            }
          }
        }
      }
    }

    return relationTypes;
  }

  /**
   * Merge child type with parent type
   * Child properties override parent properties
   * 
   * @param {Object} child - Child RelationTypeDefinition
   * @param {Object} parent - Parent RelationTypeDefinition
   * @returns {Object} Merged RelationTypeDefinition
   * @private
   */
  _mergeWithParent(child, parent) {
    return {
      // Parent properties as defaults
      ...parent,
      
      // Child properties override
      ...child,
      
      // Special handling for arrays - merge instead of replace
      sourceEntityTypes: child.sourceEntityTypes && child.sourceEntityTypes.length > 0
        ? child.sourceEntityTypes
        : parent.sourceEntityTypes,
      
      targetEntityTypes: child.targetEntityTypes && child.targetEntityTypes.length > 0
        ? child.targetEntityTypes
        : parent.targetEntityTypes,
      
      // Merge metadata
      metadata: {
        ...parent.metadata,
        ...child.metadata
      },
      
      // Keep child's own identity
      relationTypeId: child.relationTypeId,
      name: child.name,
      displayName: child.displayName,
      parentType: child.parentType
    };
  }

  /**
   * Get list of loaded files
   * 
   * @returns {Array<string>} Array of file paths that have been loaded
   */
  getLoadedFiles() {
    return Array.from(this.loadedFiles);
  }

  /**
   * Clear the loaded files cache
   */
  clearCache() {
    this.loadedFiles.clear();
  }

  /**
   * Load relation types from multiple files
   * 
   * @param {Array<string>} filePaths - Array of file paths
   * @returns {Array<Object>} Combined array of RelationTypeDefinitions
   */
  loadFromFiles(filePaths) {
    const allTypes = [];
    
    for (const filePath of filePaths) {
      const types = this.loadFromFile(filePath);
      allTypes.push(...types);
    }
    
    return allTypes;
  }

  /**
   * Validate a JSON file structure without loading
   * 
   * @param {string} filePath - Path to the JSON file
   * @returns {Object} Validation result with { valid: boolean, errors: string[] }
   */
  validateFile(filePath) {
    try {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
      const fileContent = fs.readFileSync(absolutePath, 'utf8');
      const data = JSON.parse(fileContent);
      
      const relationTypes = this._extractRelationTypes(data);
      const errors = [];
      
      for (const type of relationTypes) {
        try {
          this.normalize(type);
        } catch (error) {
          errors.push(`${type.relationTypeId || 'unknown'}: ${error.message}`);
        }
      }
      
      return {
        valid: errors.length === 0,
        errors,
        count: relationTypes.length
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error.message],
        count: 0
      };
    }
  }
}

module.exports = RelationTypeLoader;
