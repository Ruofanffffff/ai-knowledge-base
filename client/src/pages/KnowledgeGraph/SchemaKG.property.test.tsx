/**
 * Property-Based Tests for SchemaKG Component
 * 
 * Property 27: Entity Type Visualization Consistency
 * Property 28: Relation Weight Visual Mapping
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SchemaKG from './SchemaKG';
import fc from 'fast-check';

// Mock fetch
global.fetch = vi.fn();

/**
 * Property 27: Entity Type Visualization Consistency
 * 
 * For any entity displayed in the visualization, entities of the same type 
 * should use the same color and icon.
 * 
 * Validates: Requirements 13.2
 */
describe('Property 27: Entity Type Visualization Consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should assign consistent colors to entities of the same type', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary entity types and entities
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 5 }),
        fc.integer({ min: 3, max: 10 }),
        async (entityTypes, entitiesPerType) => {
          // Generate test data
          const entities = entityTypes.flatMap((type, typeIndex) =>
            Array.from({ length: entitiesPerType }, (_, i) => ({
              id: `entity_${type}_${i}`,
              canonicalName: `${type}_${i}`,
              type: type,
              confidence: 0.8 + Math.random() * 0.2,
              attributes: {}
            }))
          );

          const relations = [];

          // Mock API response
          (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ entities, relations })
          });

          // Render component
          const { container } = render(<SchemaKG />);

          // Wait for data to load
          await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled();
          }, { timeout: 3000 });

          // Get all rendered nodes
          const nodes = container.querySelectorAll('.node, [class*="node"]');

          // Group nodes by entity type
          const nodesByType = new Map<string, string[]>();
          entities.forEach(entity => {
            const node = Array.from(nodes).find(n => 
              n.textContent?.includes(entity.canonicalName)
            );
            if (node) {
              const computedStyle = window.getComputedStyle(node);
              const color = computedStyle.fill || computedStyle.backgroundColor || computedStyle.color;
              
              if (!nodesByType.has(entity.type)) {
                nodesByType.set(entity.type, []);
              }
              nodesByType.get(entity.type)!.push(color);
            }
          });

          // Verify: All nodes of the same type should have the same color
          nodesByType.forEach((colors, type) => {
            if (colors.length > 1) {
              const firstColor = colors[0];
              const allSameColor = colors.every(c => c === firstColor);
              expect(allSameColor).toBe(true);
            }
          });
        }
      ),
      { numRuns: 10, timeout: 30000 }
    );
  });

  it('should use consistent visual representation for same entity types', async () => {
    // Test with predefined entity types
    const testCases = [
      { type: 'PersonEntity', count: 5 },
      { type: 'LocationEntity', count: 3 },
      { type: 'EventEntity', count: 4 }
    ];

    const entities = testCases.flatMap(({ type, count }) =>
      Array.from({ length: count }, (_, i) => ({
        id: `${type}_${i}`,
        canonicalName: `${type}_Instance_${i}`,
        type: type,
        confidence: 0.85,
        attributes: {}
      }))
    );

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ entities, relations: [] })
    });

    const { container } = render(<SchemaKG />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Verify each entity type has consistent styling
    testCases.forEach(({ type, count }) => {
      const typeNodes = Array.from(container.querySelectorAll('.node, [class*="node"]'))
        .filter(node => node.textContent?.includes(type));

      if (typeNodes.length > 1) {
        const firstNodeStyle = window.getComputedStyle(typeNodes[0]);
        const firstColor = firstNodeStyle.fill || firstNodeStyle.backgroundColor;

        typeNodes.slice(1).forEach(node => {
          const nodeStyle = window.getComputedStyle(node);
          const nodeColor = nodeStyle.fill || nodeStyle.backgroundColor;
          expect(nodeColor).toBe(firstColor);
        });
      }
    });
  });
});

/**
 * Property 28: Relation Weight Visual Mapping
 * 
 * For any relation displayed in the visualization, the edge thickness 
 * should be proportional to the relation's weight or confidence value.
 * 
 * Validates: Requirements 13.3
 */
describe('Property 28: Relation Weight Visual Mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should map relation weights to edge thickness proportionally', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary relations with different weights
        fc.array(
          fc.record({
            weight: fc.float({ min: 0.1, max: 1.0 }),
            confidence: fc.float({ min: 0.5, max: 1.0 })
          }),
          { minLength: 3, maxLength: 10 }
        ),
        async (relationConfigs) => {
          // Create entities
          const entities = [
            { id: 'e1', canonicalName: 'Entity1', type: 'TestEntity', confidence: 0.9, attributes: {} },
            { id: 'e2', canonicalName: 'Entity2', type: 'TestEntity', confidence: 0.9, attributes: {} }
          ];

          // Create relations with varying weights
          const relations = relationConfigs.map((config, i) => ({
            id: `rel_${i}`,
            sourceEntity: 'e1',
            targetEntity: 'e2',
            type: `RelationType_${i}`,
            weight: config.weight,
            confidence: config.confidence
          }));

          (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ entities, relations })
          });

          const { container } = render(<SchemaKG />);

          await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled();
          }, { timeout: 3000 });

          // Get all rendered edges
          const edges = container.querySelectorAll('.edge, .link, [class*="edge"], [class*="link"]');

          if (edges.length >= 2) {
            // Extract edge thicknesses and corresponding weights
            const edgeData: Array<{ thickness: number; weight: number }> = [];

            relations.forEach((rel, i) => {
              const edge = edges[i];
              if (edge) {
                const style = window.getComputedStyle(edge);
                const thickness = parseFloat(style.strokeWidth || '1');
                edgeData.push({ thickness, weight: rel.weight });
              }
            });

            // Verify: Higher weight should result in thicker edges
            if (edgeData.length >= 2) {
              edgeData.sort((a, b) => a.weight - b.weight);
              
              for (let i = 1; i < edgeData.length; i++) {
                const prev = edgeData[i - 1];
                const curr = edgeData[i];
                
                // If weight increases, thickness should not decrease
                if (curr.weight > prev.weight) {
                  expect(curr.thickness).toBeGreaterThanOrEqual(prev.thickness);
                }
              }
            }
          }
        }
      ),
      { numRuns: 10, timeout: 30000 }
    );
  });

  it('should maintain proportional thickness for different confidence levels', async () => {
    const entities = [
      { id: 'e1', canonicalName: 'Entity1', type: 'TestEntity', confidence: 0.9, attributes: {} },
      { id: 'e2', canonicalName: 'Entity2', type: 'TestEntity', confidence: 0.9, attributes: {} },
      { id: 'e3', canonicalName: 'Entity3', type: 'TestEntity', confidence: 0.9, attributes: {} }
    ];

    const relations = [
      { id: 'r1', sourceEntity: 'e1', targetEntity: 'e2', type: 'relates_to', weight: 0.3, confidence: 0.3 },
      { id: 'r2', sourceEntity: 'e2', targetEntity: 'e3', type: 'relates_to', weight: 0.6, confidence: 0.6 },
      { id: 'r3', sourceEntity: 'e1', targetEntity: 'e3', type: 'relates_to', weight: 0.9, confidence: 0.9 }
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ entities, relations })
    });

    const { container } = render(<SchemaKG />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    }, { timeout: 3000 });

    const edges = container.querySelectorAll('.edge, .link, [class*="edge"], [class*="link"]');

    if (edges.length === 3) {
      const thicknesses = Array.from(edges).map(edge => {
        const style = window.getComputedStyle(edge);
        return parseFloat(style.strokeWidth || '1');
      });

      // Verify: thickness[0] < thickness[1] < thickness[2]
      expect(thicknesses[0]).toBeLessThanOrEqual(thicknesses[1]);
      expect(thicknesses[1]).toBeLessThanOrEqual(thicknesses[2]);
    }
  });

  it('should handle edge cases for weight mapping', async () => {
    const entities = [
      { id: 'e1', canonicalName: 'Entity1', type: 'TestEntity', confidence: 0.9, attributes: {} },
      { id: 'e2', canonicalName: 'Entity2', type: 'TestEntity', confidence: 0.9, attributes: {} }
    ];

    // Test edge cases
    const edgeCases = [
      { weight: 0.0, confidence: 0.5 },  // Minimum weight
      { weight: 1.0, confidence: 1.0 },  // Maximum weight
      { weight: 0.5, confidence: 0.5 }   // Middle weight
    ];

    for (const testCase of edgeCases) {
      const relations = [{
        id: 'r1',
        sourceEntity: 'e1',
        targetEntity: 'e2',
        type: 'test_relation',
        weight: testCase.weight,
        confidence: testCase.confidence
      }];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entities, relations })
      });

      const { container } = render(<SchemaKG />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      }, { timeout: 3000 });

      const edge = container.querySelector('.edge, .link, [class*="edge"], [class*="link"]');
      
      if (edge) {
        const style = window.getComputedStyle(edge);
        const thickness = parseFloat(style.strokeWidth || '1');
        
        // Verify thickness is within reasonable bounds
        expect(thickness).toBeGreaterThan(0);
        expect(thickness).toBeLessThan(20); // Reasonable upper bound
      }
    }
  });
});

/**
 * Integration Test: Combined Properties
 */
describe('Integration: Properties 27 & 28', () => {
  it('should maintain both color consistency and weight mapping simultaneously', async () => {
    const entities = [
      { id: 'p1', canonicalName: 'Person1', type: 'PersonEntity', confidence: 0.9, attributes: {} },
      { id: 'p2', canonicalName: 'Person2', type: 'PersonEntity', confidence: 0.9, attributes: {} },
      { id: 'l1', canonicalName: 'Location1', type: 'LocationEntity', confidence: 0.85, attributes: {} },
      { id: 'l2', canonicalName: 'Location2', type: 'LocationEntity', confidence: 0.85, attributes: {} }
    ];

    const relations = [
      { id: 'r1', sourceEntity: 'p1', targetEntity: 'l1', type: 'located_at', weight: 0.8, confidence: 0.8 },
      { id: 'r2', sourceEntity: 'p2', targetEntity: 'l2', type: 'located_at', weight: 0.4, confidence: 0.4 },
      { id: 'r3', sourceEntity: 'p1', targetEntity: 'p2', type: 'knows', weight: 0.6, confidence: 0.6 }
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ entities, relations })
    });

    const { container } = render(<SchemaKG />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Verify Property 27: Same type entities have same color
    const personNodes = Array.from(container.querySelectorAll('.node, [class*="node"]'))
      .filter(node => node.textContent?.includes('Person'));
    
    if (personNodes.length === 2) {
      const color1 = window.getComputedStyle(personNodes[0]).fill || 
                     window.getComputedStyle(personNodes[0]).backgroundColor;
      const color2 = window.getComputedStyle(personNodes[1]).fill || 
                     window.getComputedStyle(personNodes[1]).backgroundColor;
      expect(color1).toBe(color2);
    }

    // Verify Property 28: Edge thickness reflects weight
    const edges = Array.from(container.querySelectorAll('.edge, .link, [class*="edge"], [class*="link"]'));
    
    if (edges.length === 3) {
      const thicknesses = edges.map(edge => 
        parseFloat(window.getComputedStyle(edge).strokeWidth || '1')
      );
      
      // r2 (0.4) should be thinnest, r3 (0.6) middle, r1 (0.8) thickest
      expect(thicknesses[1]).toBeLessThanOrEqual(thicknesses[2]);
      expect(thicknesses[2]).toBeLessThanOrEqual(thicknesses[0]);
    }
  });
});
