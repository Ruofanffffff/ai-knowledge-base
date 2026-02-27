-- Migration: Knowledge Body Lifecycle
-- Purpose: Add lifecycle_status and last_active_at to knowledge_bodies for lifecycle management;
--          Add stage5 logging fields to theme_discovery_logs
-- Date: 2025-07-15
-- Note: These tables live in knowledge_graph.db (Prisma-managed).
--       This migration serves as a fallback for environments without Prisma.
--       The primary migration path is via `npx prisma migrate dev`.

-- ============================================
-- KnowledgeBody: Add lifecycle fields
-- ============================================

-- SQLite does not support ADD COLUMN IF NOT EXISTS, so these may fail
-- if columns already exist. The migrate.js script handles this gracefully.
ALTER TABLE knowledge_bodies ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE knowledge_bodies ADD COLUMN last_active_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Index for efficient lifecycle queries
CREATE INDEX IF NOT EXISTS idx_knowledge_bodies_user_lifecycle ON knowledge_bodies(user_id, lifecycle_status);

-- ============================================
-- ThemeDiscoveryLog: Add stage5 logging fields
-- ============================================

ALTER TABLE theme_discovery_logs ADD COLUMN stale_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE theme_discovery_logs ADD COLUMN archived_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE theme_discovery_logs ADD COLUMN stage5_error TEXT;
