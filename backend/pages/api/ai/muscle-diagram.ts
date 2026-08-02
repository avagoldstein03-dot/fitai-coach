import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { getUserSubscription } from "@/lib/subscription-middleware";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildPrompt(exerciseName: string, muscles: string[]): string {
  const muscleList = muscles.length > 0 ? ` (${muscles.join(", ")})` : "";
  return (
    `Create a hyper-realistic anatomical diagram of a standing human figure doing a ${exerciseName}${muscleList}. ` +
    `The skin is transparent so the entire muscular system is visible. ` +
    `The muscles actively engaged in this movement are brightly glowing in neon blue, ` +
    `while the resting muscles remain a subtle gray. ` +
    `Clean vector style, isolated on a white background, educational, highly detailed.`
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["POST"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    const subscription = await getUserSubscription(req);
    if (!subscription.limits.formCheck) {
      return sendError(res, "subscription_required", "Upgrade to Premium to use this feature", 403);
    }

    const { exerciseName, muscles = [] } = req.body;
    if (!exerciseName || typeof exerciseName !== "string") {
      return sendError(res, "validation_error", "exerciseName is required", 400);
    }

    const prompt = buildPrompt(exerciseName, muscles);

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      response_format: "url",
    });

    const imageUrl = (response.data ?? [])[0]?.url;
    if (!imageUrl) throw new Error("No image URL in response");

    sendSuccess(res, { imageUrl });
  } catch (error) {
    console.error("Muscle diagram generation error:", error);
    sendError(res, "server_error", "Failed to generate muscle diagram", 500);
  }
}
