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
