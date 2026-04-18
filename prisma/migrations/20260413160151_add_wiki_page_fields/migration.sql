-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_wiki_pages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "type" TEXT NOT NULL DEFAULT 'concept',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "sources" TEXT NOT NULL DEFAULT '[]',
    "related" TEXT NOT NULL DEFAULT '[]',
    "confidence" REAL NOT NULL DEFAULT 0.5,
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
INSERT INTO "new_wiki_pages" ("created_at", "embedding", "html", "id", "last_compiled_at", "last_run_id", "last_source_id", "markdown", "slug", "status", "summary", "title", "updated_at", "user_id", "version") SELECT "created_at", "embedding", "html", "id", "last_compiled_at", "last_run_id", "last_source_id", "markdown", "slug", "status", "summary", "title", "updated_at", "user_id", "version" FROM "wiki_pages";
DROP TABLE "wiki_pages";
ALTER TABLE "new_wiki_pages" RENAME TO "wiki_pages";
CREATE INDEX "wiki_pages_user_id_updated_at_idx" ON "wiki_pages"("user_id", "updated_at");
CREATE INDEX "wiki_pages_user_id_slug_idx" ON "wiki_pages"("user_id", "slug");
CREATE INDEX "wiki_pages_user_id_type_idx" ON "wiki_pages"("user_id", "type");
CREATE UNIQUE INDEX "wiki_pages_user_id_slug_key" ON "wiki_pages"("user_id", "slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
