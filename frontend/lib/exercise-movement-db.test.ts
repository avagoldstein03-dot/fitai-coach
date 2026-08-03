import { findExerciseMovement } from "./exercise-movement-db";

describe("findExerciseMovement", () => {
  it("matches a common exercise name and returns two image URLs", () => {
    const result = findExerciseMovement("Bench Press");
    expect(result).not.toBeNull();
    expect(result?.images).toHaveLength(2);
    expect(result?.images[0]).toMatch(/^https:\/\/raw\.githubusercontent\.com\//);
    expect(result?.images[0]).not.toEqual(result?.images[1]);
  });

  it("matches regardless of case and extra whitespace", () => {
    const result = findExerciseMovement("  squat  ");
    expect(result).not.toBeNull();
  });

  it("prefers the least-embellished matching candidate", () => {
    const result = findExerciseMovement("Bicep Curl");
    // Should not resolve to something wildly more specific than requested.
    expect(result?.name.toLowerCase()).toContain("bicep curl");
  });

  it("matches multi-word queries via token coverage, not substring order", () => {
    const result = findExerciseMovement("Overhead Press");
    expect(result).not.toBeNull();
    expect(result?.name.toLowerCase()).toContain("overhead");
  });

  it("returns null for a name with no plausible match", () => {
    expect(findExerciseMovement("Astronaut Zero Gravity Cha-Cha")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(findExerciseMovement("")).toBeNull();
  });
});
