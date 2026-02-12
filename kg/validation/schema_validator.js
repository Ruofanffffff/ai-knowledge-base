/**
 * Schema Validator
 * 
 * Validates schema definitions from the JSON configuration file.
 * Ensures all schemas have required field definitions with proper structure.
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_FILE_PATH = path.join(__dirname, '../field_normalizer/schema_field_mappings_full.json');
const MIN_SCHEMA_COUNT = 412;
const MIN_CORE_FIELDS = 5;

class SchemaValidator {
  constructor() {
    this.schemas = null;
    this.validationErrors = [];
  }

  /**
   * Load schemas from JSON file
   * @returns {Object} Loaded schemas
   */
  loadSchemas() {
    try {
      const fileContent = fs.readFileSync(SCHEMA_FILE_PATH, 'utf8');
      this.schemas = JSON.parse(fileContent);
      return this.schemas;
    } catch (error) {
      throw new Error(`Failed to load schema file: ${error.message}`);
    }
  }

  /**
   * Validate that the schema file contains at least the minimum required number of schemas
   * Requirement 10.1: Verify at least 412 schema definitions
   * @returns {boolean} True if count is valid
   */
  validateSchemaCount() {
    if (!this.schemas) {
      this.loadSchemas();
    }

    const schemaNames = Object.keys(this.schemas);
    const count = schemaNames.length;

    if (count < MIN_SCHEMA_COUNT) {
      const error = `Schema count validation failed: Expected at least ${MIN_SCHEMA_COUNT} schemas, found ${count}`;
      this.validationErrors.push(error);
      return false;
    }

    return true;
  }

  /**
   * Validate the structure of a single schema
   * Requirement 10.2: Validate required field definitions
   * Requirement 10.3: Verify at least 5 core fields defined
   * @param {string} schemaName - Name of the schema
   * @param {Object} schema - Schema object to validate
   * @returns {boolean} True if structure is valid
   */
  validateSchemaStructure(schemaName, schema) {
    if (!schema || typeof schema !== 'object') {
      this.validationErrors.push(`Schema "${schemaName}": Invalid schema object`);
      return false;
    }

    const fields = Object.keys(schema);
    
    // Requirement 10.3: Check minimum core fields
    if (fields.length < MIN_CORE_FIELDS) {
      this.validationErrors.push(
        `Schema "${schemaName}": Expected at least ${MIN_CORE_FIELDS} core fields, found ${fields.length}`
      );
      return false;
    }

    let isValid = true;

    // Requirement 10.2: Validate each field has required properties
    // Note: Some fields may be arrays (simplified format) or objects (full format)
    for (const fieldName of fields) {
      const field = schema[fieldName];

      // Skip array fields (simplified format - just variations list)
      if (Array.isArray(field)) {
        continue;
      }

      if (!field || typeof field !== 'object') {
        this.validationErrors.push(
          `Schema "${schemaName}", Field "${fieldName}": Invalid field definition (must be object or array)`
        );
        isValid = false;
        continue;
      }

      // Check required properties for full format fields
      const requiredProps = ['common_variations', 'weight', 'required', 'description'];
      for (const prop of requiredProps) {
        if (!(prop in field)) {
          this.validationErrors.push(
            `Schema "${schemaName}", Field "${fieldName}": Missing required property "${prop}"`
          );
          isValid = false;
        }
      }

      // Validate property types
      if ('common_variations' in field && !Array.isArray(field.common_variations)) {
        this.validationErrors.push(
          `Schema "${schemaName}", Field "${fieldName}": "common_variations" must be an array`
        );
        isValid = false;
      }

      if ('weight' in field && typeof field.weight !== 'number') {
        this.validationErrors.push(
          `Schema "${schemaName}", Field "${fieldName}": "weight" must be a number`
        );
        isValid = false;
      }

      if ('required' in field && typeof field.required !== 'boolean') {
        this.validationErrors.push(
          `Schema "${schemaName}", Field "${fieldName}": "required" must be a boolean`
        );
        isValid = false;
      }

      if ('description' in field && typeof field.description !== 'string') {
        this.validationErrors.push(
          `Schema "${schemaName}", Field "${fieldName}": "description" must be a string`
        );
        isValid = false;
      }
    }

    return isValid;
  }

  /**
   * Validate field mappings and variations
   * Requirement 10.4: Validate field mappings include common variations
   * @param {string} schemaName - Name of the schema
   * @param {Object} schema - Schema object to validate
   * @returns {boolean} True if mappings are valid
   */
  validateFieldMappings(schemaName, schema) {
    if (!schema || typeof schema !== 'object') {
      return false;
    }

    let isValid = true;

    for (const fieldName of Object.keys(schema)) {
      const field = schema[fieldName];

      // Handle simplified format (array of variations)
      if (Array.isArray(field)) {
        if (field.length === 0) {
          this.validationErrors.push(
            `Schema "${schemaName}", Field "${fieldName}": Variations array is empty`
          );
          isValid = false;
          continue;
        }

        // Validate that variations are strings
        for (let i = 0; i < field.length; i++) {
          const variation = field[i];
          if (typeof variation !== 'string') {
            this.validationErrors.push(
              `Schema "${schemaName}", Field "${fieldName}": Variation at index ${i} is not a string`
            );
            isValid = false;
          }
        }
        continue;
      }

      if (!field || typeof field !== 'object') {
        continue;
      }

      // Requirement 10.4: Check common_variations exists and has content
      if (!Array.isArray(field.common_variations)) {
        this.validationErrors.push(
          `Schema "${schemaName}", Field "${fieldName}": Missing or invalid "common_variations" array`
        );
        isValid = false;
        continue;
      }

      if (field.common_variations.length === 0) {
        this.validationErrors.push(
          `Schema "${schemaName}", Field "${fieldName}": "common_variations" array is empty`
        );
        isValid = false;
        continue;
      }

      // Validate that variations are strings
      for (let i = 0; i < field.common_variations.length; i++) {
        const variation = field.common_variations[i];
        if (typeof variation !== 'string') {
          this.validationErrors.push(
            `Schema "${schemaName}", Field "${fieldName}": Variation at index ${i} is not a string`
          );
          isValid = false;
        }
      }

      // Check that the field name itself is included in variations (common pattern)
      if (!field.common_variations.includes(fieldName)) {
        // This is a warning, not an error - some schemas may have different patterns
        // We don't mark as invalid, just note it
      }
    }

    return isValid;
  }

  /**
   * Validate all schemas in the configuration file
   * Runs all validation checks and collects errors
   * @returns {Object} Validation result with success flag and errors
   */
  validateAllSchemas() {
    this.validationErrors = [];

    try {
      // Load schemas
      this.loadSchemas();

      // Validate schema count
      const countValid = this.validateSchemaCount();

      // Validate each schema
      const schemaNames = Object.keys(this.schemas);
      let allSchemasValid = true;

      for (const schemaName of schemaNames) {
        const schema = this.schemas[schemaName];

        const structureValid = this.validateSchemaStructure(schemaName, schema);
        const mappingsValid = this.validateFieldMappings(schemaName, schema);

        if (!structureValid || !mappingsValid) {
          allSchemasValid = false;
        }
      }

      const success = countValid && allSchemasValid;

      return {
        success,
        schemaCount: schemaNames.length,
        errors: this.validationErrors,
        message: success
          ? `Schema validation passed: ${schemaNames.length} schemas validated successfully`
          : `Schema validation failed with ${this.validationErrors.length} error(s)`
      };
    } catch (error) {
      return {
        success: false,
        schemaCount: 0,
        errors: [error.message],
        message: `Schema validation failed: ${error.message}`
      };
    }
  }

  /**
   * Get validation errors
   * @returns {Array<string>} List of validation errors
   */
  getErrors() {
    return this.validationErrors;
  }

  /**
   * Clear validation errors
   */
  clearErrors() {
    this.validationErrors = [];
  }
}

module.exports = SchemaValidator;
