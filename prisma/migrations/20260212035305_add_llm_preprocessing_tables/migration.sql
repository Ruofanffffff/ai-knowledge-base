-- CreateTable
CREATE TABLE "document_index" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doc_id" TEXT NOT NULL,
    "indexed_text" TEXT NOT NULL,
    "metadata" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "correction_record" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doc_id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "correction_type" TEXT NOT NULL,
    "original_value" TEXT,
    "corrected_value" TEXT,
    "confidence_before" REAL,
    "confidence_after" REAL,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "correction_stats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doc_id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "total_corrections" INTEGER NOT NULL DEFAULT 0,
    "accuracy_before" REAL,
    "accuracy_after" REAL,
    "recall_before" REAL,
    "recall_after" REAL,
    "precision_before" REAL,
    "precision_after" REAL,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "graph_description" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doc_id" TEXT NOT NULL,
    "description_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "document_index_doc_id_idx" ON "document_index"("doc_id");

-- CreateIndex
CREATE INDEX "document_index_created_at_idx" ON "document_index"("created_at");

-- CreateIndex
CREATE INDEX "correction_record_doc_id_idx" ON "correction_record"("doc_id");

-- CreateIndex
CREATE INDEX "correction_record_stage_idx" ON "correction_record"("stage");

-- CreateIndex
CREATE INDEX "correction_record_doc_id_stage_idx" ON "correction_record"("doc_id", "stage");

-- CreateIndex
CREATE INDEX "correction_record_created_at_idx" ON "correction_record"("created_at");

-- CreateIndex
CREATE INDEX "correction_stats_doc_id_idx" ON "correction_stats"("doc_id");

-- CreateIndex
CREATE INDEX "correction_stats_stage_idx" ON "correction_stats"("stage");

-- CreateIndex
CREATE INDEX "correction_stats_doc_id_stage_idx" ON "correction_stats"("doc_id", "stage");

-- CreateIndex
CREATE INDEX "graph_description_doc_id_idx" ON "graph_description"("doc_id");

-- CreateIndex
CREATE INDEX "graph_description_description_type_idx" ON "graph_description"("description_type");
