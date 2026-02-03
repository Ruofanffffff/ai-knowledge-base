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
