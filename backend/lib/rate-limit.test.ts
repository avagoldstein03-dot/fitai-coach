describe("checkRateLimit", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("fails open (allows the request) when Upstash isn't configured", async () => {
    const { checkRateLimit } = await import("./rate-limit");
    const allowed = await checkRateLimit("test-limiter", "user-1", 5, "1 h");
    expect(allowed).toBe(true);
  });

  it("fails open consistently across repeated calls with no Redis configured", async () => {
    const { checkRateLimit } = await import("./rate-limit");
    for (let i = 0; i < 10; i++) {
      expect(await checkRateLimit("test-limiter", "user-1", 5, "1 h")).toBe(true);
    }
  });
});
