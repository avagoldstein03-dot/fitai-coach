import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import type { UserProfile } from "@/types/index";
import { normalizeConditions, MAX_MEDICAL_NOTES_LENGTH } from "@/lib/medical-conditions";
import { normalizeInjuryAreas } from "@/lib/health-safety";
import {
  SEXES,
  LIFE_STAGES,
  ACTIVITY_LEVELS,
  FITNESS_EXPERIENCE_LEVELS,
  onlyKnown,
} from "@/lib/profile-options";

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

    // PATCH — update weight, height, age, name, injury/mobility history, or diet/allergies
    if (req.method === "PATCH") {
      const { weight, height, age, name, unitSystem, language, country, currency, sex, lifeStage, activityLevel, fitnessExperience, injuryHistory, injuryAreas, medicalConditions, medicalNotes, dietPreferences, foodAllergies } = req.body;
      const updateData: Record<string, any> = {};
      if (weight !== undefined) updateData.weight = Number(weight);
      if (height !== undefined) updateData.height = Number(height);
      if (age !== undefined) updateData.age = Number(age);
      if (name !== undefined) updateData.name = String(name);
      if (unitSystem !== undefined) updateData.unitSystem = String(unitSystem);
      if (language !== undefined) updateData.language = String(language);
      if (country !== undefined) updateData.country = String(country);
      if (currency !== undefined) updateData.currency = String(currency);
      // Each of these was collected once at onboarding and then frozen, though
      // every one changes real output. activityLevel is the worst of them: it is
      // the TDEE multiplier, so someone whose activity changed was stuck with a
      // calorie target up to 40% off with no way to correct it.
      //
      // Validated against the fixed lists rather than stored as given — an
      // unrecognised activityLevel would fall through to the multiplier's `||
      // 1.375` default and be wrong silently, which is worse than being refused.
      if (sex !== undefined) {
        const v = onlyKnown(SEXES, sex);
        if (v) updateData.sex = v;
      }
      if (lifeStage !== undefined) {
        const v = onlyKnown(LIFE_STAGES, lifeStage);
        if (v) updateData.lifeStage = v;
      }
      if (activityLevel !== undefined) {
        const v = onlyKnown(ACTIVITY_LEVELS, activityLevel);
        if (v) updateData.activityLevel = v;
      }
      if (fitnessExperience !== undefined) {
        const v = onlyKnown(FITNESS_EXPERIENCE_LEVELS, fitnessExperience);
        if (v) updateData.fitnessExperience = v;
      }
      if (injuryHistory !== undefined) updateData.injuryHistory = String(injuryHistory).trim().slice(0, 500);
      // Health answers are editable after onboarding, which they previously were
      // not. The condition most likely to begin after someone signs up —
      // pregnancy — is also the one that changes the most about what the app
      // should say, and there was no way to enter it.
      //
      // Both lists go through their normalizers rather than being trusted: these
      // values end up inside a prompt, and only known keys may get there.
      if (injuryAreas !== undefined) updateData.injuryAreas = normalizeInjuryAreas(injuryAreas);
      if (medicalConditions !== undefined) updateData.medicalConditions = normalizeConditions(medicalConditions);
      if (medicalNotes !== undefined) {
        updateData.medicalNotes = String(medicalNotes).trim().slice(0, MAX_MEDICAL_NOTES_LENGTH);
      }
      if (dietPreferences !== undefined) {
        updateData.dietPreferences = Array.isArray(dietPreferences) ? dietPreferences.map((d) => String(d).toLowerCase()) : [];
      }
      if (foodAllergies !== undefined) {
        updateData.foodAllergies = Array.isArray(foodAllergies) ? foodAllergies.map((a) => String(a).trim()).filter(Boolean) : [];
      }

      if (Object.keys(updateData).length === 0) {
        return sendError(res, "validation_error", "No valid fields provided", 400);
      }

      const updated = await prisma.user.update({
        where: { clerkId: userId },
        data: updateData,
        select: { id: true, name: true, weight: true, height: true, age: true, sex: true, lifeStage: true, activityLevel: true, fitnessExperience: true, unitSystem: true, language: true, country: true, currency: true, injuryHistory: true, injuryAreas: true, medicalConditions: true, medicalNotes: true, dietPreferences: true, foodAllergies: true },
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
        lifeStage: true,
        activityLevel: true,
        fitnessExperience: true,
        height: true,
        weight: true,
        unitSystem: true,
        language: true,
        country: true,
        currency: true,
        injuryHistory: true,
        injuryAreas: true,
        medicalConditions: true,
        medicalNotes: true,
        dietPreferences: true,
        foodAllergies: true,
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
      lifeStage: user.lifeStage || undefined,
      activityLevel: user.activityLevel || undefined,
      fitnessExperience: user.fitnessExperience || undefined,
      height: user.height || undefined,
      weight: user.weight || undefined,
      unitSystem: (user.unitSystem as "imperial" | "metric") || "imperial",
      language: user.language || "English",
      country: user.country || "United States",
      currency: user.currency || "usd",
      injuryHistory: user.injuryHistory || undefined,
      injuryAreas: user.injuryAreas,
      medicalConditions: user.medicalConditions,
      medicalNotes: user.medicalNotes || undefined,
      dietPreferences: user.dietPreferences,
      foodAllergies: user.foodAllergies,
      onboardingCompleted: user.onboardingCompleted,
      onboardingStep: user.onboardingStep,
    };

    sendSuccess(res, profile, "Profile retrieved successfully");
  } catch (error) {
    console.error("Error fetching profile:", error);
    sendError(res, "server_error", "Failed to fetch profile", 500);
  }
}
