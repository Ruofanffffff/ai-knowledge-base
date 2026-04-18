-- CreateTable
CREATE TABLE "wiki_sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT,
    "source_url" TEXT,
    "title" TEXT,
    "raw_content" TEXT,
    "content_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" TEXT,
    "error" TEXT,
    "last_compiled_at" DATETIME,
    "next_run_at" DATETIME,
    "locked_at" DATETIME,
    "lock_owner" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" DATETIME,
    "last_run_id" TEXT,
    "last_trace_id" TEXT,
    "last_duration_ms" INTEGER,
    "last_extracted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "wiki_pages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "markdown" TEXT NOT NULL,
    "html" TEXT,
    "embedding" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_compiled_at" DATETIME,
    "last_source_id" TEXT,
    "last_run_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "wiki_source_refs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "score" REAL,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wiki_source_refs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "wiki_sources" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "wiki_source_refs_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki_pages" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "wiki_compile_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "stage" TEXT,
    "trace_id" TEXT,
    "metrics" TEXT,
    "error" TEXT,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" DATETIME,
    CONSTRAINT "wiki_compile_runs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "wiki_sources" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "wiki_sources_user_id_idx" ON "wiki_sources"("user_id");

-- CreateIndex
CREATE INDEX "wiki_sources_status_idx" ON "wiki_sources"("status");

-- CreateIndex
CREATE INDEX "wiki_sources_next_run_at_idx" ON "wiki_sources"("next_run_at");

-- CreateIndex
CREATE INDEX "wiki_sources_locked_at_idx" ON "wiki_sources"("locked_at");

-- CreateIndex
CREATE INDEX "wiki_pages_user_id_updated_at_idx" ON "wiki_pages"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "wiki_pages_user_id_slug_idx" ON "wiki_pages"("user_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_pages_user_id_slug_key" ON "wiki_pages"("user_id", "slug");

-- CreateIndex
CREATE INDEX "wiki_source_refs_source_id_idx" ON "wiki_source_refs"("source_id");

-- CreateIndex
CREATE INDEX "wiki_source_refs_page_id_idx" ON "wiki_source_refs"("page_id");

-- CreateIndex
CREATE INDEX "wiki_compile_runs_source_id_idx" ON "wiki_compile_runs"("source_id");

-- CreateIndex
CREATE INDEX "wiki_compile_runs_started_at_idx" ON "wiki_compile_runs"("started_at");
