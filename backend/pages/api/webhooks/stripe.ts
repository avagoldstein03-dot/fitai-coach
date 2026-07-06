import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import stripe from "@/services/stripe-service";
import { sendSuccess, sendError } from "@/lib/api-utils";

export const config = {
  api: {
    bodyParser: {
      raw: true,
    },
  },
};

async function handleSubscriptionCreated(subscription: any) {
  const userId = subscription.metadata.userId;
  const customerId = subscription.customer;

  // Find user by ID
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!user) {
    console.error(`User not found: ${userId}`);
    return;
  }

  // Create or update subscription in database
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0].price.id,
      plan: "premium",
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
    update: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0].price.id,
      plan: "premium",
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });

  console.log(`Subscription created for user ${userId}`);
}

async function handleSubscriptionUpdated(subscription: any) {
  const userId = subscription.metadata.userId;

  await prisma.subscription.update({
    where: { userId },
    data: {
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });

  console.log(`Subscription updated for user ${userId}`);
}

async function handleSubscriptionDeleted(subscription: any) {
  const userId = subscription.metadata.userId;

  await prisma.subscription.update({
    where: { userId },
    data: {
      status: "canceled",
      cancelledAt: new Date(),
      plan: "free",
    },
  });

  console.log(`Subscription canceled for user ${userId}`);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return sendError(
      res,
      "webhook_error",
      `Webhook Error: ${err.message}`,
      400
    );
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    sendSuccess(res, { received: true }, "Webhook processed");
  } catch (error) {
    console.error("Error processing webhook:", error);
    sendError(res, "webhook_error", "Failed to process webhook", 500);
  }
}
