-- The injury answer as a fixed list of body parts, alongside the existing free
-- text rather than replacing it. A known key drives a reviewed exercise
-- substitution in code (lib/health-safety) where prose cannot.
--
-- Additive with a default: existing users have no areas recorded, their
-- injuryHistory text is untouched, and nothing reads this column as required.
ALTER TABLE "User" ADD COLUMN "injuryAreas" TEXT[] DEFAULT ARRAY[]::TEXT[];
