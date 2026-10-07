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

  it("clamps to six actions", () => {
    const one = (n: number) => `[ACTION:{"type":"add_to_list","name":"item ${n}"}]`;
    const { actions } = extractActions("Shop:\n" + [1, 2, 3, 4, 5, 6, 7, 8].map(one).join("\n"));
    expect(actions).toHaveLength(6);
  });

  it("gives every food a button before giving any food a second one", () => {
    // The reported bug: three foods named, but log + shopping-list for the first
    // consumed the slots and the other two rendered no button at all.
    const raw = [
      "Three options:",
      '[ACTION:{"type":"log_food","foodName":"Greek yogurt","calories":120,"protein":20}]',
      '[ACTION:{"type":"add_to_list","name":"Greek yogurt"}]',
      '[ACTION:{"type":"log_food","foodName":"Egg whites","calories":104,"protein":22}]',
      '[ACTION:{"type":"log_food","foodName":"Quinoa","calories":222,"protein":8}]',
    ].join("\n");
    const { actions } = extractActions(raw);
    const foods = actions.filter((a) => a.type === "log_food").map((a: any) => a.foodName);
    expect(foods).toEqual(["Greek yogurt", "Egg whites", "Quinoa"]);
  });

  it("keeps a second action for the same food only once everything else has one", () => {
    const raw = [
      '[ACTION:{"type":"log_food","foodName":"Greek yogurt","calories":120,"protein":20}]',
      '[ACTION:{"type":"add_to_list","name":"Greek yogurt"}]',
      '[ACTION:{"type":"log_food","foodName":"Eggs","calories":140,"protein":12}]',
    ].join("\n");
    const { actions } = extractActions(raw);
    // Both foods first, then the duplicate subject.
    expect(actions.map((a: any) => `${a.type}:${a.foodName ?? a.name}`)).toEqual([
      "log_food:Greek yogurt",
      "log_food:Eggs",
      "add_to_list:Greek yogurt",
    ]);
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
