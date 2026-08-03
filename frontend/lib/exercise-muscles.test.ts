import { getMusclesForExercise } from "./exercise-muscles";

describe("getMusclesForExercise", () => {
  it("maps a bench press to chest/triceps/shoulders", () => {
    expect(getMusclesForExercise("Barbell Bench Press")).toEqual(
      expect.arrayContaining(["chest", "triceps", "shoulders"])
    );
  });

  it("maps a squat to quads/glutes/hamstrings", () => {
    expect(getMusclesForExercise("Back Squat")).toEqual(
      expect.arrayContaining(["quads", "glutes", "hamstrings"])
    );
  });

  it("is case-insensitive", () => {
    expect(getMusclesForExercise("DUMBBELL CURL")).toContain("biceps");
  });

  it("returns an empty array for an unrecognized exercise", () => {
    expect(getMusclesForExercise("Astronaut Training")).toEqual([]);
  });

  it("dedupes muscles matched by multiple keyword groups", () => {
    const muscles = getMusclesForExercise("Tricep Kickback");
    expect(muscles.filter((m) => m === "triceps")).toHaveLength(1);
  });
});
