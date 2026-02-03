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

-- CreateIndex
CREATE UNIQUE INDEX "field_distribution_field_name_key" ON "field_distribution"("field_name");

-- CreateIndex
CREATE INDEX "field_distribution_count_idx" ON "field_distribution"("count");

-- CreateIndex
CREATE INDEX "field_distribution_last_seen_idx" ON "field_distribution"("last_seen");

-- CreateIndex
CREATE INDEX "field_distribution_field_type_idx" ON "field_distribution"("field_type");
