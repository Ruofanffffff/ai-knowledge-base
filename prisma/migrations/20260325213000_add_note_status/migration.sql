-- Add status column to notes for inbox/archived workflow
ALTER TABLE "notes" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'archived';

-- Prisma schema adds an index on status; SQLite will create it here
CREATE INDEX IF NOT EXISTS "notes_status_idx" ON "notes"("status");

