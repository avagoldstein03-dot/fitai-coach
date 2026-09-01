import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth, clerkClient } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import handler from "./step1";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
  clerkClient: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  },
}));

const BASE_BODY = {
  name: "Jamie",
  age: 45,
  sex: "female",
  height: 165,
  weight: 68,
};

function mockReqRes(body: Record<string, unknown>) {
  const req = { method: "POST", body } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("onboarding/step1 handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: "user_1", onboardingStep: 1 });
  });

  it("persists lifeStage on update when provided", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_1" });
    const { req, res } = mockReqRes({ ...BASE_BODY, lifeStage: "menopause" });

    await handler(req, res);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lifeStage: "menopause" }) })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("persists lifeStage on create when provided", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (clerkClient as unknown as jest.Mock).mockResolvedValue({
      users: { getUser: jest.fn().mockResolvedValue({ emailAddresses: [], primaryEmailAddressId: null }) },
    });
    (prisma.user.create as jest.Mock).mockResolvedValue({ id: "user_1", onboardingStep: 1 });
    const { req, res } = mockReqRes({ ...BASE_BODY, lifeStage: "perimenopause" });

    await handler(req, res);

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lifeStage: "perimenopause" }) })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("succeeds without lifeStage and does not force a value", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_1" });
    const { req, res } = mockReqRes(BASE_BODY);

    await handler(req, res);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lifeStage: undefined }) })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("rejects an invalid lifeStage value", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user_1" });
    const { req, res } = mockReqRes({ ...BASE_BODY, lifeStage: "menopause_severe" });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
