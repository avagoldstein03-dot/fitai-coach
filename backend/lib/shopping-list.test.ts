import { parseIngredientPhrase, categorizeIngredient, generateShoppingList } from "./shopping-list";

describe("parseIngredientPhrase", () => {
  it("parses a quantity with a known unit", () => {
    expect(parseIngredientPhrase("3 whole eggs")).toEqual({ name: "eggs", quantity: 3, unit: "whole" });
  });

  it("parses a quantity with a cup unit", () => {
    expect(parseIngredientPhrase("1 cup oatmeal")).toEqual({ name: "oatmeal", quantity: 1, unit: "cup" });
  });

  it("parses a phrase with no quantity", () => {
    expect(parseIngredientPhrase("chicken breast")).toEqual({ name: "chicken breast", quantity: 1, unit: "" });
  });

  it("parses a simple fraction", () => {
    expect(parseIngredientPhrase("1/2 avocado")).toEqual({ name: "avocado", quantity: 0.5, unit: "" });
  });

  it("parses a decimal quantity", () => {
    expect(parseIngredientPhrase("1.5 cups rice")).toEqual({ name: "rice", quantity: 1.5, unit: "cups" });
  });

  it("keeps an unrecognized leading word as part of the name, not a unit", () => {
    expect(parseIngredientPhrase("2 large eggs")).toEqual({ name: "large eggs", quantity: 2, unit: "" });
  });
});

describe("categorizeIngredient", () => {
  it("categorizes known proteins, vegetables, and fruits", () => {
    expect(categorizeIngredient("chicken breast")).toBe("Proteins");
    expect(categorizeIngredient("broccoli")).toBe("Vegetables");
    expect(categorizeIngredient("banana")).toBe("Fruits");
  });

  it("falls back to Other for an unrecognized ingredient instead of dropping it", () => {
    expect(categorizeIngredient("dragonfruit powder")).toBe("Other");
  });

  it("is case-insensitive", () => {
    expect(categorizeIngredient("CHICKEN Breast")).toBe("Proteins");
  });
});

describe("generateShoppingList", () => {
  it("aggregates ingredients across all days and meals", () => {
    const days = [
      { meals: [{ foods: ["3 whole eggs", "1 cup oatmeal"] }] },
      { meals: [{ foods: ["chicken breast"] }] },
    ];
    const items = generateShoppingList(days);
    expect(items).toHaveLength(3);
  });

  it("sums quantities for the same ingredient appearing on different days", () => {
    const days = [
      { meals: [{ foods: ["3 whole eggs"] }] },
      { meals: [{ foods: ["3 whole eggs"] }] },
    ];
    const items = generateShoppingList(days);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: "Eggs", quantity: 6, unit: "whole" });
  });

  it("sums raw quantities even when units differ, keeping the first-seen unit", () => {
    const days = [
      { meals: [{ foods: ["1 cup rice"] }] },
      { meals: [{ foods: ["200 g rice"] }] },
    ];
    const items = generateShoppingList(days);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ quantity: 201, unit: "cup" });
  });

  it("places an unrecognized ingredient in the Other category rather than dropping it", () => {
    const days = [{ meals: [{ foods: ["dragonfruit powder"] }] }];
    const items = generateShoppingList(days);
    expect(items).toHaveLength(1);
    expect(items[0].category).toBe("Other");
  });

  it("marks every generated item as not checked and not custom", () => {
    const days = [{ meals: [{ foods: ["3 whole eggs"] }] }];
    const items = generateShoppingList(days);
    expect(items[0]).toMatchObject({ checked: false, isCustom: false });
  });

  it("assigns a stable slugified id derived from the name", () => {
    const days = [{ meals: [{ foods: ["chicken breast"] }] }];
    const items = generateShoppingList(days);
    expect(items[0].id).toBe("chicken-breast");
  });
});
