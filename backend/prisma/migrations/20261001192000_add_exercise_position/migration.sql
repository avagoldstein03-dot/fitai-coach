-- Order of an exercise within its day. Postgres rows have no inherent order, so
-- without this the training order produced at generation time was lost on read.
-- Existing rows all default to 0, which preserves their current (arbitrary)
-- order rather than reshuffling anyone's live program.
ALTER TABLE "Exercise" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
