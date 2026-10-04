-- Self-reported health context collected during onboarding, so training and
-- nutrition advice can be made more conservative. Additive and nullable:
-- existing users have no conditions recorded and are unaffected.
ALTER TABLE "User" ADD COLUMN "medicalConditions" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN "medicalNotes" TEXT;
