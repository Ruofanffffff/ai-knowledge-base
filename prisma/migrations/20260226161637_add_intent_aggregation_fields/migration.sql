-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_knowledge_bodies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "theme_name" TEXT NOT NULL,
    "theme_description" TEXT NOT NULL,
    "confidence_score" REAL NOT NULL DEFAULT 0.3,
    "growth_phase" TEXT NOT NULL DEFAULT 'discovery',
    "related_fragment_ids" TEXT NOT NULL,
    "related_entity_ids" TEXT,
    "exported_doc_id" TEXT,
    "theme_embedding" TEXT,
    "parent_id" TEXT,
    "body_type" TEXT NOT NULL DEFAULT 'topic',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "knowledge_bodies_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "knowledge_bodies" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_knowledge_bodies" ("confidence_score", "created_at", "exported_doc_id", "growth_phase", "id", "related_entity_ids", "related_fragment_ids", "theme_description", "theme_embedding", "theme_name", "updated_at", "user_id") SELECT "confidence_score", "created_at", "exported_doc_id", "growth_phase", "id", "related_entity_ids", "related_fragment_ids", "theme_description", "theme_embedding", "theme_name", "updated_at", "user_id" FROM "knowledge_bodies";
DROP TABLE "knowledge_bodies";
ALTER TABLE "new_knowledge_bodies" RENAME TO "knowledge_bodies";
CREATE INDEX "knowledge_bodies_user_id_growth_phase_idx" ON "knowledge_bodies"("user_id", "growth_phase");
CREATE INDEX "knowledge_bodies_parent_id_idx" ON "knowledge_bodies"("parent_id");
CREATE INDEX "knowledge_bodies_user_id_body_type_idx" ON "knowledge_bodies"("user_id", "body_type");
CREATE TABLE "new_theme_discovery_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "themes_found" INTEGER NOT NULL DEFAULT 0,
    "fragments_scanned" INTEGER NOT NULL DEFAULT 0,
    "triggered_by" TEXT NOT NULL,
    "error" TEXT,
    "intent_bodies_created" INTEGER NOT NULL DEFAULT 0,
    "bodies_merged" INTEGER NOT NULL DEFAULT 0,
    "stage4_error" TEXT,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" DATETIME
);
INSERT INTO "new_theme_discovery_logs" ("completed_at", "error", "fragments_scanned", "id", "started_at", "status", "themes_found", "triggered_by") SELECT "completed_at", "error", "fragments_scanned", "id", "started_at", "status", "themes_found", "triggered_by" FROM "theme_discovery_logs";
DROP TABLE "theme_discovery_logs";
ALTER TABLE "new_theme_discovery_logs" RENAME TO "theme_discovery_logs";
CREATE INDEX "theme_discovery_logs_started_at_idx" ON "theme_discovery_logs"("started_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
