-- AlterTable
ALTER TABLE "kg_entities" ADD COLUMN "anchor_fields" TEXT;
ALTER TABLE "kg_entities" ADD COLUMN "anchor_fingerprint" TEXT;

-- CreateIndex
CREATE INDEX "kg_entities_anchor_fingerprint_idx" ON "kg_entities"("anchor_fingerprint");

-- CreateIndex
CREATE INDEX "kg_entities_type_anchor_fingerprint_idx" ON "kg_entities"("type", "anchor_fingerprint");
