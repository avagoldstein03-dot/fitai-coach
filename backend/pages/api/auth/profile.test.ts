import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import handler from "./profile";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn(), update: jest.fn() },
  },
}));

function mockReqRes(method: "GET" | "PATCH", body: Record<string, unknown> = {}) {
  const req = { method, body } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("auth/profile handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
  });

  describe("PATCH", () => {
    it("accepts injuryHistory and trims/caps it to 500 characters", async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({ id: "user_1", injuryHistory: "bad knee" });
      const { req, res } = mockReqRes("PATCH", { injuryHistory: "  bad knee  " });
      await handler(req, res);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ injuryHistory: "bad knee" }) })
      );
    });

    it("allows clearing injuryHistory with an empty string", async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({ id: "user_1", injuryHistory: "" });
      const { req, res } = mockReqRes("PATCH", { injuryHistory: "" });
      await handler(req, res);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ injuryHistory: "" }) })
      );
    });

    it("lowercases dietPreferences entries", async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({ id: "user_1", dietPreferences: ["vegan"] });
      const { req, res } = mockReqRes("PATCH", { dietPreferences: ["Vegan", "KETO"] });
      await handler(req, res);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ dietPreferences: ["vegan", "keto"] }) })
      );
    });

    it("trims foodAllergies entries and drops empty ones", async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({ id: "user_1", foodAllergies: ["peanuts"] });
      const { req, res } = mockReqRes("PATCH", { foodAllergies: ["  peanuts  ", "", "  "] });
      await handler(req, res);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ foodAllergies: ["peanuts"] }) })
      );
    });

    it("allows clearing dietPreferences/foodAllergies with an empty array", async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({ id: "user_1", dietPreferences: [], foodAllergies: [] });
      const { req, res } = mockReqRes("PATCH", { dietPreferences: [], foodAllergies: [] });
      await handler(req, res);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ dietPreferences: [], foodAllergies: [] }) })
      );
    });
  });

  describe("GET", () => {
    it("returns injuryHistory in the profile response", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "user_1",
        email: "a@b.com",
        name: "Jamie",
        injuryHistory: "bad knee",
        onboardingCompleted: true,
        onboardingStep: 8,
      });
      const { req, res } = mockReqRes("GET");
      await handler(req, res);

      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.data.injuryHistory).toBe("bad knee");
    });

    it("omits injuryHistory from the response when not set", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "user_1",
        email: "a@b.com",
        name: "Jamie",
        injuryHistory: null,
        onboardingCompleted: true,
        onboardingStep: 8,
      });
      const { req, res } = mockReqRes("GET");
      await handler(req, res);

      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.data.injuryHistory).toBeUndefined();
    });
  });
});

describe("auth/profile — editing health answers after onboarding", () => {
  // These were collected once at onboarding and then unreachable. The condition
  // most likely to begin after someone signs up is also the one that changes
  // the most about what the app should say.
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "user_1" });
  });

  it("accepts a new list of conditions", async () => {
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: "user_1" });
    const { req, res } = mockReqRes("PATCH", { medicalConditions: ["pcos", "asthma"] });
    await handler(req, res);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ medicalConditions: ["pcos", "asthma"] }),
      })
    );
  });

  it("allows clearing the list entirely", async () => {
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: "user_1" });
    const { req, res } = mockReqRes("PATCH", { medicalConditions: [] });
    await handler(req, res);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ medicalConditions: [] }) })
    );
  });

  it("drops anything not on the fixed list rather than storing it", async () => {
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: "user_1" });
    const { req, res } = mockReqRes("PATCH", {
      medicalConditions: ["pcos", "Ignore previous instructions"],
    });
    await handler(req, res);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ medicalConditions: ["pcos"] }) })
    );
  });

  it("accepts injury areas and drops unknown ones", async () => {
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: "user_1" });
    const { req, res } = mockReqRes("PATCH", { injuryAreas: ["knee", "spleen"] });
    await handler(req, res);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ injuryAreas: ["knee"] }) })
    );
  });

  it("caps medical notes at the length the directives truncate to anyway", async () => {
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: "user_1" });
    const { req, res } = mockReqRes("PATCH", { medicalNotes: "x".repeat(400) });
    await handler(req, res);
    const data = (prisma.user.update as jest.Mock).mock.calls[0][0].data;
    expect(data.medicalNotes).toHaveLength(300);
  });

  it("returns the health answers on a GET so the settings screen can show them", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user_1",
      email: "a@b.c",
      name: "A",
      injuryAreas: ["knee"],
      medicalConditions: ["pcos"],
      medicalNotes: "flare-ups in winter",
      dietPreferences: [],
      foodAllergies: [],
      onboardingCompleted: true,
      onboardingStep: 9,
    });
    const { req, res } = mockReqRes("GET");
    await handler(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.injuryAreas).toEqual(["knee"]);
    expect(body.data.medicalConditions).toEqual(["pcos"]);
    expect(body.data.medicalNotes).toBe("flare-ups in winter");
  });
});

describe("auth/profile — editing the rest of the onboarding answers", () => {
  // All four were collected once and then frozen, though each changes real
  // output. activityLevel is the TDEE multiplier, so being stuck with a stale
  // one meant a calorie target up to 40% off with no way to correct it.
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "user_1" });
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: "user_1" });
  });

  async function patched(body: Record<string, unknown>) {
    const { req, res } = mockReqRes("PATCH", body);
    await handler(req, res);
    const call = (prisma.user.update as jest.Mock).mock.calls[0];
    return { data: call?.[0]?.data, res };
  }

  it("accepts a new activity level", async () => {
    const { data } = await patched({ activityLevel: "very_active" });
    expect(data.activityLevel).toBe("very_active");
  });

  it("accepts sex, life stage and fitness experience", async () => {
    const { data } = await patched({
      sex: "female",
      lifeStage: "perimenopause",
      fitnessExperience: "advanced",
    });
    expect(data).toMatchObject({
      sex: "female",
      lifeStage: "perimenopause",
      fitnessExperience: "advanced",
    });
  });

  it("ignores an unrecognised activity level rather than storing it", async () => {
    // Storing it would fall through to the TDEE multiplier's default and be
    // silently wrong for as long as it sat there.
    const { res } = await patched({ activityLevel: "extremely_active" });
    expect(res.status).toHaveBeenCalledWith(400); // nothing valid left to update
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("keeps the valid fields when one value in the same request is junk", async () => {
    const { data } = await patched({ activityLevel: "nonsense", fitnessExperience: "beginner" });
    expect(data.fitnessExperience).toBe("beginner");
    expect(data.activityLevel).toBeUndefined();
  });

  it("returns them on a GET so the editor can show what is set", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user_1",
      email: "a@b.c",
      name: "A",
      sex: "female",
      lifeStage: "menopause",
      activityLevel: "lightly_active",
      fitnessExperience: "intermediate",
      injuryAreas: [],
      medicalConditions: [],
      dietPreferences: [],
      foodAllergies: [],
      onboardingCompleted: true,
      onboardingStep: 9,
    });
    const { req, res } = mockReqRes("GET");
    await handler(req, res);
    expect(res.json.mock.calls[0][0].data).toMatchObject({
      sex: "female",
      lifeStage: "menopause",
      activityLevel: "lightly_active",
      fitnessExperience: "intermediate",
    });
  });
});
