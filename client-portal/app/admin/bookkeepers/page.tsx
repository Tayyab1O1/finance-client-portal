"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { getIdToken } from "firebase/auth";
import { getAllClients, getBookkeepers, updateBookkeeperAssignedClients } from "@/lib/firestore";
import type { ClientProfile, UserRecord } from "@/lib/types";
import AdminNav from "@/components/AdminNav";
import { useToast } from "@/context/ToastContext";

function AssignedClientsEditor({ bookkeeper, clients, onSaved }: {
  bookkeeper: UserRecord; clients: ClientProfile[]; onSaved: (uid: string, ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(bookkeeper.assignedClientIds ?? []);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  function toggle(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function save() {
    setSaving(true);
    try {
      await updateBookkeeperAssignedClients(bookkeeper.uid, selected);
      onSaved(bookkeeper.uid, selected);
      showToast("Assigned clients updated.", "success");
      setOpen(false);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to update assignments.");
    } finally {
      setSaving(false);
    }
  }

  const assignedNames = clients
    .filter(c => (bookkeeper.assignedClientIds ?? []).includes(c.clickupFolderId))
    .map(c => c.fullName || c.clickupFolderName);

  return (
    <div className="border border-gray-100 rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-700 truncate">{bookkeeper.email}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {assignedNames.length === 0 ? "No clients assigned" : assignedNames.join(", ")}
          </p>
        </div>
        <button onClick={() => setOpen(o => !o)}
          className="text-xs font-medium px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition shrink-0">
          {open ? "Close" : "Edit clients"}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
            {clients.map(c => (
              <button key={c.clickupFolderId} type="button" onClick={() => toggle(c.clickupFolderId)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition ${
                  selected.includes(c.clickupFolderId) ? "border-[#1a1a2e] bg-[#1a1a2e]/5" : "border-gray-100 hover:border-gray-200"
                }`}>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                  selected.includes(c.clickupFolderId) ? "bg-[#1a1a2e] border-[#1a1a2e]" : "border-gray-300"
                }`}>
                  {selected.includes(c.clickupFolderId) && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-gray-700 truncate">{c.fullName || c.clickupFolderName}</span>
              </button>
            ))}
          </div>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 bg-[#1a1a2e] text-white text-sm font-medium rounded-lg hover:bg-[#2d2d4e] disabled:opacity-60 transition">
            {saving ? "Saving..." : "Save assignments"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function BookkeepersPage() {
  const [bookkeepers, setBookkeepers] = useState<UserRecord[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const { showToast } = useToast();

  async function loadData() {
    const [bk, cl] = await Promise.all([getBookkeepers(), getAllClients()]);
    setBookkeepers(bk);
    setClients(cl);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  function handleAssignedSaved(uid: string, ids: string[]) {
    setBookkeepers(prev => prev.map(b => b.uid === uid ? { ...b, assignedClientIds: ids } : b));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Not authenticated");
      const idToken = await getIdToken(currentUser);

      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ email, password, role: "bookkeeper" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create bookkeeper");
      }

      showToast(`Bookkeeper ${email} created successfully.`, "success");
      setEmail(""); setPassword("");
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create bookkeeper.";
      showToast(msg.replace("Firebase: ", "").replace(/\(auth\/.*\)/, "").trim());
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AdminNav />
      <main className="flex-1 px-4 sm:px-6 md:px-8 py-6 md:py-8 max-w-3xl">
        <h1 className="text-2xl font-bold text-[#1a1a2e] mb-1">Bookkeepers</h1>
        <p className="text-sm text-gray-400 mb-6">Manage bookkeeper accounts and which clients each one can access.</p>

        <section className="bg-white rounded-2xl border border-gray-100 p-6 space-y-3 mb-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Active Bookkeepers</h2>
          {loading ? (
            <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : bookkeepers.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">No bookkeepers yet.</p>
          ) : (
            bookkeepers.map(b => (
              <AssignedClientsEditor key={b.uid} bookkeeper={b} clients={clients} onSaved={handleAssignedSaved} />
            ))
          )}
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Create New Bookkeeper</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e] transition"
                placeholder="bookkeeper@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e] transition"
                placeholder="Min. 6 characters" />
            </div>
            <button type="submit" disabled={creating}
              className="w-full bg-[#1a1a2e] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#2d2d4e] disabled:opacity-60 transition flex items-center justify-center gap-2">
              {creating ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creating...</>
              ) : "Create bookkeeper"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
