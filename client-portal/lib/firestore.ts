import {
  doc, getDoc, getDocs, setDoc, updateDoc,
  collection, query, orderBy, where, serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { ClientProfile, Task, UserRecord } from "./types";

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

export async function updateClientProfile(
  clientId: string,
  data: Partial<Omit<ClientProfile, "clickupFolderId" | "clickupFolderName" | "monthlyWorkListId" | "syncedAt">>
): Promise<void> {
  await updateDoc(doc(db, "clients", clientId), { ...data });
}

export async function getUsersForClient(clientId: string): Promise<UserRecord[]> {
  const q = query(collection(db, "users"), where("clientId", "==", clientId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as UserRecord);
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

export async function getPortalSettings(): Promise<{ servicesOptions: string[] }> {
  const snap = await getDoc(doc(db, "settings", "portal"));
  if (snap.exists()) return snap.data() as { servicesOptions: string[] };
  return { servicesOptions: DEFAULT_SERVICES };
}

export async function updatePortalSettings(data: { servicesOptions: string[] }): Promise<void> {
  await setDoc(doc(db, "settings", "portal"), data);
}
