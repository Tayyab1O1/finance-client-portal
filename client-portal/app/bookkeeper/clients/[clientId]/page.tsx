"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getClientsByIds } from "@/lib/firestore";
import type { ClientProfile } from "@/lib/types";
import BookkeeperNav from "@/components/BookkeeperNav";
import ClientPortalView from "@/components/dashboard/ClientPortalView";

export default function BookkeeperClientView() {
  const { clientId } = useParams<{ clientId: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const [assignedClients, setAssignedClients] = useState<ClientProfile[]>([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const currentClient = assignedClients.find(c => c.clickupFolderId === clientId);
  const displayName = currentClient?.fullName || currentClient?.clickupFolderName || "Client";
  const isAssigned = (profile?.assignedClientIds ?? []).includes(clientId);

  useEffect(() => {
    if (!profile) return;
    getClientsByIds(profile.assignedClientIds ?? []).then(setAssignedClients);
  }, [profile]);

  // Defense-in-depth: Firestore rules already block reads for unassigned
  // clients, but bail out client-side too rather than rendering an empty shell.
  if (profile && !isAssigned) {
    return (
      <div className="min-h-screen flex flex-col">
        <BookkeeperNav />
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          You don&apos;t have access to this client.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <BookkeeperNav />

      <div className="bg-white border-b border-gray-100 px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-gray-400 min-w-0">
          <Link href="/bookkeeper" className="hover:text-[#1a1a2e] transition shrink-0">My Clients</Link>
          <span className="shrink-0">/</span>
          <span className="text-[#1a1a2e] font-medium truncate">{displayName}</span>
        </div>
        <div className="relative">
          <button onClick={() => setSwitcherOpen(o => !o)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-[#1a1a2e] text-white rounded-lg hover:bg-[#2d2d4e] transition whitespace-nowrap">
            Switch Client
            <svg className={`w-3.5 h-3.5 transition-transform ${switcherOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {switcherOpen && (
            <div className="absolute right-0 top-full mt-1 w-[min(13rem,calc(100vw-2rem))] bg-white rounded-xl border border-gray-100 shadow-lg z-20 overflow-hidden">
              {assignedClients.map(c => (
                <button key={c.clickupFolderId}
                  onClick={() => { router.push(`/bookkeeper/clients/${c.clickupFolderId}`); setSwitcherOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 hover:bg-gray-50 transition ${c.clickupFolderId === clientId ? "bg-gray-50 font-medium text-[#1a1a2e]" : "text-gray-600"}`}>
                  <div className="w-6 h-6 rounded-md bg-[#1a1a2e]/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {c.logoImageUrl
                      ? <img src={c.logoImageUrl} alt="" className="w-full h-full object-contain p-0.5" />
                      : <span className="text-[9px] font-bold text-[#1a1a2e]">{(c.fullName || c.clickupFolderName).slice(0, 2).toUpperCase()}</span>
                    }
                  </div>
                  {c.fullName || c.clickupFolderName}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <ClientPortalView clientId={clientId} overlayLabel="Bookkeeper View" />
    </div>
  );
}
