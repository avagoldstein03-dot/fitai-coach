import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import handler from "./step4";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn(), update: jest.fn() },
  },
}));

function mockReqRes(body: Record<string, unknown>) {
  const req = { method: "POST", body } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("onboarding/step4 handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_1" });
  });

  it("saves injuryHistory alongside fitnessExperience when provided", async () => {
    const { req, res } = mockReqRes({ fitnessExperience: "beginner", injuryHistory: "bad left knee" });
    await handler(req, res);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fitnessExperience: "beginner", injuryHistory: "bad left knee" }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("succeeds without injuryHistory and does not null it out", async () => {
    const { req, res } = mockReqRes({ fitnessExperience: "advanced" });
    await handler(req, res);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ injuryHistory: undefined }) })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("rejects an injuryHistory string over 500 characters", async () => {
    const { req, res } = mockReqRes({ fitnessExperience: "beginner", injuryHistory: "a".repeat(501) });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects an invalid fitnessExperience value", async () => {
    const { req, res } = mockReqRes({ fitnessExperience: "expert" });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
