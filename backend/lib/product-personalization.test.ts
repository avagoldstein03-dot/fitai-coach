import { computeProductPersonalization, PersonalizationInput } from "./product-personalization";

const BASE_PRODUCT = {
  caloriesPer100g: null,
  proteinPer100g: null,
  carbsPer100g: null,
  fatPer100g: null,
  ingredientsText: null,
};

const BASE_INPUT: PersonalizationInput = {
  product: BASE_PRODUCT,
  primaryGoal: null,
  targets: null,
  consumedToday: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  foodAllergies: [],
  trainedToday: false,
};

describe("computeProductPersonalization", () => {
  it("returns null remaining when the user has no nutrition targets", () => {
    const result = computeProductPersonalization(BASE_INPUT);
    expect(result.remaining).toBeNull();
  });

  it("computes remaining macros as targets minus what's already consumed today", () => {
    const result = computeProductPersonalization({
      ...BASE_INPUT,
      targets: { dailyCaloricTarget: 2000, proteinTarget: 150, carbsTarget: 200, fatsTarget: 60 },
      consumedToday: { calories: 1200, protein: 90, carbs: 120, fat: 40 },
    });
    expect(result.remaining).toEqual({ calories: 800, protein: 60, carbs: 80, fat: 20 });
  });

  it("flags a high protein-per-calorie product as a good fit for a fat-loss goal", () => {
    const result = computeProductPersonalization({
      ...BASE_INPUT,
      primaryGoal: "fat_loss",
      product: { ...BASE_PRODUCT, caloriesPer100g: 120, proteinPer100g: 25 },
    });
    expect(result.goalNote).toMatch(/protein-per-calorie/i);
  });

  it("flags a calorie-dense, low-protein product as worth portioning for a fat-loss goal", () => {
    const result = computeProductPersonalization({
      ...BASE_INPUT,
      primaryGoal: "fat_loss",
      product: { ...BASE_PRODUCT, caloriesPer100g: 500, proteinPer100g: 3 },
    });
    expect(result.goalNote).toMatch(/portioning carefully/i);
  });

  it("flags decent protein content as good for a muscle-gain goal", () => {
    const result = computeProductPersonalization({
      ...BASE_INPUT,
      primaryGoal: "muscle_gain",
      product: { ...BASE_PRODUCT, caloriesPer100g: 200, proteinPer100g: 20 },
    });
    expect(result.goalNote).toMatch(/muscle-gain/i);
  });

  it("returns no goal note when there's no active goal", () => {
    const result = computeProductPersonalization({
      ...BASE_INPUT,
      primaryGoal: null,
      product: { ...BASE_PRODUCT, caloriesPer100g: 120, proteinPer100g: 25 },
    });
    expect(result.goalNote).toBeNull();
  });

  it("flags a matching allergen found in the ingredients text", () => {
    const result = computeProductPersonalization({
      ...BASE_INPUT,
      foodAllergies: ["peanuts", "shellfish"],
      product: { ...BASE_PRODUCT, ingredientsText: "Sugar, wheat flour, peanuts, salt" },
    });
    expect(result.allergyWarnings).toEqual(["peanuts"]);
  });

  it("returns no allergy warnings when none of the user's allergens appear", () => {
    const result = computeProductPersonalization({
      ...BASE_INPUT,
      foodAllergies: ["shellfish"],
      product: { ...BASE_PRODUCT, ingredientsText: "Sugar, wheat flour, salt" },
    });
    expect(result.allergyWarnings).toEqual([]);
  });

  it("adds a training-day note for a higher-carb product after a workout today", () => {
    const result = computeProductPersonalization({
      ...BASE_INPUT,
      trainedToday: true,
      product: { ...BASE_PRODUCT, carbsPer100g: 45 },
    });
    expect(result.trainingNote).toMatch(/restocking energy/i);
  });

  it("does not add a training-day note for a low-carb product even after training", () => {
    const result = computeProductPersonalization({
      ...BASE_INPUT,
      trainedToday: true,
      product: { ...BASE_PRODUCT, carbsPer100g: 5 },
    });
    expect(result.trainingNote).toBeNull();
  });

  it("does not add a training-day note when there was no workout today", () => {
    const result = computeProductPersonalization({
      ...BASE_INPUT,
      trainedToday: false,
      product: { ...BASE_PRODUCT, carbsPer100g: 45 },
    });
    expect(result.trainingNote).toBeNull();
  });
});
