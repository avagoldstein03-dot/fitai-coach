import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError, validateRequest } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/rate-limit";

const dailyMetricSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  steps: z.number().int().min(0).max(200_000).optional(),
  activeEnergyKcal: z.number().min(0).max(20_000).optional(),
  sleepMinutes: z.number().int().min(0).max(1440).optional(),
  restingHeartRate: z.number().min(20).max(250).optional(),
});

const syncSchema = z.object({
  metrics: z.array(dailyMetricSchema).max(35),
  latestWeight: z
    .object({
      kg: z.number().min(20).max(500),
      sampleUuid: z.string().min(1),
      sampleDate: z.string(),
    })
    .optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateRequest(req, ["GET", "POST"])) {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "Unauthorized", 401);

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });
    if (!user) return sendError(res, "user_not_found", "User not found", 404);

    if (req.method === "GET") {
      const [latestMetric, latestHealthkitWeight] = await Promise.all([
        prisma.healthMetric.findFirst({
          where: { userId: user.id },
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true },
        }),
        prisma.weightLog.findFirst({
          where: { userId: user.id, source: "healthkit" },
          orderBy: { loggedAt: "desc" },
          select: { loggedAt: true },
        }),
      ]);

      const timestamps = [latestMetric?.updatedAt, latestHealthkitWeight?.loggedAt].filter(
        (d): d is Date => d != null
      );
      const lastSyncedAt = timestamps.length
        ? new Date(Math.max(...timestamps.map((d) => d.getTime()))).toISOString()
        : null;

      return sendSuccess(res, { lastSyncedAt });
    }

    // POST — accept a batch of daily metrics + optionally the latest weight sample
    const allowed = await checkRateLimit("health-sync", userId, 20, "1 h");
    if (!allowed) {
      return sendError(res, "rate_limited", "Too many requests, please slow down", 429);
    }

    const parsed = syncSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, "validation_error", "Invalid health sync payload", 400);
    }
    const { metrics, latestWeight } = parsed.data;

    await prisma.$transaction(
      metrics.map((m) => {
        const { date, ...fields } = m;
        return prisma.healthMetric.upsert({
          where: { userId_date: { userId: user.id, date: new Date(date) } },
          update: fields,
          create: { userId: user.id, date: new Date(date), ...fields },
        });
      })
    );

    if (latestWeight) {
      const existingBySample = await prisma.weightLog.findUnique({
        where: { userId_externalId: { userId: user.id, externalId: latestWeight.sampleUuid } },
      });

      if (!existingBySample) {
        const mostRecentLog = await prisma.weightLog.findFirst({
          where: { userId: user.id },
          orderBy: { loggedAt: "desc" },
        });

        const sampleDate = new Date(latestWeight.sampleDate);
        const isNewerThanLatest = !mostRecentLog || sampleDate > mostRecentLog.loggedAt;

        await prisma.weightLog.create({
          data: {
            userId: user.id,
            weight: latestWeight.kg,
            loggedAt: sampleDate,
            source: "healthkit",
            externalId: latestWeight.sampleUuid,
          },
        });

        if (isNewerThanLatest) {
          await prisma.user.update({ where: { id: user.id }, data: { weight: latestWeight.kg } });
        }
      }
    }

    return sendSuccess(res, { synced: metrics.length }, "Health data synced");
  } catch (error) {
    console.error("Health sync error:", error);
    sendError(res, "server_error", "Failed to sync health data", 500);
  }
}
