-- Daily aggregate health metrics synced from Apple Health (read-only, v1).
CREATE TABLE "HealthMetric" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "steps" INTEGER,
  "activeEnergyKcal" DOUBLE PRECISION,
  "sleepMinutes" INTEGER,
  "restingHeartRate" DOUBLE PRECISION,
  "source" TEXT NOT NULL DEFAULT 'healthkit',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HealthMetric_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HealthMetric_userId_date_key" ON "HealthMetric"("userId", "date");

ALTER TABLE "HealthMetric" ADD CONSTRAINT "HealthMetric_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Distinguish manual weight entries from ones synced in from Apple Health,
-- and allow dedupe against the HealthKit sample they came from.
ALTER TABLE "WeightLog" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "WeightLog" ADD COLUMN "externalId" TEXT;

CREATE UNIQUE INDEX "WeightLog_userId_externalId_key" ON "WeightLog"("userId", "externalId");
