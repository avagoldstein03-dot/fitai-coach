import { adaptSessionToReadiness } from "./readiness-adaptation";
import type { ReadinessResult } from "./trends";

const ex = (exerciseName: string, sets: number, category?: string) => ({
  exerciseName, sets, reps: "8-10", category,
});

const session = () => [
  ex("Barbell Hip Thrust", 4),
  ex("Romanian Deadlift", 4),
  ex("Bulgarian Split Squat", 3),
  ex("Plank", 3, "core"),
  ex("Russian Twist", 3, "core"),
];

const readiness = (
  score: number,
  label: ReadinessResult["label"],
  factors: ReadinessResult["factors"] = []
): ReadinessResult => ({ score, label, factors });

const SLEEP_DOWN = {
  name: "Sleep",
  impact: "negative" as const,
  detail: "Last night was 5.1h, 22% below your recent average (6.6h).",
};
const RHR_UP = {
  name: "Resting heart rate",
  impact: "negative" as const,
  detail: "Resting heart rate was 8% above your recent average (58 bpm).",
};

describe("adaptSessionToReadiness", () => {
  it("does nothing without a readiness score", () => {
    const { exercises, adaptation } = adaptSessionToReadiness(session(), null);
    expect(adaptation).toBeNull();
    expect(exercises.map((e) => e.sets)).toEqual([4, 4, 3, 3, 3]);
  });

  it("leaves a normal day alone", () => {
    const { exercises, adaptation } = adaptSessionToReadiness(session(), readiness(68, "ready"));
    expect(adaptation?.applied).toBe(false);
    expect(adaptation?.adjustments).toEqual([]);
    expect(exercises.map((e) => e.sets)).toEqual([4, 4, 3, 3, 3]);
  });

  it("encourages rather than adds volume when primed", () => {
    const { exercises, adaptation } = adaptSessionToReadiness(session(), readiness(88, "primed"));
    expect(adaptation?.applied).toBe(false);
    expect(adaptation?.note).toContain("push your top set");
    // Never imposes extra work.
    expect(exercises.map((e) => e.sets)).toEqual([4, 4, 3, 3, 3]);
  });

  it("drops one set from the main lifts when recovery is down", () => {
    const { exercises, adaptation } = adaptSessionToReadiness(
      session(),
      readiness(48, "take_it_easy", [SLEEP_DOWN])
    );
    expect(adaptation?.applied).toBe(true);
    expect(exercises.map((e) => e.sets)).toEqual([3, 3, 2, 3, 3]);
    expect(adaptation?.adjustments).toHaveLength(3);
  });

  it("drops two when recovery is poor", () => {
    const { exercises } = adaptSessionToReadiness(
      session(),
      readiness(28, "prioritize_recovery", [SLEEP_DOWN])
    );
    // Floor of 2 keeps the split squat from falling to 1.
    expect(exercises.map((e) => e.sets)).toEqual([2, 2, 2, 3, 3]);
  });

  it("never touches the ab circuit", () => {
    const { exercises } = adaptSessionToReadiness(
      session(),
      readiness(28, "prioritize_recovery", [SLEEP_DOWN])
    );
    const core = exercises.filter((e) => e.category === "core");
    expect(core.map((e) => e.sets)).toEqual([3, 3]);
  });

  it("never drops below two sets", () => {
    const light = [ex("Leg Press", 2), ex("Leg Curl", 3)];
    const { exercises } = adaptSessionToReadiness(light, readiness(20, "prioritize_recovery", [SLEEP_DOWN]));
    expect(exercises.map((e) => e.sets)).toEqual([2, 2]);
  });

  it("says nothing changed when the session is already at the floor", () => {
    const minimal = [ex("Leg Press", 2), ex("Leg Curl", 2)];
    const { exercises, adaptation } = adaptSessionToReadiness(
      minimal,
      readiness(30, "prioritize_recovery", [SLEEP_DOWN])
    );
    expect(adaptation?.applied).toBe(false);
    expect(adaptation?.note).toContain("already light");
    expect(exercises.map((e) => e.sets)).toEqual([2, 2]);
  });

  it("names the real signal rather than saying 'recovery is low'", () => {
    const { adaptation } = adaptSessionToReadiness(
      session(),
      readiness(44, "take_it_easy", [SLEEP_DOWN, RHR_UP])
    );
    expect(adaptation?.note).toContain("22% below your recent average");
    expect(adaptation?.note).toContain("a set came off");
  });

  it("still explains itself when no single factor stands out", () => {
    const { adaptation } = adaptSessionToReadiness(session(), readiness(44, "take_it_easy", []));
    expect(adaptation?.note).toContain("Recovery is low today");
  });

  it("keeps the weight and only changes the volume", () => {
    const { adaptation } = adaptSessionToReadiness(
      session(),
      readiness(44, "take_it_easy", [SLEEP_DOWN])
    );
    expect(adaptation?.note).toContain("Keep the weight");
  });

  it("does not mutate the session it was given", () => {
    const original = session();
    adaptSessionToReadiness(original, readiness(28, "prioritize_recovery", [SLEEP_DOWN]));
    expect(original.map((e) => e.sets)).toEqual([4, 4, 3, 3, 3]);
  });
});
