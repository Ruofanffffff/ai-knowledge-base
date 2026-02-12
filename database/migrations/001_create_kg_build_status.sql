-- Migration: Create kg_build_status table
-- Purpose: Track knowledge graph build status for each document
-- Date: 2026-02-11

-- Create kg_build_status table
CREATE TABLE IF NOT EXISTS kg_build_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('pending', 'building', 'completed', 'failed')),
  error_message TEXT,
  error_category TEXT CHECK(error_category IN ('user_error', 'system_error', 'unknown_error')),
  entity_count INTEGER DEFAULT 0,
  relation_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_kg_build_status_doc_id ON kg_build_status(doc_id);
CREATE INDEX IF NOT EXISTS idx_kg_build_status_status ON kg_build_status(status);
CREATE INDEX IF NOT EXISTS idx_kg_build_status_updated_at ON kg_build_status(updated_at);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_kg_build_status_timestamp 
AFTER UPDATE ON kg_build_status
FOR EACH ROW
BEGIN
  UPDATE kg_build_status SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
