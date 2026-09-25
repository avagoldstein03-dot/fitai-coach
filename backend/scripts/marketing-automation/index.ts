// Minimal end-to-end check of the official Higgsfield TypeScript SDK against
// the Seedance 2.5 text-to-video model. Submits one generation, waits for it
// to finish, and prints the resulting video URL.
//
// This makes a real, billable API call when run.
//
// Setup: put your Higgsfield credential in backend/.env.local as
//   HF_CREDENTIALS=your-key-id:your-key-secret
// (backend/.env.local is git-ignored; nothing here reads it back to you.)
//
// Run: node backend/scripts/marketing-automation/index.ts

import { config, higgsfield } from "@higgsfield/client/v2";

try {
  process.loadEnvFile(new URL("../../.env.local", import.meta.url));
} catch {
  // .env.local may not exist yet, or HF_CREDENTIALS may already be exported
  // in the shell environment -- config() below will fail clearly either way.
}

config({
  credentials: process.env.HF_CREDENTIALS,
});

async function main() {
  if (!process.env.HF_CREDENTIALS) {
    console.error("HF_CREDENTIALS is not set. Add it to backend/.env.local as HF_CREDENTIALS=key-id:key-secret.");
    process.exit(1);
  }

  console.log("Submitting Seedance 2.5 text-to-video request...");

  const result = await higgsfield.subscribe("bytedance/seedance-2.5/text-to-video", {
    input: {
      prompt: "A cinematic scene at sunset",
      duration: 5,
      resolution: "720p",
      aspect_ratio: "16:9",
    },
    withPolling: true,
  });

  console.log("Final status:", result.status);

  if (result.status === "completed") {
    const videoUrl = result.video?.url;
    if (!videoUrl) {
      console.error("Completed, but no video URL found in the result:", JSON.stringify(result));
      process.exit(1);
    }
    console.log("Video URL:", videoUrl);
    return;
  }

  if (result.status === "nsfw") {
    console.error("Request was blocked by content moderation (nsfw). No video was generated.");
    process.exit(1);
  }

  if (result.status === "canceled") {
    console.error("Request was canceled before completion. No video was generated.");
    process.exit(1);
  }

  // "failed" or any other non-success terminal status
  console.error("Request failed:", JSON.stringify(result));
  process.exit(1);
}

main().catch((err) => {
  console.error("Unexpected error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
