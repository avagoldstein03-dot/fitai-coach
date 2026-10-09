import { validateDay, validateWeek, exerciseFitsFocus, effectiveMuscles, declaredMusclesAreWrong, describeProblems, scrubContraindicated } from "./workout-validation";
import { musclesFor, musclesForFocus } from "./exercise-muscles";
import type { WorkoutPlanExercise, WorkoutPlanDay, WorkoutPlanWeek } from "@/services/ai-provider";

const ex = (
  exerciseName: string,
  extra: Partial<WorkoutPlanExercise> = {}
): WorkoutPlanExercise => ({ exerciseName, sets: 3, reps: "8-12", restSeconds: 60, ...extra });

const core = (name: string) => ex(name, { category: "core" });

/** A day that passes every rule, so each test can break exactly one thing. */
const goodDay = (overrides: Partial<WorkoutPlanDay> = {}): WorkoutPlanDay => ({
  dayOfWeek: 0,
  focus: "Glutes & Hamstrings",
  exercises: [
    ex("Barbell Hip Thrust"),
    ex("Romanian Deadlift"),
    ex("Bulgarian Split Squat"),
    ex("Seated Leg Curl"),
    ex("Cable Pull-Through"),
    core("Plank"),
    core("Russian Twist"),
    core("Dead Bug"),
  ],
  ...overrides,
});

describe("musclesFor", () => {
  it("does not read a leg curl as a biceps curl", () => {
    expect(musclesFor("Seated Leg Curl")).toEqual(["hamstrings"]);
  });
  it("does not read a face pull as a pull-up", () => {
    expect(musclesFor("Cable Face Pull")).toEqual(expect.arrayContaining(["shoulders", "back"]));
    expect(musclesFor("Cable Face Pull")).not.toContain("biceps");
  });
  it("maps a squat to the legs", () => {
    expect(musclesFor("Barbell Back Squat")).toEqual(expect.arrayContaining(["quads", "glutes"]));
  });
  it("returns nothing for an unrecognised name", () => {
    expect(musclesFor("Zercher Something")).toEqual([]);
  });
});

describe("musclesForFocus", () => {
  it("reads a named pair", () => {
    expect(musclesForFocus("Glutes & Hamstrings")).toEqual(expect.arrayContaining(["glutes", "hamstrings"]));
  });
  it("expands push", () => {
    expect(musclesForFocus("Upper Body - Push")).toEqual(expect.arrayContaining(["chest", "shoulders", "triceps"]));
  });
  it("expands pull", () => {
    expect(musclesForFocus("Pull & Back")).toEqual(expect.arrayContaining(["back", "lats", "biceps"]));
  });
  it("handles a missing focus", () => {
    expect(musclesForFocus(undefined)).toEqual([]);
  });
});

describe("exerciseFitsFocus", () => {
  it("rejects the reported case — a squat on a back day", () => {
    expect(exerciseFitsFocus(ex("Barbell Back Squat"), "Back & Biceps")).toBe(false);
  });
  it("accepts a row on a back day", () => {
    expect(exerciseFitsFocus(ex("Seated Cable Row"), "Back & Biceps")).toBe(true);
  });
  it("accepts a hip thrust on a glute day", () => {
    expect(exerciseFitsFocus(ex("Barbell Hip Thrust"), "Glutes & Hamstrings")).toBe(true);
  });
  it("rejects a chest press on a leg day", () => {
    expect(exerciseFitsFocus(ex("Chest Press Machine"), "Glutes & Quads")).toBe(false);
  });
  it("lets an unrecognised exercise through rather than guessing", () => {
    expect(exerciseFitsFocus(ex("Zercher Hold Variation"), "Back & Biceps")).toBe(true);
  });
  it("lets anything through when the focus is unusable", () => {
    expect(exerciseFitsFocus(ex("Barbell Back Squat"), "Day One")).toBe(true);
  });

  it("validates an unknown exercise from its declared muscles", () => {
    const unknown = ex("Zercher Hold Variation", { muscles: ["quads", "glutes"] });
    // The keyword map has never heard of it, but the declared muscles are enough.
    expect(exerciseFitsFocus(unknown, { focus: "Back & Biceps" })).toBe(false);
    expect(exerciseFitsFocus(unknown, { focus: "Glutes & Quads" })).toBe(true);
  });

  it("prefers declared focusMuscles over parsing the prose label", () => {
    const day = { focus: "Day One", focusMuscles: ["back", "lats"] };
    expect(exerciseFitsFocus(ex("Barbell Back Squat"), day)).toBe(false);
    expect(exerciseFitsFocus(ex("Seated Cable Row"), day)).toBe(true);
  });

  it("ignores an invented muscle group", () => {
    const bogus = ex("Some New Lift", { muscles: ["posterior chain", "core stability"] });
    // Nothing usable survives normalisation, so it passes on no evidence rather
    // than being validated against a made-up vocabulary.
    expect(exerciseFitsFocus(bogus, { focus: "Back & Biceps" })).toBe(true);
    expect(effectiveMuscles(bogus)).toEqual([]);
  });
});

describe("effectiveMuscles", () => {
  it("trusts the keyword map over a declared label", () => {
    const lying = ex("Barbell Back Squat", { muscles: ["back", "lats"] });
    expect(effectiveMuscles(lying)).toEqual(expect.arrayContaining(["quads", "glutes"]));
    expect(effectiveMuscles(lying)).not.toContain("lats");
  });

  it("falls back to the declared list for an unknown exercise", () => {
    expect(effectiveMuscles(ex("Zercher Something", { muscles: ["quads"] }))).toEqual(["quads"]);
  });
});

describe("declaredMusclesAreWrong", () => {
  it("catches a squat labelled as a back exercise", () => {
    expect(declaredMusclesAreWrong(ex("Barbell Back Squat", { muscles: ["back", "lats"] }))).toBe(true);
  });

  it("accepts a correct label", () => {
    expect(declaredMusclesAreWrong(ex("Barbell Back Squat", { muscles: ["quads"] }))).toBe(false);
  });

  it("says nothing when there is no label or no known mapping", () => {
    expect(declaredMusclesAreWrong(ex("Barbell Back Squat"))).toBe(false);
    expect(declaredMusclesAreWrong(ex("Zercher Something", { muscles: ["quads"] }))).toBe(false);
  });
});

describe("validateDay", () => {
  it("passes a well-formed day", () => {
    expect(validateDay(goodDay())).toEqual([]);
  });

  it("flags an exercise that does not match the focus", () => {
    const day = goodDay({
      focus: "Back & Biceps",
      exercises: [
        ex("Pull-Up"), ex("Bent-Over Row"), ex("Seated Cable Row"),
        ex("Barbell Back Squat"), ex("Dumbbell Curl"),
        core("Plank"), core("Russian Twist"), core("Dead Bug"),
      ],
    });
    const problems = validateDay(day);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("Barbell Back Squat");
    expect(problems[0].message).toContain("does not train Back & Biceps");
  });

  it("flags a mislabelled exercise rather than letting the label excuse it", () => {
    const day = goodDay({
      focus: "Back & Biceps",
      exercises: [
        ex("Pull-Up"), ex("Bent-Over Row"), ex("Seated Cable Row"), ex("Dumbbell Curl"),
        // Declaring "back" would otherwise make a squat pass the focus check.
        ex("Barbell Back Squat", { muscles: ["back", "lats"] }),
        core("Plank"), core("Russian Twist"), core("Dead Bug"),
      ],
    });
    const problems = validateDay(day);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("is labelled as training");
  });

  it("accepts an unfamiliar exercise whose declared muscles fit the day", () => {
    const day = goodDay({
      focus: "Glutes & Hamstrings",
      exercises: [
        ex("Barbell Hip Thrust"), ex("Romanian Deadlift"), ex("Cable Pull-Through"),
        ex("Seated Leg Curl"),
        ex("Reverse Hyper Machine", { muscles: ["glutes", "hamstrings"] }),
        core("Plank"), core("Russian Twist"), core("Dead Bug"),
      ],
    });
    expect(validateDay(day)).toEqual([]);
  });

  it("flags a day with only four main exercises — the reported complaint", () => {
    const day = goodDay({
      exercises: [
        ex("Barbell Hip Thrust"), ex("Romanian Deadlift"), ex("Bulgarian Split Squat"),
        core("Plank"), core("Russian Twist"), core("Dead Bug"),
      ],
    });
    expect(validateDay(day)[0].message).toContain("has 3 main exercises");
  });

  it("does not count the ab circuit toward the five", () => {
    const day = goodDay({
      exercises: [
        ex("Barbell Hip Thrust"), ex("Romanian Deadlift"), ex("Bulgarian Split Squat"),
        ex("Seated Leg Curl"), core("Plank"), core("Russian Twist"), core("Dead Bug"),
      ],
    });
    expect(validateDay(day).some((p) => p.message.includes("4 main exercises"))).toBe(true);
  });

  it("flags a single tacked-on ab exercise", () => {
    const day = goodDay({
      exercises: [
        ex("Barbell Hip Thrust"), ex("Romanian Deadlift"), ex("Bulgarian Split Squat"),
        ex("Seated Leg Curl"), ex("Cable Pull-Through"), core("Plank"),
      ],
    });
    expect(validateDay(day)[0].message).toContain('has 1 exercises tagged "core"');
  });

  it("flags a missing focus", () => {
    expect(validateDay(goodDay({ focus: undefined }))[0].message).toContain('has no "focus"');
  });

  it("ignores mobility work when counting main exercises", () => {
    const day = goodDay({
      exercises: [...goodDay().exercises, ex("Hip Flexor Stretch", { category: "mobility" })],
    });
    expect(validateDay(day)).toEqual([]);
  });
});

describe("validateWeek", () => {
  const week = (days: WorkoutPlanDay[]) => ({ weekNumber: 1, progressionStrategy: "base", days });

  it("passes a correct week", () => {
    expect(validateWeek(week([goodDay(), goodDay({ dayOfWeek: 2 })]), 2)).toEqual([]);
  });

  it("flags the wrong number of days", () => {
    expect(validateWeek(week([goodDay()]), 5)[0].message).toContain("has 1 training days");
  });

  it("flags an empty rest day", () => {
    const problems = validateWeek(
      week([goodDay(), goodDay({ dayOfWeek: 3, focus: "Active Rest", exercises: [] })]),
      2
    );
    expect(problems.some((p) => p.message.includes("no exercises at all"))).toBe(true);
  });

  it("flags two sessions on the same weekday", () => {
    const problems = validateWeek(week([goodDay(), goodDay()]), 2);
    expect(problems.some((p) => p.message.includes("both on dayOfWeek 0"))).toBe(true);
  });
});

describe("describeProblems", () => {
  it("renders something the model can act on", () => {
    const out = describeProblems([{ message: "Day 0 has 3 main exercises" }]);
    expect(out).toContain("previous attempt");
    expect(out).toContain("- Day 0 has 3 main exercises");
  });
});

/** Module-scoped twin of the helper inside the validateWeek block above. */
const aWeek = (days: WorkoutPlanDay[]): WorkoutPlanWeek => ({
  weekNumber: 1,
  progressionStrategy: "base",
  days,
});

describe("validateDay — reported injuries", () => {
  it("says nothing when no injury is reported", () => {
    expect(validateDay(goodDay())).toEqual([]);
    expect(validateDay(goodDay(), [])).toEqual([]);
  });

  it("flags an exercise that loads a reported area", () => {
    // The default good day leads with a Romanian deadlift, which is exactly the
    // kind of thing a reported lower back should not be handed.
    const problems = validateDay(goodDay(), ["lower_back"]);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("Romanian Deadlift");
    expect(problems[0].message).toContain("lower back");
    expect(problems[0].message).toContain("Seated Leg Curl");
  });

  it("checks the ab circuit too, not just the main work", () => {
    const day = goodDay({
      exercises: [
        ex("Barbell Hip Thrust"), ex("Leg Press"), ex("Bulgarian Split Squat"),
        ex("Seated Leg Curl"), ex("Cable Pull-Through"),
        core("Plank"), core("Box Jump"), core("Dead Bug"),
      ],
    });
    const problems = validateDay(day, ["knee"]);
    expect(problems.some((p) => p.message.includes("Box Jump"))).toBe(true);
  });

  it("leaves a day alone when the injury is somewhere else", () => {
    expect(validateDay(goodDay(), ["wrist"])).toEqual([]);
  });

  it("threads through validateWeek", () => {
    const problems = validateWeek(aWeek([goodDay(), goodDay({ dayOfWeek: 2 })]), 2, ["lower_back"]);
    expect(problems.filter((p) => p.message.includes("Romanian Deadlift"))).toHaveLength(2);
  });
});

describe("scrubContraindicated", () => {
  const oneWeek = (day: WorkoutPlanDay): WorkoutPlanWeek => aWeek([day]);

  it("is a no-op with no reported areas", () => {
    const w = oneWeek(goodDay());
    const { week: out, scrubbed } = scrubContraindicated(w, []);
    expect(scrubbed).toEqual([]);
    expect(out).toBe(w);
  });

  it("substitutes the exercise rather than leaving a hole in the session", () => {
    const { week: out, scrubbed } = scrubContraindicated(oneWeek(goodDay()), ["lower_back"]);
    const names = out.days[0].exercises.map((e) => e.exerciseName);
    expect(names).not.toContain("Romanian Deadlift");
    expect(names).toContain("Seated Leg Curl");
    // Count is preserved — a session with a gap reads as the app being broken.
    expect(out.days[0].exercises).toHaveLength(goodDay().exercises.length);
    expect(scrubbed).toEqual([
      { dayOfWeek: 0, from: "Romanian Deadlift", to: "Seated Leg Curl", areaLabel: "lower back" },
    ]);
  });

  it("keeps the sets, reps and rest of the exercise it replaced", () => {
    const day = goodDay({ exercises: [ex("Barbell Deadlift", { sets: 5, reps: "3-5", restSeconds: 180 })] });
    const { week: out } = scrubContraindicated(oneWeek(day), ["lower_back"]);
    expect(out.days[0].exercises[0]).toMatchObject({
      exerciseName: "Hip Thrust",
      sets: 5,
      reps: "3-5",
      restSeconds: 180,
    });
  });

  it("re-derives the muscles so they describe the substitute, not what left", () => {
    const day = goodDay({
      exercises: [ex("Barbell Back Squat", { muscles: ["quads", "glutes"] })],
    });
    const { week: out } = scrubContraindicated(oneWeek(day), ["lower_back"]);
    expect(out.days[0].exercises[0].exerciseName).toBe("Leg Press");
    expect(out.days[0].exercises[0].muscles).toEqual(musclesFor("Leg Press"));
  });

  it("tells the user why the exercise they see is the one they see", () => {
    const { week: out } = scrubContraindicated(oneWeek(goodDay()), ["lower_back"]);
    const swapped = out.days[0].exercises.find((e) => e.exerciseName === "Seated Leg Curl");
    expect(swapped?.notes).toContain("lower back");
  });

  it("removes an exercise outright when nothing safe does the same job", () => {
    const day = goodDay({ exercises: [ex("Jefferson Curl"), ex("Leg Press")] });
    const { week: out, scrubbed } = scrubContraindicated(oneWeek(day), ["lower_back"]);
    expect(out.days[0].exercises.map((e) => e.exerciseName)).toEqual(["Leg Press"]);
    expect(scrubbed[0]).toMatchObject({ from: "Jefferson Curl", to: null });
  });

  it("does not mutate the week it was given", () => {
    const w = oneWeek(goodDay());
    scrubContraindicated(w, ["lower_back"]);
    expect(w.days[0].exercises.map((e) => e.exerciseName)).toContain("Romanian Deadlift");
  });

  it("leaves a week with nothing contraindicated untouched", () => {
    const { scrubbed } = scrubContraindicated(oneWeek(goodDay()), ["wrist"]);
    expect(scrubbed).toEqual([]);
  });

  it("produces a week that then passes its own injury validation", () => {
    // The property that makes this the safety net: whatever it hands back must
    // have nothing left in it to flag.
    const areas = ["lower_back", "knee", "shoulder"] as const;
    const day = goodDay({
      exercises: [
        ex("Barbell Deadlift"), ex("Barbell Back Squat"), ex("Barbell Overhead Press"),
        ex("Bent-Over Barbell Row"), ex("Box Jump"),
        core("Plank"), core("Russian Twist"), core("Dead Bug"),
      ],
    });
    const { week: out } = scrubContraindicated(oneWeek(day), [...areas]);
    for (const d of out.days) {
      expect(validateDay(d, [...areas]).filter((p) => p.message.includes("keep away"))).toEqual([]);
    }
  });
});
