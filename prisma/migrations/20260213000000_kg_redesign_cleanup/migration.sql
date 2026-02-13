-- KG Redesign Cleanup Migration
-- Drops all deprecated KG-related tables and creates cleaned entity/relation tables

-- DropTable: alerts
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "alerts";
PRAGMA foreign_keys=on;

-- DropTable: ckb
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "ckb";
PRAGMA foreign_keys=on;

-- DropTable: correction_record
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "correction_record";
PRAGMA foreign_keys=on;

-- DropTable: correction_stats
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "correction_stats";
PRAGMA foreign_keys=on;

-- DropTable: document_entities
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "document_entities";
PRAGMA foreign_keys=on;

-- DropTable: document_structures
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "document_structures";
PRAGMA foreign_keys=on;

-- DropTable: entities
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "entities";
PRAGMA foreign_keys=on;

-- DropTable: entity_relations
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "entity_relations";
PRAGMA foreign_keys=on;

-- DropTable: field_distribution
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "field_distribution";
PRAGMA foreign_keys=on;

-- DropTable: filter_rules
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "filter_rules";
PRAGMA foreign_keys=on;

-- DropTable: graph_description
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "graph_description";
PRAGMA foreign_keys=on;

-- DropTable: kg_entities
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "kg_entities";
PRAGMA foreign_keys=on;

-- DropTable: kg_relations
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "kg_relations";
PRAGMA foreign_keys=on;

-- DropTable: kg_token_usage
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "kg_token_usage";
PRAGMA foreign_keys=on;

-- DropTable: processing_monitors
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "processing_monitors";
PRAGMA foreign_keys=on;

-- DropTable: relation_types
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "relation_types";
PRAGMA foreign_keys=on;

-- DropTable: schemas
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "schemas";
PRAGMA foreign_keys=on;

-- DropTable: segment_processing
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "segment_processing";
PRAGMA foreign_keys=on;

-- DropTable: validation_reports
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "validation_reports";
PRAGMA foreign_keys=on;

-- CreateTable: cleaned_entities
CREATE TABLE IF NOT EXISTS "cleaned_entities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cleaned_name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source_entity_ids" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable: cleaned_relations
CREATE TABLE IF NOT EXISTS "cleaned_relations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cleaned_name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source_entity_id" TEXT NOT NULL,
    "target_entity_id" TEXT NOT NULL,
    "source_relation_ids" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "cleaned_relations_source_entity_id_fkey" FOREIGN KEY ("source_entity_id") REFERENCES "cleaned_entities" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cleaned_relations_target_entity_id_fkey" FOREIGN KEY ("target_entity_id") REFERENCES "cleaned_entities" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cleaned_entities_cleaned_name_idx" ON "cleaned_entities"("cleaned_name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cleaned_relations_source_entity_id_idx" ON "cleaned_relations"("source_entity_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cleaned_relations_target_entity_id_idx" ON "cleaned_relations"("target_entity_id");
