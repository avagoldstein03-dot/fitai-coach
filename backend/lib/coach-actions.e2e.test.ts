import { extractActions } from "@/lib/coach-actions";
import { z } from "zod";

// The exact schemas the two write endpoints validate against, copied from
// backend/pages/api/food/manual.ts and nutrition/shopping-list.ts.
const FoodItemSchema = z.object({
  foodName: z.string().min(1),
  quantity: z.number().positive().default(1),
  unit: z.string().default("serving"),
  calories: z.number().min(0),
  protein: z.number().min(0).default(0),
  carbs: z.number().min(0).default(0),
  fat: z.number().min(0).default(0),
  fiber: z.number().min(0).default(0),
});
const ManualSchema = z.object({
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).default("snack"),
  items: z.array(FoodItemSchema).min(1),
});
const ListAddSchema = z.object({
  action: z.literal("add"),
  name: z.string().trim().min(1).max(100),
  quantity: z.number().positive().optional(),
  unit: z.string().trim().max(20).optional(),
});

describe("coach actions reach the real endpoints", () => {
  const reply = `You're about 40g short on protein.

Greek yogurt would close most of it in one go.

[ACTION:{"type":"log_food","foodName":"Greek yogurt","quantity":1,"unit":"cup","calories":120,"protein":20,"carbs":9,"fat":0}]
[ACTION:{"type":"add_to_list","name":"Greek yogurt","quantity":2,"unit":"tubs"}]
[ACTION:{"type":"open","screen":"FoodDiary","label":"Open diary"}]`;

  const { text, actions } = extractActions(reply);

  it("leaves clean prose with its paragraph break intact", () => {
    expect(text).toBe(
      "You're about 40g short on protein.\n\nGreek yogurt would close most of it in one go."
    );
    expect(text).not.toContain("ACTION");
  });

  it("builds a body /api/food/manual accepts", () => {
    const a = actions.find((x) => x.type === "log_food") as any;
    const body = {
      mealType: "snack",
      items: [{
        foodName: a.foodName, quantity: a.quantity, unit: a.unit,
        calories: a.calories, protein: a.protein, carbs: a.carbs, fat: a.fat, fiber: a.fiber,
      }],
    };
    expect(ManualSchema.safeParse(body).success).toBe(true);
  });

  it("builds a body /api/nutrition/shopping-list accepts", () => {
    const a = actions.find((x) => x.type === "add_to_list") as any;
    const body = { action: "add", name: a.name, quantity: a.quantity, unit: a.unit };
    expect(ListAddSchema.safeParse(body).success).toBe(true);
  });

  it("only ever emits screens that exist as routes", () => {
    const a = actions.find((x) => x.type === "open") as any;
    expect(a.screen).toBe("FoodDiary");
  });
});
