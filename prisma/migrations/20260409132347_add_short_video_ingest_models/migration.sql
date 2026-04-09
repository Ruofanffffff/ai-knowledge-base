-- CreateTable
CREATE TABLE "short_video_sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'unknown',
    "original_url" TEXT NOT NULL,
    "normalized_url" TEXT NOT NULL,
    "input_text" TEXT,
    "ingestLevel" TEXT NOT NULL DEFAULT 'L0',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" TEXT,
    "error" TEXT,
    "note_quick_id" TEXT,
    "note_refined_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "short_video_sources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "short_video_artifacts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "metadata" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "short_video_artifacts_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "short_video_sources" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "short_video_digest_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "hour" INTEGER NOT NULL DEFAULT 20,
    "minute" INTEGER NOT NULL DEFAULT 0,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "short_video_digest_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "short_video_daily_digests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "short_video_daily_digests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "short_video_sources_user_id_idx" ON "short_video_sources"("user_id");

-- CreateIndex
CREATE INDEX "short_video_sources_platform_idx" ON "short_video_sources"("platform");

-- CreateIndex
CREATE INDEX "short_video_sources_status_idx" ON "short_video_sources"("status");

-- CreateIndex
CREATE INDEX "short_video_sources_created_at_idx" ON "short_video_sources"("created_at");

-- CreateIndex
CREATE INDEX "short_video_artifacts_source_id_idx" ON "short_video_artifacts"("source_id");

-- CreateIndex
CREATE INDEX "short_video_artifacts_kind_idx" ON "short_video_artifacts"("kind");

-- CreateIndex
CREATE INDEX "short_video_artifacts_created_at_idx" ON "short_video_artifacts"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "short_video_digest_settings_user_id_key" ON "short_video_digest_settings"("user_id");

-- CreateIndex
CREATE INDEX "short_video_daily_digests_user_id_idx" ON "short_video_daily_digests"("user_id");

-- CreateIndex
CREATE INDEX "short_video_daily_digests_date_idx" ON "short_video_daily_digests"("date");

-- CreateIndex
CREATE INDEX "short_video_daily_digests_created_at_idx" ON "short_video_daily_digests"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "short_video_daily_digests_user_id_date_key" ON "short_video_daily_digests"("user_id", "date");
