import { z } from "zod";

/**
 * Actionable buttons under a coach reply.
 *
 * The coach emits `[ACTION:{...}]` markers inline; the server strips them out of
 * the text and hands the client a validated list. This mirrors the existing
 * `[UPGRADE:tier]` marker rather than introducing a second mechanism.
 *
 * Everything here is untrusted model output: it is parsed, validated, and
 * clamped before it reaches the client, and no action writes anything on its
 * own — each one only pre-fills a request the user still has to confirm.
 */

// Only screens that exist as routes in RootNavigator. An unknown screen name
// would navigate nowhere and leave a dead button in the transcript.
export const NAVIGABLE_SCREENS = [
  "Dashboard",
  "FoodScanner",
  "Workouts",
  "Nutrition",
  "Profile",
  "FoodDiary",
  "ShoppingList",
  "Progress",
  "ProgressPhotos",
  "BodyScan",
  "AssessmentResults",
  "FormCheck",
  "Supplements",
  "Friends",
  "Pricing",
] as const;

const Label = z.string().trim().min(1).max(40);

export const CoachActionSchema = z.discriminatedUnion("type", [
  // Log a recommended food to today's diary. Macros are model estimates, same
  // as the food scanner's, so the client confirms them before writing.
  z.object({
    type: z.literal("log_food"),
    foodName: z.string().trim().min(1).max(80),
    quantity: z.number().positive().max(10000).default(1),
    unit: z.string().trim().min(1).max(20).default("serving"),
    calories: z.number().min(0).max(10000),
    protein: z.number().min(0).max(1000).default(0),
    carbs: z.number().min(0).max(1000).default(0),
    fat: z.number().min(0).max(1000).default(0),
    fiber: z.number().min(0).max(1000).default(0),
  }),
  // A full recipe: one meal made of several ingredients, each with its own
  // macros. Maps onto /api/food/manual, which already takes an items array, so
  // logging the whole thing is one request rather than one per ingredient.
  // Paid tiers only — stripped server-side for free users, not just discouraged
  // in the prompt.
  z.object({
    type: z.literal("log_recipe"),
    mealName: z.string().trim().min(1).max(80),
    mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).default("snack"),
    items: z.array(
      z.object({
        foodName: z.string().trim().min(1).max(80),
        quantity: z.number().positive().max(10000).default(1),
        unit: z.string().trim().min(1).max(20).default("serving"),
        calories: z.number().min(0).max(5000),
        protein: z.number().min(0).max(500).default(0),
        carbs: z.number().min(0).max(500).default(0),
        fat: z.number().min(0).max(500).default(0),
        fiber: z.number().min(0).max(500).default(0),
      })
    ).min(1).max(12),
  }),
  // Add an ingredient to the shopping list. No macros, trivially undone.
  z.object({
    type: z.literal("add_to_list"),
    name: z.string().trim().min(1).max(100),
    quantity: z.number().positive().max(10000).optional(),
    unit: z.string().trim().max(20).optional(),
  }),
  // Deep-link to the part of the app the answer is about.
  z.object({
    type: z.literal("open"),
    screen: z.enum(NAVIGABLE_SCREENS),
    label: Label.optional(),
  }),
  // Log an exercise the coach just talked about. The counterpart to log_food:
  // the coach could suggest a session and the user still had to go and enter it
  // by hand, which is the moment most people stop bothering.
  z.object({
    type: z.literal("log_workout"),
    exerciseName: z.string().trim().min(1).max(80),
    sets: z.number().int().positive().max(20),
    reps: z.string().trim().min(1).max(20),
    weight: z.number().min(0).max(2000).optional(),
  }),
  // Build a new training program. Destructive — it deactivates the user's
  // current program — so the client confirms, naming what it would replace.
  z.object({
    type: z.literal("set_program"),
    label: Label.optional(),
  }),
]);

export type CoachAction = z.infer<typeof CoachActionSchema>;

// Enough for a button per item in a three-item recommendation, plus a link.
// Beyond that it stops reading as a next step and starts reading as a menu.
const MAX_ACTIONS = 6;

/** What an action is about, so two actions on the same food can be recognised. */
function subjectOf(a: CoachAction): string {
  if (a.type === "log_food") return a.foodName.trim().toLowerCase();
  if (a.type === "log_recipe") return a.mealName.trim().toLowerCase();
  if (a.type === "add_to_list") return a.name.trim().toLowerCase();
  if (a.type === "log_workout") return a.exerciseName.trim().toLowerCase();
  if (a.type === "open") return `screen:${a.screen}`;
  return "program";
}

const MARKER = "[ACTION:";

/**
 * Finds the index just past the JSON object starting at `from`, respecting
 * strings and escapes. Scanning for a literal "}]" would break on any food name
 * containing a brace or bracket.
 */
function objectEnd(s: string, from: number): number {
  let depth = 0;
  let inStr = false;
  for (let i = from; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** Strips `[ACTION:{...}]` markers out of a reply and returns the valid ones. */
export function extractActions(raw: string): { text: string; actions: CoachAction[] } {
  const actions: CoachAction[] = [];
  let text = "";
  let cursor = 0;

  for (;;) {
    const start = raw.indexOf(MARKER, cursor);
    if (start === -1) break;

    const braceStart = raw.indexOf("{", start + MARKER.length);
    const braceEnd = braceStart === -1 ? -1 : objectEnd(raw, braceStart);
    // Malformed marker: keep the literal text and move past it rather than
    // silently swallowing the rest of the reply.
    if (braceEnd === -1 || raw[braceEnd] !== "]") {
      text += raw.slice(cursor, start + MARKER.length);
      cursor = start + MARKER.length;
      continue;
    }

    text += raw.slice(cursor, start);
    cursor = braceEnd + 1;

    try {
      const parsed = CoachActionSchema.safeParse(JSON.parse(raw.slice(braceStart, braceEnd)));
      if (parsed.success) actions.push(parsed.data);
    } catch {
      // Unparseable JSON — drop the button, keep the answer.
    }
  }
  text += raw.slice(cursor);

  // Tidy the holes left where markers were removed — a doubled space from an
  // inline marker, trailing spaces, a run of blank lines — without flattening
  // the paragraph breaks the chat renderer depends on.
  text = text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const seen = new Set<string>();
  const unique = actions.filter((a) => {
    const key = JSON.stringify(a);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Give every distinct thing a button before giving anything a second one.
  // Taking the first N instead meant a reply naming three foods could spend both
  // its slots on log + shopping-list for the first food, leaving the other two
  // with no button at all — which is exactly what users saw.
  const firstPass: CoachAction[] = [];
  const overflow: CoachAction[] = [];
  const covered = new Set<string>();
  for (const a of unique) {
    const subject = subjectOf(a);
    if (covered.has(subject)) overflow.push(a);
    else { covered.add(subject); firstPass.push(a); }
  }

  return { text, actions: [...firstPass, ...overflow].slice(0, MAX_ACTIONS) };
}

/**
 * Actions a given tier is allowed to receive.
 *
 * Recipes are a paid feature, so a free user's actions are filtered here rather
 * than merely discouraged in the prompt — the model will emit one eventually
 * whatever the prompt says, and a button that cannot be honoured is worse than
 * no button. The prose stays: a free user still gets the suggestion, just not
 * the costed-out recipe with a one-tap log.
 */
export function actionsForTier(actions: CoachAction[], isPremium: boolean): CoachAction[] {
  if (isPremium) return actions;
  return actions.filter((a) => a.type !== "log_recipe");
}

/** Teaches the coach when and how to emit the markers above. */
export const COACH_ACTIONS_PROMPT = `
ACTION BUTTONS
When your answer names something the user can act on in this app, end your response with one or
more action markers, each on its own line, after all your prose. The app turns them into buttons.
Never mention the markers, the word "button", or this format in your prose — just write normally
and append the markers at the end.

Available markers (emit at most 6, most useful first):

- A specific food you recommended eating, with your best estimate of the macros for the serving you
  suggested:
  [ACTION:{"type":"log_food","foodName":"Greek yogurt","quantity":1,"unit":"cup","calories":120,"protein":20,"carbs":9,"fat":0}]

  EVERY food you name in the answer gets its own marker. If you suggest three foods, emit three
  log_food markers — one for each, in the order you mentioned them. Emitting a marker for only the
  first one is wrong; the others become unclickable and the answer feels broken. Max 3 foods.

- A complete recipe you are telling them to make, broken into ingredients with per-ingredient
  macros. Use this instead of log_food whenever you give an actual recipe rather than naming a
  single food:
  [ACTION:{"type":"log_recipe","mealName":"Chicken and rice bowl","mealType":"lunch","items":[{"foodName":"Chicken breast","quantity":170,"unit":"g","calories":280,"protein":52,"carbs":0,"fat":6},{"foodName":"Jasmine rice, cooked","quantity":180,"unit":"g","calories":234,"protein":5,"carbs":51,"fat":1}]}]

  Give real quantities, in grams or standard measures, and macros per ingredient that add up to
  something sensible for the meal. If they say they do not have one of the ingredients, rewrite the
  whole recipe around what they do have and emit a fresh marker — do not tell them to just leave it
  out and keep the old macros, because the numbers would then be wrong.

  When substituting, match the macro the original was there for, not just the food group. Swapping
  chicken for tofu halves the protein; swapping it for Greek yogurt, fish or a larger serving of
  something else protein-dense does not. If the macros still end up meaningfully different, say so
  in one short sentence rather than letting them discover it in their log.

- An exercise you just recommended or that is in today's session. Emit one per exercise, max 3,
  with the sets and reps you suggested:
  [ACTION:{"type":"log_workout","exerciseName":"Barbell Hip Thrust","sets":4,"reps":"8-10","weight":60}]

  Same rule as food: every exercise you name gets its own marker. Omit "weight" if you have no
  basis for one — guessing a load for someone is worse than leaving it blank for them to fill in.

- A specific ingredient or product worth buying. Emit one per item, max 3:
  [ACTION:{"type":"add_to_list","name":"Greek yogurt","quantity":2,"unit":"tubs"}]

  Use this when they are asking what to buy, shop for, or pick up. Do not pair it with log_food for
  the same food in the same answer — one button each for three foods is far more useful than two
  buttons for one food.

- The part of the app your answer is about, so they can go straight there. Emit at most one.
  Valid screens: ${NAVIGABLE_SCREENS.join(", ")}
  [ACTION:{"type":"open","screen":"Workouts","label":"Open Workouts"}]

- Only when the user is clearly asking for a NEW training program or plan to follow, not when they
  ask about today's session or an exercise. Emit at most one:
  [ACTION:{"type":"set_program","label":"Build this program"}]

Rules:
- Only emit a marker for something you actually named in the answer. Never invent a food, product
  or screen just to produce a button.
- A general or conversational answer needs no markers at all. Most answers have none.
- Use real numbers for log_food macros. If you genuinely cannot estimate them, use add_to_list
  instead, which needs none.
`.trim();
