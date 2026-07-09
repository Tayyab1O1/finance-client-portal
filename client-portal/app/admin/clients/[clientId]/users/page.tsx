"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { getIdToken } from "firebase/auth";
import { getClientProfile, getUsersForClient } from "@/lib/firestore";
import type { ClientProfile, UserRecord } from "@/lib/types";
import AdminNav from "@/components/AdminNav";
import { useToast } from "@/context/ToastContext";

export default function ClientUsersPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const { showToast } = useToast();

  async function loadData() {
    const [c, u] = await Promise.all([getClientProfile(clientId), getUsersForClient(clientId)]);
    setClient(c);
    setUsers(u);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [clientId]);

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
        body: JSON.stringify({ email, password, clientId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create user");
      }

      showToast(`User ${email} created successfully.`, "success");
      setEmail(""); setPassword("");
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create user.";
      showToast(msg.replace("Firebase: ", "").replace(/\(auth\/.*\)/, "").trim());
    } finally {
      setCreating(false);
    }
  }

  const displayName = client?.fullName || client?.clickupFolderName || clientId;

  return (
    <div className="min-h-screen flex flex-col">
      <AdminNav />
      <main className="flex-1 px-4 sm:px-6 md:px-8 py-6 md:py-8 max-w-2xl">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6 min-w-0">
          <Link href="/admin" className="hover:text-[#1a1a2e] transition shrink-0">Dashboard</Link>
          <span className="shrink-0">/</span>
          <Link href={`/admin/clients/${clientId}/edit`} className="hover:text-[#1a1a2e] transition truncate">{displayName}</Link>
          <span className="shrink-0">/</span>
          <span className="text-[#1a1a2e] shrink-0">Users</span>
        </div>

        <h1 className="text-2xl font-bold text-[#1a1a2e] mb-1">Client Users</h1>
        <p className="text-sm text-gray-400 mb-6">{displayName}</p>

        <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Active Users</h2>
          {loading ? (
            <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}</div>
          ) : users.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">No users yet for this client.</p>
          ) : (
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.uid} className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#1a1a2e]/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-[#1a1a2e]">{u.email[0].toUpperCase()}</span>
                    </div>
                    <span className="text-sm text-gray-700 truncate">{u.email}</span>
                  </div>
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium shrink-0">Active</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Create New User</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e] transition"
                placeholder="client@example.com" />
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
              ) : "Create user"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
