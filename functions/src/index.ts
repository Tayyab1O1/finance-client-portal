import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { runSync } from "./clickupSync";
import { ingestSubmission, reconcileAllForms } from "./filloutSync";

initializeApp();

// Secret stored in Google Secret Manager — set via:
// firebase functions:secrets:set CLICKUP_API_TOKEN
const CLICKUP_API_TOKEN = defineSecret("CLICKUP_API_TOKEN");

// Same value must be set in both places — Functions Secret Manager (here) and
// the Next.js app's server env (FILLOUT_API_KEY / FILLOUT_WEBHOOK_SECRET) —
// since the connect-form API route and this Function both need them.
// Set via: firebase functions:secrets:set FILLOUT_API_KEY
//          firebase functions:secrets:set FILLOUT_WEBHOOK_SECRET
const FILLOUT_API_KEY = defineSecret("FILLOUT_API_KEY");
const FILLOUT_WEBHOOK_SECRET = defineSecret("FILLOUT_WEBHOOK_SECRET");

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

// Single shared ingestion endpoint for every connected Fillout form. Identity
// (which client/dashboard a submission belongs to) comes from the ?formId=
// query param registered at connect-form time, looked up against
// filloutFormMappings — never trusted from the payload body itself.
export const filloutWebhook = onRequest(
  { secrets: [FILLOUT_WEBHOOK_SECRET], memory: "256MiB", timeoutSeconds: 60 },
  async (req, res) => {
    // Temporary — firebase functions:log isn't rendering our console output
    // reliably, so write every hit straight to Firestore where it can be
    // inspected directly. Remove once delivery is confirmed reliable.
    const debugEntry: Record<string, unknown> = {
      at: new Date(),
      method: req.method,
      query: req.query,
      contentType: req.headers["content-type"] ?? null,
      rawBody: req.rawBody ? req.rawBody.toString("utf8").slice(0, 5000) : null,
      parsedBody: req.body ?? null,
    };

    try {
      if (req.method !== "POST") {
        debugEntry.outcome = "rejected-method";
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const formId = req.query.formId as string | undefined;
      const secret = req.query.secret as string | undefined;
      if (!formId || secret !== FILLOUT_WEBHOOK_SECRET.value()) {
        debugEntry.outcome = "rejected-auth";
        debugEntry.hadFormId = !!formId;
        debugEntry.hadSecret = !!secret;
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // Fillout sends Content-Type: text/plain, so the platform's default
      // JSON body parser never runs and req.body is left as a raw string (or
      // whatever partial parse happened) — parse rawBody ourselves instead of
      // trusting req.body. Confirmed live: the payload is
      // { formId, formName, submission: {...} }, not a bare submission object.
      const parsed = req.rawBody ? JSON.parse(req.rawBody.toString("utf8")) : req.body;
      const submission = parsed?.submission ?? parsed;
      await ingestSubmission(formId, submission);
      debugEntry.outcome = "success";
      res.status(200).json({ success: true });
    } catch (err) {
      debugEntry.outcome = "error";
      debugEntry.errorMessage = String(err);
      res.status(500).json({ error: "Ingestion failed", details: String(err) });
    } finally {
      try {
        await getFirestore().collection("webhookDebugLogs").add(debugEntry);
      } catch {
        // best-effort — never let debug logging mask the real response
      }
    }
  }
);

// Backfills any submission the webhook missed. Runs every 4 hours — frequent
// enough to catch a missed webhook quickly, infrequent enough to stay well
// within Fillout's API rate limits across however many forms are connected.
export const scheduledFilloutReconcile = onSchedule(
  {
    schedule: "0 */4 * * *",
    timeZone: "UTC",
    secrets: [FILLOUT_API_KEY],
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async () => {
    await reconcileAllForms(FILLOUT_API_KEY.value());
  }
);
