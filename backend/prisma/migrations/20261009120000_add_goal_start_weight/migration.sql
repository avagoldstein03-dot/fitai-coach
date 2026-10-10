-- Where a weight target started from, and when, so progress toward it can be
-- measured. Weight history only exists for users who connected Apple Health,
-- so without a snapshot there is no "started from" for everyone else.
--
-- Additive and nullable: existing goals have no target recorded and are
-- unaffected; the snapshot is taken the next time a target is set.
ALTER TABLE "Goal" ADD COLUMN "startWeight" DOUBLE PRECISION;
ALTER TABLE "Goal" ADD COLUMN "targetSetAt" TIMESTAMP(3);
