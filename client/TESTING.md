# Testing Guide

This document describes the testing strategy, tools, and practices used in the AI Knowledge Base frontend application.

## Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Testing Tools](#testing-tools)
- [Test Types](#test-types)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Property-Based Testing](#property-based-testing)
- [Test Coverage](#test-coverage)
- [Best Practices](#best-practices)

## Testing Philosophy

Our testing approach follows these principles:

1. **Comprehensive Coverage**: Test all critical paths and edge cases
2. **Property-Based Testing**: Use PBT to verify universal properties
3. **Fast Feedback**: Tests should run quickly for rapid development
4. **Maintainable**: Tests should be easy to understand and update
5. **Realistic**: Tests should reflect real-world usage

## Testing Tools

### Core Testing Framework

- **Vitest**: Fast unit test framework with Jest-compatible API
- **React Testing Library**: Test React components from user perspective
- **fast-check**: Property-based testing library

### Additional Tools

- **@testing-library/jest-dom**: Custom matchers for DOM assertions
- **@testing-library/user-event**: Simulate user interactions
- **jsdom**: DOM implementation for Node.js

## Test Types

### 1. Unit Tests

Test individual functions, utilities, and components in isolation.

**Location**: `src/**/*.test.ts(x)`

**Examples**:
- `src/utils/storage.test.ts` - localStorage utilities
- `src/utils/transformers.test.ts` - data transformation functions
- `src/api/auth.test.ts` - authentication API

### 2. Integration Tests

Test how multiple units work together, especially API integration.

**Location**: `src/api/integration.test.ts`

**Examples**:
- Full authentication flow
- Document CRUD operations
- Graph data fetching and transformation

### 3. Component Tests

Test React components with user interactions.

**Location**: `src/components/**/*.test.tsx`

**Examples**:
- `src/components/ErrorModal/ErrorModal.test.tsx`
- `src/components/ProtectedRoute.test.tsx`

### 4. Property-Based Tests

Test properties that should hold for all inputs using fast-check.

**Location**: `src/**/*.property.test.ts(x)`

**Examples**:
- `src/api/api-endpoint-correctness.property.test.ts`
- `src/api/auth-token-persistence.property.test.ts`
- `src/utils/data-transformation.property.test.ts`

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm test
```

### Run Tests Once (CI Mode)

```bash
npm run test:run
```

### Run Tests with UI

```bash
npm run test:ui
```

### Run Specific Test File

```bash
npm test -- src/utils/storage.test.ts
```

### Run Tests Matching Pattern

```bash
npm test -- --grep "authentication"
```

### Run with Coverage

```bash
npm test -- --coverage
```

## Writing Tests

### Unit Test Example

```typescript
// src/utils/storage.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAuthToken, setAuthToken, clearAuthToken } from './storage';

describe('storage utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('getAuthToken', () => {
    it('should return null when no token is stored', () => {
      expect(getAuthToken()).toBeNull();
    });

    it('should return stored token', () => {
      localStorage.setItem('auth_token', 'test-token');
      expect(getAuthToken()).toBe('test-token');
    });
  });

  describe('setAuthToken', () => {
    it('should store token in localStorage', () => {
      setAuthToken('my-token');
      expect(localStorage.getItem('auth_token')).toBe('my-token');
    });
  });

  describe('clearAuthToken', () => {
    it('should remove auth token from localStorage', () => {
      localStorage.setItem('auth_token', 'test-token');
      clearAuthToken();
      expect(localStorage.getItem('auth_token')).toBeNull();
    });
  });
});
```

### API Test Example

```typescript
// src/api/documents.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { documentsApi } from './documents';
import type { Document } from './types';

// Mock the API client
vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('documentsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDocuments', () => {
    it('should fetch all documents using correct endpoint', async () => {
      const mockDocuments: Document[] = [
        {
          id: '1',
          title: 'Document 1',
          content: 'Content 1',
          type: 'text',
          fileType: 'txt',
          metadata: {},
          tags: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockResolvedValue({ data: mockDocuments });

      const result = await documentsApi.getDocuments();

      expect(result).toEqual(mockDocuments);
      expect(apiClient.default.get).toHaveBeenCalledWith('/documents');
    });
  });
});
```

### Component Test Example

```typescript
// src/components/ErrorModal/ErrorModal.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorProvider, useError } from '../../contexts/ErrorContext';
import ErrorModal from './ErrorModal';

describe('ErrorModal', () => {
  it('should not render when no error', () => {
    render(
      <ErrorProvider>
        <ErrorModal />
      </ErrorProvider>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render with correct content', () => {
    const TestComponent = () => {
      const { showError } = useError();
      
      useEffect(() => {
        showError({
          title: 'Test Error',
          message: 'This is a test error',
          type: 'error'
        });
      }, []);

      return <ErrorModal />;
    };

    render(
      <ErrorProvider>
        <TestComponent />
      </ErrorProvider>
    );

    expect(screen.getByText('Test Error')).toBeInTheDocument();
    expect(screen.getByText('This is a test error')).toBeInTheDocument();
  });
});
```

## Property-Based Testing

Property-based testing (PBT) verifies that certain properties hold for all possible inputs, not just specific test cases.

### Why Property-Based Testing?

- **Comprehensive**: Tests thousands of inputs automatically
- **Edge Cases**: Discovers edge cases you might not think of
- **Confidence**: Provides higher confidence in correctness
- **Specification**: Properties serve as executable specifications

### Property Test Example

```typescript
// src/utils/data-transformation.property.test.ts
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { transformEntityToNode, transformNodeToEntity } from './transformers';

describe('Property: Data Transformation Correctness', () => {
  it('should preserve all required fields when transforming entity to node', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary entities
        fc.record({
          id: fc.uuid(),
          canonical_name: fc.string({ minLength: 1, maxLength: 100 }),
          type: fc.constantFrom('ConceptEntity', 'PersonEntity'),
          confidence: fc.double({ min: 0, max: 1 }),
          schemas: fc.array(
            fc.record({
              schema_name: fc.string({ minLength: 1, maxLength: 50 }),
              confidence: fc.double({ min: 0, max: 1 }),
            })
          ),
        }),
        (entity) => {
          const node = transformEntityToNode(entity);

          // Verify all required fields are preserved
          expect(node.id).toBe(entity.id);
          expect(node.label).toBe(entity.canonical_name);
          expect(node.type).toBe(entity.type);
          expect(node.confidence).toBe(entity.confidence);
        }
      ),
      { numRuns: 100 } // Run 100 random test cases
    );
  });

  it('should maintain data integrity in round-trip transformation', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          canonical_name: fc.string({ minLength: 1, maxLength: 100 }),
          type: fc.constantFrom('ConceptEntity', 'PersonEntity'),
          confidence: fc.double({ min: 0, max: 1 }),
          schemas: fc.array(
            fc.record({
              schema_name: fc.string({ minLength: 1, maxLength: 50 }),
              confidence: fc.double({ min: 0, max: 1 }),
            })
          ),
        }),
        (originalEntity) => {
          // Transform: Entity -> Node -> Entity
          const node = transformEntityToNode(originalEntity);
          const backToEntity = transformNodeToEntity(node);

          // Verify essential fields are preserved
          expect(backToEntity.id).toBe(originalEntity.id);
          expect(backToEntity.canonical_name).toBe(originalEntity.canonical_name);
          expect(backToEntity.type).toBe(originalEntity.type);
          expect(backToEntity.confidence).toBe(originalEntity.confidence);
        }
      ),
      { numRuns: 50 }
    );
  });
});
```

### Property Test Patterns

#### 1. Invariant Properties

Properties that should always be true:

```typescript
it('should always return non-negative confidence', () => {
  fc.assert(
    fc.property(fc.anything(), (input) => {
      const result = calculateConfidence(input);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    })
  );
});
```

#### 2. Round-Trip Properties

Data should survive transformation cycles:

```typescript
it('should preserve data in round-trip transformation', () => {
  fc.assert(
    fc.property(fc.record({ /* ... */ }), (original) => {
      const transformed = transform(original);
      const restored = reverseTransform(transformed);
      expect(restored).toEqual(original);
    })
  );
});
```

#### 3. Idempotence Properties

Applying operation multiple times should be same as once:

```typescript
it('should be idempotent', () => {
  fc.assert(
    fc.property(fc.anything(), (input) => {
      const once = normalize(input);
      const twice = normalize(once);
      expect(twice).toEqual(once);
    })
  );
});
```

## Test Coverage

### Current Coverage

- **Unit Tests**: 143 tests passing
- **Property-Based Tests**: 800+ test cases (via fast-check)
- **Test Files**: 16 files
- **Pass Rate**: 100%

### Coverage by Module

| Module | Unit Tests | Property Tests | Integration Tests |
|--------|-----------|----------------|-------------------|
| API Services | ✅ | ✅ | ✅ |
| Utilities | ✅ | ✅ | - |
| Components | ✅ | - | - |
| Hooks | ✅ | - | ✅ |
| Contexts | ✅ | - | - |

### Viewing Coverage Report

```bash
npm test -- --coverage
```

Coverage report will be generated in `coverage/` directory.

## Best Practices

### 1. Test Behavior, Not Implementation

❌ Don't test implementation details:
```typescript
// Bad
expect(component.state.count).toBe(1);
```

✅ Test user-visible behavior:
```typescript
// Good
expect(screen.getByText('Count: 1')).toBeInTheDocument();
```

### 2. Use Descriptive Test Names

```typescript
// Good test names
it('should redirect to login when token is invalid')
it('should display error message when API call fails')
it('should preserve all fields when transforming entity to node')
```

### 3. Arrange-Act-Assert Pattern

```typescript
it('should create document', async () => {
  // Arrange
  const mockDocument = { id: '1', title: 'Test' };
  vi.mocked(apiClient.post).mockResolvedValue({ data: mockDocument });

  // Act
  const result = await documentsApi.createDocument({ title: 'Test' });

  // Assert
  expect(result).toEqual(mockDocument);
  expect(apiClient.post).toHaveBeenCalledWith('/documents', { title: 'Test' });
});
```

### 4. Clean Up After Tests

```typescript
describe('my tests', () => {
  beforeEach(() => {
    // Set up test environment
    localStorage.clear();
  });

  afterEach(() => {
    // Clean up
    vi.clearAllMocks();
    localStorage.clear();
  });
});
```

### 5. Mock External Dependencies

```typescript
// Mock API client
vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock fetch
global.fetch = vi.fn();
```

### 6. Test Edge Cases

```typescript
describe('edge cases', () => {
  it('should handle empty array', () => {
    expect(transform([])).toEqual([]);
  });

  it('should handle null values', () => {
    expect(transform(null)).toBeNull();
  });

  it('should handle very long strings', () => {
    const longString = 'a'.repeat(10000);
    expect(transform(longString)).toBeDefined();
  });
});
```

### 7. Use Property Tests for Complex Logic

For complex transformations, validations, or algorithms, use property-based testing:

```typescript
// Instead of testing specific cases
it('should transform specific entity', () => {
  const entity = { id: '1', canonical_name: 'Test' };
  const node = transformEntityToNode(entity);
  expect(node.label).toBe('Test');
});

// Test the property for all possible inputs
it('should preserve canonical_name as label for all entities', () => {
  fc.assert(
    fc.property(
      fc.record({ id: fc.uuid(), canonical_name: fc.string() }),
      (entity) => {
        const node = transformEntityToNode(entity);
        expect(node.label).toBe(entity.canonical_name);
      }
    )
  );
});
```

## Continuous Integration

Tests run automatically on:
- Every commit
- Every pull request
- Before deployment

### CI Configuration

```yaml
# .github/workflows/ci.yml
- name: Run tests
  run: |
    cd client
    npm test -- --run
```

## Troubleshooting

### Tests Timing Out

If tests timeout:
1. Increase timeout: `npm test -- --timeout=10000`
2. Check for infinite loops
3. Verify async operations complete

### Mock Not Working

If mocks don't work:
1. Ensure mock is defined before import
2. Use `vi.clearAllMocks()` in `beforeEach`
3. Check mock path is correct

### Property Tests Failing

If property tests fail:
1. Review the failing example provided by fast-check
2. Check if property is too strict
3. Verify generators produce valid inputs

## Related Documentation

- [Main README](../README.md)
- [API Integration Guide](./API_INTEGRATION.md)
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [fast-check Documentation](https://fast-check.dev/)
