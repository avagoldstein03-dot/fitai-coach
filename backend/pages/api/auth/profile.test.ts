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
