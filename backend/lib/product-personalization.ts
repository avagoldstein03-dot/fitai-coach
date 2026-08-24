import prisma from "@/lib/prisma";

export interface PersonalizationInput {
  product: {
    caloriesPer100g: number | null;
    proteinPer100g: number | null;
    carbsPer100g: number | null;
    fatPer100g: number | null;
    ingredientsText: string | null;
  };
  primaryGoal: string | null;
  targets: { dailyCaloricTarget: number; proteinTarget: number; carbsTarget: number; fatsTarget: number } | null;
  consumedToday: { calories: number; protein: number; carbs: number; fat: number };
  foodAllergies: string[];
  trainedToday: boolean;
}

export interface PersonalizationResult {
  remaining: { calories: number; protein: number; carbs: number; fat: number } | null;
  goalNote: string | null;
  allergyWarnings: string[];
  trainingNote: string | null;
}

// All-positive-framing rule: every branch here either notes a fit with the
// user's goal or a neutral timing observation — the "this is bad" framing
// already lives in the ingredient/additive score, this layer never repeats it.
export function computeProductPersonalization(input: PersonalizationInput): PersonalizationResult {
  const remaining = input.targets
    ? {
        calories: Math.round(input.targets.dailyCaloricTarget - input.consumedToday.calories),
        protein: Math.round(input.targets.proteinTarget - input.consumedToday.protein),
        carbs: Math.round(input.targets.carbsTarget - input.consumedToday.carbs),
        fat: Math.round(input.targets.fatsTarget - input.consumedToday.fat),
      }
    : null;

  let goalNote: string | null = null;
  const { caloriesPer100g, proteinPer100g, carbsPer100g } = input.product;
  if (proteinPer100g != null && caloriesPer100g != null && caloriesPer100g > 0) {
    const proteinPerCalorie = proteinPer100g / caloriesPer100g;
    if (input.primaryGoal === "fat_loss" && proteinPerCalorie >= 0.08) {
      goalNote = "Solid protein-per-calorie pick for a fat-loss goal.";
    } else if (input.primaryGoal === "muscle_gain" && proteinPer100g >= 15) {
      goalNote = "Good protein content to support a muscle-gain goal.";
    } else if (input.primaryGoal === "fat_loss" && caloriesPer100g >= 400 && proteinPerCalorie < 0.03) {
      goalNote = "Calorie-dense relative to its protein — worth portioning carefully for a fat-loss goal.";
    }
  }

  const allergyWarnings: string[] = [];
  if (input.product.ingredientsText && input.foodAllergies.length > 0) {
    const lowerIngredients = input.product.ingredientsText.toLowerCase();
    for (const allergen of input.foodAllergies) {
      const trimmed = allergen.trim().toLowerCase();
      if (trimmed && lowerIngredients.includes(trimmed)) {
        allergyWarnings.push(allergen);
      }
    }
  }

  let trainingNote: string | null = null;
  if (input.trainedToday && carbsPer100g != null && carbsPer100g >= 20) {
    trainingNote = "Higher in carbs — good timing for restocking energy after today's training.";
  }

  return { remaining, goalNote, allergyWarnings, trainingNote };
}

// Fetches the per-user context computeProductPersonalization needs. Kept
// separate from the pure function above so the scoring logic stays easy to
// test without a database.
export async function fetchPersonalizationContext(userId: string): Promise<Omit<PersonalizationInput, "product">> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [user, nutritionPlan, todaysMeals, recentWorkout] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { foodAllergies: true, goal: { select: { primaryGoal: true } } },
    }),
    prisma.nutritionPlan.findUnique({
      where: { userId },
      select: { dailyCaloricTarget: true, proteinTarget: true, carbsTarget: true, fatsTarget: true },
    }),
    prisma.meal.findMany({
      where: { userId, createdAt: { gte: startOfToday } },
      select: { totalCalories: true, totalProtein: true, totalCarbs: true, totalFat: true },
    }),
    prisma.workoutSession.findFirst({
      where: { userId, createdAt: { gte: startOfToday } },
      select: { id: true },
    }),
  ]);

  const consumedToday = todaysMeals.reduce(
    (sum, m) => ({
      calories: sum.calories + (m.totalCalories || 0),
      protein: sum.protein + (m.totalProtein || 0),
      carbs: sum.carbs + (m.totalCarbs || 0),
      fat: sum.fat + (m.totalFat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return {
    primaryGoal: user?.goal?.primaryGoal ?? null,
    targets: nutritionPlan
      ? {
          dailyCaloricTarget: nutritionPlan.dailyCaloricTarget,
          proteinTarget: nutritionPlan.proteinTarget,
          carbsTarget: nutritionPlan.carbsTarget,
          fatsTarget: nutritionPlan.fatsTarget,
        }
      : null,
    consumedToday,
    foodAllergies: user?.foodAllergies ?? [],
    trainedToday: !!recentWorkout,
  };
}
