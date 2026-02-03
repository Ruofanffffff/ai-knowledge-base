/**
 * Data Models for Document Full Processing
 * 
 * This module defines the data structures used throughout the document processing system.
 */

/**
 * StructuralUnit - Represents a single structural unit in a document
 * @typedef {Object} StructuralUnit
 * @property {string} unit_id - Unique identifier for the unit
 * @property {string} type - Type of unit: 'paragraph' | 'heading' | 'list_item' | 'table_row' | 'code_block' | 'image'
 * @property {string} content - Text content of the unit
 * @property {number} level - Hierarchy level (depth)
 * @property {string|null} parent_id - Parent unit ID
 * @property {boolean} is_empty - Whether the unit is empty
 * @property {boolean} should_filter - Whether the unit should be filtered
 * @property {string|null} filter_reason - Reason for filtering
 */

/**
 * HierarchyNode - Represents a node in the document hierarchy tree
 * @typedef {Object} HierarchyNode
 * @property {string} unit_id - Unit ID
 * @property {string} type - Unit type
 * @property {HierarchyNode[]} children - Child nodes
 * @property {boolean} processed - Whether the node has been processed
 */

/**
 * HierarchyTree - Represents the complete document hierarchy
 * @typedef {Object} HierarchyTree
 * @property {HierarchyNode} root - Root node of the tree
 */

/**
 * DocumentStructure - Complete document structure analysis result
 * @typedef {Object} DocumentStructure
 * @property {string} doc_id - Document ID
 * @property {string} file_type - File type (word, pdf, excel, markdown)
 * @property {number} total_units - Total number of structural units
 * @property {StructuralUnit[]} units - Array of structural units
 * @property {HierarchyTree} hierarchy - Document hierarchy tree
 */

/**
 * ReportSummary - Summary of validation report
 * @typedef {Object} ReportSummary
 * @property {number} total_structural_units - Total structural units
 * @property {number} ckb_count - Number of CKBs generated
 * @property {number} skipped_count - Number of skipped units
 * @property {number} coverage_rate - Coverage rate (0-1)
 * @property {boolean} is_complete - Whether processing is complete
 * @property {number} quality_score - Quality score (0-100)
 */

/**
 * SkippedContent - Information about skipped content
 * @typedef {Object} SkippedContent
 * @property {string} unit_id - Unit ID
 * @property {string} content - Content preview (truncated)
 * @property {string} filter_reason - Reason for filtering
 * @property {string} matched_rule - Matched filter rule
 */

/**
 * LowQualityCKB - Information about low quality CKB
 * @typedef {Object} LowQualityCKB
 * @property {string} ckb_id - CKB ID
 * @property {string} content - Content preview
 * @property {number} source_confidence - Source confidence score
 * @property {string[]} issues - List of quality issues
 */

/**
 * MissingUnit - Information about missing structural unit
 * @typedef {Object} MissingUnit
 * @property {string} unit_id - Unit ID
 * @property {string} type - Unit type
 * @property {string} content - Content preview
 * @property {number} level - Hierarchy level
 * @property {string|null} parent_id - Parent unit ID
 */

/**
 * ValidationReport - Complete validation report
 * @typedef {Object} ValidationReport
 * @property {string} report_id - Report ID
 * @property {string} doc_id - Document ID
 * @property {string} created_at - Creation timestamp
 * @property {ReportSummary} summary - Report summary
 * @property {HierarchyTree} structure_tree - Document structure tree
 * @property {SkippedContent[]} skipped_content - Skipped content list
 * @property {LowQualityCKB[]} low_quality_ckbs - Low quality CKBs
 * @property {MissingUnit[]} missing_units - Missing units
 * @property {string[]} recommendations - Optimization recommendations
 */

/**
 * ProcessingStage - Information about a processing stage
 * @typedef {Object} ProcessingStage
 * @property {string} stage_name - Stage name
 * @property {string} start_time - Start timestamp
 * @property {string|null} end_time - End timestamp
 * @property {number|null} duration_ms - Duration in milliseconds
 * @property {string} status - Status: 'started' | 'completed' | 'failed'
 * @property {string|null} error_message - Error message if failed
 * @property {Object} metadata - Additional metadata
 */

/**
 * ProcessingProgress - Current processing progress
 * @typedef {Object} ProcessingProgress
 * @property {string} monitor_id - Monitor ID
 * @property {string} doc_id - Document ID
 * @property {string} current_stage - Current stage name
 * @property {string[]} completed_stages - Completed stage names
 * @property {number} total_stages - Total number of stages
 * @property {number} progress_percentage - Progress percentage (0-100)
 * @property {number|null} estimated_remaining_time_ms - Estimated remaining time
 */

/**
 * DocumentSegment - A segment of a large document
 * @typedef {Object} DocumentSegment
 * @property {string} segment_id - Segment ID
 * @property {string} doc_id - Document ID
 * @property {number} segment_index - Segment index (0-based)
 * @property {number} total_segments - Total number of segments
 * @property {StructuralUnit[]} units - Structural units in this segment
 * @property {string} start_unit_id - First unit ID
 * @property {string} end_unit_id - Last unit ID
 */

/**
 * ResourceUsage - Resource usage information
 * @typedef {Object} ResourceUsage
 * @property {number} memory_mb - Memory usage in MB
 * @property {number} cpu_percentage - CPU usage percentage
 */

/**
 * SegmentResult - Result of processing a segment
 * @typedef {Object} SegmentResult
 * @property {string} segment_id - Segment ID
 * @property {Object[]} ckbs - Generated CKBs
 * @property {Object} validation - Validation result
 * @property {number} processing_time_ms - Processing time
 * @property {ResourceUsage} resource_usage - Resource usage
 */

/**
 * FilterRule - Content filtering rule
 * @typedef {Object} FilterRule
 * @property {string} rule_id - Rule ID
 * @property {string} name - Rule name
 * @property {string} type - Rule type: 'regex' | 'keyword' | 'length' | 'pattern'
 * @property {string|RegExp} pattern - Pattern to match
 * @property {string} action - Action: 'skip' | 'mark_low_quality'
 * @property {string} reason - Reason for filtering
 * @property {boolean} enabled - Whether rule is enabled
 */

/**
 * Alert - System alert
 * @typedef {Object} Alert
 * @property {string} alert_id - Alert ID
 * @property {string} alert_type - Alert type
 * @property {string} severity - Severity: 'info' | 'warning' | 'error' | 'critical'
 * @property {string} message - Alert message
 * @property {Object} metadata - Additional metadata
 * @property {string} triggered_at - Trigger timestamp
 * @property {string|null} resolved_at - Resolution timestamp
 * @property {string} status - Status: 'active' | 'resolved' | 'ignored'
 */

module.exports = {
  // Type definitions are exported for JSDoc usage
  // No runtime exports needed as these are just type definitions
};
