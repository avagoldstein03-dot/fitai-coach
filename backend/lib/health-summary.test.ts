import { buildHealthSummary } from "./health-summary";

function metric(overrides: Partial<{ date: Date; steps: number | null; activeEnergyKcal: number | null; sleepMinutes: number | null; restingHeartRate: number | null }> = {}) {
  return {
    date: new Date(),
    steps: null,
    activeEnergyKcal: null,
    sleepMinutes: null,
    restingHeartRate: null,
    ...overrides,
  };
}

describe("buildHealthSummary", () => {
  it("returns an empty string for no metrics", () => {
    expect(buildHealthSummary([])).toBe("");
  });

  it("returns an empty string when every field is null across all days", () => {
    expect(buildHealthSummary([metric(), metric()])).toBe("");
  });

  it("computes average steps and sleep, ignoring null days", () => {
    const metrics = [
      metric({ steps: 10000, sleepMinutes: 420 }),
      metric({ steps: 8000, sleepMinutes: 360 }),
      metric({ steps: null, sleepMinutes: null }),
    ];
    const summary = buildHealthSummary(metrics);
    expect(summary).toContain("9000 steps/day");
    expect(summary).toContain("6.5h sleep");
  });

  it("includes average active energy when present", () => {
    const summary = buildHealthSummary([metric({ activeEnergyKcal: 500 }), metric({ activeEnergyKcal: 300 })]);
    expect(summary).toContain("Averaging 400 active kcal/day");
  });

  it("surfaces the most recent non-null resting heart rate", () => {
    const metrics = [
      metric({ restingHeartRate: null }),
      metric({ restingHeartRate: 62 }),
      metric({ restingHeartRate: 58 }),
    ];
    const summary = buildHealthSummary(metrics);
    expect(summary).toContain("62 bpm");
    expect(summary).not.toContain("58 bpm");
  });

  it("caps the output length", () => {
    const metrics = Array.from({ length: 30 }, () =>
      metric({ steps: 8000, activeEnergyKcal: 400, restingHeartRate: 60 })
    );
    expect(buildHealthSummary(metrics).length).toBeLessThanOrEqual(600);
  });

  it("only mentions fields that actually have data", () => {
    const summary = buildHealthSummary([metric({ steps: 5000 })]);
    expect(summary).toContain("steps/day");
    expect(summary).not.toContain("sleep");
    expect(summary).not.toContain("active kcal");
    expect(summary).not.toContain("bpm");
  });
});
