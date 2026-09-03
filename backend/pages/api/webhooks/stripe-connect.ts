import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import stripe from "@/services/stripe-service";
import { sendSuccess, sendError } from "@/lib/api-utils";

// Separate endpoint + separate webhook secret from webhooks/stripe.ts — Stripe
// Connect events are configured as their own webhook endpoint in the dashboard,
// distinct from the main account's subscription webhook.
export const config = {
  api: {
    bodyParser: { raw: true },
  },
};

async function handleAccountUpdated(account: any) {
  if (!account.charges_enabled || !account.payouts_enabled) {
    // Onboarding still in progress — nothing to do yet.
    return;
  }

  await prisma.affiliate
    .updateMany({
      where: { stripeAccountId: account.id },
      data: { stripeOnboardingComplete: true },
    })
    .catch((err) => console.error("Failed to mark affiliate onboarding complete:", err));

  console.log(`Stripe Connect account ${account.id} finished onboarding.`);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  const sig = req.headers["stripe-signature"] as string;
  const body = req.body;

  if (!sig) {
    return sendError(res, "invalid_signature", "Missing signature", 401);
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_CONNECT_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error(`Stripe Connect webhook error: ${err.message}`);
    return sendError(res, "webhook_error", `Webhook Error: ${err.message}`, 400);
  }

  try {
    switch (event.type) {
      case "account.updated":
        await handleAccountUpdated(event.data.object);
        break;
      default:
        console.log(`Unhandled Stripe Connect event type ${event.type}`);
    }

    sendSuccess(res, { received: true }, "Webhook processed");
  } catch (error) {
    console.error("Error processing Stripe Connect webhook:", error);
    sendError(res, "webhook_error", "Failed to process webhook", 500);
  }
}
