"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAllClients } from "@/lib/firestore";
import type { ClientProfile } from "@/lib/types";
import AdminNav from "@/components/AdminNav";

function ClientCard({ client }: { client: ClientProfile }) {
  const name = client.fullName || client.clickupFolderName;
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const syncedAt = client.syncedAt ? new Date(client.syncedAt.toMillis()) : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 hover:shadow-md transition-shadow">
      <div className="h-28 bg-[#1a1a2e] relative overflow-hidden rounded-t-2xl">
        {client.coverImageUrl ? (
          <img src={client.coverImageUrl} alt="" className="w-full h-full object-cover opacity-60" />
        ) : (
          <div className="absolute inset-0"
            style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #4f8ef7 0%, transparent 50%), radial-gradient(circle at 80% 20%, #7c3aed 0%, transparent 40%)" }} />
        )}
      </div>

      <div className="px-5 py-4 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-xl bg-white border-2 border-gray-100 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
            {client.logoImageUrl ? (
              <img src={client.logoImageUrl} alt="Logo" className="w-full h-full object-contain p-1" />
            ) : (
              <span className="text-[#1a1a2e] text-sm font-bold">{initials}</span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[#1a1a2e] truncate">{name}</h3>
            {client.executiveDirectorName && (
              <p className="text-xs text-gray-400 truncate mt-0.5">{client.executiveDirectorName}</p>
            )}
          </div>
        </div>

        {client.servicesAvailed && client.servicesAvailed.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {client.servicesAvailed.slice(0, 3).map(s => (
              <span key={s} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{s}</span>
            ))}
            {client.servicesAvailed.length > 3 && (
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">+{client.servicesAvailed.length - 3}</span>
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="text-xs text-gray-400">
            Synced {syncedAt ? syncedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "never"}
          </span>
        </div>

        <div className="flex gap-2">
          <Link href={`/admin/clients/${client.clickupFolderId}`}
            className="flex-1 text-center text-xs font-medium bg-[#1a1a2e] text-white py-2 rounded-lg hover:bg-[#2d2d4e] transition">
            View Portal
          </Link>
          <Link href={`/admin/clients/${client.clickupFolderId}/edit`}
            className="flex-1 text-center text-xs font-medium bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition">
            Edit
          </Link>
          <Link href={`/admin/clients/${client.clickupFolderId}/users`}
            className="px-3 text-xs font-medium bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Users
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllClients().then(c => { setClients(c); setLoading(false); });
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <AdminNav />
      <main className="flex-1 px-4 sm:px-6 md:px-8 py-6 md:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1a1a2e]">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">{clients.length} clients</p>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 h-64 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {clients.map(c => <ClientCard key={c.clickupFolderId} client={c} />)}
          </div>
        )}
      </main>
    </div>
  );
}
