import type { NextApiRequest, NextApiResponse } from "next";
import {
  broadcastWorkoutReminders,
  broadcastMealNudges,
  broadcastProgressUpdates,
  broadcastWeeklyReviewReady,
} from "@/services/notifications";
import handler from "./cron";

jest.mock("@/services/notifications", () => ({
  broadcastWorkoutReminders: jest.fn(),
  broadcastMealNudges: jest.fn(),
  broadcastProgressUpdates: jest.fn(),
  broadcastWeeklyReviewReady: jest.fn(),
}));

function mockReqRes(query: Record<string, unknown> = {}, headers: Record<string, unknown> = {}) {
  const req = { method: "GET", query, headers } as unknown as NextApiRequest;
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res: res as NextApiResponse & { status: jest.Mock; json: jest.Mock } };
}

function mockDayOfWeek(utcDay: number) {
  const RealDate = Date;
  jest.spyOn(global, "Date").mockImplementation((...args: any[]) => {
    if (args.length > 0) return new RealDate(...(args as []));
    // A fixed reference date whose UTC day-of-week we control.
    // 2026-08-02 is a Sunday (day 0); offset from there.
    const base = new RealDate("2026-08-02T12:00:00.000Z");
    base.setUTCDate(base.getUTCDate() + utcDay);
    return base;
  }) as any;
}

describe("notifications/cron handler", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.CRON_SECRET;
    (broadcastWorkoutReminders as jest.Mock).mockResolvedValue({ sent: 1, failed: 0 });
    (broadcastMealNudges as jest.Mock).mockResolvedValue({ sent: 1, failed: 0 });
    (broadcastProgressUpdates as jest.Mock).mockResolvedValue({ sent: 1, failed: 0 });
    (broadcastWeeklyReviewReady as jest.Mock).mockResolvedValue({ sent: 1, failed: 0 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("rejects an unauthorized request when CRON_SECRET is set", async () => {
    process.env.CRON_SECRET = "shh";
    const { req, res } = mockReqRes({ type: "workout" }, {});
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(broadcastWorkoutReminders).not.toHaveBeenCalled();
  });

  it("type=workout on a non-Sunday only runs the workout broadcast", async () => {
    mockDayOfWeek(1); // Monday
    const { req, res } = mockReqRes({ type: "workout" });
    await handler(req, res);

    expect(broadcastWorkoutReminders).toHaveBeenCalledTimes(1);
    expect(broadcastProgressUpdates).not.toHaveBeenCalled();
    expect(broadcastWeeklyReviewReady).not.toHaveBeenCalled();
  });

  it("type=workout on a Sunday also runs the two weekly broadcasts", async () => {
    mockDayOfWeek(0); // Sunday
    const { req, res } = mockReqRes({ type: "workout" });
    await handler(req, res);

    expect(broadcastWorkoutReminders).toHaveBeenCalledTimes(1);
    expect(broadcastProgressUpdates).toHaveBeenCalledTimes(1);
    expect(broadcastWeeklyReviewReady).toHaveBeenCalledTimes(1);

    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody.data).toEqual({
      workoutReminders: { sent: 1, failed: 0 },
      progressUpdates: { sent: 1, failed: 0 },
      weeklyReview: { sent: 1, failed: 0 },
    });
  });

  it("type=meal never triggers the weekly broadcasts, even on a Sunday", async () => {
    mockDayOfWeek(0); // Sunday
    const { req, res } = mockReqRes({ type: "meal" });
    await handler(req, res);

    expect(broadcastMealNudges).toHaveBeenCalledTimes(1);
    expect(broadcastProgressUpdates).not.toHaveBeenCalled();
    expect(broadcastWeeklyReviewReady).not.toHaveBeenCalled();
  });
});
