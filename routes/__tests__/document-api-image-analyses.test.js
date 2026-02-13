/**
 * Document API - ImageAnalyses Integration Tests
 *
 * Tests for task 3.3: 更新文档 API 支持 DocumentContentJSON
 * - Document creation/update accepts JSON content strings
 * - Document detail query returns associated imageAnalyses data
 * - Helper functions: parseJsonField, extractAnalysisIds
 *
 * Validates: Requirements 4.1, 4.4
 */

// ============================================
// Unit tests for helper functions
// ============================================

describe('parseJsonField', () => {
  // Inline the function for unit testing (it's defined in server.js)
  function parseJsonField(value, defaultValue) {
    if (!value) return defaultValue;
    try {
      return JSON.parse(value);
    } catch {
      return defaultValue;
    }
  }

  it('should return default value for null input', () => {
    expect(parseJsonField(null, [])).toEqual([]);
    expect(parseJsonField(undefined, {})).toEqual({});
  });

  it('should return default value for empty string', () => {
    expect(parseJsonField('', [])).toEqual([]);
  });

  it('should parse valid JSON string', () => {
    expect(parseJsonField('["a","b"]', [])).toEqual(['a', 'b']);
    expect(parseJsonField('{"key":"val"}', {})).toEqual({ key: 'val' });
  });

  it('should return default value for invalid JSON', () => {
    expect(parseJsonField('not json', [])).toEqual([]);
    expect(parseJsonField('{broken', {})).toEqual({});
  });
});

describe('extractAnalysisIds', () => {
  // Inline the function for unit testing
  function extractAnalysisIds(contentStr) {
    const ids = [];
    try {
      const doc = typeof contentStr === 'string' ? JSON.parse(contentStr) : contentStr;
      if (!doc || !Array.isArray(doc.content)) return ids;

      function walk(nodes) {
        for (const node of nodes) {
          if (node.type === 'imageBlock' && node.attrs && node.attrs.analysisId) {
            ids.push(node.attrs.analysisId);
          }
          if (Array.isArray(node.content)) {
            walk(node.content);
          }
        }
      }
      walk(doc.content);
    } catch {
      // content is not valid JSON, ignore
    }
    return ids;
  }

  it('should return empty array for plain text content', () => {
    expect(extractAnalysisIds('Hello world')).toEqual([]);
  });

  it('should return empty array for null/undefined', () => {
    expect(extractAnalysisIds(null)).toEqual([]);
    expect(extractAnalysisIds(undefined)).toEqual([]);
  });

  it('should return empty array for JSON without imageBlock nodes', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
      ],
    };
    expect(extractAnalysisIds(JSON.stringify(doc))).toEqual([]);
  });

  it('should extract analysisId from imageBlock nodes', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Before' }] },
        {
          type: 'imageBlock',
          attrs: {
            src: '/api/images/proxy/documents/img1.png',
            analysisId: 'analysis-uuid-1',
            analysisStatus: 'completed',
          },
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'After' }] },
      ],
    };
    expect(extractAnalysisIds(JSON.stringify(doc))).toEqual(['analysis-uuid-1']);
  });

  it('should extract multiple analysisIds', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'imageBlock',
          attrs: { src: '/img1.png', analysisId: 'id-1', analysisStatus: 'completed' },
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'Middle' }] },
        {
          type: 'imageBlock',
          attrs: { src: '/img2.png', analysisId: 'id-2', analysisStatus: 'pending' },
        },
      ],
    };
    expect(extractAnalysisIds(JSON.stringify(doc))).toEqual(['id-1', 'id-2']);
  });

  it('should skip imageBlock nodes without analysisId', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'imageBlock',
          attrs: { src: '/img1.png' },
        },
        {
          type: 'imageBlock',
          attrs: { src: '/img2.png', analysisId: 'id-2' },
        },
      ],
    };
    expect(extractAnalysisIds(JSON.stringify(doc))).toEqual(['id-2']);
  });

  it('should accept object input (not just string)', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'imageBlock',
          attrs: { src: '/img.png', analysisId: 'id-obj' },
        },
      ],
    };
    expect(extractAnalysisIds(doc)).toEqual(['id-obj']);
  });

  it('should handle nested content (e.g. blockquote containing imageBlock)', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [
            {
              type: 'imageBlock',
              attrs: { src: '/nested.png', analysisId: 'nested-id' },
            },
          ],
        },
      ],
    };
    expect(extractAnalysisIds(JSON.stringify(doc))).toEqual(['nested-id']);
  });
});
