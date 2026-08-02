import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { getUserSubscription } from "@/lib/subscription-middleware";
import { checkRateLimit } from "@/lib/rate-limit";
import { AIProviderRegistry } from "@/services/ai-registry";
import handler from "./form-check";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
  },
}));

jest.mock("@/lib/subscription-middleware", () => ({
  getUserSubscription: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(),
}));

jest.mock("@/services/ai-registry", () => ({
  AIProviderRegistry: { getProviderForTask: jest.fn() },
}));

const VALID_BODY = {
  exerciseName: "Barbell Squat",
  images: [{ base64: "abc123", mimeType: "image/jpeg" }],
};

const FORM_CHECK_RESULT = {
  exerciseName: "Barbell Squat",
  overallScore: 7,
  muscles: ["quads", "glutes"],
  positives: ["Good depth"],
  corrections: ["Keep chest up"],
  cues: ["Chest up"],
  safetyWarnings: [],
  summary: "Solid overall form.",
};

function mockReqRes(body: Record<string, unknown> = VALID_BODY, method = "POST") {
  const req = { method, body } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("workouts/form-check handler", () => {
  let analyzeForm: jest.Mock;

  beforeEach(() => {
    jest.resetAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_1" });
    (getUserSubscription as jest.Mock).mockResolvedValue({ limits: { formCheck: true } });
    (checkRateLimit as jest.Mock).mockResolvedValue(true);
    analyzeForm = jest.fn().mockResolvedValue(FORM_CHECK_RESULT);
    (AIProviderRegistry.getProviderForTask as jest.Mock).mockReturnValue({ analyzeForm });
  });

  it("rejects non-POST methods", async () => {
    const { req, res } = mockReqRes(VALID_BODY, "GET");
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("rejects unauthenticated requests", async () => {
    (getAuth as jest.Mock).mockReturnValue({ userId: null });
    const { req, res } = mockReqRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rejects when no matching user is found", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    const { req, res } = mockReqRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("rejects non-elite users without calling the AI provider", async () => {
    (getUserSubscription as jest.Mock).mockResolvedValue({ limits: { formCheck: false } });
    const { req, res } = mockReqRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(AIProviderRegistry.getProviderForTask).not.toHaveBeenCalled();
  });

  it("rejects when rate limited", async () => {
    (checkRateLimit as jest.Mock).mockResolvedValue(false);
    const { req, res } = mockReqRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(analyzeForm).not.toHaveBeenCalled();
  });

  it("rejects a missing exerciseName", async () => {
    const { req, res } = mockReqRes({ images: VALID_BODY.images });
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rejects an empty images array", async () => {
    const { req, res } = mockReqRes({ exerciseName: "Barbell Squat", images: [] });
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rejects more than 4 images", async () => {
    const images = Array.from({ length: 5 }, () => ({ base64: "abc", mimeType: "image/jpeg" }));
    const { req, res } = mockReqRes({ exerciseName: "Barbell Squat", images });
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("calls analyzeForm with joined formCues as userNotes", async () => {
    const { req, res } = mockReqRes({ ...VALID_BODY, formCues: ["Chest up", "Knees out"] });
    await handler(req, res);

    expect(AIProviderRegistry.getProviderForTask).toHaveBeenCalledWith("form_check");
    expect(analyzeForm).toHaveBeenCalledWith({
      exerciseName: "Barbell Squat",
      images: VALID_BODY.images,
      userNotes: "Chest up, Knees out",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody.data.formCheck).toEqual(FORM_CHECK_RESULT);
  });

  it("omits userNotes when formCues is missing or empty", async () => {
    const { req, res } = mockReqRes({ ...VALID_BODY, formCues: [] });
    await handler(req, res);

    expect(analyzeForm).toHaveBeenCalledWith({
      exerciseName: "Barbell Squat",
      images: VALID_BODY.images,
      userNotes: undefined,
    });
  });

  it("returns a generic 500 when the AI provider throws", async () => {
    analyzeForm.mockRejectedValue(new Error("OpenAI exploded with sensitive internals"));
    const { req, res } = mockReqRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody.message).not.toMatch(/sensitive internals/);
  });

  it("returns 422 with a specific message when no person is detected", async () => {
    analyzeForm.mockRejectedValue(
      new Error("No person detected performing the exercise. Please make sure you're clearly visible in frame and try again.")
    );
    const { req, res } = mockReqRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody.message).toMatch(/No person detected/);
  });
});
