import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth, clerkClient } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { deleteS3Object } from "@/lib/s3";
import handler from "@/pages/api/auth/account";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
  clerkClient: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock("@/lib/s3", () => ({
  deleteS3Object: jest.fn(),
}));

function mockReqRes(method: "GET" | "DELETE") {
  const req = { method } as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

describe("auth/account handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 without touching Prisma when unauthenticated", async () => {
    (getAuth as jest.Mock).mockReturnValue({ userId: null });
    const { req, res } = mockReqRes("DELETE");

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  describe("DELETE", () => {
    it("purges S3 photos for every progress photo and body scan image before deleting the user", async () => {
      (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_1" });
      (clerkClient as jest.Mock).mockResolvedValue({
        users: { deleteUser: jest.fn() },
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "user_1",
        progressPhotos: [{ photoUrl: "https://bucket.s3.amazonaws.com/progress-1.jpg" }],
        bodyScans: [
          {
            frontImageUrl: "https://bucket.s3.amazonaws.com/front.jpg",
            sideImageUrl: "https://bucket.s3.amazonaws.com/side.jpg",
            backImageUrl: null,
          },
        ],
      });

      const { req, res } = mockReqRes("DELETE");
      await handler(req, res);

      expect(deleteS3Object).toHaveBeenCalledTimes(3);
      expect(deleteS3Object).toHaveBeenCalledWith("https://bucket.s3.amazonaws.com/progress-1.jpg");
      expect(deleteS3Object).toHaveBeenCalledWith("https://bucket.s3.amazonaws.com/front.jpg");
      expect(deleteS3Object).toHaveBeenCalledWith("https://bucket.s3.amazonaws.com/side.jpg");
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { clerkId: "clerk_1" } });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("skips S3 deletes when there are no photos", async () => {
      (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_2" });
      (clerkClient as jest.Mock).mockResolvedValue({
        users: { deleteUser: jest.fn() },
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "user_2",
        progressPhotos: [],
        bodyScans: [],
      });

      const { req, res } = mockReqRes("DELETE");
      await handler(req, res);

      expect(deleteS3Object).not.toHaveBeenCalled();
      expect(prisma.user.delete).toHaveBeenCalled();
    });
  });

  describe("GET", () => {
    it("includes progressPhotos and weightLogs in the data export", async () => {
      (getAuth as jest.Mock).mockReturnValue({ userId: "clerk_3" });
      const progressPhotos = [{ photoUrl: "https://bucket.s3.amazonaws.com/p.jpg" }];
      const weightLogs = [{ weight: 70, loggedAt: new Date() }];
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        name: "Test User",
        email: "test@example.com",
        goal: null,
        meals: [],
        workoutSessions: [],
        bodyAssessments: [],
        chatMessages: [],
        progressPhotos,
        weightLogs,
      });

      const { req, res } = mockReqRes("GET");
      await handler(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ progressPhotos, weightLogs }),
        })
      );
    });
  });
});
