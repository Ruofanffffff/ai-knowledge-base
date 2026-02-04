# Property Tests for Knowledge Graph Visualization

## Overview

This directory contains property-based tests for the Knowledge Graph visualization components, specifically testing Properties 27 and 28 as defined in the design document.

## Test Files

### 1. SchemaKG.property.test.tsx

Tests for the main Schema Knowledge Graph visualization component.

#### Property 27: Entity Type Visualization Consistency
- **Requirement**: Entities of the same type should use the same color and icon
- **Validates**: Requirements 13.2
- **Test Cases**:
  - Consistent colors for entities of the same type
  - Consistent visual representation across multiple instances
  - Integration with varying entity counts

#### Property 28: Relation Weight Visual Mapping
- **Requirement**: Edge thickness should be proportional to relation weight/confidence
- **Validates**: Requirements 13.3
- **Test Cases**:
  - Proportional thickness mapping for different weights
  - Maintaining proportionality across confidence levels
  - Edge case handling (min/max weights)

### 2. CKBExplorer.property.test.tsx

Tests for the CKB (Common Knowledge Base) Explorer component.

#### Additional Properties Tested:
- **CKB List Completeness**: All CKBs from API should be displayed
- **CKB Content Preservation**: Content should match API data exactly
- **CKB Filtering Correctness**: Filters should work correctly
- **CKB Detail View Consistency**: Detail views should show complete information
- **CKB Pagination Consistency**: Total counts should remain consistent
- **CKB Source Document Link**: Links should navigate to correct documents

## Running the Tests

### Prerequisites

Install dependencies:
```bash
cd client
npm install
```

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
npm test -- SchemaKG.property.test.tsx
```

### Run Tests in UI Mode
```bash
npm run test:ui
```

### Run Tests Once (CI Mode)
```bash
npm run test:run
```

## Test Framework

- **Testing Library**: Vitest + React Testing Library
- **Property-Based Testing**: fast-check
- **Mocking**: Vitest's built-in mocking capabilities

## Test Configuration

The tests are configured in:
- `vitest.config.ts`: Main Vitest configuration
- `src/test/setup.ts`: Test environment setup

## Implementation Notes

### Property 27 Implementation

The tests verify that:
1. Entities are grouped by type
2. Each type has a consistent color scheme
3. The color mapping is maintained across re-renders
4. Multiple instances of the same type use identical styling

### Property 28 Implementation

The tests verify that:
1. Edge thickness increases with weight/confidence
2. The mapping is proportional (not just ordinal)
3. Edge cases (0.0, 1.0) are handled correctly
4. The visual mapping is consistent across different relation types

## Known Limitations

1. **Visual Testing**: These tests verify computed styles but don't capture actual visual rendering. For true visual regression testing, consider tools like Percy or Chromatic.

2. **D3 Rendering**: Some D3-based visualizations may require additional mocking or integration testing approaches.

3. **Async Rendering**: The tests use `waitFor` to handle async rendering, but timing issues may occur in CI environments.

## Future Improvements

1. Add visual regression testing
2. Add performance benchmarks for large graphs
3. Add accessibility (a11y) tests
4. Add interaction tests (drag, zoom, pan)
5. Add responsive design tests

## Related Documentation

- Design Document: `.kiro/specs/schema-driven-knowledge-graph/design.md`
- Requirements: `.kiro/specs/schema-driven-knowledge-graph/requirements.md`
- Component Implementation: `./SchemaKG.tsx`, `./CKBExplorer.tsx`
