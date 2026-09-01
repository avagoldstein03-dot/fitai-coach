import prisma from "@/lib/prisma";
import { sendPushNotification } from "./firebase";
import {
  broadcastProgressUpdates,
  broadcastWeeklyReviewReady,
  notifyOnboardingWelcome,
  notifyOnboardingNudge,
  notifyWinBackNudge,
  notifyPayingWinBack,
  broadcastOnboardingSequence,
  broadcastWinBackSequence,
} from "./notifications";

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findMany: jest.fn(), findUnique: jest.fn() },
    workoutSession: { findMany: jest.fn(), findFirst: jest.fn() },
    bodyAssessment: { findMany: jest.fn() },
    meal: { findFirst: jest.fn() },
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

describe("lifecycle notifications — individual senders", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (sendPushNotification as jest.Mock).mockResolvedValue(undefined);
  });

  it("notifyOnboardingWelcome sends a D0 welcome and returns true", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ pushToken: "token_1", notificationPrefs: null, name: "Jamie Lee" });

    const result = await notifyOnboardingWelcome("user_1");

    expect(result).toBe(true);
    expect(sendPushNotification).toHaveBeenCalledWith(
      "token_1",
      expect.objectContaining({ title: "You're in 👋", body: expect.stringContaining("Jamie") })
    );
  });

  it("notifyOnboardingWelcome returns false with no push token", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ pushToken: null });
    const result = await notifyOnboardingWelcome("user_1");
    expect(result).toBe(false);
    expect(sendPushNotification).not.toHaveBeenCalled();
  });

  it("notifyOnboardingNudge sends distinct copy per day", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ pushToken: "token_1", notificationPrefs: null });

    await notifyOnboardingNudge("user_1", 1);
    await notifyOnboardingNudge("user_1", 3);
    await notifyOnboardingNudge("user_1", 7);

    const titles = (sendPushNotification as jest.Mock).mock.calls.map((c) => c[1].title);
    expect(new Set(titles).size).toBe(3); // all three days produce different copy
  });

  it("notifyWinBackNudge sends distinct copy per day", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ pushToken: "token_1", notificationPrefs: null, name: "Sam" });

    await notifyWinBackNudge("user_1", 3);
    await notifyWinBackNudge("user_1", 7);
    await notifyWinBackNudge("user_1", 14);

    const titles = (sendPushNotification as jest.Mock).mock.calls.map((c) => c[1].title);
    expect(new Set(titles).size).toBe(3);
  });

  it("notifyPayingWinBack sends the post-expiration message", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ pushToken: "token_1", notificationPrefs: null });

    const result = await notifyPayingWinBack("user_1");

    expect(result).toBe(true);
    expect(sendPushNotification).toHaveBeenCalledWith(
      "token_1",
      expect.objectContaining({ title: "Your Pro access just ended" })
    );
  });
});

describe("broadcastOnboardingSequence", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (sendPushNotification as jest.Mock).mockResolvedValue(undefined);
  });

  it("only sends to users whose signup date falls in the 1/3/7-day buckets", async () => {
    // findMany is called once per bucket (1, 3, 7) — return one matching user each time.
    (prisma.user.findMany as jest.Mock)
      .mockResolvedValueOnce([{ id: "day1_user" }])
      .mockResolvedValueOnce([{ id: "day3_user" }])
      .mockResolvedValueOnce([{ id: "day7_user" }]);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ pushToken: "token_1", notificationPrefs: null });

    const result = await broadcastOnboardingSequence();

    expect(prisma.user.findMany).toHaveBeenCalledTimes(3);
    expect(sendPushNotification).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ sent: 3, failed: 0 });
  });

  it("returns zero when nobody falls in any bucket", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
    const result = await broadcastOnboardingSequence();
    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(sendPushNotification).not.toHaveBeenCalled();
  });
});

describe("broadcastWinBackSequence", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (sendPushNotification as jest.Mock).mockResolvedValue(undefined);
  });

  it("buckets a user by days since their last meal or workout, whichever is more recent", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: "lapsed_user" }]);
    (prisma.meal.findFirst as jest.Mock).mockResolvedValue({ createdAt: daysAgo(3) });
    (prisma.workoutSession.findFirst as jest.Mock).mockResolvedValue({ createdAt: daysAgo(10) });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ pushToken: "token_1", notificationPrefs: null, name: "Sam" });

    const result = await broadcastWinBackSequence();

    // last activity is the meal (3 days ago), not the older workout — should land in the day-3 bucket.
    expect(sendPushNotification).toHaveBeenCalledTimes(1);
    expect(sendPushNotification).toHaveBeenCalledWith("token_1", expect.objectContaining({ title: "Still there? 👋" }));
    expect(result).toEqual({ sent: 1, failed: 0 });
  });

  it("skips a user with no logged activity at all", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: "never_active_user" }]);
    (prisma.meal.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.workoutSession.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await broadcastWinBackSequence();

    expect(sendPushNotification).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, failed: 0 });
  });

  it("skips a user whose last activity doesn't land on exactly a 3/7/14-day boundary", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: "mid_window_user" }]);
    (prisma.meal.findFirst as jest.Mock).mockResolvedValue({ createdAt: daysAgo(5) });
    (prisma.workoutSession.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await broadcastWinBackSequence();

    expect(sendPushNotification).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, failed: 0 });
  });
});
