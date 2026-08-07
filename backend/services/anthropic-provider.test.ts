import type { ChatContext } from "./ai-provider";

const mockCreate = jest.fn();

jest.mock("@anthropic-ai/sdk", () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
});

const anthropicProvider = require("./anthropic-provider").default;

function baseContext(overrides: Partial<ChatContext> = {}): ChatContext {
  return {
    userId: "user_1",
    isPremium: true,
    tier: "elite",
    userProfile: { age: 30 },
    recentMeals: [],
    recentWorkouts: [],
    goals: [],
    conversationHistory: [],
    ...overrides,
  };
}

beforeEach(() => {
  mockCreate.mockReset();
  mockCreate.mockResolvedValue({ content: [{ type: "text", text: "reply" }] });
});

describe("anthropicProvider.chat", () => {
  it("includes conversation history in the messages sent to the model, followed by the new message", async () => {
    const history = [
      { role: "user" as const, content: "I'm training for a 5k" },
      { role: "assistant" as const, content: "Great goal!" },
    ];
    await anthropicProvider.chat("what did I just tell you?", baseContext({ conversationHistory: history }));

    const call = mockCreate.mock.calls[0][0];
    expect(call.messages).toEqual([...history, { role: "user", content: "what did I just tell you?" }]);
  });

  it("includes the coaching directive in the system prompt when present", async () => {
    await anthropicProvider.chat("hi", baseContext({ coachingDirective: "BE ENCOURAGING WITH BEGINNERS" }));
    const call = mockCreate.mock.calls[0][0];
    expect(call.system).toContain("BE ENCOURAGING WITH BEGINNERS");
  });

  it("includes the trends summary in the system prompt when present", async () => {
    await anthropicProvider.chat("hi", baseContext({ trendsSummary: "Bench Press has plateaued at 135lbs" }));
    const call = mockCreate.mock.calls[0][0];
    expect(call.system).toContain("Bench Press has plateaued at 135lbs");
  });

  it("includes the health summary in the system prompt when present", async () => {
    await anthropicProvider.chat("hi", baseContext({ healthSummary: "Averaging 9000 steps/day" }));
    const call = mockCreate.mock.calls[0][0];
    expect(call.system).toContain("Averaging 9000 steps/day");
  });

  it("does not add stray empty headers when directive/trends/health are absent", async () => {
    await anthropicProvider.chat("hi", baseContext());
    const call = mockCreate.mock.calls[0][0];
    expect(call.system).not.toContain("Coaching Adaptation Directive");
    expect(call.system).not.toContain("Longitudinal Trends");
    expect(call.system).not.toContain("Recent Health Data");
  });

  it("handles an empty conversation history gracefully", async () => {
    await anthropicProvider.chat("hi", baseContext({ conversationHistory: [] }));
    const call = mockCreate.mock.calls[0][0];
    expect(call.messages).toEqual([{ role: "user", content: "hi" }]);
  });
});

describe("anthropicProvider.generateProgressReview", () => {
  const baseInput = {
    userId: "user_1",
    mealsLogged: 18,
    workoutsCompleted: 4,
    weightChange: -0.8,
    bodyMetrics: {},
    period: "weekly",
    tier: "pro",
  };

  it("parses a well-formed structured response into wins/insight/adjustments/closing", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            wins: ["You logged 18 meals this week — great consistency.", "4 workouts completed."],
            insight: "Your best days are ones you log breakfast early.",
            adjustments: ["Try logging dinner the same night instead of the next morning."],
            closing: "Keep this pace going.",
          }),
        },
      ],
    });

    const result = await anthropicProvider.generateProgressReview(baseInput);

    expect(result.wins).toEqual([
      "You logged 18 meals this week — great consistency.",
      "4 workouts completed.",
    ]);
    expect(result.insight).toBe("Your best days are ones you log breakfast early.");
    expect(result.adjustments).toEqual(["Try logging dinner the same night instead of the next morning."]);
    expect(result.closing).toBe("Keep this pace going.");
  });

  it("omits insight/adjustments when the model leaves them out", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ wins: ["Solid week."], closing: "Nice work." }) }],
    });

    const result = await anthropicProvider.generateProgressReview(baseInput);

    expect(result.wins).toEqual(["Solid week."]);
    expect(result.insight).toBeUndefined();
    expect(result.adjustments).toBeUndefined();
  });

  it("always returns at least one win, even if the model returns an empty wins array", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ wins: [], closing: "Nice work." }) }],
    });

    const result = await anthropicProvider.generateProgressReview(baseInput);

    expect(result.wins.length).toBeGreaterThan(0);
  });

  it("falls back to a default win instead of throwing when the response isn't valid JSON", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "Sorry, I can't help with that." }] });

    const result = await anthropicProvider.generateProgressReview(baseInput);

    expect(result.wins.length).toBeGreaterThan(0);
    expect(typeof result.closing).toBe("string");
  });

  it("requests JSON output describing wins first in the prompt", async () => {
    await anthropicProvider.generateProgressReview(baseInput);
    const call = mockCreate.mock.calls[0][0];
    const prompt = call.messages[0].content;
    expect(prompt).toContain("what they're doing well before anything else");
    expect(prompt).toContain('"wins"');
  });

  it("uses the concise prompt and a lower token cap for pro tier", async () => {
    await anthropicProvider.generateProgressReview({ ...baseInput, tier: "pro" });
    const call = mockCreate.mock.calls[0][0];
    expect(call.max_tokens).toBe(700);
    expect(call.messages[0].content).toContain("concise");
    expect(call.messages[0].content).not.toContain("top subscription tier");
  });

  it("uses the in-depth prompt and a higher token cap for elite tier", async () => {
    await anthropicProvider.generateProgressReview({ ...baseInput, tier: "elite" });
    const call = mockCreate.mock.calls[0][0];
    expect(call.max_tokens).toBe(1100);
    expect(call.messages[0].content).toContain("top subscription tier");
    expect(call.messages[0].content).toContain("in-depth");
  });

  it("filters out non-string entries in adjustments defensively", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({ wins: ["Solid week."], adjustments: ["Real fix", 42, null], closing: "Nice work." }),
        },
      ],
    });

    const result = await anthropicProvider.generateProgressReview({ ...baseInput, tier: "elite" });

    expect(result.adjustments).toEqual(["Real fix"]);
  });
});
