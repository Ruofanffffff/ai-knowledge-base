-- AlterTable
ALTER TABLE "knowledge_bodies" ADD COLUMN "theme_embedding" TEXT;

-- CreateTable
CREATE TABLE "theme_evolution_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "body_id" TEXT NOT NULL,
    "previous_theme_name" TEXT NOT NULL,
    "previous_theme_description" TEXT NOT NULL,
    "new_theme_name" TEXT NOT NULL,
    "new_theme_description" TEXT NOT NULL,
    "drift_score" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "theme_evolution_logs_body_id_fkey" FOREIGN KEY ("body_id") REFERENCES "knowledge_bodies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "theme_evolution_logs_body_id_idx" ON "theme_evolution_logs"("body_id");

-- CreateIndex
CREATE INDEX "theme_evolution_logs_created_at_idx" ON "theme_evolution_logs"("created_at");
