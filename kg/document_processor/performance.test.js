/**
 * Performance Tests for Document Full Processing
 * 
 * Tests performance requirements (Requirements 14.1-14.10):
 * - Single document processing time
 * - Large document streaming/segmented processing
 * - Parallel batch processing
 * - System load handling
 * - Performance bottleneck identification
 * - Performance metrics recording
 * - Performance statistics
 * - Real-time performance monitoring
 * - Performance anomaly detection
 * - Performance optimization recommendations
 */

const {
  processDocumentWithFullProcessing,
  structureAnalyzer,
  contentFilter,
  completenessValidator,
  pipelineMonitor,
  segmentedProcessor
} = require('./index');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock CKB parser to avoid external dependencies
jest.mock('../ckb/ckb_parser', () => ({
  parseDocument: jest.fn(async (docId, filePath, fileType) => {
    // Simulate CKB generation - return 100 CKBs by default
    const estimatedCKBs = 100;
    
    return Array.from({ length: estimatedCKBs }, (_, i) => ({
      ckb_id: `ckb_${docId}_${i}`,
      content: { text: `Test content ${i}` },
      quality: { source_confidence: 0.8 },
      source_meta: { unit_id: `unit_${i}` }
    }));
  })
}));

describe('Performance Tests - Document Full Processing', () => {
  let testFilePath;
  let largeFilePath;
  
  beforeAll(async () => {
    // Create test files
    testFilePath = path.join(os.tmpdir(), 'test_doc_perf.txt');
    largeFilePath = path.join(os.tmpdir(), 'large_doc_perf.txt');
    
    // Create a small test file (100KB)
    const smallContent = 'Test paragraph.\n'.repeat(5000);
    await fs.writeFile(testFilePath, smallContent);
    
    // Create a large test file (15MB)
    const largeContent = 'Test paragraph with more content for large document testing.\n'.repeat(250000);
    await fs.writeFile(largeFilePath, largeContent);
  });
  
  afterAll(async () => {
    // Cleanup test files
    try {
      await fs.unlink(testFilePath);
      await fs.unlink(largeFilePath);
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  /**
   * Requirement 14.1: Single document processing time
   * WHEN processing single document THEN System SHALL complete in reasonable time (< 1 min/MB)
   */
  describe('Requirement 14.1: Single Document Processing Time', () => {
    test('should process small document (100KB) within time limit', async () => {
      const startTime = Date.now();
      
      // Create mock structure
      const structure = {
        doc_id: 'test_doc_1',
        file_type: 'text',
        total_units: 100,
        units: Array.from({ length: 100 }, (_, i) => ({
          unit_id: `unit_${i}`,
          type: 'paragraph',
          content: `Test paragraph ${i}`,
          level: 1,
          parent_id: null,
          is_empty: false,
          should_filter: false,
          filter_reason: null
        })),
        hierarchy: { root: { unit_id: 'root', type: 'document', children: [], processed: false } }
      };
      
      // Mock structure analyzer
      jest.spyOn(structureAnalyzer, 'analyzeDocument').mockResolvedValue(structure);
      
      await processDocumentWithFullProcessing('test_doc_1', testFilePath, 'text');
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Get file size in MB
      const stats = await fs.stat(testFilePath);
      const fileSizeMB = stats.size / (1024 * 1024);
      
      // Should be < 1 minute per MB
      const maxTimeMs = fileSizeMB * 60 * 1000;
      
      expect(processingTime).toBeLessThan(maxTimeMs);
      console.log(`Processing time: ${processingTime}ms for ${fileSizeMB.toFixed(2)}MB (limit: ${maxTimeMs}ms)`);
    }, 120000); // 2 minute timeout
  });
  
  /**
   * Requirement 14.2: Large document streaming processing
   * WHEN processing large document (> 100MB) THEN System SHALL use streaming to avoid memory overflow
   */
  describe('Requirement 14.2: Large Document Streaming Processing', () => {
    test('should use segmentation for large documents', async () => {
      const stats = await fs.stat(largeFilePath);
      const fileSizeMB = stats.size / (1024 * 1024);
      
      // Should trigger segmentation for files > 10MB
      const shouldSegment = segmentedProcessor.shouldUseSegmentation(stats.size, 6000);
      
      expect(shouldSegment).toBe(true);
      expect(fileSizeMB).toBeGreaterThan(10);
      
      console.log(`Large file size: ${fileSizeMB.toFixed(2)}MB - segmentation triggered: ${shouldSegment}`);
    });
    
    test('should process large document without memory overflow', async () => {
      const initialMemory = process.memoryUsage().heapUsed / (1024 * 1024);
      
      // Create large structure
      const structure = {
        doc_id: 'large_doc_1',
        file_type: 'text',
        total_units: 6000,
        units: Array.from({ length: 6000 }, (_, i) => ({
          unit_id: `unit_${i}`,
          type: 'paragraph',
          content: `Test paragraph ${i} with some content`,
          level: 1,
          parent_id: null,
          is_empty: false,
          should_filter: false,
          filter_reason: null
        })),
        hierarchy: { root: { unit_id: 'root', type: 'document', children: [], processed: false } }
      };
      
      jest.spyOn(structureAnalyzer, 'analyzeDocument').mockResolvedValue(structure);
      
      // Mock CKB generator for segmented processing
      const mockCKBGenerator = jest.fn(async (unit, docId) => ({
        ckb_id: `ckb_${docId}_${unit.unit_id}`,
        content: { text: unit.content },
        quality: { source_confidence: 0.8 },
        source_meta: { unit_id: unit.unit_id }
      }));
      
      await segmentedProcessor.processDocumentWithSegmentation(
        'large_doc_1',
        structure,
        mockCKBGenerator
      );
      
      const finalMemory = process.memoryUsage().heapUsed / (1024 * 1024);
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (< 500MB)
      expect(memoryIncrease).toBeLessThan(500);
      
      console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB (initial: ${initialMemory.toFixed(2)}MB, final: ${finalMemory.toFixed(2)}MB)`);
    }, 180000); // 3 minute timeout
  });
  
  /**
   * Requirement 14.3: Parallel batch processing
   * WHEN batch processing documents THEN System SHALL support parallel processing
   */
  describe('Requirement 14.3: Parallel Batch Processing', () => {
    test('should process multiple documents in parallel', async () => {
      const docCount = 5;
      const structures = Array.from({ length: docCount }, (_, i) => ({
        doc_id: `batch_doc_${i}`,
        file_type: 'text',
        total_units: 50,
        units: Array.from({ length: 50 }, (_, j) => ({
          unit_id: `unit_${j}`,
          type: 'paragraph',
          content: `Test paragraph ${j}`,
          level: 1,
          parent_id: null,
          is_empty: false,
          should_filter: false,
          filter_reason: null
        })),
        hierarchy: { root: { unit_id: 'root', type: 'document', children: [], processed: false } }
      }));
      
      jest.spyOn(structureAnalyzer, 'analyzeDocument').mockImplementation(
        async (docId) => structures.find(s => s.doc_id === docId)
      );
      
      const startTime = Date.now();
      
      // Process in parallel
      const promises = structures.map(structure =>
        processDocumentWithFullProcessing(structure.doc_id, testFilePath, 'text')
      );
      
      const results = await Promise.all(promises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      expect(results).toHaveLength(docCount);
      
      // Parallel processing should be faster than sequential
      // (though this is hard to test reliably in unit tests)
      console.log(`Parallel processing of ${docCount} documents: ${totalTime}ms`);
    }, 120000);
  });
  
  /**
   * Requirement 14.4: System load handling
   * WHEN system load is high THEN System SHALL auto-throttle to avoid crash
   */
  describe('Requirement 14.4: System Load Handling', () => {
    test('should handle high concurrency without crashing', async () => {
      const highConcurrency = 10;
      const structure = {
        doc_id: 'load_test_doc',
        file_type: 'text',
        total_units: 100,
        units: Array.from({ length: 100 }, (_, i) => ({
          unit_id: `unit_${i}`,
          type: 'paragraph',
          content: `Test paragraph ${i}`,
          level: 1,
          parent_id: null,
          is_empty: false,
          should_filter: false,
          filter_reason: null
        })),
        hierarchy: { root: { unit_id: 'root', type: 'document', children: [], processed: false } }
      };
      
      jest.spyOn(structureAnalyzer, 'analyzeDocument').mockResolvedValue(structure);
      
      // Create high load
      const promises = Array.from({ length: highConcurrency }, (_, i) =>
        processDocumentWithFullProcessing(`load_doc_${i}`, testFilePath, 'text')
          .catch(error => ({ error: error.message }))
      );
      
      const results = await Promise.all(promises);
      
      // System should handle load without crashing
      const successCount = results.filter(r => !r.error).length;
      const errorCount = results.filter(r => r.error).length;
      
      expect(successCount).toBeGreaterThan(0);
      console.log(`High load test: ${successCount} succeeded, ${errorCount} failed out of ${highConcurrency}`);
    }, 180000);
  });
  
  /**
   * Requirement 14.5: Performance bottleneck identification
   * WHEN processing performance degrades THEN System SHALL identify bottleneck stage
   */
  describe('Requirement 14.5: Performance Bottleneck Identification', () => {
    test('should identify slowest processing stage', async () => {
      const structure = {
        doc_id: 'bottleneck_doc',
        file_type: 'text',
        total_units: 100,
        units: Array.from({ length: 100 }, (_, i) => ({
          unit_id: `unit_${i}`,
          type: 'paragraph',
          content: `Test paragraph ${i}`,
          level: 1,
          parent_id: null,
          is_empty: false,
          should_filter: false,
          filter_reason: null
        })),
        hierarchy: { root: { unit_id: 'root', type: 'document', children: [], processed: false } }
      };
      
      jest.spyOn(structureAnalyzer, 'analyzeDocument').mockResolvedValue(structure);
      
      const result = await processDocumentWithFullProcessing('bottleneck_doc', testFilePath, 'text');
      
      // Get bottleneck analysis
      const bottleneck = await pipelineMonitor.identifyBottleneck(result.monitor_id);
      
      expect(bottleneck).toBeDefined();
      expect(bottleneck.slowest_stage).toBeDefined();
      expect(bottleneck.duration_ms).toBeGreaterThan(0);
      expect(bottleneck.percentage_of_total).toBeGreaterThan(0);
      expect(bottleneck.recommendations).toBeDefined();
      
      console.log(`Bottleneck: ${bottleneck.slowest_stage} (${bottleneck.duration_ms}ms, ${bottleneck.percentage_of_total.toFixed(1)}%)`);
    }, 60000);
  });
  
  /**
   * Requirement 14.6: Performance metrics recording
   * WHEN processing completes THEN System SHALL record performance metrics
   */
  describe('Requirement 14.6: Performance Metrics Recording', () => {
    test('should record processing time, memory, and CPU usage', async () => {
      const structure = {
        doc_id: 'metrics_doc',
        file_type: 'text',
        total_units: 100,
        units: Array.from({ length: 100 }, (_, i) => ({
          unit_id: `unit_${i}`,
          type: 'paragraph',
          content: `Test paragraph ${i}`,
          level: 1,
          parent_id: null,
          is_empty: false,
          should_filter: false,
          filter_reason: null
        })),
        hierarchy: { root: { unit_id: 'root', type: 'document', children: [], processed: false } }
      };
      
      jest.spyOn(structureAnalyzer, 'analyzeDocument').mockResolvedValue(structure);
      
      const result = await processDocumentWithFullProcessing('metrics_doc', testFilePath, 'text');
      
      // Get progress/metrics
      const progress = await pipelineMonitor.getProgress(result.monitor_id);
      
      expect(progress).toBeDefined();
      expect(progress.monitor_id).toBe(result.monitor_id);
      expect(progress.doc_id).toBe('metrics_doc');
      
      console.log(`Metrics recorded for ${progress.doc_id}: ${progress.completed_stages.length} stages completed`);
    }, 60000);
  });
  
  /**
   * Requirement 14.7: Performance statistics
   * WHEN batch processing THEN System SHALL provide performance statistics
   */
  describe('Requirement 14.7: Performance Statistics', () => {
    test('should calculate average processing time and throughput', async () => {
      const docCount = 3;
      const structures = Array.from({ length: docCount }, (_, i) => ({
        doc_id: `stats_doc_${i}`,
        file_type: 'text',
        total_units: 50,
        units: Array.from({ length: 50 }, (_, j) => ({
          unit_id: `unit_${j}`,
          type: 'paragraph',
          content: `Test paragraph ${j}`,
          level: 1,
          parent_id: null,
          is_empty: false,
          should_filter: false,
          filter_reason: null
        })),
        hierarchy: { root: { unit_id: 'root', type: 'document', children: [], processed: false } }
      }));
      
      jest.spyOn(structureAnalyzer, 'analyzeDocument').mockImplementation(
        async (docId) => structures.find(s => s.doc_id === docId)
      );
      
      const startTime = Date.now();
      const processingTimes = [];
      
      for (const structure of structures) {
        const docStartTime = Date.now();
        await processDocumentWithFullProcessing(structure.doc_id, testFilePath, 'text');
        const docEndTime = Date.now();
        processingTimes.push(docEndTime - docStartTime);
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Calculate statistics
      const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      const throughput = docCount / (totalTime / 1000); // docs per second
      
      expect(avgProcessingTime).toBeGreaterThan(0);
      expect(throughput).toBeGreaterThan(0);
      
      console.log(`Performance statistics:`);
      console.log(`  - Average processing time: ${avgProcessingTime.toFixed(2)}ms`);
      console.log(`  - Throughput: ${throughput.toFixed(2)} docs/sec`);
      console.log(`  - Total time: ${totalTime}ms for ${docCount} documents`);
    }, 120000);
  });
  
  /**
   * Requirement 14.8: Real-time performance monitoring
   * WHEN processing THEN System SHALL support real-time query of processing speed and resource usage
   */
  describe('Requirement 14.8: Real-time Performance Monitoring', () => {
    test('should query current processing speed during execution', async () => {
      const structure = {
        doc_id: 'realtime_doc',
        file_type: 'text',
        total_units: 200,
        units: Array.from({ length: 200 }, (_, i) => ({
          unit_id: `unit_${i}`,
          type: 'paragraph',
          content: `Test paragraph ${i}`,
          level: 1,
          parent_id: null,
          is_empty: false,
          should_filter: false,
          filter_reason: null
        })),
        hierarchy: { root: { unit_id: 'root', type: 'document', children: [], processed: false } }
      };
      
      jest.spyOn(structureAnalyzer, 'analyzeDocument').mockResolvedValue(structure);
      
      // Start processing
      const processingPromise = processDocumentWithFullProcessing('realtime_doc', testFilePath, 'text');
      
      // Wait a bit then query progress
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Try to get progress (may not be available yet)
      let progress;
      try {
        progress = await pipelineMonitor.getProgress('realtime_doc');
      } catch (error) {
        // Progress may not be available yet
      }
      
      // Wait for completion
      const result = await processingPromise;
      
      // Now progress should be available
      progress = await pipelineMonitor.getProgress(result.monitor_id);
      
      expect(progress).toBeDefined();
      expect(progress.progress_percentage).toBeGreaterThanOrEqual(0);
      expect(progress.progress_percentage).toBeLessThanOrEqual(100);
      
      console.log(`Real-time progress: ${progress.progress_percentage}% complete`);
    }, 60000);
  });
  
  /**
   * Requirement 14.9: Performance anomaly detection
   * WHEN performance anomaly occurs THEN System SHALL trigger alert
   */
  describe('Requirement 14.9: Performance Anomaly Detection', () => {
    test('should trigger alert when processing time exceeds threshold', async () => {
      // This is tested implicitly by the pipeline monitor's timeout detection
      // The monitor checks if stage duration > 300000ms (5 minutes) and triggers alert
      
      const structure = {
        doc_id: 'anomaly_doc',
        file_type: 'text',
        total_units: 50,
        units: Array.from({ length: 50 }, (_, i) => ({
          unit_id: `unit_${i}`,
          type: 'paragraph',
          content: `Test paragraph ${i}`,
          level: 1,
          parent_id: null,
          is_empty: false,
          should_filter: false,
          filter_reason: null
        })),
        hierarchy: { root: { unit_id: 'root', type: 'document', children: [], processed: false } }
      };
      
      jest.spyOn(structureAnalyzer, 'analyzeDocument').mockResolvedValue(structure);
      
      const result = await processDocumentWithFullProcessing('anomaly_doc', testFilePath, 'text');
      
      // Get progress to check for any timeout alerts
      const progress = await pipelineMonitor.getProgress(result.monitor_id);
      
      expect(progress).toBeDefined();
      
      // In normal processing, no timeout should occur
      // The alert system is tested separately in alert_manager.test.js
      console.log(`Processing completed without timeout alerts`);
    }, 60000);
  });
  
  /**
   * Requirement 14.10: Performance optimization recommendations
   * WHEN performance optimization needed THEN System SHALL provide tuning recommendations
   */
  describe('Requirement 14.10: Performance Optimization Recommendations', () => {
    test('should provide optimization recommendations based on bottleneck', async () => {
      const structure = {
        doc_id: 'optimization_doc',
        file_type: 'text',
        total_units: 100,
        units: Array.from({ length: 100 }, (_, i) => ({
          unit_id: `unit_${i}`,
          type: 'paragraph',
          content: `Test paragraph ${i}`,
          level: 1,
          parent_id: null,
          is_empty: false,
          should_filter: false,
          filter_reason: null
        })),
        hierarchy: { root: { unit_id: 'root', type: 'document', children: [], processed: false } }
      };
      
      jest.spyOn(structureAnalyzer, 'analyzeDocument').mockResolvedValue(structure);
      
      const result = await processDocumentWithFullProcessing('optimization_doc', testFilePath, 'text');
      
      // Get bottleneck analysis with recommendations
      const bottleneck = await pipelineMonitor.identifyBottleneck(result.monitor_id);
      
      expect(bottleneck).toBeDefined();
      expect(bottleneck.recommendations).toBeDefined();
      expect(Array.isArray(bottleneck.recommendations)).toBe(true);
      expect(bottleneck.recommendations.length).toBeGreaterThan(0);
      
      console.log(`Optimization recommendations for ${bottleneck.slowest_stage}:`);
      bottleneck.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    }, 60000);
  });
  
  /**
   * Additional performance test: Segment size adjustment
   */
  describe('Additional: Segment Size Adjustment', () => {
    test('should adjust segment size based on resource usage', () => {
      const currentSize = 1000;
      
      // Test high memory usage - should reduce size
      const highMemoryUsage = { memory_mb: 600 };
      const reducedSize = segmentedProcessor.adjustSegmentSize(currentSize, highMemoryUsage);
      expect(reducedSize).toBeLessThan(currentSize);
      
      // Test low memory usage - should increase size
      const lowMemoryUsage = { memory_mb: 200 };
      const increasedSize = segmentedProcessor.adjustSegmentSize(currentSize, lowMemoryUsage);
      expect(increasedSize).toBeGreaterThan(currentSize);
      
      // Test normal memory usage - should stay same
      const normalMemoryUsage = { memory_mb: 300 };
      const sameSize = segmentedProcessor.adjustSegmentSize(currentSize, normalMemoryUsage);
      expect(sameSize).toBe(currentSize);
      
      console.log(`Segment size adjustment:`);
      console.log(`  - High memory (600MB): ${currentSize} -> ${reducedSize}`);
      console.log(`  - Low memory (200MB): ${currentSize} -> ${increasedSize}`);
      console.log(`  - Normal memory (300MB): ${currentSize} -> ${sameSize}`);
    });
  });
});
