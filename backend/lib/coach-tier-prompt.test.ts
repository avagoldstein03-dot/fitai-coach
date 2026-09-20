import { buildTierGatingPrompt } from "./coach-tier-prompt";

describe("buildTierGatingPrompt", () => {
  it("returns an empty string for elite (no restrictions)", () => {
    expect(buildTierGatingPrompt("elite")).toBe("");
  });

  it("allows a macro split on the free tier, separate from full meal plans", () => {
    const prompt = buildTierGatingPrompt("free");
    expect(prompt).toMatch(/macro split/i);
    expect(prompt).toMatch(/meal plan/i);
  });

  it("instructs the model to fully answer the allowed part of a mixed request", () => {
    const prompt = buildTierGatingPrompt("free");
    expect(prompt).toMatch(/mixes something you MAY discuss with something you MUST NOT/i);
    expect(prompt).toMatch(/never let a gated topic .* cause you to refuse or water down/i);
  });

  it("instructs the model to name the specific upgrade benefit instead of just refusing", () => {
    const prompt = buildTierGatingPrompt("free");
    expect(prompt).toMatch(/Never just say you "can't" do it and stop there/);
    expect(prompt).toMatch(/Clearly name what upgrading to Starter gets them/);
  });

  it("ends each tier's gating instructions with that tier's exact upgrade tag", () => {
    expect(buildTierGatingPrompt("free")).toContain("[UPGRADE:starter]");
    expect(buildTierGatingPrompt("starter")).toContain("[UPGRADE:pro]");
    expect(buildTierGatingPrompt("pro")).toContain("[UPGRADE:elite]");
  });
});
