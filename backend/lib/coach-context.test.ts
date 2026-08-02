import { buildCoachingDirective } from "./coach-context";

describe("buildCoachingDirective", () => {
  it("returns a generic baseline when all fields are missing", () => {
    const directive = buildCoachingDirective({});
    expect(directive).toContain("No special coaching adaptations");
  });

  it("returns a generic baseline for a young, advanced, injury-free user", () => {
    const directive = buildCoachingDirective({ age: 28, fitnessExperience: "advanced", injuryHistory: null });
    expect(directive).toContain("more technical language");
    expect(directive).not.toContain("over 55");
    expect(directive).not.toContain("injury");
  });

  it("adds beginner-specific guidance", () => {
    const directive = buildCoachingDirective({ fitnessExperience: "beginner" });
    expect(directive).toMatch(/form|confidence/i);
  });

  it("adds age-related guidance and a medical disclaimer for older users", () => {
    const directive = buildCoachingDirective({ age: 60 });
    expect(directive).toContain("over 55");
    expect(directive).toContain("not medical advice");
  });

  it("does not add age guidance just under the threshold", () => {
    const directive = buildCoachingDirective({ age: 54 });
    expect(directive).not.toContain("over 55");
  });

  it("adds injury-specific guidance and a disclaimer, echoing the reported injury", () => {
    const directive = buildCoachingDirective({ injuryHistory: "torn ACL in 2019, cautious with squats" });
    expect(directive).toContain("torn ACL in 2019");
    expect(directive).toContain("not medical advice");
  });

  it("truncates a very long injury description before echoing it", () => {
    const longInjury = "a".repeat(1000);
    const directive = buildCoachingDirective({ injuryHistory: longInjury });
    expect(directive.length).toBeLessThan(1000);
  });

  it("ignores an empty or whitespace-only injury string", () => {
    const directive = buildCoachingDirective({ injuryHistory: "   " });
    expect(directive).toContain("No special coaching adaptations");
  });

  it("combines multiple applicable directives", () => {
    const directive = buildCoachingDirective({ age: 60, fitnessExperience: "beginner", injuryHistory: "bad knee" });
    expect(directive).toMatch(/form|confidence/i);
    expect(directive).toContain("over 55");
    expect(directive).toContain("bad knee");
  });

  it("never throws regardless of input shape", () => {
    expect(() => buildCoachingDirective({ age: null, fitnessExperience: undefined, injuryHistory: undefined })).not.toThrow();
  });
});
