/**
 * Document Index Types
 *
 * Type definitions for the document compressed index display feature.
 * Used by the Index Viewer, parser, and metadata panel components.
 */

/**
 * Section type for parsed index segments
 */
export type SectionType = 'summary' | 'concepts' | 'relations' | 'other';

/**
 * A single concept extracted from the index text
 */
export interface ConceptItem {
  name: string;
  role: string;
  description: string;
}

/**
 * A labeled relation item extracted from the index text
 */
export interface RelationItem {
  label: string;
  description: string;
}

/**
 * A parsed section of the indexed text
 */
export interface IndexSection {
  type: SectionType;
  title: string;
  content: string;
  items?: ConceptItem[];
  relationItems?: RelationItem[];
}

/**
 * Index metadata from LLM generation
 */
export interface IndexMetadata {
  generated_at?: string;
  llm_model?: string;
  token_count?: number;
  fact_count?: number;
  [key: string]: any;
}

/**
 * GET /api/preprocessing/index/:docId response
 */
export interface DocumentIndexResponse {
  id: string;
  docId: string;
  indexedText: string;
  version: number;
  metadata: IndexMetadata;
  createdAt: string;
  updatedAt: string;
}
