import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError } from "@/lib/api-utils";
import { getUserSubscription } from "@/lib/subscription-middleware";
import { checkRateLimit } from "@/lib/rate-limit";
import { AIProviderRegistry } from "@/services/ai-registry";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

const RequestSchema = z.object({
  exerciseName: z.string().trim().min(1).max(100),
  images: z
    .array(
      z.object({
        base64: z.string().min(1),
        mimeType: z.string().optional().default("image/jpeg"),
      })
    )
    .min(1)
    .max(4),
  formCues: z.array(z.string()).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return sendError(res, "invalid_method", "POST required", 405);
  }

  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      return sendError(res, "unauthorized", "Authentication required", 401);
    }

    const user = await prisma.user.findUnique({ where: { clerkId: auth.userId } });
    if (!user) {
      return sendError(res, "user_not_found", "User not found", 404);
    }

    const subscription = await getUserSubscription(req);
    if (!subscription.limits.formCheck) {
      return sendError(res, "subscription_required", "Upgrade to Premium to use this feature", 403);
    }

    const allowed = await checkRateLimit("form-check", auth.userId, 20, "1 h");
    if (!allowed) {
      return sendError(res, "rate_limited", "Too many requests, please slow down", 429);
    }

    const parsed = RequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, "invalid_input", "exerciseName and at least one image are required", 400);
    }

    const { exerciseName, images, formCues } = parsed.data;

    const aiProvider = AIProviderRegistry.getProviderForTask("form_check");
    const formCheck = await aiProvider.analyzeForm({
      exerciseName,
      images,
      userNotes: formCues && formCues.length > 0 ? formCues.join(", ") : undefined,
    });

    return sendSuccess(res, { formCheck });
  } catch (error) {
    console.error("Form check error:", error);
    if (error instanceof Error && error.message.startsWith("No person detected")) {
      return sendError(res, "no_person_detected", error.message, 422);
    }
    return sendError(res, "form_check_failed", "Form check failed", 500);
  }
}
