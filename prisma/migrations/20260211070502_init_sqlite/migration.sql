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
    "anchor_fields" TEXT,
    "anchor_config" TEXT,
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
    "anchor_fingerprint" TEXT,
    "anchor_fields" TEXT,
    "aliases" TEXT,
    "schemas" TEXT NOT NULL,
    "supported_by" TEXT NOT NULL,
    "attributes" TEXT,
    "confidence" REAL NOT NULL,
    "llm_enriched" BOOLEAN NOT NULL DEFAULT false,
    "evidence" TEXT,
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
    "evidence" TEXT,
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

-- CreateTable
CREATE TABLE "document_structures" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doc_id" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "total_units" INTEGER NOT NULL,
    "units" TEXT NOT NULL,
    "hierarchy" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "validation_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "report_id" TEXT NOT NULL,
    "doc_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "structure_tree" TEXT NOT NULL,
    "skipped_content" TEXT NOT NULL,
    "low_quality_ckbs" TEXT NOT NULL,
    "missing_units" TEXT NOT NULL,
    "recommendations" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "processing_monitors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monitor_id" TEXT NOT NULL,
    "doc_id" TEXT NOT NULL,
    "start_time" DATETIME NOT NULL,
    "end_time" DATETIME,
    "stages" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "segment_processing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "segment_id" TEXT NOT NULL,
    "doc_id" TEXT NOT NULL,
    "segment_index" INTEGER NOT NULL,
    "total_segments" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "failed_at" DATETIME,
    "recovered_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alert_id" TEXT NOT NULL,
    "alert_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT NOT NULL,
    "triggered_at" DATETIME NOT NULL,
    "resolved_at" DATETIME,
    "status" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "filter_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rule_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "field_distribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "field_name" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "last_seen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schemas" TEXT NOT NULL,
    "field_type" TEXT,
    "example_value" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "relation_types" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "relation_type_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "domain" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source_entity_types" TEXT NOT NULL,
    "target_entity_types" TEXT NOT NULL,
    "is_directional" BOOLEAN NOT NULL DEFAULT true,
    "is_temporal" BOOLEAN NOT NULL DEFAULT false,
    "supports_confidence" BOOLEAN NOT NULL DEFAULT true,
    "parent_type" TEXT,
    "metadata" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "note_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attachments_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "attachment_analysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attachment_id" TEXT NOT NULL,
    "text_content" TEXT,
    "description" TEXT,
    "tags" TEXT NOT NULL,
    "metadata" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attachment_analysis_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "attachments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
CREATE INDEX "kg_entities_anchor_fingerprint_idx" ON "kg_entities"("anchor_fingerprint");

-- CreateIndex
CREATE INDEX "kg_entities_type_anchor_fingerprint_idx" ON "kg_entities"("type", "anchor_fingerprint");

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

-- CreateIndex
CREATE INDEX "document_structures_doc_id_idx" ON "document_structures"("doc_id");

-- CreateIndex
CREATE UNIQUE INDEX "validation_reports_report_id_key" ON "validation_reports"("report_id");

-- CreateIndex
CREATE INDEX "validation_reports_doc_id_idx" ON "validation_reports"("doc_id");

-- CreateIndex
CREATE INDEX "validation_reports_report_id_idx" ON "validation_reports"("report_id");

-- CreateIndex
CREATE UNIQUE INDEX "processing_monitors_monitor_id_key" ON "processing_monitors"("monitor_id");

-- CreateIndex
CREATE INDEX "processing_monitors_doc_id_idx" ON "processing_monitors"("doc_id");

-- CreateIndex
CREATE INDEX "processing_monitors_monitor_id_idx" ON "processing_monitors"("monitor_id");

-- CreateIndex
CREATE UNIQUE INDEX "segment_processing_segment_id_key" ON "segment_processing"("segment_id");

-- CreateIndex
CREATE INDEX "segment_processing_doc_id_idx" ON "segment_processing"("doc_id");

-- CreateIndex
CREATE INDEX "segment_processing_segment_id_idx" ON "segment_processing"("segment_id");

-- CreateIndex
CREATE INDEX "segment_processing_status_idx" ON "segment_processing"("status");

-- CreateIndex
CREATE UNIQUE INDEX "alerts_alert_id_key" ON "alerts"("alert_id");

-- CreateIndex
CREATE INDEX "alerts_alert_type_idx" ON "alerts"("alert_type");

-- CreateIndex
CREATE INDEX "alerts_severity_idx" ON "alerts"("severity");

-- CreateIndex
CREATE INDEX "alerts_status_idx" ON "alerts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "filter_rules_rule_id_key" ON "filter_rules"("rule_id");

-- CreateIndex
CREATE INDEX "filter_rules_rule_id_idx" ON "filter_rules"("rule_id");

-- CreateIndex
CREATE INDEX "filter_rules_enabled_idx" ON "filter_rules"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "field_distribution_field_name_key" ON "field_distribution"("field_name");

-- CreateIndex
CREATE INDEX "field_distribution_count_idx" ON "field_distribution"("count");

-- CreateIndex
CREATE INDEX "field_distribution_last_seen_idx" ON "field_distribution"("last_seen");

-- CreateIndex
CREATE INDEX "field_distribution_field_type_idx" ON "field_distribution"("field_type");

-- CreateIndex
CREATE UNIQUE INDEX "relation_types_relation_type_id_key" ON "relation_types"("relation_type_id");

-- CreateIndex
CREATE INDEX "relation_types_domain_idx" ON "relation_types"("domain");

-- CreateIndex
CREATE INDEX "relation_types_category_idx" ON "relation_types"("category");

-- CreateIndex
CREATE INDEX "relation_types_active_idx" ON "relation_types"("active");

-- CreateIndex
CREATE INDEX "notes_user_id_idx" ON "notes"("user_id");

-- CreateIndex
CREATE INDEX "notes_created_at_idx" ON "notes"("created_at");

-- CreateIndex
CREATE INDEX "attachments_note_id_idx" ON "attachments"("note_id");

-- CreateIndex
CREATE INDEX "attachments_type_idx" ON "attachments"("type");

-- CreateIndex
CREATE UNIQUE INDEX "attachment_analysis_attachment_id_key" ON "attachment_analysis"("attachment_id");
