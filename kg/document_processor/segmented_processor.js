/**
 * Segmented Processor
 * 
 * Handles segmented processing for large documents
 * Supports parallel processing and failure recovery
 */

const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const contentFilter = require('./content_filter');
const completenessValidator = require('./completeness_validator');
const alertManager = require('./alert_manager');

const prisma = new PrismaClient();

// Configuration
const DEFAULT_SEGMENT_SIZE = 1000;  // units per segment
const DEFAULT_CONCURRENCY = 3;       // parallel segments
const SIZE_THRESHOLD_MB = 10;        // 10MB
const UNIT_COUNT_THRESHOLD = 5000;   // 5000 units

class SegmentedProcessor {
  /**
   * Check if segmentation should be used
   * @param {number} docSize - Document size in bytes
   * @param {number} unitCount - Number of structural units
   * @returns {boolean} Whether to use segmentation
   */
  shouldUseSegmentation(docSize, unitCount) {
    const sizeMB = docSize / (1024 * 1024);
    return sizeMB > SIZE_THRESHOLD_MB || unitCount > UNIT_COUNT_THRESHOLD;
  }
  
  /**
   * Segment a document
   * @param {Object} structure - DocumentStructure
   * @param {number} segmentSize - Units per segment
   * @returns {Array} Array of DocumentSegment
   */
  segmentDocument(structure, segmentSize = DEFAULT_SEGMENT_SIZE) {
    const segments = [];
    const units = structure.units;
    
    for (let i = 0; i < units.length; i += segmentSize) {
      const segmentUnits = units.slice(i, Math.min(i + segmentSize, units.length));
      
      const segment = {
        segment_id: `${structure.doc_id}_seg_${segments.length}`,
        doc_id: structure.doc_id,
        segment_index: segments.length,
        total_segments: Math.ceil(units.length / segmentSize),
        units: segmentUnits,
        start_unit_id: segmentUnits[0].unit_id,
        end_unit_id: segmentUnits[segmentUnits.length - 1].unit_id
      };
      
      segments.push(segment);
    }
    
    return segments;
  }
  
  /**
   * Process a single segment
   * @param {Object} segment - DocumentSegment
   * @param {Function} ckbGenerator - Function to generate CKBs
   * @returns {Promise<Object>} SegmentResult
   */
  async processSegment(segment, ckbGenerator) {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    
    try {
      // Save segment status
      await prisma.segmentProcessing.create({
        data: {
          segmentId: segment.segment_id,
          docId: segment.doc_id,
          segmentIndex: segment.segment_index,
          totalSegments: segment.total_segments,
          status: 'processing'
        }
      });
      
      // 1. Filter content
      const filterResult = contentFilter.applyFilters(segment.units);
      
      // 2. Generate CKBs
      const ckbs = [];
      for (const unit of filterResult.filtered_units) {
        try {
          const ckb = await ckbGenerator(unit, segment.doc_id);
          if (ckb) {
            ckbs.push(ckb);
          }
        } catch (error) {
          console.error(`Error generating CKB for unit ${unit.unit_id}:`, error);
        }
      }
      
      // 3. Validate completeness
      const validation = await completenessValidator.validate(
        segment.doc_id,
        {
          doc_id: segment.doc_id,
          file_type: 'segment',
          total_units: segment.units.length,
          units: segment.units,
          hierarchy: { root: { unit_id: 'root', type: 'segment', children: [], processed: false } }
        },
        ckbs
      );
      
      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      
      // Update segment status
      await prisma.segmentProcessing.update({
        where: { segmentId: segment.segment_id },
        data: { status: 'completed' }
      });
      
      return {
        segment_id: segment.segment_id,
        ckbs,
        validation,
        processing_time_ms: endTime - startTime,
        resource_usage: {
          memory_mb: endMemory - startMemory,
          cpu_percentage: 0  // Would need additional monitoring
        }
      };
    } catch (error) {
      console.error(`Segment ${segment.segment_id} processing failed:`, error);
      
      // Save failure state
      await prisma.segmentProcessing.update({
        where: { segmentId: segment.segment_id },
        data: {
          status: 'failed',
          errorMessage: error.message,
          failedAt: new Date()
        }
      });
      
      throw error;
    }
  }
  
  /**
   * Merge segment results
   * @param {Array} results - Array of SegmentResult
   * @returns {Promise<Object>} MergedResult
   */
  async mergeSegmentResults(results) {
    // 1. Merge all CKBs
    const allCKBs = results.flatMap(r => r.ckbs);
    
    // 2. Merge validation results
    const totalUnits = results.reduce((sum, r) => sum + r.validation.total_structural_units, 0);
    const totalCKBCount = allCKBs.length;
    const totalSkipped = results.reduce((sum, r) => sum + r.validation.skipped_count, 0);
    const coverageRate = totalUnits > 0 ? (totalCKBCount + totalSkipped) / totalUnits : 1.0;
    
    const mergedValidation = {
      doc_id: results[0].validation.doc_id,
      total_structural_units: totalUnits,
      ckb_count: totalCKBCount,
      skipped_count: totalSkipped,
      coverage_rate: coverageRate,
      missing_units: results.flatMap(r => r.validation.missing_units),
      low_quality_ckbs: results.flatMap(r => r.validation.low_quality_ckbs),
      is_complete: coverageRate >= 0.95,
      warnings: []
    };
    
    if (coverageRate < 0.95) {
      mergedValidation.warnings.push(`覆盖率 ${(coverageRate * 100).toFixed(1)}% 低于 95%`);
    }
    
    // 3. Calculate total processing time
    const totalProcessingTime = results.reduce((sum, r) => sum + r.processing_time_ms, 0);
    
    // 4. Calculate total resource usage
    const totalMemoryUsage = results.reduce((sum, r) => sum + r.resource_usage.memory_mb, 0);
    
    return {
      doc_id: results[0].validation.doc_id,
      total_ckbs: totalCKBCount,
      merged_validation: mergedValidation,
      total_processing_time_ms: totalProcessingTime,
      segment_count: results.length,
      total_memory_usage_mb: totalMemoryUsage
    };
  }
  
  /**
   * Recover from segment processing failure
   * @param {string} segmentId - Segment ID
   * @param {Function} ckbGenerator - Function to generate CKBs
   * @returns {Promise<Object>} SegmentResult
   */
  async recoverFromFailure(segmentId, ckbGenerator) {
    const failedSegment = await prisma.segmentProcessing.findUnique({
      where: { segmentId: segmentId }
    });
    
    if (!failedSegment) {
      throw new Error(`Segment ${segmentId} not found`);
    }
    
    if (failedSegment.status !== 'failed') {
      throw new Error(`Segment ${segmentId} is not in failed state`);
    }
    
    // Load segment data (would need to reconstruct from document)
    // For now, throw error indicating manual intervention needed
    throw new Error('Segment recovery requires manual intervention - segment data needs to be reconstructed');
  }
  
  /**
   * Process document with segmentation
   * @param {string} docId - Document ID
   * @param {Object} structure - DocumentStructure
   * @param {Function} ckbGenerator - Function to generate CKBs
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} MergedResult
   */
  async processDocumentWithSegmentation(docId, structure, ckbGenerator, options = {}) {
    const segmentSize = options.segmentSize || DEFAULT_SEGMENT_SIZE;
    const concurrency = options.concurrency || DEFAULT_CONCURRENCY;
    
    // 1. Segment the document
    const segments = this.segmentDocument(structure, segmentSize);
    console.log(`Document ${docId} segmented into ${segments.length} parts`);
    
    // 2. Process segments in parallel batches
    const results = [];
    const errors = [];
    
    for (let i = 0; i < segments.length; i += concurrency) {
      const batch = segments.slice(i, Math.min(i + concurrency, segments.length));
      
      console.log(`Processing batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(segments.length / concurrency)}`);
      
      const batchPromises = batch.map(segment => 
        this.processSegment(segment, ckbGenerator)
          .catch(error => {
            errors.push({ segment_id: segment.segment_id, error });
            return null;
          })
      );
      
      const batchResults = await Promise.all(batchPromises);
      
      // Filter out failed segments
      const successfulResults = batchResults.filter(r => r !== null);
      results.push(...successfulResults);
      
      console.log(`Processed ${results.length}/${segments.length} segments (${errors.length} failed)`);
      
      // Check if too many failures
      if (errors.length > segments.length * 0.3) {
        throw new Error(`Too many segment failures: ${errors.length}/${segments.length}`);
      }
    }
    
    // 3. Merge results
    if (results.length === 0) {
      throw new Error('All segments failed to process');
    }
    
    const mergedResult = await this.mergeSegmentResults(results);
    
    // 4. Check coverage and trigger alerts if needed
    if (mergedResult.merged_validation.coverage_rate < 0.95) {
      await alertManager.trigger('low_coverage', {
        doc_id: docId,
        coverage_rate: mergedResult.merged_validation.coverage_rate,
        segment_count: segments.length,
        failed_segments: errors.length
      });
    }
    
    // 5. Log errors
    if (errors.length > 0) {
      console.error(`${errors.length} segments failed:`);
      for (const error of errors) {
        console.error(`  - ${error.segment_id}: ${error.error.message}`);
      }
    }
    
    return mergedResult;
  }
  
  /**
   * Adjust segment size based on resource availability
   * @param {number} currentSize - Current segment size
   * @param {Object} resourceUsage - Resource usage stats
   * @returns {number} Adjusted segment size
   */
  adjustSegmentSize(currentSize, resourceUsage) {
    const memoryUsageMB = resourceUsage.memory_mb;
    const maxMemoryMB = 500;  // 500MB threshold
    
    if (memoryUsageMB > maxMemoryMB) {
      // Reduce segment size by 20%
      return Math.floor(currentSize * 0.8);
    } else if (memoryUsageMB < maxMemoryMB * 0.5) {
      // Increase segment size by 20%
      return Math.floor(currentSize * 1.2);
    }
    
    return currentSize;
  }
}

// Singleton instance
const segmentedProcessor = new SegmentedProcessor();

module.exports = segmentedProcessor;
