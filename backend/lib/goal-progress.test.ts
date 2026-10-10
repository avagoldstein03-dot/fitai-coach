import {
  computeGoalProgress,
  shouldShowWeightTarget,
  describeGoalForCoach,
} from "./goal-progress";

const weeksAgo = (n: number) => new Date(Date.now() - n * 7 * 24 * 60 * 60 * 1000);
const NOW = new Date();

describe("shouldShowWeightTarget", () => {
  it("shows the target when nothing is reported", () => {
    expect(shouldShowWeightTarget([])).toBe(true);
    expect(shouldShowWeightTarget(null)).toBe(true);
  });

  it("shows it for conditions that do not bear on weight talk", () => {
    expect(shouldShowWeightTarget(["asthma", "high_blood_pressure", "pcos"])).toBe(true);
  });

  it("withholds it entirely for a disordered-eating history", () => {
    // The directive says not to emphasise weight, scale numbers or appearance.
    // A countdown with a pace rating is exactly that, so it is blocked rather
    // than softened — there is no gentler version of a scale countdown.
    expect(shouldShowWeightTarget(["disordered_eating_history"])).toBe(false);
  });

  it("withholds it during pregnancy, where the calorie target already refuses a deficit", () => {
    expect(shouldShowWeightTarget(["pregnant_or_postpartum"])).toBe(false);
  });

  it("withholds it when one of several reported conditions calls for that", () => {
    expect(shouldShowWeightTarget(["asthma", "disordered_eating_history"])).toBe(false);
  });

  it("infers nothing from 'prefer not to say'", () => {
    expect(shouldShowWeightTarget(["prefer_not_to_say"])).toBe(true);
  });
});

describe("computeGoalProgress", () => {
  it("is null without a target", () => {
    expect(computeGoalProgress({ currentWeight: 80, targetWeight: null })).toBeNull();
  });

  it("is null without a current weight", () => {
    expect(computeGoalProgress({ currentWeight: null, targetWeight: 70 })).toBeNull();
  });

  it("reads 0% on the day the target is set, not as an error", () => {
    const p = computeGoalProgress({ currentWeight: 80, targetWeight: 70, targetSetAt: NOW })!;
    expect(p.percentComplete).toBe(0);
    expect(p.remainingKg).toBe(10);
    expect(p.totalKg).toBe(10);
    expect(p.direction).toBe("lose");
  });

  it("measures progress from the start snapshot", () => {
    const p = computeGoalProgress({ startWeight: 80, currentWeight: 76, targetWeight: 70 })!;
    expect(p.remainingKg).toBe(6);
    expect(p.totalKg).toBe(10);
    expect(p.percentComplete).toBe(40);
  });

  it("handles a gaining goal", () => {
    const p = computeGoalProgress({ startWeight: 60, currentWeight: 63, targetWeight: 70 })!;
    expect(p.direction).toBe("gain");
    expect(p.remainingKg).toBe(7);
    expect(p.percentComplete).toBe(30);
  });

  it("calls the target met once it is within half a kilo", () => {
    const p = computeGoalProgress({ startWeight: 80, currentWeight: 70.3, targetWeight: 70 })!;
    expect(p.pace).toBe("met");
    expect(p.percentComplete).toBe(100);
  });

  it("stays at 100% rather than going negative when they pass the target", () => {
    const p = computeGoalProgress({ startWeight: 80, currentWeight: 68, targetWeight: 70 })!;
    expect(p.percentComplete).toBe(100);
    expect(p.remainingKg).toBeGreaterThanOrEqual(0);
  });

  it("never reports negative progress for someone moving the wrong way", () => {
    const p = computeGoalProgress({ startWeight: 80, currentWeight: 83, targetWeight: 70 })!;
    expect(p.percentComplete).toBe(0);
    expect(p.remainingKg).toBe(13);
  });

  describe("pace", () => {
    it("is unknown without a timeline", () => {
      const p = computeGoalProgress({ startWeight: 80, currentWeight: 76, targetWeight: 70 })!;
      expect(p.pace).toBe("unknown");
      expect(p.requiredRateKgPerWeek).toBeNull();
    });

    it("is on track halfway through a timeline at halfway to the target", () => {
      const p = computeGoalProgress({
        startWeight: 80, currentWeight: 75, targetWeight: 70,
        timelineWeeks: 20, targetSetAt: weeksAgo(10),
      })!;
      expect(p.pace).toBe("on_track");
    });

    it("is ahead when the change outpaces the clock", () => {
      const p = computeGoalProgress({
        startWeight: 80, currentWeight: 72, targetWeight: 70,
        timelineWeeks: 20, targetSetAt: weeksAgo(5),
      })!;
      expect(p.pace).toBe("ahead");
    });

    it("is behind when the clock outpaces the change", () => {
      const p = computeGoalProgress({
        startWeight: 80, currentWeight: 79, targetWeight: 70,
        timelineWeeks: 20, targetSetAt: weeksAgo(15),
      })!;
      expect(p.pace).toBe("behind");
    });

    it("reports the weeks left and the rate they imply", () => {
      const p = computeGoalProgress({
        startWeight: 80, currentWeight: 76, targetWeight: 70,
        timelineWeeks: 20, targetSetAt: weeksAgo(8),
      })!;
      expect(p.weeksRemaining).toBe(12);
      expect(p.requiredRateKgPerWeek).toBeCloseTo(0.5, 1);
    });

    it("stops quoting a rate once the timeline has run out", () => {
      const p = computeGoalProgress({
        startWeight: 80, currentWeight: 76, targetWeight: 70,
        timelineWeeks: 10, targetSetAt: weeksAgo(12),
      })!;
      expect(p.weeksRemaining).toBe(0);
      expect(p.requiredRateKgPerWeek).toBeNull();
    });
  });

  describe("rate warning", () => {
    it("says nothing about a sustainable rate", () => {
      const p = computeGoalProgress({
        startWeight: 80, currentWeight: 80, targetWeight: 75,
        timelineWeeks: 20, targetSetAt: NOW,
      })!;
      // 5kg over 20 weeks is 0.25/wk against a 0.8 ceiling.
      expect(p.rateWarning).toBeNull();
      expect(p.rateIsAggressive).toBe(false);
    });

    it("flags a timeline that needs more than 1% of bodyweight a week", () => {
      const p = computeGoalProgress({
        startWeight: 80, currentWeight: 80, targetWeight: 70,
        timelineWeeks: 6, targetSetAt: NOW,
      })!;
      expect(p.rateIsAggressive).toBe(true);
      expect(p.rateWarning).toContain("faster than is sustainable");
      // Points at the timeline, not at eating less.
      expect(p.rateWarning).toContain("more time");
    });

    it("scales the threshold to bodyweight rather than using a flat figure", () => {
      // 0.7kg/wk is fine at 110kg and not at 55kg.
      const heavy = computeGoalProgress({
        startWeight: 110, currentWeight: 110, targetWeight: 103,
        timelineWeeks: 10, targetSetAt: NOW,
      })!;
      const light = computeGoalProgress({
        startWeight: 55, currentWeight: 55, targetWeight: 48,
        timelineWeeks: 10, targetSetAt: NOW,
      })!;
      expect(heavy.rateIsAggressive).toBe(false);
      expect(light.rateIsAggressive).toBe(true);
    });
  });
});

describe("describeGoalForCoach", () => {
  it("says nothing without a target", () => {
    expect(describeGoalForCoach(null, null)).toBe("");
    expect(describeGoalForCoach(null, 70)).toBe("");
  });

  it("gives the coach the distance and the share covered", () => {
    const p = computeGoalProgress({ startWeight: 80, currentWeight: 76, targetWeight: 70 })!;
    const line = describeGoalForCoach(p, 70);
    expect(line).toContain("70kg");
    expect(line).toContain("6kg");
    expect(line).toContain("40%");
  });

  it("turns the coach toward maintenance once the target is met", () => {
    const p = computeGoalProgress({ startWeight: 80, currentWeight: 70, targetWeight: 70 })!;
    expect(describeGoalForCoach(p, 70)).toContain("maintaining");
  });

  it("tells the coach to name an unsustainable timeline rather than coach into it", () => {
    const p = computeGoalProgress({
      startWeight: 80, currentWeight: 80, targetWeight: 70,
      timelineWeeks: 6, targetSetAt: NOW,
    })!;
    const line = describeGoalForCoach(p, 70);
    expect(line).toContain("faster than is sustainable");
    expect(line).toContain("extending it rather than cutting harder");
  });
});

describe("the display flag is separate from the prose", () => {
  it("gives the UI a boolean and the rate, not an English sentence in kg", () => {
    // The UI has to render this in the viewer's own units and language, which a
    // server-built string cannot do. The sentence stays for the coach prompt.
    const p = computeGoalProgress({
      startWeight: 80, currentWeight: 80, targetWeight: 70,
      timelineWeeks: 6, targetSetAt: NOW,
    })!;
    expect(typeof p.rateIsAggressive).toBe("boolean");
    expect(typeof p.requiredRateKgPerWeek).toBe("number");
  });
});
