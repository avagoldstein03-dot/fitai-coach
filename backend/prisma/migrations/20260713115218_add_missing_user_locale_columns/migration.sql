-- Adds columns declared in schema.prisma that were never applied to the database.
-- Prisma includes these in every INSERT (they have schema-level defaults), so their
-- absence was breaking prisma.user.create() entirely — i.e. new user signup.
ALTER TABLE "User" ADD COLUMN "unitSystem" TEXT DEFAULT 'imperial';
ALTER TABLE "User" ADD COLUMN "language" TEXT DEFAULT 'English';
ALTER TABLE "User" ADD COLUMN "country" TEXT DEFAULT 'United States';
ALTER TABLE "User" ADD COLUMN "currency" TEXT DEFAULT 'usd';
