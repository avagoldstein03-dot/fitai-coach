-- Free-text injury/mobility history, used to give the AI coach explicit
-- guidance on movements to avoid or modify for this user.
ALTER TABLE "User" ADD COLUMN "injuryHistory" TEXT;
