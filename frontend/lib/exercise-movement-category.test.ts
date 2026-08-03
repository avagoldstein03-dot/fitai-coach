import { getMovementCategory } from "./exercise-movement-category";

describe("getMovementCategory", () => {
  it("classifies squats and lunges as squat", () => {
    expect(getMovementCategory("Back Squat")).toBe("squat");
    expect(getMovementCategory("Walking Lunge")).toBe("squat");
  });

  it("classifies deadlifts and hip thrusts as hinge", () => {
    expect(getMovementCategory("Romanian Deadlift")).toBe("hinge");
    expect(getMovementCategory("Hip Thrust")).toBe("hinge");
  });

  it("classifies presses and push-ups as press", () => {
    expect(getMovementCategory("Barbell Bench Press")).toBe("press");
    expect(getMovementCategory("Push-Up")).toBe("press");
  });

  it("classifies rows and pull-ups as pull", () => {
    expect(getMovementCategory("Seated Cable Row")).toBe("pull");
    expect(getMovementCategory("Pull-Up")).toBe("pull");
  });

  it("classifies curls as curl", () => {
    expect(getMovementCategory("Dumbbell Bicep Curl")).toBe("curl");
  });

  it("classifies planks and crunches as core", () => {
    expect(getMovementCategory("Plank")).toBe("core");
    expect(getMovementCategory("Bicycle Crunch")).toBe("core");
  });

  it("classifies calf raises as calf", () => {
    expect(getMovementCategory("Standing Calf Raise")).toBe("calf");
  });

  it("returns null for an unrecognized exercise", () => {
    expect(getMovementCategory("Astronaut Training")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(getMovementCategory("BACK SQUAT")).toBe("squat");
  });
});
