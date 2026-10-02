import OpenAI from "openai";
import { buildTierGatingPrompt } from "@/lib/coach-tier-prompt";
import { COACH_ACTIONS_PROMPT } from "@/lib/coach-actions";
import { expandWeekWithProgression } from "@/lib/workout-progression";
import { orderWeek } from "@/lib/workout-ordering";
import { MUSCLE_GROUPS } from "@/lib/exercise-muscles";
import { validateWeek, describeProblems } from "@/lib/workout-validation";
import { expandDaysWithRotation } from "@/lib/meal-plan-rotation";
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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Pulls the JSON object out of a completion, failing loudly when the model ran
 * out of tokens mid-object.
 *
 * response_format: json_object only guarantees well-formed JSON when the model
 * is allowed to finish. Hit max_tokens and the output is cut off mid-array, and
 * the only symptom users saw was a raw parser message ("Expected ',' or ']'
 * after array element in JSON at position 4658"), which says nothing about the
 * real cause. finish_reason distinguishes the two.
 */
function parseJsonCompletion<T>(
  response: { choices: Array<{ message: { content: string | null }; finish_reason?: string | null }> },
  label: string
): T {
  const choice = response.choices[0];
  const content = choice?.message?.content;
  if (!content) throw new Error(`No response from OpenAI while generating ${label}`);

  if (choice.finish_reason === "length") {
    throw new Error(
      `The ${label} response was cut off before it finished (hit the token limit). ` +
        `Try again, or reduce how much is being asked for in one call.`
    );
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error(`Raw OpenAI ${label} response:`, content);
    throw new Error(`AI did not return JSON for ${label}: "${content.slice(0, 200)}"`);
  }

  try {
    return JSON.parse(jsonMatch[0]) as T;
  } catch (e) {
    console.error(`Unparseable OpenAI ${label} response:`, content);
    throw new Error(`AI returned malformed JSON for ${label}: ${(e as Error).message}`);
  }
}

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
    // Only week 1 is AI-authored — weeks 2+ apply progressive overload to that same
    // week programmatically (see expandWeekWithProgression). Asking the model to
    // hand-write every week of a multi-week program was the single biggest driver
    // of slow generation (~40s for a 4-week plan vs. ~10s for one week).
    const prompt = `You are an experienced personal trainer designing week 1 of a personalized ${userProfile.durationWeeks}-week workout program.

Client profile:
- Goal: ${userProfile.goal}
- Experience: ${userProfile.experience}
- Equipment available: ${userProfile.equipment.join(", ")}
- Days per week: ${userProfile.daysPerWeek}
${userProfile.sex ? `- Sex: ${userProfile.sex}` : ""}
${userProfile.bodyGoalFocus ? `- Stated body goal / aesthetic focus: ${userProfile.bodyGoalFocus}` : ""}
${userProfile.specificFocus ? `- Specific thing they want to fix/improve: ${userProfile.specificFocus}` : ""}
${userProfile.assessmentSummary ? `- Latest body assessment notes: ${userProfile.assessmentSummary}` : ""}
${userProfile.injuryHistory ? `- Reported injury/mobility limitation: "${userProfile.injuryHistory}"` : ""}

Use the client's stated goal/focus and body assessment notes (if provided) to decide which muscle groups should get priority volume/frequency and which exercises best fit their body type and aim. For example, someone wanting a leaner/smaller look needs different exercise selection and volume distribution than someone wanting to build size in a specific area. Be specific and personalized rather than generic.
${userProfile.injuryHistory ? `\nIf an injury or mobility limitation is reported, avoid exercises that would aggravate it, substitute safe alternatives, and include general mobility/maintenance work for the affected area(s) — framed as general wellness, not treatment or rehab. This is general guidance, not medical advice.\n` : ""}
Return ONLY valid JSON with no markdown, structured exactly like this:
{
  "coachNote": "2-3 sentences, written directly to the client: how this program is tailored to their stated goal and body type, and honest, encouraging guidance on whether their goal is realistic and what to focus on to get there.",
  "week": {
    "weekNumber": 1,
    "progressionStrategy": "short description of this week's progressive overload focus",
    "days": [
      {
        "dayOfWeek": 0,
        "focus": "Glutes & Hamstrings",
        "focusMuscles": ["glutes", "hamstrings"],
        "exercises": [
          { "exerciseName": "Barbell Back Squat", "sets": 4, "reps": "6-8", "restSeconds": 90, "notes": "optional coaching cue", "category": "strength", "movementType": "compound", "isPriority": true, "muscles": ["quads", "glutes", "hamstrings"] },
          { "exerciseName": "Hanging Leg Raise", "sets": 3, "reps": "10-12", "restSeconds": 30, "notes": "part of the ab circuit", "category": "core", "movementType": "isolation", "isPriority": false, "muscles": ["abs"] }
        ]
      }
    ]
  }
}

The week must have exactly ${userProfile.daysPerWeek} day entries (dayOfWeek values 0-6 for Monday-Sunday, spread sensibly so rest falls between sessions). Only include days the client actually trains — do not add a rest or recovery entry, and never return a day with an empty exercise list.

MUSCLE GROUPS — use only these exact words, in "muscles" on every exercise and "focusMuscles" on every day: ${MUSCLE_GROUPS.join(", ")}. Do not invent others ("posterior chain", "core stability" and the like are not valid). "muscles" lists what that exercise actually trains, and must be accurate — a squat is quads/glutes/hamstrings even on a day focused elsewhere.

SPLIT — decide this first, before choosing any exercise.
Give every day a "focus" naming the muscle groups it trains, e.g. "Glutes & Hamstrings", "Back & Biceps", "Chest & Triceps", "Upper Body", "Legs & Core", and a "focusMuscles" list saying the same thing in the vocabulary above. Choose a coherent split for ${userProfile.daysPerWeek} days a week — commonly full-body for 3, upper/lower for 4, push/pull/legs plus an upper/lower for 5, push/pull/legs twice for 6 — and give the muscle group the client's goal is about 2-3 of those sessions rather than one.

Every exercise on a day must train that day's stated focus. A squat belongs on a leg or glute day, never on a back day; a chest press belongs on a push or upper day, never on a leg day. One core or mobility finisher at the end of a session is fine on any day. Do not assemble a day from unrelated body parts — four exercises hitting legs, chest, hamstrings and rear delts in one session is wrong, however good each exercise is on its own.

SESSION LENGTH — each day has two parts.

Main work: exactly 5 exercises that train the day's stated focus, tagged "category": "strength" (or "cardio" where a conditioning piece genuinely fits the focus). All 5 must be real training for that focus. Do not count an ab or core movement toward these 5 — a day of three lifts and a plank is not a full session.
${
  userProfile.dayStructure === "separate"
    ? `Build each day as EITHER a heavy day or a pump day, alternating through the week so consecutive sessions are not the same shape.

A heavy day: all 5 main exercises are compound, multi-joint lifts — squats, hinges, presses, rows, pull-ups, lunges, hip thrusts — with heavier loading and lower reps (4-8) and longer rest (90-150s). No isolation work in the main block.

A pump day: all 5 main exercises are single-joint isolation work — curls, extensions, raises, flyes, kickbacks, leg curls — with higher reps (12-20) and shorter rest (30-60s). No compound lifts in the main block.

Say which a day is in its "focus", e.g. "Glutes & Hamstrings - Heavy" or "Arms & Shoulders - Pump". Give the client's priority muscle group at least one of each.`
    : `Lead with compound lifts and finish with isolation work — roughly 2-3 compounds then 2-3 isolation exercises.`
}

Ab circuit: then 2-3 core exercises, each tagged "category": "core", with short rest (30-45 seconds) so they read as a circuit rather than straight sets. Vary them — a brace, a flexion movement and a rotation or anti-rotation, not three variations of the same crunch. Every day gets a core circuit.

So a normal day is 7-8 exercises in total: 5 main plus a 2-3 exercise ab circuit. Use "mobility" only for genuine warm-up or cooldown work, and only where an injury or limitation makes it worthwhile.

Label every exercise with two more fields, which decide the order it is performed in:
- "movementType": "compound" for multi-joint lifts (squat, deadlift, hip thrust, press, row, pull-up, lunge, leg press), "isolation" for single-joint work (curl, extension, lateral raise, kickback, calf raise).
- "isPriority": true only for the exercises that directly train the muscle group the client's stated goal or focus is about, false otherwise.

Order each day so the client does the heaviest work for their stated goal while they are freshest: priority compound lifts first, then remaining compounds, then isolation work, then any cardio or mobility. A client whose goal is glutes should start on hip thrusts or squats, not reach them third after their legs are already fatigued.`;

    // Sized to one week's output instead of the whole program — the main lever
    // that makes this fast, on top of only asking for one week in the first place.
    //
    // The per-exercise figure was 45, which was measured against the bare example
    // object. A real one carries a "notes" coaching cue and a long exerciseName and
    // costs 55-70, so a 5-day week overran its budget and was truncated mid-array.
    //
    // A day is now 5 main exercises plus a 2-3 move ab circuit, so budget for 8
    // per day rather than 5. At 6 days that is 48 exercises, which is why the
    // ceiling is 5000 rather than 4000.
    const EXERCISES_PER_DAY = 8;
    const TOKENS_PER_EXERCISE = 70;
    const workoutMaxTokens = Math.min(
      5000,
      Math.ceil(userProfile.daysPerWeek * EXERCISES_PER_DAY * TOKENS_PER_EXERCISE + 600)
    );

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      max_tokens: workoutMaxTokens,
      messages: [{ role: "user", content: prompt }],
    });

    let parsed = parseJsonCompletion<{ coachNote: string; week: WorkoutPlanResult["weeks"][0] }>(
      response,
      "workout program"
    );
    // The prompt asks for training order, but asking is not the same as getting
    // it, so the order is enforced here, along with the ab circuit, before the
    // week is checked.
    let week = orderWeek(parsed.week);
    let problems = validateWeek(week, userProfile.daysPerWeek);

    // One retry, with the specific failures handed back. The model is good at
    // fixing a named mistake and poor at avoiding it unprompted — a squat on a
    // back day, four main exercises instead of five, a stray empty rest day.
    if (problems.length) {
      console.warn(
        "Workout generation failed validation, retrying:",
        problems.map((p) => p.message)
      );
      const retry = await openai.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        max_tokens: workoutMaxTokens,
        messages: [
          { role: "user", content: prompt },
          { role: "assistant", content: response.choices[0].message.content ?? "" },
          { role: "user", content: describeProblems(problems) },
        ],
      });
      const reparsed = parseJsonCompletion<{ coachNote: string; week: WorkoutPlanResult["weeks"][0] }>(
        retry,
        "workout program"
      );
      const retryWeek = orderWeek(reparsed.week);
      const retryProblems = validateWeek(retryWeek, userProfile.daysPerWeek);
      // Keep whichever attempt is closer to correct rather than assuming the
      // second is better — occasionally the retry fixes one thing and breaks another.
      if (retryProblems.length <= problems.length) {
        parsed = reparsed;
        week = retryWeek;
        problems = retryProblems;
      }
      if (problems.length) {
        console.warn(
          "Workout generation still imperfect after retry:",
          problems.map((p) => p.message)
        );
      }
    }

    return {
      coachNote: parsed.coachNote,
      weeks: expandWeekWithProgression(week, userProfile.durationWeeks),
    };
  }

  async generateMealPlan(userProfile: NutritionGenerationInput): Promise<MealPlanResult> {
    // Only 3 template days are AI-authored, then rotated across the full week
    // programmatically (see expandDaysWithRotation) — asking for all 7 unique
    // days in one call was the main driver of slow meal-plan generation, same
    // root cause as the earlier workout-generation fix.
    const TEMPLATE_DAY_COUNT = 3;
    const isPrecisionTier = userProfile.tier === "pro" || userProfile.tier === "elite";

    const foodsInstruction = isPrecisionTier
      ? `Each food item must include an exact gram (or ml for liquids) measurement in parentheses, e.g. "3 large eggs (150g)", "1 cup dry oatmeal (80g)", "1 medium banana (118g)" — precise enough that the calorie/macro totals are traceable back to real measured quantities, not vague portions.`
      : `Each food item should use realistic everyday quantities, e.g. "3 whole eggs", "1 cup oatmeal", "1 banana".`;

    const prompt = `Create ${TEMPLATE_DAY_COUNT} varied template days of a personalized meal plan for someone with:
- Goal: ${userProfile.goal}
- Weight: ${userProfile.weight} kg
- Activity Level: ${userProfile.activityLevel}
- Diet Preferences: ${userProfile.dietPreferences.join(", ")}
- Allergies: ${userProfile.foodAllergies.join(", ")}

Return ONLY valid JSON with no markdown, structured exactly like this:
{
  "days": [
    {
      "day": "Day 1",
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

Generate exactly ${TEMPLATE_DAY_COUNT} day entries, labeled "Day 1", "Day 2", "Day 3" — these will be rotated across a full week, so make them meaningfully different from each other rather than near-duplicates. Each day must include Breakfast, Lunch, Dinner, and a Snack (4 meals). ${foodsInstruction} Give accurate calorie/protein/carb/fat totals for each meal, respecting the stated diet preferences and allergies.`;

    // Sized for 3 template days instead of 7 — precision-tier output has more
    // detail per food item, so it gets a bit more headroom.
    const maxTokens = isPrecisionTier ? 1800 : 1400;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });

    const parsed = parseJsonCompletion<MealPlanResult>(response, "meal plan");
    return { days: expandDaysWithRotation(parsed.days, 7) };
  }

  // Not currently used — progress_review routes to AnthropicProvider (see ai-registry.ts).
  // Kept in sync with that prompt's structured, wins-first, tier-aware approach in case routing ever changes.
  async generateProgressReview(userProfile: ProgressReviewInput): Promise<ProgressReviewResult> {
    const isElite = userProfile.tier === "elite";

    const prompt = isElite
      ? `Create an in-depth ${userProfile.period} progress review for a user with:
- Meals logged: ${userProfile.mealsLogged}
- Workouts completed: ${userProfile.workoutsCompleted}
- Weight change: ${userProfile.weightChange} kg
- Body metrics: ${JSON.stringify(userProfile.bodyMetrics)}

This user is on the top subscription tier — give them real depth on top of the wins, not just a longer generic review. Return ONLY valid JSON with no markdown, structured exactly like this:
{
  "wins": ["short, specific, genuine positive callout", "a second one if real", "a third if genuinely warranted, otherwise omit"],
  "insight": "2-3 sentences on a real, specific behavioral pattern — omit entirely if nothing stands out",
  "adjustments": ["one specific, actionable fix tied to the actual numbers", "a second if genuinely warranted", "a third if warranted — omit the field entirely if nothing is worth changing"],
  "closing": "one short motivating line to close on"
}

"wins" always has at least 1 entry, never fabricated. "adjustments" must be concrete and specific, not vague advice. No filler — depth means specific, not longer for its own sake.`
      : `Create a concise ${userProfile.period} progress review for a user with:
- Meals logged: ${userProfile.mealsLogged}
- Workouts completed: ${userProfile.workoutsCompleted}
- Weight change: ${userProfile.weightChange} kg
- Body metrics: ${JSON.stringify(userProfile.bodyMetrics)}

People want to see what they're doing well before anything else. Return ONLY valid JSON with no markdown, structured exactly like this:
{
  "wins": ["short, specific, genuine positive callout", "a second one if there's a real second win, otherwise omit"],
  "insight": "one short sentence on a behavioral pattern worth noting — omit this field entirely if nothing stands out",
  "adjustments": ["one short sentence suggesting a change — omit the field entirely if nothing is warranted"],
  "closing": "one short motivating line to close on"
}

"wins" always has at least 1 entry — find something genuinely true and specific to praise even in a quiet week. Never fabricate a win, never pad with generic praise. Keep every field short.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      max_tokens: isElite ? 1100 : 700,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.choices[0].message.content;
    const jsonMatch = content?.match(/\{[\s\S]*\}/);
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
    const systemPrompt = `You are Active AI, a personalized fitness and nutrition coaching assistant.
You have access to the user's profile, recent meals, workouts, and goals. Provide personalized,
motivating, and evidence-based coaching. Never provide medical diagnoses.

Talk like a knowledgeable friend, not a textbook or a support bot. Match the user's energy — if
they're casual, joking, or informal, be casual and have a little fun with it before landing on the
real answer. Use contractions, keep it conversational, and don't stack disclaimers or hedge unless
the question genuinely calls for one. Playful is about delivery and warmth, not about being vague —
the actual info should stay specific and accurate.

Keep responses short and conversational — a few sentences to a short paragraph, like a text, not an
essay. Only go longer if the user's question genuinely needs it (e.g. they ask for a full plan or a
detailed breakdown).

When a response genuinely covers multiple distinct points (not a single quick answer), give it real
structure instead of one dense paragraph: put each topic as its own short bold subtitle on its own
line (e.g. "**Protein**"), with the actual detail below it on separate lines. Most people skim
rather than read a wall of text, so a real breakdown with subtitles is easier to scan than a single
undifferentiated block. Don't force this structure onto a short, single-point answer — it's only for
responses that actually break down into multiple topics.

${COACH_ACTIONS_PROMPT}
${tierGating}
${context.coachingDirective ? `Coaching Adaptation Directive:\n${context.coachingDirective}\n` : ""}${context.trendsSummary ? `Longitudinal Trends:\n${context.trendsSummary}\n` : ""}${context.healthSummary ? `Recent Health Data:\n${context.healthSummary}\n` : ""}User Profile: ${JSON.stringify(context.userProfile)}
Recent Goals: ${JSON.stringify(context.goals)}
Recent Meals: ${JSON.stringify(context.recentMeals?.slice(0, 5))}
Recent Workouts: ${JSON.stringify(context.recentWorkouts?.slice(0, 5))}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 700,
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
