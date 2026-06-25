import { doc, getDoc, collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "./firebase";
import type { ClientProfile, Task } from "./types";

export async function getClientProfile(clientId: string): Promise<ClientProfile | null> {
  const snap = await getDoc(doc(db, "clients", clientId));
  return snap.exists() ? (snap.data() as ClientProfile) : null;
}

export async function getClientTasks(clientId: string): Promise<Task[]> {
  const q = query(
    collection(db, "clients", clientId, "tasks"),
    orderBy("dueDate", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Task);
}
