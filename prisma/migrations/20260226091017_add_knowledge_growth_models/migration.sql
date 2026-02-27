-- CreateTable
CREATE TABLE "doc_principles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doc_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "related_entity_ids" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'pattern',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "unified_principles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'pattern',
    "source_doc_principle_ids" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "document_insights" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doc_id" TEXT NOT NULL,
    "concepts" TEXT NOT NULL,
    "references" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "image_analyses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "image_key" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "description" TEXT,
    "elements" TEXT,
    "theme" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "document_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "image_analyses_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cognitive_fragments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "fragment_type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_meta" TEXT,
    "embedding" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "knowledge_bodies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "theme_name" TEXT NOT NULL,
    "theme_description" TEXT NOT NULL,
    "confidence_score" REAL NOT NULL DEFAULT 0.3,
    "growth_phase" TEXT NOT NULL DEFAULT 'discovery',
    "related_fragment_ids" TEXT NOT NULL,
    "related_entity_ids" TEXT,
    "exported_doc_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "knowledge_body_nodes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "body_id" TEXT NOT NULL,
    "parent_node_id" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'gap',
    "content" TEXT,
    "generation_mode" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "knowledge_body_nodes_body_id_fkey" FOREIGN KEY ("body_id") REFERENCES "knowledge_bodies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "knowledge_body_nodes_parent_node_id_fkey" FOREIGN KEY ("parent_node_id") REFERENCES "knowledge_body_nodes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "theme_discovery_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "themes_found" INTEGER NOT NULL DEFAULT 0,
    "fragments_scanned" INTEGER NOT NULL DEFAULT 0,
    "triggered_by" TEXT NOT NULL,
    "error" TEXT,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" DATETIME
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_doc_entities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doc_id" TEXT NOT NULL,
    "cleaned_name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL DEFAULT 'concept',
    "source" TEXT NOT NULL DEFAULT 'fact',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_doc_entities" ("cleaned_name", "created_at", "description", "doc_id", "id", "updated_at") SELECT "cleaned_name", "created_at", "description", "doc_id", "id", "updated_at" FROM "doc_entities";
DROP TABLE "doc_entities";
ALTER TABLE "new_doc_entities" RENAME TO "doc_entities";
CREATE INDEX "doc_entities_doc_id_idx" ON "doc_entities"("doc_id");
CREATE INDEX "doc_entities_cleaned_name_idx" ON "doc_entities"("cleaned_name");
CREATE TABLE "new_doc_relations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doc_id" TEXT NOT NULL,
    "cleaned_name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "layer" TEXT NOT NULL DEFAULT 'how',
    "source" TEXT NOT NULL DEFAULT 'fact',
    "source_entity_id" TEXT NOT NULL,
    "target_entity_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "doc_relations_source_entity_id_fkey" FOREIGN KEY ("source_entity_id") REFERENCES "doc_entities" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "doc_relations_target_entity_id_fkey" FOREIGN KEY ("target_entity_id") REFERENCES "doc_entities" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_doc_relations" ("cleaned_name", "created_at", "description", "doc_id", "id", "source_entity_id", "target_entity_id", "updated_at") SELECT "cleaned_name", "created_at", "description", "doc_id", "id", "source_entity_id", "target_entity_id", "updated_at" FROM "doc_relations";
DROP TABLE "doc_relations";
ALTER TABLE "new_doc_relations" RENAME TO "doc_relations";
CREATE INDEX "doc_relations_doc_id_idx" ON "doc_relations"("doc_id");
CREATE INDEX "doc_relations_source_entity_id_idx" ON "doc_relations"("source_entity_id");
CREATE INDEX "doc_relations_target_entity_id_idx" ON "doc_relations"("target_entity_id");
CREATE TABLE "new_unification_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "entity_count" INTEGER NOT NULL DEFAULT 0,
    "relation_count" INTEGER NOT NULL DEFAULT 0,
    "principle_count" INTEGER NOT NULL DEFAULT 0,
    "triggered_by" TEXT NOT NULL,
    "error" TEXT,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" DATETIME
);
INSERT INTO "new_unification_logs" ("completed_at", "entity_count", "error", "id", "relation_count", "started_at", "status", "triggered_by") SELECT "completed_at", "entity_count", "error", "id", "relation_count", "started_at", "status", "triggered_by" FROM "unification_logs";
DROP TABLE "unification_logs";
ALTER TABLE "new_unification_logs" RENAME TO "unification_logs";
CREATE INDEX "unification_logs_started_at_idx" ON "unification_logs"("started_at");
CREATE TABLE "new_unified_entities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cleaned_name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL DEFAULT 'concept',
    "source" TEXT NOT NULL DEFAULT 'fact',
    "source_doc_entity_ids" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_unified_entities" ("cleaned_name", "created_at", "description", "id", "source_doc_entity_ids", "updated_at") SELECT "cleaned_name", "created_at", "description", "id", "source_doc_entity_ids", "updated_at" FROM "unified_entities";
DROP TABLE "unified_entities";
ALTER TABLE "new_unified_entities" RENAME TO "unified_entities";
CREATE INDEX "unified_entities_cleaned_name_idx" ON "unified_entities"("cleaned_name");
CREATE TABLE "new_unified_relations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cleaned_name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "layer" TEXT NOT NULL DEFAULT 'how',
    "source" TEXT NOT NULL DEFAULT 'fact',
    "source_entity_id" TEXT NOT NULL,
    "target_entity_id" TEXT NOT NULL,
    "source_doc_relation_ids" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "unified_relations_source_entity_id_fkey" FOREIGN KEY ("source_entity_id") REFERENCES "unified_entities" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "unified_relations_target_entity_id_fkey" FOREIGN KEY ("target_entity_id") REFERENCES "unified_entities" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_unified_relations" ("cleaned_name", "created_at", "description", "id", "source_doc_relation_ids", "source_entity_id", "target_entity_id", "updated_at") SELECT "cleaned_name", "created_at", "description", "id", "source_doc_relation_ids", "source_entity_id", "target_entity_id", "updated_at" FROM "unified_relations";
DROP TABLE "unified_relations";
ALTER TABLE "new_unified_relations" RENAME TO "unified_relations";
CREATE INDEX "unified_relations_source_entity_id_idx" ON "unified_relations"("source_entity_id");
CREATE INDEX "unified_relations_target_entity_id_idx" ON "unified_relations"("target_entity_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "doc_principles_doc_id_idx" ON "doc_principles"("doc_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_insights_doc_id_key" ON "document_insights"("doc_id");

-- CreateIndex
CREATE INDEX "document_insights_doc_id_idx" ON "document_insights"("doc_id");

-- CreateIndex
CREATE INDEX "image_analyses_image_key_idx" ON "image_analyses"("image_key");

-- CreateIndex
CREATE INDEX "image_analyses_document_id_idx" ON "image_analyses"("document_id");

-- CreateIndex
CREATE INDEX "image_analyses_status_idx" ON "image_analyses"("status");

-- CreateIndex
CREATE INDEX "cognitive_fragments_user_id_created_at_idx" ON "cognitive_fragments"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "cognitive_fragments_source_id_created_at_idx" ON "cognitive_fragments"("source_id", "created_at");

-- CreateIndex
CREATE INDEX "knowledge_bodies_user_id_growth_phase_idx" ON "knowledge_bodies"("user_id", "growth_phase");

-- CreateIndex
CREATE INDEX "knowledge_body_nodes_body_id_idx" ON "knowledge_body_nodes"("body_id");

-- CreateIndex
CREATE INDEX "knowledge_body_nodes_parent_node_id_idx" ON "knowledge_body_nodes"("parent_node_id");

-- CreateIndex
CREATE INDEX "theme_discovery_logs_started_at_idx" ON "theme_discovery_logs"("started_at");
