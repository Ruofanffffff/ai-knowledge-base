-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "hashedPassword" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'document',
    "fileType" TEXT,
    "metadata" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#999999',
    "description" TEXT
);

-- CreateTable
CREATE TABLE "document_tags" (
    "documentId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("documentId", "tagId"),
    CONSTRAINT "document_tags_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "document_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "entities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'concept',
    "description" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "entity_relations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'association',
    "strength" REAL NOT NULL DEFAULT 0.5,
    "description" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "entity_relations_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "entities" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "entity_relations_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "entities" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "document_entities" (
    "documentId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "score" REAL NOT NULL DEFAULT 0.5,

    PRIMARY KEY ("documentId", "entityId"),
    CONSTRAINT "document_entities_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "document_entities_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "search_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "query" TEXT NOT NULL,
    "documentId" TEXT,
    "userId" TEXT,
    "score" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "search_history_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "backups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filePath" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "description" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "backups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ckb" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doc_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_meta" TEXT NOT NULL,
    "structure" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "timestamps" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ckb_doc_id_fkey" FOREIGN KEY ("doc_id") REFERENCES "documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "schemas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "scene" TEXT,
    "core_fields" TEXT NOT NULL,
    "threshold" REAL NOT NULL,
    "relations" TEXT,
    "example_description" TEXT,
    "description" TEXT,
    "version" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "kg_entities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "canonical_name" TEXT NOT NULL,
    "aliases" TEXT,
    "schemas" TEXT NOT NULL,
    "supported_by" TEXT NOT NULL,
    "attributes" TEXT,
    "confidence" REAL NOT NULL,
    "llm_enriched" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "kg_relations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "weight" REAL,
    "confidence" REAL NOT NULL,
    "evidence_ckb" TEXT NOT NULL,
    "evidence_text" TEXT,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "kg_relations_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "kg_entities" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "kg_relations_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "kg_entities" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "kg_token_usage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "module" TEXT NOT NULL,
    "ckb_id" TEXT,
    "model_name" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "total_tokens" INTEGER NOT NULL,
    "cost" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE INDEX "ckb_doc_id_idx" ON "ckb"("doc_id");

-- CreateIndex
CREATE INDEX "ckb_source_type_idx" ON "ckb"("source_type");

-- CreateIndex
CREATE UNIQUE INDEX "schemas_name_key" ON "schemas"("name");

-- CreateIndex
CREATE INDEX "schemas_entity_type_idx" ON "schemas"("entity_type");

-- CreateIndex
CREATE INDEX "schemas_scene_idx" ON "schemas"("scene");

-- CreateIndex
CREATE INDEX "schemas_active_idx" ON "schemas"("active");

-- CreateIndex
CREATE INDEX "kg_entities_type_idx" ON "kg_entities"("type");

-- CreateIndex
CREATE INDEX "kg_entities_canonical_name_idx" ON "kg_entities"("canonical_name");

-- CreateIndex
CREATE INDEX "kg_entities_confidence_idx" ON "kg_entities"("confidence");

-- CreateIndex
CREATE INDEX "kg_relations_source_id_idx" ON "kg_relations"("source_id");

-- CreateIndex
CREATE INDEX "kg_relations_target_id_idx" ON "kg_relations"("target_id");

-- CreateIndex
CREATE INDEX "kg_relations_type_idx" ON "kg_relations"("type");

-- CreateIndex
CREATE INDEX "kg_relations_confidence_idx" ON "kg_relations"("confidence");

-- CreateIndex
CREATE INDEX "kg_token_usage_module_idx" ON "kg_token_usage"("module");

-- CreateIndex
CREATE INDEX "kg_token_usage_created_at_idx" ON "kg_token_usage"("created_at");
