import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { createBillingPortalSession } from "@/services/stripe-service";
import { z } from "zod";

const portalSchema = z.object({
  returnUrl: z.string().url(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!validateRequest(req, ["POST"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return sendError(res, "unauthorized", "Unauthorized", 401);
    }

    const validationResult = portalSchema.safeParse(req.body);
    if (!validationResult.success) {
      return sendError(res, "validation_error", "Invalid request body", 400);
    }

    const { returnUrl } = validationResult.data;

    const subscription = await prisma.subscription.findUnique({
      where: {
        userId: (await prisma.user.findUnique({
          where: { clerkId: userId },
          select: { id: true },
        }))?.id,
      },
      select: { stripeCustomerId: true },
    });

    if (!subscription || !subscription.stripeCustomerId) {
      return sendError(
        res,
        "no_subscription",
        "No subscription found",
        404
      );
    }

    const session = await createBillingPortalSession(
      subscription.stripeCustomerId,
      returnUrl
    );

    sendSuccess(
      res,
      {
        url: session.url,
      },
      "Billing portal session created",
      200
    );
  } catch (error) {
    console.error("Error creating billing portal session:", error);
    sendError(res, "server_error", "Failed to create billing portal session", 500);
  }
}
