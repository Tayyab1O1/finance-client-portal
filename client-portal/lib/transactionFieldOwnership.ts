import type { ExtraFieldDef, TransactionFieldOwner } from "./types";

// Single source of truth for "who may write this field" — imported by both the
// grid UI (to decide which cells are editable per role) and the write-field API
// route (to actually enforce it). Never duplicate this logic elsewhere: a
// mismatch between what the UI shows as editable and what the server accepts
// is exactly the kind of drift that turns into a silent-failure bug report.

// Structural fields every transaction row has regardless of admin config —
// not part of the admin-defined extraFields schema. Bookkeeper/admin only
// (there's no client-editable structural field; a client's own field is
// whatever admin defines with editableBy: "client" in extraFields).
// Note: AP-run-date is NOT here — it's an opt-in extraFields column (type
// "apDate") now, not automatic on every dashboard.
const STRUCTURAL_STAFF_FIELDS = ["attachmentLinks"] as const;

// Structural fields (attachmentLinks) resolve statically here.
// formAnswers.<questionId> is deliberately NOT writable through this endpoint
// by anyone, including admin — the submitted form data is a fixed record of
// what the client actually sent; corrections happen via an admin-defined
// extraFields column, not by editing the original answer. extraFields.<id>
// fields don't resolve here either — their owner is defined per
// client+dashboard by admin and must be looked up via canWriteExtraField()
// with that field's actual ExtraFieldDef.
export function getFieldOwner(field: string): TransactionFieldOwner | null {
  if ((STRUCTURAL_STAFF_FIELDS as readonly string[]).includes(field)) return "bookkeeper";
  return null;
}

// role -> which owner tiers that role may write, for the statically-resolved
// fields above. Admin can always write everything; this only needs the
// non-admin cases.
export function roleCanWriteField(role: "client" | "bookkeeper", field: string): boolean {
  const owner = getFieldOwner(field);
  if (!owner) return false;
  if (role === "client") return owner === "client";
  if (role === "bookkeeper") return owner === "bookkeeper";
  return false;
}

// Same check but inclusive of admin (who may write any recognized structural/
// form-answer field) — what the grid UI calls per structural cell.
export function canWriteField(role: "admin" | "client" | "bookkeeper", field: string): boolean {
  if (role === "admin") return getFieldOwner(field) !== null;
  return roleCanWriteField(role, field);
}

// Admin-defined extra fields (manual/status) — ownership comes from the
// field's own definition (DashboardFieldConfig), not a static list, since
// admin authors these per client+dashboard. Admin can always write; everyone
// else must match editableBy exactly.
export function canWriteExtraField(role: "admin" | "client" | "bookkeeper", fieldDef: ExtraFieldDef | undefined): boolean {
  if (!fieldDef) return false;
  if (role === "admin") return true;
  return fieldDef.editableBy === role;
}
