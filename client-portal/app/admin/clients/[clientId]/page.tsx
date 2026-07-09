"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getAllClients } from "@/lib/firestore";
import type { ClientProfile } from "@/lib/types";
import AdminNav from "@/components/AdminNav";
import ClientPortalView from "@/components/dashboard/ClientPortalView";

export default function AdminClientView() {
  const { clientId } = useParams<{ clientId: string }>();
  const router = useRouter();
  const [allClients, setAllClients] = useState<ClientProfile[]>([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const currentClient = allClients.find(c => c.clickupFolderId === clientId);
  const displayName = currentClient?.fullName || currentClient?.clickupFolderName || "Client";

  useEffect(() => {
    getAllClients().then(setAllClients);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <AdminNav />

      {/* Sub-nav */}
      <div className="bg-white border-b border-gray-100 px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-gray-400 min-w-0">
          <Link href="/admin" className="hover:text-[#1a1a2e] transition shrink-0">Dashboard</Link>
          <span className="shrink-0">/</span>
          <span className="text-[#1a1a2e] font-medium truncate">{displayName}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/clients/${clientId}/edit`}
            className="text-xs font-medium px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition whitespace-nowrap">
            Edit Profile
          </Link>
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
                {allClients.map(c => (
                  <button key={c.clickupFolderId}
                    onClick={() => { router.push(`/admin/clients/${c.clickupFolderId}`); setSwitcherOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 hover:bg-gray-50 transition ${c.clickupFolderId === clientId ? "bg-gray-50 font-medium text-[#1a1a2e]" : "text-gray-600"}`}>
                    <div className="w-6 h-6 rounded-md bg-[#1a1a2e]/10 flex items-center justify-center shrink-0 overflow-hidden">
                      {c.logoImageUrl
                        ? <img src={c.logoImageUrl} alt="" className="w-full h-full object-contain p-0.5" />
                        : <span className="text-[9px] font-bold text-[#1a1a2e]">{(c.fullName || c.clickupFolderName).slice(0, 2).toUpperCase()}</span>
                      }
                    </div>
                    {c.fullName || c.clickupFolderName}
                    {c.clickupFolderId === clientId && (
                      <svg className="w-3.5 h-3.5 text-[#1a1a2e] ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ClientPortalView clientId={clientId} adminOverlay />
    </div>
  );
}
