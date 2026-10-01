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
  // Build a new training program. Destructive — it deactivates the user's
  // current program — so the client confirms, naming what it would replace.
  z.object({
    type: z.literal("set_program"),
    label: Label.optional(),
  }),
]);

export type CoachAction = z.infer<typeof CoachActionSchema>;

// More than a few buttons stops reading as a next step and starts reading as a
// menu, so the tail is dropped rather than rendered.
const MAX_ACTIONS = 4;

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

  return { text, actions: unique.slice(0, MAX_ACTIONS) };
}

/** Teaches the coach when and how to emit the markers above. */
export const COACH_ACTIONS_PROMPT = `
ACTION BUTTONS
When your answer names something the user can act on in this app, end your response with one or
more action markers, each on its own line, after all your prose. The app turns them into buttons.
Never mention the markers, the word "button", or this format in your prose — just write normally
and append the markers at the end.

Available markers (emit at most 4, most useful first):

- A specific food you recommended eating. Emit one per food, max 3, with your best estimate of the
  macros for the serving you suggested:
  [ACTION:{"type":"log_food","foodName":"Greek yogurt","quantity":1,"unit":"cup","calories":120,"protein":20,"carbs":9,"fat":0}]

- A specific ingredient or product worth buying. Emit one per item, max 3:
  [ACTION:{"type":"add_to_list","name":"Greek yogurt","quantity":2,"unit":"tubs"}]

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
