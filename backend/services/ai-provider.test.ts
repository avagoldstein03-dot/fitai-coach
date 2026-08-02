import { sanitizeConversationHistory } from "./ai-provider";

describe("sanitizeConversationHistory", () => {
  it("returns an empty array for empty input", () => {
    expect(sanitizeConversationHistory([], 10)).toEqual([]);
  });

  it("passes clean, already-alternating input through unchanged", () => {
    const messages = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ];
    expect(sanitizeConversationHistory(messages, 10)).toEqual(messages);
  });

  it("caps to the last maxMessages entries", () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `msg ${i}`,
    }));
    const result = sanitizeConversationHistory(messages, 10);
    expect(result).toHaveLength(10);
    expect(result[result.length - 1].content).toBe("msg 19");
  });

  it("drops a leading assistant message", () => {
    const messages = [
      { role: "assistant", content: "orphaned reply" },
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ];
    const result = sanitizeConversationHistory(messages, 10);
    expect(result[0].role).toBe("user");
    expect(result).toHaveLength(2);
  });

  it("drops a trailing user message", () => {
    const messages = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "user", content: "orphaned question" },
    ];
    const result = sanitizeConversationHistory(messages, 10);
    expect(result).toHaveLength(2);
    expect(result[result.length - 1].role).toBe("assistant");
  });

  it("normalizes any non-assistant role to user", () => {
    const messages = [{ role: "system", content: "weird" }];
    const result = sanitizeConversationHistory(messages, 10);
    expect(result[0].role).toBe("user");
  });
});
