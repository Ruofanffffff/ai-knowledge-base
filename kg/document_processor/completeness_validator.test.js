/**
 * Unit Tests for Completeness Validator
 * 
 * Tests coverage calculation, missing unit identification, 
 * low quality CKB detection, and warning generation
 */

const completenessValidator = require('./completeness_validator');

describe('Completeness Validator - Unit Tests', () => {
  
  describe('calculateCoverage', () => {
    test('should return 1.0 for zero total units', () => {
      const coverage = completenessValidator.calculateCoverage(0, 0, 0);
      expect(coverage).toBe(1.0);
    });
    
    test('should calculate correct coverage for complete processing', () => {
      const coverage = completenessValidator.calculateCoverage(100, 80, 20);
      expect(coverage).toBe(1.0);
    });
    
    test('should calculate correct coverage for incomplete processing', () => {
      const coverage = completenessValidator.calculateCoverage(100, 70, 20);
      expect(coverage).toBe(0.9);
    });
    
    test('should handle case with no skipped units', () => {
      const coverage = completenessValidator.calculateCoverage(50, 50, 0);
      expect(coverage).toBe(1.0);
    });
    
    test('should handle case with no CKBs', () => {
      const coverage = completenessValidator.calculateCoverage(50, 0, 30);
      expect(coverage).toBe(0.6);
    });
    
    test('should return coverage less than 1 when units are missing', () => {
      const coverage = completenessValidator.calculateCoverage(100, 50, 30);
      expect(coverage).toBe(0.8);
      expect(coverage).toBeLessThan(1.0);
    });
  });
  
  describe('identifyMissingUnits', () => {
    test('should identify units without CKBs', () => {
      const structure = {
        units: [
          { unit_id: 'u1', content: 'Content 1', should_filter: false, is_empty: false },
          { unit_id: 'u2', content: 'Content 2', should_filter: false, is_empty: false },
          { unit_id: 'u3', content: 'Content 3', should_filter: false, is_empty: false }
        ]
      };
      
      const ckbs = [
        { sourceMeta: JSON.stringify({ unit_id: 'u1' }) }
      ];
      
      const missing = completenessValidator.identifyMissingUnits(structure, ckbs);
      expect(missing).toHaveLength(2);
      expect(missing.map(u => u.unit_id)).toEqual(['u2', 'u3']);
    });
    
    test('should not include filtered units as missing', () => {
      const structure = {
        units: [
          { unit_id: 'u1', content: 'Content 1', should_filter: false, is_empty: false },
          { unit_id: 'u2', content: '', should_filter: true, is_empty: true },
          { unit_id: 'u3', content: 'Content 3', should_filter: false, is_empty: false }
        ]
      };
      
      const ckbs = [
        { sourceMeta: JSON.stringify({ unit_id: 'u1' }) }
      ];
      
      const missing = completenessValidator.identifyMissingUnits(structure, ckbs);
      expect(missing).toHaveLength(1);
      expect(missing[0].unit_id).toBe('u3');
    });
    
    test('should not include empty units as missing', () => {
      const structure = {
        units: [
          { unit_id: 'u1', content: 'Content 1', should_filter: false, is_empty: false },
          { unit_id: 'u2', content: '', should_filter: false, is_empty: true }
        ]
      };
      
      const ckbs = [
        { sourceMeta: JSON.stringify({ unit_id: 'u1' }) }
      ];
      
      const missing = completenessValidator.identifyMissingUnits(structure, ckbs);
      expect(missing).toHaveLength(0);
    });
    
    test('should return empty array when all units have CKBs', () => {
      const structure = {
        units: [
          { unit_id: 'u1', content: 'Content 1', should_filter: false, is_empty: false },
          { unit_id: 'u2', content: 'Content 2', should_filter: false, is_empty: false }
        ]
      };
      
      const ckbs = [
        { sourceMeta: JSON.stringify({ unit_id: 'u1' }) },
        { sourceMeta: JSON.stringify({ unit_id: 'u2' }) }
      ];
      
      const missing = completenessValidator.identifyMissingUnits(structure, ckbs);
      expect(missing).toHaveLength(0);
    });
    
    test('should handle CKBs with object sourceMeta', () => {
      const structure = {
        units: [
          { unit_id: 'u1', content: 'Content 1', should_filter: false, is_empty: false },
          { unit_id: 'u2', content: 'Content 2', should_filter: false, is_empty: false }
        ]
      };
      
      const ckbs = [
        { sourceMeta: { unit_id: 'u1' } }
      ];
      
      const missing = completenessValidator.identifyMissingUnits(structure, ckbs);
      expect(missing).toHaveLength(1);
      expect(missing[0].unit_id).toBe('u2');
    });
  });
  
  describe('validate', () => {
    test('should validate complete processing', async () => {
      const structure = {
        total_units: 10,
        units: [
          ...Array(8).fill(null).map((_, i) => ({
            unit_id: `u${i}`,
            content: `Content ${i}`,
            should_filter: false,
            is_empty: false
          })),
          ...Array(2).fill(null).map((_, i) => ({
            unit_id: `f${i}`,
            content: '',
            should_filter: true,
            is_empty: true
          }))
        ]
      };
      
      const ckbs = Array(8).fill(null).map((_, i) => ({
        sourceMeta: JSON.stringify({ unit_id: `u${i}` }),
        quality: JSON.stringify({ source_confidence: 0.8 })
      }));
      
      const result = await completenessValidator.validate('doc1', structure, ckbs);
      
      expect(result.doc_id).toBe('doc1');
      expect(result.total_structural_units).toBe(10);
      expect(result.ckb_count).toBe(8);
      expect(result.skipped_count).toBe(2);
      expect(result.coverage_rate).toBe(1.0);
      expect(result.missing_units).toHaveLength(0);
      expect(result.low_quality_ckbs).toHaveLength(0);
      expect(result.is_complete).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
    
    test('should detect low coverage', async () => {
      const structure = {
        total_units: 100,
        units: Array(100).fill(null).map((_, i) => ({
          unit_id: `u${i}`,
          content: `Content ${i}`,
          should_filter: false,
          is_empty: false
        }))
      };
      
      const ckbs = Array(80).fill(null).map((_, i) => ({
        sourceMeta: JSON.stringify({ unit_id: `u${i}` }),
        quality: JSON.stringify({ source_confidence: 0.8 })
      }));
      
      const result = await completenessValidator.validate('doc2', structure, ckbs);
      
      expect(result.coverage_rate).toBe(0.8);
      expect(result.is_complete).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('覆盖率');
      expect(result.warnings[0]).toContain('80.0%');
    });
    
    test('should detect low quality CKBs', async () => {
      const structure = {
        total_units: 10,
        units: Array(10).fill(null).map((_, i) => ({
          unit_id: `u${i}`,
          content: `Content ${i}`,
          should_filter: false,
          is_empty: false
        }))
      };
      
      const ckbs = [
        ...Array(7).fill(null).map((_, i) => ({
          sourceMeta: JSON.stringify({ unit_id: `u${i}` }),
          quality: JSON.stringify({ source_confidence: 0.8 })
        })),
        ...Array(3).fill(null).map((_, i) => ({
          sourceMeta: JSON.stringify({ unit_id: `u${i + 7}` }),
          quality: JSON.stringify({ source_confidence: 0.3 })
        }))
      ];
      
      const result = await completenessValidator.validate('doc3', structure, ckbs);
      
      expect(result.low_quality_ckbs).toHaveLength(3);
      expect(result.warnings.some(w => w.includes('低质量'))).toBe(true);
    });
    
    test('should detect missing units', async () => {
      const structure = {
        total_units: 10,
        units: Array(10).fill(null).map((_, i) => ({
          unit_id: `u${i}`,
          content: `Content ${i}`,
          should_filter: false,
          is_empty: false
        }))
      };
      
      const ckbs = Array(7).fill(null).map((_, i) => ({
        sourceMeta: JSON.stringify({ unit_id: `u${i}` }),
        quality: JSON.stringify({ source_confidence: 0.8 })
      }));
      
      const result = await completenessValidator.validate('doc4', structure, ckbs);
      
      expect(result.missing_units).toHaveLength(3);
      expect(result.warnings.some(w => w.includes('未处理'))).toBe(true);
    });
    
    test('should handle CKBs with object quality', async () => {
      const structure = {
        total_units: 5,
        units: Array(5).fill(null).map((_, i) => ({
          unit_id: `u${i}`,
          content: `Content ${i}`,
          should_filter: false,
          is_empty: false
        }))
      };
      
      const ckbs = Array(5).fill(null).map((_, i) => ({
        sourceMeta: JSON.stringify({ unit_id: `u${i}` }),
        quality: { source_confidence: i < 3 ? 0.8 : 0.3 }
      }));
      
      const result = await completenessValidator.validate('doc5', structure, ckbs);
      
      expect(result.low_quality_ckbs).toHaveLength(2);
    });
    
    test('should generate multiple warnings when multiple issues exist', async () => {
      const structure = {
        total_units: 100,
        units: Array(100).fill(null).map((_, i) => ({
          unit_id: `u${i}`,
          content: `Content ${i}`,
          should_filter: false,
          is_empty: false
        }))
      };
      
      const ckbs = [
        ...Array(70).fill(null).map((_, i) => ({
          sourceMeta: JSON.stringify({ unit_id: `u${i}` }),
          quality: JSON.stringify({ source_confidence: 0.8 })
        })),
        ...Array(10).fill(null).map((_, i) => ({
          sourceMeta: JSON.stringify({ unit_id: `u${i + 70}` }),
          quality: JSON.stringify({ source_confidence: 0.3 })
        }))
      ];
      
      const result = await completenessValidator.validate('doc6', structure, ckbs);
      
      expect(result.warnings.length).toBeGreaterThanOrEqual(3);
      expect(result.warnings.some(w => w.includes('覆盖率'))).toBe(true);
      expect(result.warnings.some(w => w.includes('低质量'))).toBe(true);
      expect(result.warnings.some(w => w.includes('未处理'))).toBe(true);
    });
  });
});
