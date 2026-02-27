-- Migration: Knowledge Body Intent Aggregation
-- Purpose: Add parent_id and body_type to knowledge_bodies for hierarchical intent aggregation;
--          Add stage4 logging fields to theme_discovery_logs
-- Date: 2025-07-14
-- Note: These tables live in knowledge_graph.db (Prisma-managed).
--       This migration serves as a fallback for environments without Prisma.
--       The primary migration path is via `npx prisma migrate dev`.

-- ============================================
-- KnowledgeBody: Add parent_id and body_type
-- ============================================

-- SQLite does not support ADD COLUMN IF NOT EXISTS, so these may fail
-- if columns already exist. The migrate.js script handles this gracefully.
ALTER TABLE knowledge_bodies ADD COLUMN parent_id TEXT;
ALTER TABLE knowledge_bodies ADD COLUMN body_type TEXT NOT NULL DEFAULT 'topic';

-- Indexes for efficient hierarchy queries
CREATE INDEX IF NOT EXISTS idx_knowledge_bodies_parent_id ON knowledge_bodies(parent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_bodies_user_body_type ON knowledge_bodies(user_id, body_type);

-- ============================================
-- ThemeDiscoveryLog: Add stage4 logging fields
-- ============================================

ALTER TABLE theme_discovery_logs ADD COLUMN intent_bodies_created INTEGER NOT NULL DEFAULT 0;
ALTER TABLE theme_discovery_logs ADD COLUMN bodies_merged INTEGER NOT NULL DEFAULT 0;
ALTER TABLE theme_discovery_logs ADD COLUMN stage4_error TEXT;
