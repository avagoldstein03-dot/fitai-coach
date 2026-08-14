import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { buildTierGatingPrompt } from "@/lib/coach-tier-prompt";
import type {
  AIProvider,
  FoodAnalysisResult,
  BodyAnalysisInput,
  BodyAnalysisResult,
  WorkoutGenerationInput,
  WorkoutPlanResult,
  NutritionGenerationInput,
  MealPlanResult,
  ProgressReviewInput,
  ProgressReviewResult,
  FormCheckInput,
  FormCheckResult,
  ChatContext,
  CrossDomainSignal,
} from "./ai-provider";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Fetch an image URL and convert to base64 for the Anthropic vision API
async function fetchImageAsBase64(url: string): Promise<{ base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" }> {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  const contentType = String(response.headers["content-type"] || "image/jpeg");
  const mediaType = (contentType.split(";")[0] as any) || "image/jpeg";
  const base64 = Buffer.from(response.data).toString("base64");
  return { base64, mediaType };
}

export class AnthropicProvider implements AIProvider {
  async analyzeFood(imageUrl: string): Promise<FoodAnalysisResult> {
    const { base64, mediaType } = await fetchImageAsBase64(imageUrl);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: `Analyze this food image and provide nutritional information. Return ONLY valid JSON with no markdown:
{
  "foodName": "string",
  "quantity": number,
  "unit": "string (g, ml, oz, cup)",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "fiber": number,
  "confidenceScore": number
}`,
            },
          ],
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Invalid response type");

    try {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error("Failed to parse food analysis response:", error);
      throw new Error("Failed to analyze food");
    }
  }

  async analyzeBody(input: BodyAnalysisInput): Promise<BodyAnalysisResult> {
    const userContext = `User Profile: Age ${input.userAge}, ${input.userSex}, Height ${input.userHeight}cm, Weight ${input.userWeight}kg`;

    const [front, side, back] = await Promise.all([
      fetchImageAsBase64(input.frontImageUrl),
      fetchImageAsBase64(input.sideImageUrl),
      fetchImageAsBase64(input.backImageUrl),
    ]);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: front.mediaType, data: front.base64 } },
            { type: "image", source: { type: "base64", media_type: side.mediaType, data: side.base64 } },
            { type: "image", source: { type: "base64", media_type: back.mediaType, data: back.base64 } },
            {
              type: "text",
              text: `${userContext}

Analyze these 3 body assessment photos (front, side, back) and provide a comprehensive assessment.
Return ONLY valid JSON with no markdown:
{
  "bodyComposition": {
    "estimatedBodyFat": "percentage estimate (e.g., '22-26%')",
    "muscleDefinition": "assessment of muscle definition",
    "estimatedBMI": "calculated BMI"
  },
  "posture": {
    "spinalAlignment": "assessment of spine",
    "shoulderAlignment": "assessment of shoulders",
    "notes": "general posture notes"
  },
  "strengths": ["list of 3-5 positive observations"],
  "areasForImprovement": ["list of 3-5 areas to improve"],
  "recommendations": {
    "exercise": ["3-4 specific exercise recommendations"],
    "nutrition": ["3-4 nutrition recommendations"],
    "recovery": ["2-3 recovery/sleep recommendations"]
  },
  "summary": "1-2 paragraph overall assessment and recommendations"
}

IMPORTANT: Never present results as medical diagnoses.`,
            },
          ],
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Invalid response type");

    try {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error("Failed to parse body analysis response:", error);
      throw new Error("Failed to analyze body");
    }
  }

  async generateWorkout(userProfile: WorkoutGenerationInput): Promise<WorkoutPlanResult> {
    const prompt = `You are an experienced personal trainer designing a personalized ${userProfile.durationWeeks}-week workout program.

Client profile:
- Goal: ${userProfile.goal}
- Experience: ${userProfile.experience}
- Equipment available: ${userProfile.equipment.join(", ")}
- Days per week: ${userProfile.daysPerWeek}
${userProfile.sex ? `- Sex: ${userProfile.sex}` : ""}
${userProfile.bodyGoalFocus ? `- Stated body goal / aesthetic focus: ${userProfile.bodyGoalFocus}` : ""}
${userProfile.specificFocus ? `- Specific thing they want to fix/improve: ${userProfile.specificFocus}` : ""}
${userProfile.assessmentSummary ? `- Latest body assessment notes: ${userProfile.assessmentSummary}` : ""}

Use the client's stated goal/focus and body assessment notes (if provided) to decide which muscle groups should get priority volume/frequency and which exercises best fit their body type and aim. Be specific and personalized rather than generic.

Return ONLY valid JSON with no markdown, structured exactly like this:
{
  "coachNote": "2-3 sentences, written directly to the client: how this program is tailored to their stated goal and body type, and honest, encouraging guidance on whether their goal is realistic and what to focus on to get there.",
  "weeks": [
    {
      "weekNumber": 1,
      "progressionStrategy": "short description of this week's progressive overload focus",
      "days": [
        {
          "dayOfWeek": 0,
          "exercises": [
            { "exerciseName": "Barbell Back Squat", "sets": 4, "reps": "6-8", "restSeconds": 90, "notes": "optional coaching cue" }
          ]
        }
      ]
    }
  ]
}

Generate exactly ${userProfile.durationWeeks} week entries, each with exactly ${userProfile.daysPerWeek} day entries (dayOfWeek 0-6, spread sensibly with rest days between sessions). Each day must have exactly 4-5 exercises chosen so that together they hit all major muscle groups intended for that day's focus, matching the client's stated goal — balanced coverage over quantity. Apply progressive overload across weeks.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Invalid response type");
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`AI did not return JSON: "${content.text.slice(0, 200)}"`);
    return JSON.parse(jsonMatch[0]);
  }

  async generateMealPlan(userProfile: NutritionGenerationInput): Promise<MealPlanResult> {
    const prompt = `Create a personalized 7-day meal plan for:
Goal: ${userProfile.goal}
Weight: ${userProfile.weight} kg
Activity: ${userProfile.activityLevel}
Preferences: ${userProfile.dietPreferences.join(", ")}
Allergies: ${userProfile.foodAllergies.join(", ")}

Return ONLY valid JSON with no markdown, structured exactly like this:
{
  "days": [
    {
      "day": "Monday",
      "meals": [
        { "name": "Breakfast", "foods": ["3 whole eggs", "1 cup oatmeal", "1 banana"], "calories": 520, "protein": 32, "carbs": 60, "fat": 14 }
      ]
    }
  ]
}

Generate exactly 7 days (Monday-Sunday), each with Breakfast, Lunch, Dinner, and a Snack (4 meals), with realistic foods and accurate calorie/protein/carb/fat totals per meal respecting the stated preferences and allergies. Vary meals across days.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Invalid response type");
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`AI did not return JSON: "${content.text.slice(0, 200)}"`);
    return JSON.parse(jsonMatch[0]);
  }

  async generateProgressReview(userProfile: ProgressReviewInput): Promise<ProgressReviewResult> {
    const isElite = userProfile.tier === "elite";

    const prompt = isElite
      ? `Generate an in-depth ${userProfile.period} progress review for a user:
Meals logged: ${userProfile.mealsLogged}
Workouts completed: ${userProfile.workoutsCompleted}
Weight change: ${userProfile.weightChange} kg
Body metrics: ${JSON.stringify(userProfile.bodyMetrics)}

This user is on the top subscription tier — give them real depth on top of the wins, not just a longer version of a generic review. People still want to see what they're doing well first. Return ONLY valid JSON with no markdown, structured exactly like this:
{
  "wins": ["short, specific, genuine positive callout", "a second one if there's a real second win", "a third if there's genuinely one, otherwise omit"],
  "insight": "2-3 sentences on a real behavioral pattern in this data — specific and substantive, not generic. Omit entirely if nothing stands out.",
  "adjustments": ["one specific, actionable fix tied to the actual numbers", "a second specific fix if there's a genuine second one", "a third if warranted — omit the field entirely if nothing is worth changing"],
  "closing": "one short motivating line to close on"
}

"wins" always has at least 1 entry — never fabricated, never generic. "adjustments" should be concrete and specific enough that the user knows exactly what to do differently (e.g. tied to a specific metric or pattern), not vague advice like "try to be more consistent." Still no filler anywhere — depth means specific and useful, not longer for its own sake.`
      : `Generate a concise ${userProfile.period} progress review for a user:
Meals logged: ${userProfile.mealsLogged}
Workouts completed: ${userProfile.workoutsCompleted}
Weight change: ${userProfile.weightChange} kg
Body metrics: ${JSON.stringify(userProfile.bodyMetrics)}

People want to see what they're doing well before anything else. Return ONLY valid JSON with no markdown, structured exactly like this:
{
  "wins": ["short, specific, genuine positive callout", "a second one if there's a real second win, otherwise omit"],
  "insight": "one short sentence on a behavioral pattern worth noting — omit this field entirely if nothing stands out",
  "adjustments": ["one short sentence suggesting a change — omit the field entirely if nothing is warranted"],
  "closing": "one short motivating line to close on"
}

"wins" always has at least 1 entry — find something genuinely true and specific to praise even in a quiet week (e.g. showing up at all, one good session, consistency on one metric). Never fabricate a win that isn't supported by the numbers, and never pad with generic praise. Keep every field short — this is meant to be scanned in a few seconds, not read as a report.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: isElite ? 1100 : 700,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return { wins: ["You showed up this week — that's what counts."], closing: "Keep it going." };
    }
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { wins: ["You showed up this week — that's what counts."], closing: "Keep it going." };
    }
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        wins: Array.isArray(parsed.wins) && parsed.wins.length ? parsed.wins : ["You showed up this week — that's what counts."],
        insight: typeof parsed.insight === "string" ? parsed.insight : undefined,
        adjustments: Array.isArray(parsed.adjustments) && parsed.adjustments.length
          ? parsed.adjustments.filter((a: unknown) => typeof a === "string")
          : undefined,
        closing: typeof parsed.closing === "string" ? parsed.closing : "Keep it going.",
      };
    } catch {
      return { wins: ["You showed up this week — that's what counts."], closing: "Keep it going." };
    }
  }

  async generateCrossDomainInsights(signals: CrossDomainSignal[]): Promise<string[]> {
    const prompt = `You are a fitness coach. Here are some notable co-occurring changes in a user's data this week, already computed:
${signals.map((s) => `- ${s.description}`).join("\n")}

Turn these into 2-4 short, specific, encouraging insight sentences a user would actually want to read on their dashboard. Don't just restate the numbers — connect them to something the user can act on. Don't claim certainty about causation, phrase them as observations worth paying attention to.

Return ONLY a valid JSON array of strings, no markdown, no other text. Example: ["Your sleep dropped this week, and so did your workout volume — prioritizing rest might help your numbers bounce back.", "..."]`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") return [];
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
    } catch {
      return [];
    }
  }

  async analyzeForm(input: FormCheckInput): Promise<FormCheckResult> {
    const imageContent = input.images.map((img) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: (img.mimeType || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
        data: img.base64,
      },
    }));

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            ...imageContent,
            {
              type: "text",
              text: `You are an expert personal trainer analyzing ${input.exerciseName} form.${input.userNotes ? ` User notes: ${input.userNotes}` : ""}

IMPORTANT: Before doing anything else, check whether a person is clearly visible actually performing the movement. If ANY of the following are true — no person is visible, the images show an empty room/wall/floor/object, the images are too dark, blurry, or low-quality to assess movement, or the person is not visibly performing the exercise — respond with ONLY this JSON and nothing else: {"error":"no_person_detected"}

Only if a person clearly performing the exercise is visible, return ONLY valid JSON with no markdown:
{
  "exerciseName": "${input.exerciseName}",
  "overallScore": <integer 1-10>,
  "muscles": ["primary and secondary muscles worked, e.g. quads, glutes, hamstrings, core"],
  "positives": ["2-4 specific things the user is doing well"],
  "corrections": ["2-4 specific form corrections needed"],
  "cues": ["2-3 short coaching cues to repeat during the movement"],
  "safetyWarnings": ["injury-risk concerns — empty array if none"],
  "summary": "2-3 sentence overall assessment"
}

Be specific, actionable, and encouraging. Never diagnose injuries.`,
            },
          ],
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Invalid response type");
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const result = JSON.parse(jsonMatch[0]);
    if (result.error === "no_person_detected") {
      throw new Error("No person detected performing the exercise. Please make sure you're clearly visible in frame and try again.");
    }
    return result;
  }

  async chat(userMessage: string, context: ChatContext): Promise<string> {
    const tierGating = buildTierGatingPrompt(context.tier);
    const systemPrompt = `You are Active AI, a personalized fitness and nutrition coaching assistant.
Provide evidence-based, motivating coaching using the user's profile data.
Never provide medical diagnoses.
${tierGating}
${context.coachingDirective ? `Coaching Adaptation Directive:\n${context.coachingDirective}\n` : ""}${context.trendsSummary ? `Longitudinal Trends:\n${context.trendsSummary}\n` : ""}${context.healthSummary ? `Recent Health Data:\n${context.healthSummary}\n` : ""}User Profile: ${JSON.stringify(context.userProfile)}
Recent Goals: ${JSON.stringify(context.goals)}
Recent Meals: ${JSON.stringify(context.recentMeals?.slice(0, 5))}
Recent Workouts: ${JSON.stringify(context.recentWorkouts?.slice(0, 5))}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [...(context.conversationHistory ?? []), { role: "user", content: userMessage }],
    });

    const content = message.content[0];
    return content.type === "text" ? content.text : "I couldn't process your question.";
  }
}

export default new AnthropicProvider();
