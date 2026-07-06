import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { createCheckoutSession } from "@/services/stripe-service";
import { z } from "zod";

const checkoutSchema = z.object({
  priceId: z.string().min(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
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

    const validationResult = checkoutSchema.safeParse(req.body);
    if (!validationResult.success) {
      return sendError(res, "validation_error", "Invalid request body", 400);
    }

    const { priceId, successUrl, cancelUrl } = validationResult.data;

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });

    if (!user) {
      return sendError(res, "user_not_found", "User not found", 404);
    }

    const session = await createCheckoutSession(
      user.id,
      priceId,
      successUrl,
      cancelUrl
    );

    sendSuccess(
      res,
      {
        sessionId: session.id,
        url: session.url,
      },
      "Checkout session created",
      200
    );
  } catch (error) {
    console.error("Error creating checkout session:", error);
    sendError(res, "server_error", "Failed to create checkout session", 500);
  }
}
