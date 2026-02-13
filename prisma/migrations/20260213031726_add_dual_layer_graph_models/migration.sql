-- CreateTable
CREATE TABLE "doc_entities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doc_id" TEXT NOT NULL,
    "cleaned_name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "doc_relations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doc_id" TEXT NOT NULL,
    "cleaned_name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source_entity_id" TEXT NOT NULL,
    "target_entity_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "doc_relations_source_entity_id_fkey" FOREIGN KEY ("source_entity_id") REFERENCES "doc_entities" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "doc_relations_target_entity_id_fkey" FOREIGN KEY ("target_entity_id") REFERENCES "doc_entities" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "unified_entities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cleaned_name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source_doc_entity_ids" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "unified_relations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cleaned_name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source_entity_id" TEXT NOT NULL,
    "target_entity_id" TEXT NOT NULL,
    "source_doc_relation_ids" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "unified_relations_source_entity_id_fkey" FOREIGN KEY ("source_entity_id") REFERENCES "unified_entities" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "unified_relations_target_entity_id_fkey" FOREIGN KEY ("target_entity_id") REFERENCES "unified_entities" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "unification_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "entity_count" INTEGER NOT NULL DEFAULT 0,
    "relation_count" INTEGER NOT NULL DEFAULT 0,
    "triggered_by" TEXT NOT NULL,
    "error" TEXT,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" DATETIME
);

-- CreateIndex
CREATE INDEX "doc_entities_doc_id_idx" ON "doc_entities"("doc_id");

-- CreateIndex
CREATE INDEX "doc_entities_cleaned_name_idx" ON "doc_entities"("cleaned_name");

-- CreateIndex
CREATE INDEX "doc_relations_doc_id_idx" ON "doc_relations"("doc_id");

-- CreateIndex
CREATE INDEX "doc_relations_source_entity_id_idx" ON "doc_relations"("source_entity_id");

-- CreateIndex
CREATE INDEX "doc_relations_target_entity_id_idx" ON "doc_relations"("target_entity_id");

-- CreateIndex
CREATE INDEX "unified_entities_cleaned_name_idx" ON "unified_entities"("cleaned_name");

-- CreateIndex
CREATE INDEX "unified_relations_source_entity_id_idx" ON "unified_relations"("source_entity_id");

-- CreateIndex
CREATE INDEX "unified_relations_target_entity_id_idx" ON "unified_relations"("target_entity_id");

-- CreateIndex
CREATE INDEX "unification_logs_started_at_idx" ON "unification_logs"("started_at");
