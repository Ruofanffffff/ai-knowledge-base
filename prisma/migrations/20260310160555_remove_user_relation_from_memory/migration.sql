-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_memories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" TEXT NOT NULL,
    "importance_score" REAL NOT NULL,
    "last_accessed_at" DATETIME NOT NULL,
    "metadata" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_memories" ("content", "created_at", "embedding", "id", "importance_score", "last_accessed_at", "metadata", "type", "updated_at", "user_id") SELECT "content", "created_at", "embedding", "id", "importance_score", "last_accessed_at", "metadata", "type", "updated_at", "user_id" FROM "memories";
DROP TABLE "memories";
ALTER TABLE "new_memories" RENAME TO "memories";
CREATE INDEX "memories_user_id_idx" ON "memories"("user_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
