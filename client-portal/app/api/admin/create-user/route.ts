import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { adminAuth, adminDb } = await import("@/lib/firebaseAdmin");

    // Verify caller is an authenticated admin
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

    // Confirm caller has admin role in Firestore
    const callerDoc = await adminDb.collection("users").doc(callerUid).get();
    if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { email, password, clientId, role = "client" } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: "email and password are required" }, { status: 400 });
    }
    if (role !== "client" && role !== "bookkeeper") {
      return NextResponse.json({ error: "role must be 'client' or 'bookkeeper'" }, { status: 400 });
    }
    if (role === "client" && !clientId) {
      return NextResponse.json({ error: "clientId is required for role 'client'" }, { status: 400 });
    }

    // Create Auth user server-side (no client sign-in side-effect)
    const userRecord = await adminAuth.createUser({ email, password });

    // Create Firestore record using Admin SDK (bypasses security rules)
    await adminDb.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      role,
      clientId: role === "client" ? clientId : null,
      ...(role === "bookkeeper" ? { assignedClientIds: [] } : {}),
      createdAt: new Date(),
    });

    return NextResponse.json({ uid: userRecord.uid });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[create-user]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
