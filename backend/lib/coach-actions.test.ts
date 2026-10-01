import { extractActions } from "./coach-actions";

describe("extractActions", () => {
  it("returns the reply unchanged when there are no markers", () => {
    const raw = "You're about 40g short on protein today.";
    expect(extractActions(raw)).toEqual({ text: raw, actions: [] });
  });

  it("pulls an action out and strips it from the text", () => {
    const { text, actions } = extractActions(
      'Greek yogurt would close the gap.\n\n[ACTION:{"type":"log_food","foodName":"Greek yogurt","quantity":1,"unit":"cup","calories":120,"protein":20,"carbs":9,"fat":0}]'
    );
    expect(text).toBe("Greek yogurt would close the gap.");
    expect(actions).toEqual([
      { type: "log_food", foodName: "Greek yogurt", quantity: 1, unit: "cup", calories: 120, protein: 20, carbs: 9, fat: 0, fiber: 0 },
    ]);
  });

  it("keeps paragraph breaks the renderer depends on", () => {
    const { text } = extractActions(
      'First para.\n\nSecond para.\n\n[ACTION:{"type":"open","screen":"Workouts"}]'
    );
    expect(text).toBe("First para.\n\nSecond para.");
  });

  it("handles a food name containing braces and brackets", () => {
    const { text, actions } = extractActions(
      'Try it.\n[ACTION:{"type":"add_to_list","name":"Yogurt [plain] {2%}"}]'
    );
    expect(text).toBe("Try it.");
    expect(actions[0]).toMatchObject({ type: "add_to_list", name: "Yogurt [plain] {2%}" });
  });

  it("drops an action with an unknown screen but keeps the answer", () => {
    const { text, actions } = extractActions(
      'Here you go.\n[ACTION:{"type":"open","screen":"NotARealScreen"}]'
    );
    expect(text).toBe("Here you go.");
    expect(actions).toEqual([]);
  });

  it("drops an unknown action type", () => {
    const { actions } = extractActions('Hi.\n[ACTION:{"type":"delete_account"}]');
    expect(actions).toEqual([]);
  });

  it("drops malformed JSON without swallowing the rest of the reply", () => {
    const { text, actions } = extractActions(
      'Before.\n[ACTION:{"type":"log_food",,,}]\nAfter.'
    );
    expect(text).toContain("Before.");
    expect(text).toContain("After.");
    expect(actions).toEqual([]);
  });

  it("does not swallow the reply when the marker is never closed", () => {
    const { text, actions } = extractActions('Keep this.\n[ACTION:{"type":"open"');
    expect(text).toContain("Keep this.");
    expect(actions).toEqual([]);
  });

  it("clamps to four actions", () => {
    const one = (n: number) => `[ACTION:{"type":"add_to_list","name":"item ${n}"}]`;
    const { actions } = extractActions("Shop:\n" + [1, 2, 3, 4, 5, 6].map(one).join("\n"));
    expect(actions).toHaveLength(4);
  });

  it("de-duplicates identical actions", () => {
    const dup = '[ACTION:{"type":"add_to_list","name":"eggs"}]';
    const { actions } = extractActions(`Eggs.\n${dup}\n${dup}`);
    expect(actions).toHaveLength(1);
  });

  it("rejects negative macros", () => {
    const { actions } = extractActions(
      'x\n[ACTION:{"type":"log_food","foodName":"a","calories":-5,"protein":10}]'
    );
    expect(actions).toEqual([]);
  });

  it("extracts a marker that appears mid-reply", () => {
    const { text, actions } = extractActions(
      'Start. [ACTION:{"type":"open","screen":"Nutrition"}] End.'
    );
    expect(text).toBe("Start. End.");
    expect(actions).toHaveLength(1);
  });
});
