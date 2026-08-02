import { generateFriendCode, generateUniqueFriendCode } from "./friend-code";

describe("generateFriendCode", () => {
  it("generates a 6-character code", () => {
    expect(generateFriendCode()).toHaveLength(6);
  });

  it("only uses unambiguous uppercase alphanumeric characters", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateFriendCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it("does not include ambiguous characters O, 0, I, 1", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateFriendCode()).not.toMatch(/[O0I1]/);
    }
  });
});

describe("generateUniqueFriendCode", () => {
  it("returns a code immediately when it's not taken", async () => {
    const isCodeTaken = jest.fn().mockResolvedValue(false);
    const code = await generateUniqueFriendCode(isCodeTaken);
    expect(code).toHaveLength(6);
    expect(isCodeTaken).toHaveBeenCalledTimes(1);
  });

  it("retries when a code collides, and succeeds once it finds a free one", async () => {
    const isCodeTaken = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const code = await generateUniqueFriendCode(isCodeTaken);
    expect(code).toHaveLength(6);
    expect(isCodeTaken).toHaveBeenCalledTimes(3);
  });

  it("throws after exhausting max attempts", async () => {
    const isCodeTaken = jest.fn().mockResolvedValue(true);
    await expect(generateUniqueFriendCode(isCodeTaken, 3)).rejects.toThrow(
      "Could not generate a unique friend code after several attempts"
    );
    expect(isCodeTaken).toHaveBeenCalledTimes(3);
  });
});
