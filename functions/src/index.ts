import { initializeApp } from "firebase-admin/app";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { runSync } from "./clickupSync";

initializeApp();

// Secret stored in Google Secret Manager — set via:
// firebase functions:secrets:set CLICKUP_API_TOKEN
const CLICKUP_API_TOKEN = defineSecret("CLICKUP_API_TOKEN");

// Runs twice daily: 6am and 6pm UTC
export const scheduledClickupSync = onSchedule(
  {
    schedule: "0 6,18 * * *",
    timeZone: "UTC",
    secrets: [CLICKUP_API_TOKEN],
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async () => {
    await runSync(CLICKUP_API_TOKEN.value());
  }
);

// Manual trigger — call from admin portal or curl for on-demand sync
export const triggerClickupSync = onRequest(
  {
    secrets: [CLICKUP_API_TOKEN],
    memory: "512MiB",
    timeoutSeconds: 540,
    cors: true,
  },
  async (req, res) => {
    // Basic auth check — only allow POST with correct header
    const authHeader = req.headers["x-sync-secret"];
    const expectedSecret = process.env.SYNC_SECRET ?? "";

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    if (!expectedSecret || authHeader !== expectedSecret) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      await runSync(CLICKUP_API_TOKEN.value());
      res.status(200).json({ success: true, message: "Sync complete" });
    } catch (err) {
      console.error("Sync failed:", err);
      res.status(500).json({ error: "Sync failed", details: String(err) });
    }
  }
);
