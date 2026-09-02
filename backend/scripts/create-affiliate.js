// Manually creates an Affiliate row with a unique referral code — for
// onboarding a real creator partner. No self-serve signup flow exists.
// Run from backend/: node scripts/create-affiliate.js <name> <email> [commissionRate]
//
// Example: node scripts/create-affiliate.js "Jane Creator" jane@creator.com 0.25

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Duplicated from backend/lib/friend-code.ts rather than imported — that file
// uses the `@/` TS path alias elsewhere in the project, which isn't available
// to a plain-`node` script without adding a transpilation step (same reason
// grant-comp.js duplicates its own logic instead of importing from `@/lib`).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

function generateCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

async function generateUniqueCode() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const existing = await prisma.affiliate.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique affiliate code after several attempts");
}

async function main() {
  const [, , name, email, rateArg] = process.argv;
  const commissionRate = rateArg ? parseFloat(rateArg) : 0.2;

  if (!name || !email) {
    console.error("Usage: node scripts/create-affiliate.js <name> <email> [commissionRate=0.20]");
    process.exit(1);
  }
  if (Number.isNaN(commissionRate) || commissionRate <= 0 || commissionRate > 1) {
    console.error(`Invalid commissionRate "${rateArg}". Must be a fraction between 0 and 1, e.g. 0.20 for 20%.`);
    process.exit(1);
  }

  const existing = await prisma.affiliate.findUnique({ where: { email } });
  if (existing) {
    console.error(`An affiliate with email "${email}" already exists (code: ${existing.code}).`);
    process.exit(1);
  }

  const code = await generateUniqueCode();

  const affiliate = await prisma.affiliate.create({
    data: { name, email, code, commissionRate },
  });

  console.log(`Created affiliate: ${affiliate.name} <${affiliate.email}>`);
  console.log(`Code: ${affiliate.code}`);
  console.log(`Commission rate: ${(affiliate.commissionRate * 100).toFixed(0)}%`);
}

main()
  .catch((err) => {
    console.error("Failed to create affiliate:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
