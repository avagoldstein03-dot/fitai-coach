import type { ChatContext } from "./ai-provider";

const mockCreate = jest.fn();

jest.mock("openai", () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
});

const openaiProvider = require("./openai-provider").default;

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
  mockCreate.mockResolvedValue({ choices: [{ message: { content: "reply" } }] });
});

describe("openaiProvider.chat", () => {
  it("includes conversation history in the messages sent to the model, followed by the new message", async () => {
    const history = [
      { role: "user" as const, content: "I'm training for a 5k" },
      { role: "assistant" as const, content: "Great goal!" },
    ];
    await openaiProvider.chat("what did I just tell you?", baseContext({ conversationHistory: history }));

    const call = mockCreate.mock.calls[0][0];
    expect(call.messages).toEqual([
      { role: "system", content: expect.any(String) },
      ...history,
      { role: "user", content: "what did I just tell you?" },
    ]);
  });

  it("includes the coaching directive in the system prompt when present", async () => {
    await openaiProvider.chat("hi", baseContext({ coachingDirective: "BE ENCOURAGING WITH BEGINNERS" }));
    const call = mockCreate.mock.calls[0][0];
    expect(call.messages[0].content).toContain("BE ENCOURAGING WITH BEGINNERS");
  });

  it("includes the trends summary in the system prompt when present", async () => {
    await openaiProvider.chat("hi", baseContext({ trendsSummary: "Bench Press has plateaued at 135lbs" }));
    const call = mockCreate.mock.calls[0][0];
    expect(call.messages[0].content).toContain("Bench Press has plateaued at 135lbs");
  });

  it("includes the health summary in the system prompt when present", async () => {
    await openaiProvider.chat("hi", baseContext({ healthSummary: "Averaging 9000 steps/day" }));
    const call = mockCreate.mock.calls[0][0];
    expect(call.messages[0].content).toContain("Averaging 9000 steps/day");
  });

  it("does not add stray empty headers when directive/trends/health are absent", async () => {
    await openaiProvider.chat("hi", baseContext());
    const call = mockCreate.mock.calls[0][0];
    expect(call.messages[0].content).not.toContain("Coaching Adaptation Directive");
    expect(call.messages[0].content).not.toContain("Longitudinal Trends");
    expect(call.messages[0].content).not.toContain("Recent Health Data");
  });

  it("now includes recent meals and workouts, matching Anthropic's parity", async () => {
    await openaiProvider.chat(
      "hi",
      baseContext({ recentMeals: [{ mealType: "breakfast" }], recentWorkouts: [{ exerciseName: "Squat" }] })
    );
    const call = mockCreate.mock.calls[0][0];
    expect(call.messages[0].content).toContain("breakfast");
    expect(call.messages[0].content).toContain("Squat");
  });
});
