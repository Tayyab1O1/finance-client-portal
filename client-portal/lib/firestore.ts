import {
  doc, getDoc, getDocs, setDoc, updateDoc, onSnapshot,
  collection, query, orderBy, where, serverTimestamp, documentId,
} from "firebase/firestore";
import { db } from "./firebase";
import type { ClientProfile, DashboardFieldConfig, DashboardType, FilloutFormMapping, FormSchema, Task, TransactionRow, UserRecord } from "./types";

// ─── Client (shared) ────────────────────────────────────────────────────────

export async function getClientProfile(clientId: string): Promise<ClientProfile | null> {
  const snap = await getDoc(doc(db, "clients", clientId));
  return snap.exists() ? (snap.data() as ClientProfile) : null;
}

export async function getClientTasks(clientId: string): Promise<Task[]> {
  const q = query(collection(db, "clients", clientId, "tasks"), orderBy("dueDate", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Task);
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export async function getAllClients(): Promise<ClientProfile[]> {
  const snap = await getDocs(collection(db, "clients"));
  return snap.docs.map((d) => d.data() as ClientProfile);
}

// For non-admin roles who can only read a scoped subset of clients (e.g. a
// bookkeeper's assigned clients) — getAllClients() would fail security rules
// for anyone but an admin, since the rule can't prove an unfiltered list is
// scoped to what the caller may see.
export async function getClientsByIds(clientIds: string[]): Promise<ClientProfile[]> {
  if (clientIds.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < clientIds.length; i += 30) chunks.push(clientIds.slice(i, i + 30));
  const results = await Promise.all(
    chunks.map(chunk => getDocs(query(collection(db, "clients"), where(documentId(), "in", chunk))))
  );
  return results.flatMap(snap => snap.docs.map((d) => d.data() as ClientProfile));
}

export async function updateClientProfile(
  clientId: string,
  data: Partial<Omit<ClientProfile, "clickupFolderId" | "clickupFolderName" | "monthlyWorkListId" | "syncedAt">>
): Promise<void> {
  await updateDoc(doc(db, "clients", clientId), { ...data });
}

// Persists immediately (dot-notation targets just this one key, leaving the
// other dashboard type's flag untouched) — connecting/disconnecting a Fillout
// form is itself an immediate action, so whether the dashboard is "enabled"
// shouldn't silently depend on someone remembering to also click the page's
// separate batched "Save changes" button afterward.
export async function setClientDashboardEnabled(clientId: string, dashboardType: DashboardType, enabled: boolean): Promise<void> {
  await updateDoc(doc(db, "clients", clientId), { [`dashboardsEnabled.${dashboardType}`]: enabled });
}

export async function getUsersForClient(clientId: string): Promise<UserRecord[]> {
  const q = query(collection(db, "users"), where("clientId", "==", clientId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as UserRecord);
}

export async function getBookkeepers(): Promise<UserRecord[]> {
  const q = query(collection(db, "users"), where("role", "==", "bookkeeper"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as UserRecord);
}

export async function updateBookkeeperAssignedClients(uid: string, assignedClientIds: string[]): Promise<void> {
  await updateDoc(doc(db, "users", uid), { assignedClientIds });
}

export async function getFilloutMappingsForClient(clientId: string): Promise<FilloutFormMapping[]> {
  const q = query(collection(db, "filloutFormMappings"), where("clientId", "==", clientId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as FilloutFormMapping);
}

// ─── AP/AR transaction dashboards ───────────────────────────────────────────

function transactionCollectionName(dashboardType: DashboardType): "apTransactions" | "arTransactions" {
  return dashboardType === "payable" ? "apTransactions" : "arTransactions";
}

// Live subscription — the grid reads directly via onSnapshot (not one-time
// fetches) so every viewer (client/bookkeeper/admin) sees every other
// viewer's edits appear immediately, without a refresh.
export function subscribeToTransactions(
  clientId: string,
  dashboardType: DashboardType,
  onChange: (rows: TransactionRow[]) => void
): () => void {
  const q = query(collection(db, transactionCollectionName(dashboardType)), where("clientId", "==", clientId));
  return onSnapshot(q, snap => onChange(snap.docs.map(d => d.data() as TransactionRow)));
}

export async function getFormSchemaForClientDashboard(clientId: string, dashboardType: DashboardType): Promise<FormSchema | null> {
  const q = query(
    collection(db, "formSchemas"),
    where("clientId", "==", clientId),
    where("dashboardType", "==", dashboardType)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : (snap.docs[0].data() as FormSchema);
}

function dashboardFieldConfigId(clientId: string, dashboardType: DashboardType): string {
  return `${clientId}_${dashboardType}`;
}

export async function getDashboardFieldConfig(clientId: string, dashboardType: DashboardType): Promise<DashboardFieldConfig | null> {
  const snap = await getDoc(doc(db, "dashboardFieldConfigs", dashboardFieldConfigId(clientId, dashboardType)));
  return snap.exists() ? (snap.data() as DashboardFieldConfig) : null;
}

export async function setDashboardFieldConfig(clientId: string, dashboardType: DashboardType, fields: DashboardFieldConfig["fields"]): Promise<void> {
  await setDoc(doc(db, "dashboardFieldConfigs", dashboardFieldConfigId(clientId, dashboardType)), {
    clientId, dashboardType, fields,
  });
}

export async function createUserRecord(uid: string, email: string, clientId: string): Promise<void> {
  await setDoc(doc(db, "users", uid), {
    uid,
    email,
    role: "client",
    clientId,
    createdAt: serverTimestamp(),
  });
}

// ─── Settings ────────────────────────────────────────────────────────────────

const DEFAULT_SERVICES = [
  "Bookkeeping", "Payroll", "AP/Expense Management", "Financial Reporting",
  "Tax Compliance", "CFO Advisory", "Budgeting & Forecasting", "Audit Support",
];

interface PortalSettings {
  servicesOptions: string[];
  filloutWebhookBaseUrl?: string; // deployed filloutWebhook Function URL, set once after first deploy
}

export async function getPortalSettings(): Promise<PortalSettings> {
  const snap = await getDoc(doc(db, "settings", "portal"));
  const data = snap.exists() ? (snap.data() as PortalSettings) : null;
  return { ...data, servicesOptions: data?.servicesOptions ?? DEFAULT_SERVICES };
}

export async function updatePortalSettings(data: Partial<PortalSettings>): Promise<void> {
  await setDoc(doc(db, "settings", "portal"), data, { merge: true });
}
