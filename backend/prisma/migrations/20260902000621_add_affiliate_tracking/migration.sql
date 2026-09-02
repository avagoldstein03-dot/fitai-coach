-- CreateTable
CREATE TABLE "Affiliate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Affiliate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateReferral" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionEntry" (
    "id" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "grossAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "commissionAmount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_email_key" ON "Affiliate"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_code_key" ON "Affiliate"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateReferral_userId_key" ON "AffiliateReferral"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionEntry_providerEventId_key" ON "CommissionEntry"("providerEventId");

-- AddForeignKey
ALTER TABLE "AffiliateReferral" ADD CONSTRAINT "AffiliateReferral_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateReferral" ADD CONSTRAINT "AffiliateReferral_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "AffiliateReferral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
