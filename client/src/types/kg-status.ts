/**
 * Knowledge Graph Build Status Types
 * 
 * Type definitions for KG build status tracking.
 */

/**
 * Build status values
 */
export type KGBuildStatus = 'pending' | 'building' | 'completed' | 'failed';

/**
 * Error category values
 */
export type KGErrorCategory = 'user_error' | 'system_error' | 'unknown_error';

/**
 * Knowledge graph build status
 */
export interface KGStatus {
  docId: string;
  status: KGBuildStatus;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
  errorCategory?: KGErrorCategory;
  entityCount?: number;
  relationCount?: number;
}

/**
 * Single status query response
 */
export interface KGStatusResponse {
  success: boolean;
  data: KGStatus;
  error?: string;
}

/**
 * Batch status query response
 */
export interface BatchKGStatusResponse {
  success: boolean;
  data: KGStatus[];
  error?: string;
}

/**
 * Rebuild request response
 */
export interface RebuildResponse {
  success: boolean;
  message: string;
  error?: string;
}
