import { getVideoForExercise, resolveVideoCategory } from "./exercise-video-catalog";

describe("resolveVideoCategory (pure keyword matching)", () => {
  it("matches a horizontal press exercise", () => {
    expect(resolveVideoCategory("Barbell Bench Press")).toBe("horizontalPress");
  });

  it("matches squat-pattern exercises case-insensitively", () => {
    expect(resolveVideoCategory("BARBELL BACK SQUAT")).toBe("squat");
  });

  it("prefers the specific hamstring-curl category over the generic curl category", () => {
    expect(resolveVideoCategory("Seated Hamstring Curl")).toBe("hamstringCurl");
    expect(resolveVideoCategory("Lying Leg Curl")).toBe("hamstringCurl");
  });

  it("still matches the generic curl category for bicep-style curls", () => {
    expect(resolveVideoCategory("Standing Dumbbell Bicep Curl")).toBe("curl");
  });

  it("matches leg extension separately from squats and curls", () => {
    expect(resolveVideoCategory("Seated Leg Extension")).toBe("legExtension");
  });

  it("returns null for an exercise name with no matching category", () => {
    expect(resolveVideoCategory("Totally Made Up Exercise Xyz")).toBeNull();
  });
});

describe("getVideoForExercise (gated on a reviewed clip actually existing)", () => {
  it("returns a video for a category that has a reviewed clip", () => {
    const result = getVideoForExercise("Barbell Back Squat");
    expect(result?.libraryId).toBe("squat");
    expect(result?.videoUrl).toMatch(/^https:\/\//);
  });

  it("returns null for a category that matches but has no clip yet", () => {
    // horizontalPress is a real category with an empty videoUrl until its
    // clip passes review (see exercise-video-catalog.ts) — matching without
    // a reviewed clip must not surface a broken/empty video.
    expect(getVideoForExercise("Barbell Bench Press")).toBeNull();
  });

  it("returns a video for a second reviewed category (deadlift/hinge)", () => {
    const result = getVideoForExercise("Conventional Deadlift");
    expect(result?.libraryId).toBe("hinge");
    expect(result?.videoUrl).toMatch(/^https:\/\//);
  });

  it("returns null for an exercise name with no matching category", () => {
    expect(getVideoForExercise("Totally Made Up Exercise Xyz")).toBeNull();
  });
});
