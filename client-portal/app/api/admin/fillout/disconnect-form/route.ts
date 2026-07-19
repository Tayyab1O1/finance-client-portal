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

    const { filloutFormId } = await request.json();
    if (!filloutFormId) {
      return NextResponse.json({ error: "filloutFormId is required" }, { status: 400 });
    }

    const mappingRef = adminDb.collection("filloutFormMappings").doc(filloutFormId);
    const mappingSnap = await mappingRef.get();
    if (!mappingSnap.exists) {
      return NextResponse.json({ error: "No mapping found for this form" }, { status: 404 });
    }

    const filloutApiKey = process.env.FILLOUT_API_KEY;
    const webhookId = mappingSnap.data()?.webhookId;

    if (filloutApiKey && webhookId) {
      const filloutRes = await fetch(`${FILLOUT_API_BASE}/webhook/delete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${filloutApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ webhookId }),
      });
      // Don't block disconnecting on Fillout's response — an already-deleted/stale
      // webhook on their side shouldn't leave our mapping stuck. Just log it.
      if (!filloutRes.ok) {
        console.error("[fillout/disconnect-form] webhook delete failed", filloutRes.status, await filloutRes.text());
      }
    }

    // Deliberately leave apTransactions/arTransactions and formSchemas in place —
    // disconnecting stops new submissions from arriving, it doesn't erase history.
    await mappingRef.delete();

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[fillout/disconnect-form]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
