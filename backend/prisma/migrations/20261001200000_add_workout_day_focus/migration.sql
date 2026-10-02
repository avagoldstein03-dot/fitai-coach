-- Muscle groups a session trains, e.g. "Glutes & Hamstrings". The generator had
-- no split to anchor exercise selection to, which produced days mixing four
-- unrelated body parts. Nullable: existing days keep their weekday label only.
ALTER TABLE "WorkoutDay" ADD COLUMN "focus" TEXT;
