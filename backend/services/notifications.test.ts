import prisma from "@/lib/prisma";
import { sendPushNotification } from "./firebase";
import { broadcastProgressUpdates, broadcastWeeklyReviewReady } from "./notifications";

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findMany: jest.fn(), findUnique: jest.fn() },
    workoutSession: { findMany: jest.fn() },
    bodyAssessment: { findMany: jest.fn() },
  },
}));

jest.mock("./firebase", () => ({
  sendPushNotification: jest.fn(),
  sendBulkNotifications: jest.fn(),
}));

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

describe("broadcastProgressUpdates", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (sendPushNotification as jest.Mock).mockResolvedValue(undefined);
  });

  it("sends only to users with a detected plateau", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user_plateaued", pushToken: "token_1", notificationPrefs: null },
      { id: "user_progressing", pushToken: "token_2", notificationPrefs: null },
    ]);
    (prisma.workoutSession.findMany as jest.Mock)
      .mockResolvedValueOnce(
        [0, 1, 2].map((n) => ({
          exerciseName: "Bench Press",
          weight: 135,
          completedReps: "8",
          createdAt: daysAgo(n),
        }))
      )
      .mockResolvedValueOnce([
        { exerciseName: "Row", weight: 135, completedReps: "8", createdAt: daysAgo(0) },
        { exerciseName: "Row", weight: 125, completedReps: "8", createdAt: daysAgo(1) },
      ]);
    (prisma.bodyAssessment.findMany as jest.Mock).mockResolvedValue([]);

    const result = await broadcastProgressUpdates();

    expect(sendPushNotification).toHaveBeenCalledTimes(1);
    expect(sendPushNotification).toHaveBeenCalledWith(
      "token_1",
      expect.objectContaining({ title: "Progress update 📈" })
    );
    expect(result).toEqual({ sent: 1, failed: 0 });
  });

  it("skips users with the progress_updates pref off", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user_1", pushToken: "token_1", notificationPrefs: { progress_updates: false } },
    ]);

    const result = await broadcastProgressUpdates();

    expect(prisma.workoutSession.findMany).not.toHaveBeenCalled();
    expect(sendPushNotification).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, failed: 0 });
  });

  it("skips users with no push token", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user_1", pushToken: null, notificationPrefs: null },
    ]);

    await broadcastProgressUpdates();

    expect(sendPushNotification).not.toHaveBeenCalled();
  });
});

describe("broadcastWeeklyReviewReady", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (sendPushNotification as jest.Mock).mockResolvedValue(undefined);
  });

  const proSubscription = {
    plan: "premium",
    status: "active",
    currentPeriodEnd: daysAgo(-30),
    stripePriceId: null,
    tier: "pro",
  };

  it("sends only to pro/elite users with the pref on", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "pro_user", pushToken: "token_pro", notificationPrefs: null, subscription: proSubscription },
      { id: "free_user", pushToken: "token_free", notificationPrefs: null, subscription: null },
    ]);
    // notifyWeeklyReview re-fetches the user internally
    (prisma.user.findUnique as jest.Mock).mockImplementation(({ where }: any) =>
      where.id === "pro_user"
        ? Promise.resolve({ pushToken: "token_pro", notificationPrefs: null, name: "Jamie" })
        : Promise.resolve(null)
    );

    const result = await broadcastWeeklyReviewReady();

    expect(sendPushNotification).toHaveBeenCalledTimes(1);
    expect(sendPushNotification).toHaveBeenCalledWith(
      "token_pro",
      expect.objectContaining({ title: "Weekly review ready ✨" })
    );
    expect(result).toEqual({ sent: 1, failed: 0 });
  });

  it("skips free-tier users even if the pref is on", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "free_user", pushToken: "token_free", notificationPrefs: { weekly_review: true }, subscription: null },
    ]);

    await broadcastWeeklyReviewReady();

    expect(sendPushNotification).not.toHaveBeenCalled();
  });

  it("skips users with the weekly_review pref off", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      {
        id: "pro_user",
        pushToken: "token_pro",
        notificationPrefs: { weekly_review: false },
        subscription: proSubscription,
      },
    ]);

    await broadcastWeeklyReviewReady();

    expect(sendPushNotification).not.toHaveBeenCalled();
  });
});
