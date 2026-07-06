import admin from "firebase-admin";

// Lazy singleton — only initializes once even across hot-reloads in dev
function getApp(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0]!;

  const projectId  = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    throw new Error(
      "Firebase Admin not configured. Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL."
    );
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, privateKey, clientEmail }),
  });
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
}

// Send via Firebase Admin (FCM) — used for bare React Native or production
async function sendViaFCM(fcmToken: string, payload: PushPayload): Promise<void> {
  const app = getApp();
  await app.messaging().send({
    token: fcmToken,
    notification: { title: payload.title, body: payload.body },
    data: payload.data ?? {},
    android: { priority: "high" },
    apns: {
      payload: {
        aps: {
          badge: payload.badge,
          sound: "default",
        },
      },
    },
  });
}

// Send via Expo Push Service — works for Expo Go and managed workflow
async function sendViaExpo(expoToken: string, payload: PushPayload): Promise<void> {
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to:    expoToken,
      title: payload.title,
      body:  payload.body,
      data:  payload.data ?? {},
      sound: "default",
      badge: payload.badge,
    }),
  });

  const result = await response.json();
  if (result?.data?.status === "error") {
    throw new Error(result.data.message ?? "Expo push failed");
  }
}

// Routes to the correct sender based on token format
export async function sendPushNotification(
  token: string,
  payload: PushPayload
): Promise<void> {
  if (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[")) {
    await sendViaExpo(token, payload);
  } else {
    await sendViaFCM(token, payload);
  }
}

// Sends to multiple tokens, silently skips failures for individual tokens
export async function sendBulkNotifications(
  tokens: string[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  const results = await Promise.allSettled(
    tokens.map((token) => sendPushNotification(token, payload))
  );

  const sent   = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  if (failed > 0) {
    console.warn(`[firebase] ${failed}/${tokens.length} push notifications failed`);
  }

  return { sent, failed };
}
