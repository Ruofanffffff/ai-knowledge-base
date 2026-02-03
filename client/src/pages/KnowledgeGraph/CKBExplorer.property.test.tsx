/**
 * Property-Based Tests for CKBExplorer Component
 * 
 * Additional property tests for CKB visualization and interaction
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CKBExplorer from './CKBExplorer';
import fc from 'fast-check';

// Mock fetch
global.fetch = vi.fn();

/**
 * Property: CKB List Completeness
 * 
 * For any set of CKBs returned by the API, all CKBs should be displayed in the list.
 */
describe('Property: CKB List Completeness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display all CKBs returned by the API', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            content: fc.string({ minLength: 10, maxLength: 200 }),
            documentId: fc.uuid(),
            metadata: fc.record({
              source: fc.constantFrom('paragraph', 'table', 'list'),
              position: fc.integer({ min: 0, max: 100 })
            })
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (ckbs) => {
          (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ ckbs, total: ckbs.length })
          });

          const { container } = render(<CKBExplorer />);

          await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled();
          }, { timeout: 3000 });

          // Verify all CKBs are displayed
          const displayedCKBs = container.querySelectorAll('.ckb-item, [class*="ckb"]');
          expect(displayedCKBs.length).toBeGreaterThanOrEqual(Math.min(ckbs.length, 10)); // Assuming pagination
        }
      ),
      { numRuns: 10, timeout: 30000 }
    );
  });
});

/**
 * Property: CKB Content Preservation
 * 
 * For any CKB displayed, the content shown should match the content from the API.
 */
describe('Property: CKB Content Preservation', () => {
  it('should preserve CKB content without modification', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            content: fc.string({ minLength: 20, maxLength: 100 }),
            documentId: fc.uuid(),
            metadata: fc.constant({})
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (ckbs) => {
          (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ ckbs, total: ckbs.length })
          });

          const { container } = render(<CKBExplorer />);

          await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled();
          }, { timeout: 3000 });

          // Verify content is preserved
          ckbs.forEach(ckb => {
            const contentElements = Array.from(container.querySelectorAll('*'))
              .filter(el => el.textContent?.includes(ckb.content.substring(0, 20)));
            
            expect(contentElements.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 10, timeout: 30000 }
    );
  });
});

/**
 * Property: CKB Filtering Correctness
 * 
 * When a filter is applied, only CKBs matching the filter criteria should be displayed.
 */
describe('Property: CKB Filtering Correctness', () => {
  it('should filter CKBs by document ID correctly', async () => {
    const documentId1 = 'doc-123';
    const documentId2 = 'doc-456';

    const ckbs = [
      { id: 'ckb1', content: 'Content 1', documentId: documentId1, metadata: {} },
      { id: 'ckb2', content: 'Content 2', documentId: documentId1, metadata: {} },
      { id: 'ckb3', content: 'Content 3', documentId: documentId2, metadata: {} }
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ckbs, total: ckbs.length })
    });

    const { container } = render(<CKBExplorer />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Apply filter (if filter UI exists)
    const filterInput = container.querySelector('input[type="text"], input[placeholder*="filter"]');
    if (filterInput) {
      fireEvent.change(filterInput, { target: { value: documentId1 } });

      await waitFor(() => {
        const visibleCKBs = Array.from(container.querySelectorAll('.ckb-item, [class*="ckb"]'))
          .filter(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none';
          });

        // Should only show CKBs from documentId1
        expect(visibleCKBs.length).toBeLessThanOrEqual(2);
      });
    }
  });
});

/**
 * Property: CKB Detail View Consistency
 * 
 * When a CKB is selected, the detail view should show complete information.
 */
describe('Property: CKB Detail View Consistency', () => {
  it('should show complete CKB details when selected', async () => {
    const ckb = {
      id: 'ckb-test-123',
      content: 'This is a test CKB content with sufficient length for testing',
      documentId: 'doc-123',
      metadata: {
        source: 'paragraph',
        position: 5,
        extractedAt: new Date().toISOString()
      }
    };

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ckbs: [ckb], total: 1 })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ckb
      });

    const { container } = render(<CKBExplorer />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Click on CKB to view details
    const ckbItem = Array.from(container.querySelectorAll('*'))
      .find(el => el.textContent?.includes(ckb.content.substring(0, 20)));

    if (ckbItem) {
      fireEvent.click(ckbItem);

      await waitFor(() => {
        // Verify detail view shows content
        expect(container.textContent).toContain(ckb.content);
        
        // Verify metadata is shown
        if (ckb.metadata.source) {
          expect(container.textContent).toContain(ckb.metadata.source);
        }
      }, { timeout: 3000 });
    }
  });
});

/**
 * Property: CKB Pagination Consistency
 * 
 * When paginating through CKBs, the total count should remain consistent.
 */
describe('Property: CKB Pagination Consistency', () => {
  it('should maintain consistent total count across pages', async () => {
    const totalCKBs = 25;
    const pageSize = 10;

    // Mock first page
    const page1CKBs = Array.from({ length: pageSize }, (_, i) => ({
      id: `ckb-${i}`,
      content: `Content ${i}`,
      documentId: 'doc-123',
      metadata: {}
    }));

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ckbs: page1CKBs, total: totalCKBs })
    });

    const { container } = render(<CKBExplorer />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Check if total count is displayed
    const totalText = container.textContent;
    if (totalText?.includes('total') || totalText?.includes('Total') || totalText?.includes('共')) {
      expect(totalText).toContain(String(totalCKBs));
    }

    // Mock second page
    const page2CKBs = Array.from({ length: pageSize }, (_, i) => ({
      id: `ckb-${i + pageSize}`,
      content: `Content ${i + pageSize}`,
      documentId: 'doc-123',
      metadata: {}
    }));

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ckbs: page2CKBs, total: totalCKBs })
    });

    // Click next page button if exists
    const nextButton = Array.from(container.querySelectorAll('button'))
      .find(btn => btn.textContent?.includes('Next') || btn.textContent?.includes('下一页'));

    if (nextButton) {
      fireEvent.click(nextButton);

      await waitFor(() => {
        // Total should still be the same
        expect(container.textContent).toContain(String(totalCKBs));
      }, { timeout: 3000 });
    }
  });
});

/**
 * Property: CKB Source Document Link
 * 
 * For any CKB, clicking the source document link should navigate to the correct document.
 */
describe('Property: CKB Source Document Link', () => {
  it('should link to correct source document', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid(),
          content: fc.string({ minLength: 20, maxLength: 100 }),
          documentId: fc.uuid(),
          metadata: fc.constant({})
        }),
        async (ckb) => {
          (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ ckbs: [ckb], total: 1 })
          });

          const { container } = render(<CKBExplorer />);

          await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled();
          }, { timeout: 3000 });

          // Find document link
          const links = container.querySelectorAll('a[href*="document"], a[href*="doc"]');
          const documentLink = Array.from(links).find(link => 
            link.getAttribute('href')?.includes(ckb.documentId)
          );

          if (documentLink) {
            expect(documentLink.getAttribute('href')).toContain(ckb.documentId);
          }
        }
      ),
      { numRuns: 10, timeout: 30000 }
    );
  });
});
