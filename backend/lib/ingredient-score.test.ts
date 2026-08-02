import { computeProductScore } from "./ingredient-score";

describe("computeProductScore", () => {
  it("grades a clean, minimally-processed product as great", () => {
    const result = computeProductScore({ novaGroup: 1, nutriscoreGrade: "a", additivesTags: [] });
    expect(result.grade).toBe("great");
    expect(result.score).toBe(90);
    expect(result.flaggedIngredients).toEqual([]);
  });

  it("grades a moderately processed product with no flagged additives as good", () => {
    const result = computeProductScore({ novaGroup: 2, nutriscoreGrade: "b", additivesTags: [] });
    expect(result.grade).toBe("good");
    expect(result.score).toBe(70);
  });

  it("grades a heavily processed product with one moderate additive as mediocre", () => {
    const result = computeProductScore({
      novaGroup: 4,
      nutriscoreGrade: "c",
      additivesTags: ["en:e621"],
    });
    expect(result.grade).toBe("mediocre");
    expect(result.score).toBe(60 - 20 - 5);
    expect(result.flaggedIngredients).toHaveLength(1);
  });

  it("grades a product with multiple high-risk additives as bad and clamps at 0", () => {
    const result = computeProductScore({
      novaGroup: 4,
      nutriscoreGrade: "e",
      additivesTags: ["en:e171", "en:e320", "en:e321", "en:e951", "en:e954"],
    });
    expect(result.grade).toBe("bad");
    expect(result.score).toBe(0);
  });

  it("defaults to a neutral base score when nutriscore and nova are both missing", () => {
    const result = computeProductScore({ additivesTags: [] });
    expect(result.score).toBe(60);
    expect(result.grade).toBe("good");
    expect(result.flaggedIngredients).toEqual([]);
  });

  it("matches additive tags case-insensitively and strips the en: prefix", () => {
    const result = computeProductScore({ additivesTags: ["EN:E171"] });
    expect(result.flaggedIngredients).toHaveLength(1);
    expect(result.flaggedIngredients[0].code).toBe("e171");
  });

  it("counts a duplicated additive tag only once", () => {
    const result = computeProductScore({ additivesTags: ["en:e171", "en:e171", "E171"] });
    expect(result.flaggedIngredients).toHaveLength(1);
  });

  it("ignores additive tags that aren't in the curated list", () => {
    const result = computeProductScore({ nutriscoreGrade: "a", additivesTags: ["en:e300"] });
    expect(result.flaggedIngredients).toEqual([]);
    expect(result.score).toBe(90);
  });

  it("caps the moderate-additive penalty even with many matches", () => {
    const manyModerates = ["e211", "e212", "e282", "e407", "e433", "e466", "e621"].map((c) => `en:${c}`);
    const result = computeProductScore({ nutriscoreGrade: "a", additivesTags: manyModerates });
    expect(result.score).toBe(90 - 20);
  });

  it("caps the high-additive penalty even with many matches", () => {
    const manyHigh = ["e171", "e320", "e321", "e924", "e249", "e250"].map((c) => `en:${c}`);
    const result = computeProductScore({ nutriscoreGrade: "a", additivesTags: manyHigh });
    expect(result.score).toBe(90 - 40);
  });

  it("never returns a score outside [0, 100]", () => {
    const worst = computeProductScore({
      novaGroup: 4,
      nutriscoreGrade: "e",
      additivesTags: CONCERNING_ADDITIVES_FOR_TEST,
    });
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(100);
  });
});

const CONCERNING_ADDITIVES_FOR_TEST = [
  "e171", "e320", "e321", "e924", "e249", "e250", "e251", "e252", "e951", "e954",
];
