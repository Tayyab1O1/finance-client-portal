"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getClientsByIds } from "@/lib/firestore";
import type { ClientProfile } from "@/lib/types";
import BookkeeperNav from "@/components/BookkeeperNav";

function ClientCard({ client }: { client: ClientProfile }) {
  const name = client.fullName || client.clickupFolderName;
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <Link href={`/bookkeeper/clients/${client.clickupFolderId}`}
      className="bg-white rounded-2xl border border-gray-100 hover:shadow-md transition-shadow block">
      <div className="h-24 bg-[#1a1a2e] relative overflow-hidden rounded-t-2xl">
        {client.coverImageUrl ? (
          <img src={client.coverImageUrl} alt="" className="w-full h-full object-cover opacity-60" />
        ) : (
          <div className="absolute inset-0"
            style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #4f8ef7 0%, transparent 50%), radial-gradient(circle at 80% 20%, #7c3aed 0%, transparent 40%)" }} />
        )}
      </div>
      <div className="px-5 py-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-white border-2 border-gray-100 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
          {client.logoImageUrl
            ? <img src={client.logoImageUrl} alt="Logo" className="w-full h-full object-contain p-1" />
            : <span className="text-[#1a1a2e] text-sm font-bold">{initials}</span>
          }
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[#1a1a2e] truncate">{name}</h3>
          {client.executiveDirectorName && (
            <p className="text-xs text-gray-400 truncate mt-0.5">{client.executiveDirectorName}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function BookkeeperDashboard() {
  const { profile } = useAuth();
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    getClientsByIds(profile.assignedClientIds ?? []).then(c => { setClients(c); setLoading(false); });
  }, [profile]);

  return (
    <div className="min-h-screen flex flex-col">
      <BookkeeperNav />
      <main className="flex-1 px-4 sm:px-6 md:px-8 py-6 md:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1a1a2e]">My Clients</h1>
          <p className="text-sm text-gray-500 mt-1">{clients.length} assigned</p>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 h-52 animate-pulse" />
            ))}
          </div>
        ) : clients.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
            No clients have been assigned to you yet. Contact an admin.
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
