-- Stores the validated CoachAction[] parsed out of a reply's [ACTION:{...}]
-- markers, so the buttons under a coach message still work after the app is
-- reopened. Nullable and additive: existing rows are untouched.
ALTER TABLE "ChatMessage" ADD COLUMN "actions" JSONB;
