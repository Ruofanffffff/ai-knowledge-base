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

-- CreateIndex
CREATE UNIQUE INDEX "relation_types_relation_type_id_key" ON "relation_types"("relation_type_id");

-- CreateIndex
CREATE INDEX "relation_types_domain_idx" ON "relation_types"("domain");

-- CreateIndex
CREATE INDEX "relation_types_category_idx" ON "relation_types"("category");

-- CreateIndex
CREATE INDEX "relation_types_active_idx" ON "relation_types"("active");
