# Schema Validator

Schema validation module for the Knowledge Graph system.

## Overview

The Schema Validator ensures that the schema configuration file (`kg/field_normalizer/schema_field_mappings_full.json`) contains valid schema definitions with proper structure and field mappings.

## Requirements Validated

- **Requirement 10.1**: Verifies at least 412 schema definitions exist
- **Requirement 10.2**: Validates each schema has required field definitions
- **Requirement 10.3**: Verifies each schema has at least 5 core fields
- **Requirement 10.4**: Validates field mappings include common variations

## Usage

```javascript
const SchemaValidator = require('./kg/validation/schema_validator');

const validator = new SchemaValidator();
const result = validator.validateAllSchemas();

if (result.success) {
  console.log(`✓ ${result.message}`);
  console.log(`  Schema count: ${result.schemaCount}`);
} else {
  console.error(`✗ ${result.message}`);
  console.error('Errors:');
  result.errors.forEach(err => console.error(`  - ${err}`));
}
```

## API

### `loadSchemas()`
Loads schemas from the JSON configuration file.

**Returns:** `Object` - The loaded schemas

**Throws:** Error if file cannot be loaded or parsed

### `validateSchemaCount()`
Validates that at least 412 schemas are defined.

**Returns:** `boolean` - True if count is valid

### `validateSchemaStructure(schemaName, schema)`
Validates the structure of a single schema.

**Parameters:**
- `schemaName` (string) - Name of the schema
- `schema` (Object) - Schema object to validate

**Returns:** `boolean` - True if structure is valid

**Validates:**
- At least 5 core fields are defined
- Each field (if object format) has: `common_variations`, `weight`, `required`, `description`
- Property types are correct
- Supports both full format (object) and simplified format (array) fields

### `validateFieldMappings(schemaName, schema)`
Validates field mappings and variations.

**Parameters:**
- `schemaName` (string) - Name of the schema
- `schema` (Object) - Schema object to validate

**Returns:** `boolean` - True if mappings are valid

**Validates:**
- `common_variations` arrays exist and contain strings
- Simplified format (array) fields contain valid variations
- Variation arrays are not empty

### `validateAllSchemas()`
Validates all schemas in the configuration file.

**Returns:** `Object` with:
- `success` (boolean) - Overall validation result
- `schemaCount` (number) - Number of schemas found
- `errors` (Array<string>) - List of validation errors
- `message` (string) - Summary message

### `getErrors()`
Returns the list of validation errors.

**Returns:** `Array<string>` - List of error messages

### `clearErrors()`
Clears all validation errors.

## Schema Format

The validator supports two field formats:

### Full Format (Object)
```json
{
  "FieldName": {
    "common_variations": ["FieldName", "field_name", "FIELDNAME"],
    "weight": 0.5,
    "required": true,
    "description": "Field description"
  }
}
```

### Simplified Format (Array)
```json
{
  "FieldName": ["Variation1", "Variation2", "Variation3"]
}
```

## Testing

Run the unit tests:

```bash
npx jest kg/validation/__tests__/schema_validator.test.js
```

## Integration

The validator is integrated into:
- System startup (validates schemas on boot)
- KG build process (prevents building with invalid schemas)

See tasks 13.2 and 13.3 for integration details.
