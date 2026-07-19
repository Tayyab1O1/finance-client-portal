import { NextRequest, NextResponse } from "next/server";

const FILLOUT_API_BASE = "https://api.fillout.com/v1/api";

export async function POST(request: NextRequest) {
  try {
    const { adminAuth, adminDb } = await import("@/lib/firebaseAdmin");

    const authHeader = request.headers.get("Authorization");
    const idToken = authHeader?.replace("Bearer ", "");
    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let callerUid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      callerUid = decoded.uid;
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const callerDoc = await adminDb.collection("users").doc(callerUid).get();
    if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { clientId, dashboardType, filloutFormId, label } = await request.json();
    if (!clientId || !dashboardType || !filloutFormId || !label) {
      return NextResponse.json(
        { error: "clientId, dashboardType, filloutFormId, and label are required" },
        { status: 400 }
      );
    }
    if (dashboardType !== "payable" && dashboardType !== "receivable") {
      return NextResponse.json({ error: "dashboardType must be 'payable' or 'receivable'" }, { status: 400 });
    }

    const filloutApiKey = process.env.FILLOUT_API_KEY;
    if (!filloutApiKey) {
      return NextResponse.json({ error: "FILLOUT_API_KEY is not configured on the server" }, { status: 500 });
    }
    const webhookSecret = process.env.FILLOUT_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json({ error: "FILLOUT_WEBHOOK_SECRET is not configured on the server" }, { status: 500 });
    }

    const settingsSnap = await adminDb.collection("settings").doc("portal").get();
    const webhookBaseUrl = settingsSnap.data()?.filloutWebhookBaseUrl;
    if (!webhookBaseUrl) {
      return NextResponse.json(
        { error: "Set the Fillout webhook base URL in Settings before connecting a form (it's the deployed filloutWebhook Function URL)." },
        { status: 400 }
      );
    }

    // Refuse to silently replace an existing mapping for this form — force an explicit disconnect first.
    const existing = await adminDb.collection("filloutFormMappings").doc(filloutFormId).get();
    if (existing.exists) {
      return NextResponse.json({ error: "This Fillout form is already connected. Disconnect it first to reassign it." }, { status: 409 });
    }

    const webhookUrl = `${webhookBaseUrl}?formId=${encodeURIComponent(filloutFormId)}&secret=${encodeURIComponent(webhookSecret)}`;

    const filloutRes = await fetch(`${FILLOUT_API_BASE}/webhook/create`, {
      method: "POST",
      headers: { Authorization: `Bearer ${filloutApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ formId: filloutFormId, url: webhookUrl }),
    });

    if (!filloutRes.ok) {
      const errText = await filloutRes.text();
      console.error("[fillout/connect-form] webhook create failed", filloutRes.status, errText);
      return NextResponse.json({ error: "Fillout rejected the webhook registration — check the form ID." }, { status: 502 });
    }

    const filloutData = await filloutRes.json();
    const webhookId = filloutData.id ?? filloutData.webhookId;
    if (!webhookId) {
      console.error("[fillout/connect-form] unexpected webhook create response shape", filloutData);
      return NextResponse.json({ error: "Fillout returned an unexpected response — check server logs." }, { status: 502 });
    }

    await adminDb.collection("filloutFormMappings").doc(filloutFormId).set({
      filloutFormId,
      clientId,
      dashboardType,
      label,
      webhookId,
      createdAt: new Date(),
    });

    // Seed an empty schema doc so the grid has something to read before the first submission arrives.
    await adminDb.collection("formSchemas").doc(filloutFormId).set({
      clientId,
      dashboardType,
      filloutFormId,
      fields: [],
    });

    return NextResponse.json({ success: true, webhookId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[fillout/connect-form]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
