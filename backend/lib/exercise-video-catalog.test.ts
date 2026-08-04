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

  // These keyword removals are the actual fix for a real bug: "Leg Press"
  // used to match the squat clip (different machine/movement entirely), and
  // "Front Raise"/"Bent Over Row" etc. had similar mismatches. A category
  // only keeps a keyword if its clip actually shows that movement — no
  // match at all is the correct, safe outcome otherwise.
  it("does not match exercises whose movement differs from the category's clip", () => {
    expect(resolveVideoCategory("Leg Press")).toBeNull();
    expect(resolveVideoCategory("Walking Lunge")).toBeNull();
    expect(resolveVideoCategory("Step Up")).toBeNull();
    expect(resolveVideoCategory("Bent Over Barbell Row")).toBeNull();
    expect(resolveVideoCategory("Dumbbell Front Raise")).toBeNull();
    expect(resolveVideoCategory("Rear Delt Fly")).toBeNull();
    expect(resolveVideoCategory("Tricep Skull Crusher")).toBeNull();
    expect(resolveVideoCategory("Standing Tricep Kickback")).toBeNull();
    expect(resolveVideoCategory("Bicycle Crunch")).toBeNull();
    expect(resolveVideoCategory("Russian Twist")).toBeNull();
    expect(resolveVideoCategory("Suitcase Carry")).toBeNull();
  });

  it("still matches a cable tricep pushdown and a plank", () => {
    expect(resolveVideoCategory("Cable Tricep Pushdown")).toBe("tricepExtension");
    expect(resolveVideoCategory("Forearm Plank")).toBe("core");
  });
});

describe("getVideoForExercise (gated on a reviewed clip actually existing)", () => {
  it("returns null for a category that matches but has no clip in either gender yet", () => {
    // horizontalPress is a real category with both videoUrl fields still
    // empty until its clips pass review (see exercise-video-catalog.ts) —
    // matching without a reviewed clip must not surface a broken/empty video.
    expect(getVideoForExercise("Barbell Bench Press", "male")).toBeNull();
    expect(getVideoForExercise("Barbell Bench Press", "female")).toBeNull();
  });

  it("returns null for an exercise name with no matching category", () => {
    expect(getVideoForExercise("Totally Made Up Exercise Xyz", "male")).toBeNull();
  });

  it("returns the matching-gender clip when both genders are populated", () => {
    // squat has both a male and female reviewed clip.
    const male = getVideoForExercise("Barbell Back Squat", "male");
    const female = getVideoForExercise("Barbell Back Squat", "female");
    expect(male?.libraryId).toBe("squat");
    expect(female?.libraryId).toBe("squat");
    expect(male?.videoUrl).toMatch(/^https:\/\//);
    expect(female?.videoUrl).toMatch(/^https:\/\//);
    expect(male?.videoUrl).not.toBe(female?.videoUrl);
  });

  it("falls back to the male clip for a female user when no female clip exists yet", () => {
    // shrug currently only has a reviewed male clip.
    const result = getVideoForExercise("Barbell Shrug", "female");
    expect(result?.libraryId).toBe("shrug");
    expect(result?.videoUrl).toMatch(/^https:\/\//);
  });

  it("falls back to the female clip for a male user when no male clip exists yet", () => {
    // hipThrust currently only has a reviewed female clip.
    const result = getVideoForExercise("Barbell Hip Thrust", "male");
    expect(result?.libraryId).toBe("hipThrust");
    expect(result?.videoUrl).toMatch(/^https:\/\//);
  });

  it("defaults unset/other sex to the male-preferred fallback chain", () => {
    expect(getVideoForExercise("Conventional Deadlift")?.libraryId).toBe("hinge");
    expect(getVideoForExercise("Conventional Deadlift", "other")?.libraryId).toBe("hinge");
  });
});
