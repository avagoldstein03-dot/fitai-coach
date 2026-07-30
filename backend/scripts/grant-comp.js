// Grants a user comped premium access without going through Stripe or RevenueCat —
// for creator promo access. Run from backend/: node scripts/grant-comp.js <email> [tier] [days]
//
// Example: node scripts/grant-comp.js jane@creator.com elite 30

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const VALID_TIERS = ["starter", "pro", "elite"];

async function main() {
  const [, , email, tierArg, daysArg] = process.argv;
  const tier = tierArg || "elite";
  const days = daysArg ? parseInt(daysArg, 10) : 30;

  if (!email) {
    console.error("Usage: node scripts/grant-comp.js <email> [tier=elite] [days=30]");
    process.exit(1);
  }
  if (!VALID_TIERS.includes(tier)) {
    console.error(`Invalid tier "${tier}". Must be one of: ${VALID_TIERS.join(", ")}`);
    process.exit(1);
  }
  if (!Number.isInteger(days) || days <= 0) {
    console.error(`Invalid days "${daysArg}". Must be a positive integer.`);
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      clerkId: true,
      subscription: {
        select: { source: true, status: true, currentPeriodEnd: true, plan: true },
      },
    },
  });

  if (!user) {
    console.error(`No user found with email "${email}". They need to sign up in the app first.`);
    process.exit(1);
  }

  if (
    user.subscription &&
    user.subscription.source !== "manual-comp" &&
    user.subscription.status === "active" &&
    new Date(user.subscription.currentPeriodEnd) > new Date()
  ) {
    console.error(
      `${email} already has an active Stripe-sourced subscription (${user.subscription.plan}, ` +
        `expires ${user.subscription.currentPeriodEnd.toISOString()}). Refusing to overwrite it. ` +
        `If you're sure, cancel/downgrade it first.`
    );
    process.exit(1);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  await prisma.subscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      plan: "premium",
      status: "active",
      tier,
      source: "manual-comp",
      currentPeriodStart: now,
      currentPeriodEnd: expiresAt,
    },
    update: {
      plan: "premium",
      status: "active",
      tier,
      source: "manual-comp",
      currentPeriodStart: now,
      currentPeriodEnd: expiresAt,
      cancelledAt: null,
    },
  });

  console.log(`Found user: ${user.name} (clerkId: ${user.clerkId})`);
  console.log(`Granted ${tier} access through ${expiresAt.toISOString().split("T")[0]}`);
  console.log(`Marked source: "manual-comp"`);
}

main()
  .catch((err) => {
    console.error("Failed to grant comp access:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
