import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import type { UserProfile } from "@/types/index";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!validateRequest(req, ["GET", "PATCH"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    // PATCH — update weight, height, age, name, or injury/mobility history
    if (req.method === "PATCH") {
      const { weight, height, age, name, unitSystem, language, country, currency, injuryHistory } = req.body;
      const updateData: Record<string, any> = {};
      if (weight !== undefined) updateData.weight = Number(weight);
      if (height !== undefined) updateData.height = Number(height);
      if (age !== undefined) updateData.age = Number(age);
      if (name !== undefined) updateData.name = String(name);
      if (unitSystem !== undefined) updateData.unitSystem = String(unitSystem);
      if (language !== undefined) updateData.language = String(language);
      if (country !== undefined) updateData.country = String(country);
      if (currency !== undefined) updateData.currency = String(currency);
      if (injuryHistory !== undefined) updateData.injuryHistory = String(injuryHistory).trim().slice(0, 500);

      if (Object.keys(updateData).length === 0) {
        return sendError(res, "validation_error", "No valid fields provided", 400);
      }

      const updated = await prisma.user.update({
        where: { clerkId: userId },
        data: updateData,
        select: { id: true, name: true, weight: true, height: true, age: true, unitSystem: true, language: true, country: true, currency: true, injuryHistory: true },
      });

      return sendSuccess(res, updated, "Profile updated successfully");
    }

    // GET — return full profile
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        age: true,
        sex: true,
        height: true,
        weight: true,
        unitSystem: true,
        language: true,
        country: true,
        currency: true,
        injuryHistory: true,
        onboardingCompleted: true,
        onboardingStep: true,
      },
    });

    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    const profile: UserProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar || undefined,
      age: user.age || undefined,
      sex: user.sex || undefined,
      height: user.height || undefined,
      weight: user.weight || undefined,
      unitSystem: (user.unitSystem as "imperial" | "metric") || "imperial",
      language: user.language || "English",
      country: user.country || "United States",
      currency: user.currency || "usd",
      injuryHistory: user.injuryHistory || undefined,
      onboardingCompleted: user.onboardingCompleted,
      onboardingStep: user.onboardingStep,
    };

    sendSuccess(res, profile, "Profile retrieved successfully");
  } catch (error) {
    console.error("Error fetching profile:", error);
    sendError(res, "server_error", "Failed to fetch profile", 500);
  }
}
