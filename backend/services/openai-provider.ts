import OpenAI from "openai";
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
  FormCheckInput,
  FormCheckResult,
  ChatContext,
  CrossDomainSignal,
} from "./ai-provider";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class OpenAIProvider implements AIProvider {
  async analyzeFood(imageUrl: string): Promise<FoodAnalysisResult> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
            {
              type: "text",
              text: `Analyze this food image and identify every individual food item visible. For each item estimate its center position using normalized coordinates (x: 0=left, 1=right; y: 0=top, 1=bottom). Return ONLY valid JSON with no markdown:
{
  "foodName": "overall meal name",
  "quantity": 1,
  "unit": "serving",
  "calories": <total>,
  "protein": <total grams>,
  "carbs": <total grams>,
  "fat": <total grams>,
  "fiber": <total grams>,
  "confidenceScore": <0-1>,
  "items": [
    {
      "name": "item name",
      "quantity": <number>,
      "unit": "g/oz/cup/piece",
      "calories": <kcal>,
      "protein": <grams>,
      "carbs": <grams>,
      "fat": <grams>,
      "fiber": <grams>,
      "x": <0.0-1.0 horizontal center>,
      "y": <0.0-1.0 vertical center>
    }
  ]
}
Identify all distinct food items. Total calories/macros must equal sum of all items. If only one item is visible, still include it in the items array.`,
            },
          ],
        },
      ],
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("No response from OpenAI");

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      const result = JSON.parse(jsonMatch[0]);
      if (!result.items) result.items = [];
      return result;
    } catch (error) {
      console.error("Failed to parse food analysis response:", error);
      throw new Error("Failed to analyze food");
    }
  }

  async analyzeBody(input: BodyAnalysisInput): Promise<BodyAnalysisResult> {
    const userContext = `User Profile: Age ${input.userAge}, ${input.userSex}, Height ${input.userHeight}cm, Weight ${input.userWeight}kg`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a supportive fitness coach giving general, non-clinical training feedback to a gym client based on physique photos they submitted for coaching purposes (not a medical or health evaluation).

${userContext}

IMPORTANT: Before doing anything else, check whether a human body is clearly visible in the photos. If ANY of the following are true — no person is visible, the photos show a wall/floor/empty room/object, images are too dark or blurry to see a person, or the person is not standing in frame — respond with ONLY this JSON and nothing else: {"error":"no_person_detected"}

Only if a real person is clearly visible in the photos, give general visual fitness coaching feedback — describe build/muscle tone qualitatively (e.g. "lean", "moderate muscle definition", "athletic build"), general stance/posture observations, and training suggestions. Do not estimate body fat percentage, BMI, or any clinical/medical metric.

Also identify 4-6 body focus areas visible on the FRONT photo. For each area, estimate its position using normalized coordinates (x: 0=left, 1=right; y: 0=top, 1=bottom) based on a standing front-facing full-body photo. Typical positions: shoulders ~y:0.18, chest ~y:0.28, core/abs ~y:0.45, hips ~y:0.58, quads ~y:0.72, calves ~y:0.88.

Return ONLY valid JSON with no markdown:
{
  "bodyComposition": {
    "build": "qualitative description of overall build/muscle tone",
    "muscleDefinition": "qualitative assessment of muscle definition"
  },
  "posture": {
    "stance": "general stance observations",
    "shoulderAlignment": "general shoulder observations",
    "notes": "general posture notes"
  },
  "strengths": ["list of 3-5 positive observations"],
  "areasForImprovement": ["list of 3-5 areas to improve"],
  "recommendations": {
    "exercise": ["3-4 specific exercise recommendations"],
    "nutrition": ["3-4 general nutrition recommendations"],
    "recovery": ["2-3 recovery/sleep recommendations"]
  },
  "summary": "1-2 paragraph encouraging coaching summary and recommendations",
  "focusAreas": [
    {
      "label": "short area name (e.g. 'Shoulders', 'Core', 'Glutes')",
      "x": <0.0-1.0 horizontal center on front photo>,
      "y": <0.0-1.0 vertical center on front photo>,
      "type": "strength" or "improvement"
    }
  ]
}

This is informal coaching feedback only — never present results as a medical, clinical, or diagnostic assessment.`,
            },
            { type: "image_url", image_url: { url: input.frontImageUrl } },
            { type: "image_url", image_url: { url: input.sideImageUrl } },
            { type: "image_url", image_url: { url: input.backImageUrl } },
          ],
        },
      ],
    });

    const responseContent = response.choices[0].message.content;
    if (!responseContent) throw new Error("No response from OpenAI");

    try {
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("Raw OpenAI body analysis response:", responseContent);
        throw new Error(`AI did not return JSON: "${responseContent.slice(0, 200)}"`);
      }
      const result = JSON.parse(jsonMatch[0]);
      if (result.error === "no_person_detected") {
        throw new Error("No person detected in the scan photos. Please try again and make sure your full body is clearly visible in the frame.");
      }
      if (!result.focusAreas) result.focusAreas = [];
      return result;
    } catch (error: any) {
      console.error("Failed to parse body analysis response:", error);
      throw error;
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

Use the client's stated goal/focus and body assessment notes (if provided) to decide which muscle groups should get priority volume/frequency and which exercises best fit their body type and aim. For example, someone wanting a leaner/smaller look needs different exercise selection and volume distribution than someone wanting to build size in a specific area. Be specific and personalized rather than generic.

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

Generate exactly ${userProfile.durationWeeks} week entries. Each week must have exactly ${userProfile.daysPerWeek} day entries (dayOfWeek values 0-6 for Monday-Sunday, spread sensibly with rest days between sessions).

Each day must have exactly 4-5 exercises, chosen so that together they hit all the major muscle groups intended for that day's focus — prioritize balanced, non-redundant coverage and exercise selection that matches the client's stated goal over cramming in extra exercises.

Apply progressive overload (increasing intensity/volume) across weeks.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("No response from OpenAI");

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Raw OpenAI workout generation response:", content);
      throw new Error(`AI did not return JSON: "${content.slice(0, 200)}"`);
    }
    return JSON.parse(jsonMatch[0]);
  }

  async generateMealPlan(userProfile: NutritionGenerationInput): Promise<MealPlanResult> {
    const prompt = `Create a personalized 7-day meal plan for someone with:
- Goal: ${userProfile.goal}
- Weight: ${userProfile.weight} kg
- Activity Level: ${userProfile.activityLevel}
- Diet Preferences: ${userProfile.dietPreferences.join(", ")}
- Allergies: ${userProfile.foodAllergies.join(", ")}

Return ONLY valid JSON with no markdown, structured exactly like this:
{
  "days": [
    {
      "day": "Monday",
      "meals": [
        {
          "name": "Breakfast",
          "foods": ["3 whole eggs", "1 cup oatmeal", "1 banana"],
          "calories": 520,
          "protein": 32,
          "carbs": 60,
          "fat": 14
        }
      ]
    }
  ]
}

Generate exactly 7 days (Monday-Sunday). Each day must include Breakfast, Lunch, Dinner, and a Snack (4 meals). Each meal needs a realistic foods list and accurate calorie/protein/carb/fat totals for that meal, respecting the stated diet preferences and allergies. Vary meals across days rather than repeating the same plan every day.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("No response from OpenAI");

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Raw OpenAI meal plan response:", content);
      throw new Error(`AI did not return JSON: "${content.slice(0, 200)}"`);
    }
    return JSON.parse(jsonMatch[0]);
  }

  async generateProgressReview(userProfile: ProgressReviewInput): Promise<string> {
    const prompt = `Create a personalized ${userProfile.period} progress review for a user with:
- Meals logged: ${userProfile.mealsLogged}
- Workouts completed: ${userProfile.workoutsCompleted}
- Weight change: ${userProfile.weightChange} kg
- Body metrics: ${JSON.stringify(userProfile.bodyMetrics)}

Provide insights, positive reinforcement, and recommendations.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
    });

    return response.choices[0].message.content || "Failed to generate progress review";
  }

  async generateCrossDomainInsights(signals: CrossDomainSignal[]): Promise<string[]> {
    const prompt = `You are a fitness coach. Here are some notable co-occurring changes in a user's data this week, already computed:
${signals.map((s) => `- ${s.description}`).join("\n")}

Turn these into 2-4 short, specific, encouraging insight sentences a user would actually want to read on their dashboard. Don't just restate the numbers — connect them to something the user can act on. Don't claim certainty about causation, phrase them as observations worth paying attention to.

Return ONLY a valid JSON array of strings, no markdown, no other text. Example: ["Your sleep dropped this week, and so did your workout volume — prioritizing rest might help your numbers bounce back.", "..."]`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.choices[0].message.content;
    if (!content) return [];
    const jsonMatch = content.match(/\[[\s\S]*\]/);
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
      type: "image_url" as const,
      image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
    }));

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are an expert personal trainer and movement coach. Analyze the exercise form shown in ${input.images.length > 1 ? "these photos" : "this photo"} of a ${input.exerciseName}.${input.userNotes ? ` User notes: ${input.userNotes}` : ""}

IMPORTANT: Before doing anything else, check whether a person is clearly visible actually performing the movement. If ANY of the following are true — no person is visible, the images show an empty room/wall/floor/object, the images are too dark, blurry, or low-quality to assess movement, or the person is not visibly performing the exercise — respond with ONLY this JSON and nothing else: {"error":"no_person_detected"}

Only if a person clearly performing the exercise is visible, return ONLY valid JSON with no markdown:
{
  "exerciseName": "${input.exerciseName}",
  "overallScore": <integer 1-10>,
  "muscles": ["primary and secondary muscles worked, e.g. quads, glutes, hamstrings, core"],
  "positives": ["2-4 specific things the user is doing well"],
  "corrections": ["2-4 specific form corrections needed"],
  "cues": ["2-3 short coaching cues to repeat during the movement"],
  "safetyWarnings": ["any immediate injury-risk concerns — empty array if none"],
  "summary": "2-3 sentence overall assessment with the single most important fix"
}

Be specific, actionable, and encouraging. Never diagnose injuries.`,
            },
            ...imageContent,
          ],
        },
      ],
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("No response from OpenAI");
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const result = JSON.parse(jsonMatch[0]);
    if (result.error === "no_person_detected") {
      throw new Error("No person detected performing the exercise. Please make sure you're clearly visible in frame and try again.");
    }
    return result;
  }

  async chat(userMessage: string, context: ChatContext): Promise<string> {
    const tierGating = buildTierGatingPrompt(context.tier);
    const systemPrompt = `You are Active AI Coach, a personalized fitness and nutrition coaching assistant.
You have access to the user's profile, recent meals, workouts, and goals. Provide personalized,
motivating, and evidence-based coaching. Never provide medical diagnoses.
${tierGating}
${context.coachingDirective ? `Coaching Adaptation Directive:\n${context.coachingDirective}\n` : ""}${context.trendsSummary ? `Longitudinal Trends:\n${context.trendsSummary}\n` : ""}${context.healthSummary ? `Recent Health Data:\n${context.healthSummary}\n` : ""}User Profile: ${JSON.stringify(context.userProfile)}
Recent Goals: ${JSON.stringify(context.goals)}
Recent Meals: ${JSON.stringify(context.recentMeals?.slice(0, 5))}
Recent Workouts: ${JSON.stringify(context.recentWorkouts?.slice(0, 5))}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        ...(context.conversationHistory ?? []),
        { role: "user", content: userMessage },
      ],
    });

    return response.choices[0].message.content || "I couldn't process your question.";
  }
}

export default new OpenAIProvider();
