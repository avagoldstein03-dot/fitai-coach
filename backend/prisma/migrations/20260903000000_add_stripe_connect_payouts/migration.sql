-- AlterTable
ALTER TABLE "Affiliate" ADD COLUMN     "stripeAccountId" TEXT,
ADD COLUMN     "stripeOnboardingComplete" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CommissionEntry" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "stripeTransferId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_stripeAccountId_key" ON "Affiliate"("stripeAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionEntry_stripeTransferId_key" ON "CommissionEntry"("stripeTransferId");
