import prisma from "./prisma";
import { grantCompDays } from "./subscription-grants";

jest.mock("./prisma", () => ({
  __esModule: true,
  default: {
    subscription: { findUnique: jest.fn(), upsert: jest.fn() },
  },
}));

describe("grantCompDays", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("grants comp days to a user with no existing subscription", async () => {
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null);

    await grantCompDays("user_1", "pro", 7);

    expect(prisma.subscription.upsert).toHaveBeenCalledTimes(1);
    const args = (prisma.subscription.upsert as jest.Mock).mock.calls[0][0];
    expect(args.create).toMatchObject({ userId: "user_1", plan: "premium", status: "active", tier: "pro", source: "manual-comp" });
  });

  it("extends an existing active manual-comp subscription instead of resetting it", async () => {
    const currentEnd = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000); // 20 days left
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      source: "manual-comp",
      status: "active",
      currentPeriodEnd: currentEnd,
    });

    await grantCompDays("user_1", "pro", 7);

    const args = (prisma.subscription.upsert as jest.Mock).mock.calls[0][0];
    const newEnd = args.update.currentPeriodEnd as Date;
    // Should be ~20 + 7 = 27 days out, not reset to just 7.
    const daysFromNow = (newEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysFromNow).toBeGreaterThan(25);
  });

  it("refuses to shorten or overwrite a real active (non-comp) subscription", async () => {
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      source: "stripe",
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
    });

    await grantCompDays("user_1", "pro", 7);

    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
  });

  it("grants fresh comp days to a user whose subscription has expired", async () => {
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      source: "manual-comp",
      status: "active",
      currentPeriodEnd: new Date(Date.now() - 1000), // just expired
    });

    await grantCompDays("user_1", "pro", 7);

    const args = (prisma.subscription.upsert as jest.Mock).mock.calls[0][0];
    const newEnd = args.update.currentPeriodEnd as Date;
    const daysFromNow = (newEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysFromNow).toBeLessThan(8);
    expect(daysFromNow).toBeGreaterThan(6);
  });
});
