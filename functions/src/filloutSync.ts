import { getFirestore, FieldValue } from "firebase-admin/firestore";

const FILLOUT_API_BASE = "https://api.fillout.com/v1/api";

interface FilloutQuestion {
  id: string;
  name: string;
  type: string;
  value: unknown;
}

interface FilloutSubmission {
  submissionId: string;
  submissionTime?: string;
  questions: FilloutQuestion[];
}

interface FormMapping {
  clientId: string;
  dashboardType: "payable" | "receivable";
}

// Fillout's exact type string for a file-upload question, and the shape of its
// value, haven't been empirically confirmed against a real webhook delivery —
// this handles the shapes documented/observed elsewhere (a plain URL string, or
// an object/array of objects with a `url` key) as a best-effort default.
// Verify against a real test submission before relying on this for production data.
function extractAttachmentLinks(questions: FilloutQuestion[]): string[] {
  const links: string[] = [];
  for (const q of questions) {
    if (!/file|upload|attachment/i.test(q.type)) continue;
    const values = Array.isArray(q.value) ? q.value : [q.value];
    for (const item of values) {
      if (typeof item === "string" && item) links.push(item);
      else if (item && typeof item === "object" && "url" in item) links.push(String((item as { url: unknown }).url));
    }
  }
  return links;
}

async function upsertSubmission(
  db: FirebaseFirestore.Firestore,
  mapping: FormMapping,
  filloutFormId: string,
  submission: FilloutSubmission
) {
  const collectionName = mapping.dashboardType === "payable" ? "apTransactions" : "arTransactions";
  const formAnswers: Record<string, unknown> = {};
  for (const q of submission.questions) formAnswers[q.id] = q.value;

  // merge: true — re-ingesting an edited/late-arriving submission (webhook retry,
  // or the reconciliation job re-fetching it) must never clobber fields a
  // bookkeeper has since entered (vendorName, apRunDate, statuses, etc.)
  await db.collection(collectionName).doc(submission.submissionId).set(
    {
      id: submission.submissionId,
      clientId: mapping.clientId,
      dashboardType: mapping.dashboardType,
      source: "fillout",
      submissionId: submission.submissionId,
      submittedAt: submission.submissionTime ? new Date(submission.submissionTime) : FieldValue.serverTimestamp(),
      formAnswers,
      attachmentLinks: extractAttachmentLinks(submission.questions),
    },
    { merge: true }
  );

  // Auto-discover new question columns rather than requiring a manual schema edit
  const schemaRef = db.collection("formSchemas").doc(filloutFormId);
  const schemaSnap = await schemaRef.get();
  const existingFields: Array<{ questionId: string }> = schemaSnap.exists ? schemaSnap.data()?.fields ?? [] : [];
  const knownIds = new Set(existingFields.map((f) => f.questionId));
  const newFields = submission.questions
    .filter((q) => !knownIds.has(q.id))
    .map((q, i) => ({ questionId: q.id, label: q.name, type: q.type, order: existingFields.length + i }));

  if (newFields.length > 0) {
    await schemaRef.set(
      { clientId: mapping.clientId, dashboardType: mapping.dashboardType, filloutFormId, fields: [...existingFields, ...newFields] },
      { merge: true }
    );
  }
}

export async function ingestSubmission(filloutFormId: string, submission: FilloutSubmission): Promise<void> {
  const db = getFirestore();
  const mappingSnap = await db.collection("filloutFormMappings").doc(filloutFormId).get();
  if (!mappingSnap.exists) {
    throw new Error(`No mapping registered for Fillout form ${filloutFormId} — was it disconnected?`);
  }
  await upsertSubmission(db, mappingSnap.data() as FormMapping, filloutFormId, submission);
}

// Backfills anything the webhook may have missed (endpoint downtime, retry
// exhaustion). Safe to run repeatedly — upsertSubmission is idempotent by
// submissionId.
export async function reconcileAllForms(filloutApiKey: string): Promise<void> {
  const db = getFirestore();
  const mappingsSnap = await db.collection("filloutFormMappings").get();

  for (const mappingDoc of mappingsSnap.docs) {
    const filloutFormId = mappingDoc.id;
    const mapping = mappingDoc.data() as FormMapping;

    const res = await fetch(`${FILLOUT_API_BASE}/forms/${filloutFormId}/submissions`, {
      headers: { Authorization: `Bearer ${filloutApiKey}` },
    });
    if (!res.ok) {
      console.error(`[filloutReconcile] failed to fetch submissions for form ${filloutFormId}`, res.status, await res.text());
      continue;
    }
    const data = (await res.json()) as { responses?: FilloutSubmission[]; submissions?: FilloutSubmission[] };
    const submissions = data.responses ?? data.submissions ?? [];
    for (const submission of submissions) {
      await upsertSubmission(db, mapping, filloutFormId, submission);
    }
  }
}
