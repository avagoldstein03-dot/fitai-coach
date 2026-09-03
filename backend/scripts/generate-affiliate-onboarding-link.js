// Creates (or reuses) a Stripe Connect Express account for an affiliate and
// prints a fresh onboarding link to send them directly (email, DM — there's
// no in-app affiliate portal). Safe to re-run any time, e.g. if the affiliate
// didn't finish onboarding before the link expired.
//
// Requires BACKEND_PUBLIC_URL in the environment (the deployed backend's
// stable public URL, e.g. https://your-backend.vercel.app) — Stripe requires
// real HTTPS destinations for the post-onboarding redirect.
//
// Run from backend/: node scripts/generate-affiliate-onboarding-link.js <code>
//
// Example: node scripts/generate-affiliate-onboarding-link.js CREATO

const { PrismaClient } = require("@prisma/client");
const Stripe = require("stripe");

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function main() {
  const [, , code] = process.argv;

  if (!code) {
    console.error("Usage: node scripts/generate-affiliate-onboarding-link.js <code>");
    process.exit(1);
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("STRIPE_SECRET_KEY is not set.");
    process.exit(1);
  }
  const baseUrl = process.env.BACKEND_PUBLIC_URL;
  if (!baseUrl) {
    console.error("BACKEND_PUBLIC_URL is not set — e.g. https://your-backend.vercel.app");
    process.exit(1);
  }

  const affiliate = await prisma.affiliate.findUnique({ where: { code: code.toUpperCase() } });
  if (!affiliate) {
    console.error(`No affiliate found with code "${code}".`);
    process.exit(1);
  }

  let stripeAccountId = affiliate.stripeAccountId;

  if (!stripeAccountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: affiliate.email,
      capabilities: { transfers: { requested: true } },
    });
    stripeAccountId = account.id;
    await prisma.affiliate.update({
      where: { id: affiliate.id },
      data: { stripeAccountId },
    });
    console.log(`Created Stripe Express account ${stripeAccountId} for ${affiliate.name}.`);
  } else {
    console.log(`Reusing existing Stripe Express account ${stripeAccountId} for ${affiliate.name}.`);
  }

  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${baseUrl}/affiliate-onboarding-refresh`,
    return_url: `${baseUrl}/affiliate-onboarding-complete`,
    type: "account_onboarding",
  });

  console.log(`\nSend this link to ${affiliate.name} <${affiliate.email}> — it expires soon, so send it right away:\n`);
  console.log(accountLink.url);
}

main()
  .catch((err) => {
    console.error("Failed to generate onboarding link:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
