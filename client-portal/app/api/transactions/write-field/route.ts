import { NextRequest, NextResponse } from "next/server";
import { canWriteExtraField, getFieldOwner, roleCanWriteField } from "@/lib/transactionFieldOwnership";
import type { DashboardType, ExtraFieldDef } from "@/lib/types";

const EXTRA_FIELD_PREFIX = "extraFields.";

const ALLOWED_COLLECTIONS = ["apTransactions", "arTransactions"] as const;
type AllowedCollection = (typeof ALLOWED_COLLECTIONS)[number];

function isAllowedCollection(value: unknown): value is AllowedCollection {
  return typeof value === "string" && (ALLOWED_COLLECTIONS as readonly string[]).includes(value);
}

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

    const callerSnap = await adminDb.collection("users").doc(callerUid).get();
    if (!callerSnap.exists) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const caller = callerSnap.data() as { role: string; clientId: string | null; assignedClientIds?: string[] };

    const { collectionName, txId, field, value } = await request.json();
    if (!isAllowedCollection(collectionName) || !txId || !field) {
      return NextResponse.json({ error: "collectionName, txId, and field are required" }, { status: 400 });
    }

    const txRef = adminDb.collection(collectionName).doc(txId);
    const txSnap = await txRef.get();
    if (!txSnap.exists) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    const txClientId = txSnap.data()?.clientId as string | undefined;
    const txDashboardType = txSnap.data()?.dashboardType as DashboardType | undefined;
    const role = caller.role as "admin" | "client" | "bookkeeper";
    const servesClient =
      role === "admin" ||
      (role === "client" && caller.clientId === txClientId) ||
      (role === "bookkeeper" && (caller.assignedClientIds ?? []).includes(txClientId ?? ""));

    let authorized = false;
    let extraFieldDef: ExtraFieldDef | undefined;

    if (field.startsWith(EXTRA_FIELD_PREFIX) && field.length > EXTRA_FIELD_PREFIX.length) {
      // Admin-defined manual/status field — ownership isn't a static list, it's
      // whatever admin configured per client+dashboard. Look it up rather than
      // trusting anything the request claims about who may write it.
      const extraFieldId = field.slice(EXTRA_FIELD_PREFIX.length);
      const configSnap = await adminDb.collection("dashboardFieldConfigs").doc(`${txClientId}_${txDashboardType}`).get();
      extraFieldDef = ((configSnap.data()?.fields ?? []) as ExtraFieldDef[]).find(f => f.id === extraFieldId);
      authorized = servesClient && canWriteExtraField(role, extraFieldDef);
      if (!extraFieldDef) {
        return NextResponse.json({ error: `No field definition found for '${extraFieldId}'` }, { status: 400 });
      }
    } else {
      // Structural fields (attachmentLinks) resolved statically via
      // lib/transactionFieldOwnership.ts, shared with the grid UI so the two
      // can't drift apart. Everything else — clientId, source, submissionId,
      // formAnswers.<id> (the submitted form data, immutable by design so it
      // stays a fixed record of what was actually sent), and lastModifiedBy/At
      // — is rejected here, including for admin. Corrections to a form answer
      // go through an admin-defined extraFields column instead.
      if (getFieldOwner(field) === null) {
        return NextResponse.json({ error: `Field '${field}' is not editable through this endpoint` }, { status: 400 });
      }
      authorized = servesClient && (role === "admin" || roleCanWriteField(role, field));
    }

    if (!authorized) {
      return NextResponse.json({ error: "You are not permitted to edit this field" }, { status: 403 });
    }

    // An "apDate" field's value must be one of the client's actual AP calendar
    // dates — enforced here, not just filtered in the dropdown, so a crafted
    // request can't set an arbitrary date.
    if (extraFieldDef?.type === "apDate" && value) {
      const clientSnap = await adminDb.collection("clients").doc(txClientId!).get();
      const apCalendar = clientSnap.data()?.apCalendar as
        | { generatedDates?: string[]; extraDates?: string[]; skipDates?: string[] }
        | undefined;
      const validDates = new Set([...(apCalendar?.generatedDates ?? []), ...(apCalendar?.extraDates ?? [])]);
      const skipped = new Set(apCalendar?.skipDates ?? []);
      if (!validDates.has(value) || skipped.has(value)) {
        return NextResponse.json({ error: "Invalid AP run date for this client" }, { status: 400 });
      }
    }

    await txRef.update({
      [field]: value,
      lastModifiedBy: callerUid,
      lastModifiedAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[transactions/write-field]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
