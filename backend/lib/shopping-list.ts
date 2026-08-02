export interface MealPlanDayInput {
  meals: Array<{ foods: string[] }>;
}

export interface ShoppingListItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  checked: boolean;
  isCustom: boolean;
}

const CATEGORIES = {
  Proteins: [
    "chicken", "turkey", "beef", "salmon", "tuna", "shrimp", "tofu", "eggs", "egg",
    "whey", "protein", "fish", "steak", "pork", "bacon", "sausage", "ground beef",
    "ground turkey", "cod", "tilapia",
  ],
  Vegetables: [
    "broccoli", "spinach", "kale", "carrot", "celery", "pepper", "onion", "garlic",
    "tomato", "cucumber", "zucchini", "lettuce", "asparagus", "green bean",
    "bell pepper", "cauliflower", "mushroom", "cabbage",
  ],
  Fruits: [
    "apple", "banana", "berry", "blueberry", "strawberry", "orange", "mango",
    "grape", "pineapple", "lemon", "lime", "avocado",
  ],
  "Grains & Carbs": [
    "rice", "oat", "bread", "pasta", "quinoa", "sweet potato", "potato",
    "tortilla", "wrap", "cereal", "granola",
  ],
  "Dairy & Eggs": [
    "milk", "yogurt", "cheese", "cottage", "greek", "butter", "cream",
    "almond milk", "oat milk", "cottage cheese",
  ],
  "Pantry & Condiments": [
    "oil", "olive oil", "salt", "sauce", "spice", "seasoning", "vinegar", "honey",
    "almond", "nut", "peanut", "seed", "flax", "chia", "cinnamon", "vanilla",
    "coconut", "hummus", "chickpea", "lentil", "black bean",
  ],
} as const;

export function categorizeIngredient(name: string): string {
  const normalized = name.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some((k) => normalized.includes(k))) {
      return category;
    }
  }
  return "Other";
}

const KNOWN_UNITS = new Set([
  "cup", "cups", "tbsp", "tsp", "oz", "g", "gram", "grams", "lb", "lbs", "ml",
  "whole", "slice", "slices", "clove", "cloves", "can", "cans", "piece", "pieces",
  "scoop", "scoops", "fillet", "fillets",
]);

export function parseIngredientPhrase(phrase: string): { name: string; quantity: number; unit: string } {
  const trimmed = phrase.trim();

  const fractionMatch = trimmed.match(/^(\d+)\/(\d+)\s+(.+)$/);
  if (fractionMatch) {
    const [, num, denom, rest] = fractionMatch;
    return { name: rest.trim(), quantity: Number(num) / Number(denom), unit: "" };
  }

  const numberMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?\s+(.+)$/);
  if (numberMatch) {
    const [, qty, unitCandidate, rest] = numberMatch;
    if (unitCandidate && KNOWN_UNITS.has(unitCandidate.toLowerCase())) {
      return { name: rest.trim(), quantity: Number(qty), unit: unitCandidate.toLowerCase() };
    }
    const name = unitCandidate ? `${unitCandidate} ${rest}`.trim() : rest.trim();
    return { name, quantity: Number(qty), unit: "" };
  }

  return { name: trimmed, quantity: 1, unit: "" };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateShoppingList(days: MealPlanDayInput[]): ShoppingListItem[] {
  const byName = new Map<string, ShoppingListItem>();

  for (const day of days) {
    for (const meal of day.meals) {
      for (const foodPhrase of meal.foods) {
        const { name, quantity, unit } = parseIngredientPhrase(foodPhrase);
        const normalized = name.toLowerCase().trim();
        if (!normalized) continue;

        const existing = byName.get(normalized);
        if (existing) {
          existing.quantity += quantity;
        } else {
          const display = name.charAt(0).toUpperCase() + name.slice(1);
          byName.set(normalized, {
            id: slugify(normalized),
            name: display,
            quantity,
            unit,
            category: categorizeIngredient(normalized),
            checked: false,
            isCustom: false,
          });
        }
      }
    }
  }

  return [...byName.values()];
}
