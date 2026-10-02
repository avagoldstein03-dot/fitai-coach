// Temporary QA helper — toggles avagoldstein03@gmail.com's comp subscription
// tier for manual upgrade-popup testing. Not meant to be committed.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const target = process.argv[2]; // "free" | "starter" | "pro" | "elite"

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "avagoldstein03@gmail.com" },
    select: { id: true },
  });
  if (!user) { console.log("User not found"); return; }

  if (target === "free") {
    // isPremium requires currentPeriodEnd in the future -- push it into the
    // past so resolveTier() falls back to "free", regardless of the tier column.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const updated = await prisma.subscription.update({
      where: { userId: user.id },
      data: { currentPeriodEnd: yesterday },
    });
    console.log("Set to FREE (expired currentPeriodEnd):", updated.currentPeriodEnd);
    return;
  }

  if (!["starter", "pro", "elite"].includes(target)) {
    console.log("Usage: node set-test-tier.js [free|starter|pro|elite]");
    return;
  }

  const oneYearOut = new Date();
  oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
  const updated = await prisma.subscription.update({
    where: { userId: user.id },
    data: { plan: "premium", status: "active", tier: target, currentPeriodEnd: oneYearOut },
  });
  console.log(`Set to ${target.toUpperCase()}:`, { tier: updated.tier, currentPeriodEnd: updated.currentPeriodEnd });
}

main().catch((e) => console.error(e)).finally(() => prisma.$disconnect());
