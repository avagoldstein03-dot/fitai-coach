-- CreateTable
CREATE TABLE "ProductScan" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "productName" TEXT,
    "brand" TEXT,
    "imageUrl" TEXT,
    "ingredientsText" TEXT,
    "additivesTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "novaGroup" INTEGER,
    "nutriscoreGrade" TEXT,
    "score" INTEGER NOT NULL,
    "grade" TEXT NOT NULL,
    "flaggedIngredients" JSONB NOT NULL DEFAULT '[]',
    "scoringVersion" INTEGER NOT NULL DEFAULT 1,
    "lastFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductScan_barcode_key" ON "ProductScan"("barcode");

-- CreateIndex
CREATE INDEX "ProductScan_scoringVersion_idx" ON "ProductScan"("scoringVersion");
