/**
 * CKB Parser Unit Tests
 */

const { createCKB } = require('./ckb_parser');
const { createCKB: createCKBFactory } = require('./ckb_factory');

describe('CKB Factory', () => {
  test('should create valid CKB with required fields', () => {
    const ckb = createCKBFactory({
      docId: 'test-doc-123',
      sourceType: 'word',
      text: 'This is a test paragraph with some content.'
    });
    
    expect(ckb).toBeDefined();
    expect(ckb.ckb_id).toBeDefined();
    expect(ckb.doc_id).toBe('test-doc-123');
    expect(ckb.source_type).toBe('word');
    expect(ckb.content.text).toBe('This is a test paragraph with some content.');
    expect(ckb.quality).toBeDefined();
    expect(ckb.timestamps).toBeDefined();
  });
  
  test('should calculate quality metrics correctly', () => {
    const ckb = createCKBFactory({
      docId: 'test-doc-123',
      sourceType: 'pdf',
      text: 'Short text',
      sourceConfidence: 0.9
    });
    
    expect(ckb.quality.overall_score).toBeGreaterThan(0);
    expect(ckb.quality.overall_score).toBeLessThanOrEqual(1);
    expect(ckb.quality.source_confidence).toBe(0.9);
  });
  
  test('should throw error when missing required fields', () => {
    expect(() => {
      createCKBFactory({
        text: 'Some text'
      });
    }).toThrow('docId and sourceType are required');
  });
  
  test('should handle empty text', () => {
    const ckb = createCKBFactory({
      docId: 'test-doc-123',
      sourceType: 'word',
      text: ''
    });
    
    expect(ckb).toBeDefined();
    expect(ckb.content.text).toBe('');
  });
  
  test('should include source metadata', () => {
    const sourceMeta = {
      file_name: 'test.docx',
      paragraph_index: 5
    };
    
    const ckb = createCKBFactory({
      docId: 'test-doc-123',
      sourceType: 'word',
      sourceMeta: sourceMeta,
      text: 'Test content'
    });
    
    expect(ckb.source_meta).toEqual(sourceMeta);
  });
  
  test('should include structure information', () => {
    const structure = {
      section_title: 'Introduction',
      level: 1
    };
    
    const ckb = createCKBFactory({
      docId: 'test-doc-123',
      sourceType: 'word',
      structure: structure,
      text: 'Test content'
    });
    
    expect(ckb.structure).toEqual(structure);
  });
});

describe('CKB Parser Integration', () => {
  test('should export createCKB function', () => {
    expect(typeof createCKB).toBe('function');
  });
  
  test('createCKB should work through parser module', () => {
    const ckb = createCKB({
      docId: 'test-doc-123',
      sourceType: 'excel',
      text: 'Test data from Excel'
    });
    
    expect(ckb).toBeDefined();
    expect(ckb.doc_id).toBe('test-doc-123');
    expect(ckb.source_type).toBe('excel');
  });
});
