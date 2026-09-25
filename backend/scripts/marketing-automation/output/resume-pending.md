# Render notes (2026-09-25)

Ava makes the videos herself. Claude doesn't render or spend Higgsfield credits unless explicitly asked. Scripts, captions, and shot notes for #47–54 are in `prompts.json` and the "Active AI — UGC Video Prompts" doc.

## What the test renders showed
- `generate-ugc-video.ts` uses `SpeakDuration.SHORT`, so every Speak render is only **5 seconds** of a 26–53 s script.
- Higgsfield Speak rejects input images over ~10 MB; the script now re-encodes larger ones to JPEG before step 4.
- `--image <url> --audio <url>` resumes a run at step 4 without paying for steps 1–3 again.
- The API key (`HF_CREDENTIALS`) draws on a separate balance from the Ultra app credits.
- Video models garble on-screen app text, so keep the phone screen out of frame and cut to the real screenshot instead (each prompt's `screenshotCut` field says where).
- Every image in `screenshot-assets/` is a small thumbnail (230×500 to 380×826); full-resolution phone screenshots will look sharper.
