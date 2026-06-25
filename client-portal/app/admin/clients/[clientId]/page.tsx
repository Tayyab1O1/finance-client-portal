"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getAllClients, getClientProfile, getClientTasks } from "@/lib/firestore";
import type { ClientProfile, Task } from "@/lib/types";
import AdminNav from "@/components/AdminNav";
import ClientInfoTab from "@/components/dashboard/ClientInfoTab";
import TaskCalendarTab from "@/components/dashboard/TaskCalendarTab";

type Tab = "info" | "tasks";

export default function AdminClientView() {
  const { clientId } = useParams<{ clientId: string }>();
  const router = useRouter();
  const [allClients, setAllClients] = useState<ClientProfile[]>([]);
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [switcherOpen, setSwitcherOpen] = useState(false);

  useEffect(() => {
    getAllClients().then(setAllClients);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([getClientProfile(clientId), getClientTasks(clientId)]).then(([cp, t]) => {
      setClientProfile(cp);
      setTasks(t);
      setLoading(false);
    });
  }, [clientId]);

  const displayName = clientProfile?.fullName || clientProfile?.clickupFolderName || "Client";
  const initials = displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex flex-col">
      <AdminNav />

      {/* Sub-nav */}
      <div className="bg-white border-b border-gray-100 px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Link href="/admin" className="hover:text-[#1a1a2e] transition">Dashboard</Link>
          <span>/</span>
          <span className="text-[#1a1a2e] font-medium">{displayName}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/clients/${clientId}/edit`}
            className="text-xs font-medium px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition">
            Edit Profile
          </Link>
          <div className="relative">
            <button onClick={() => setSwitcherOpen(o => !o)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-[#1a1a2e] text-white rounded-lg hover:bg-[#2d2d4e] transition">
              Switch Client
              <svg className={`w-3.5 h-3.5 transition-transform ${switcherOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {switcherOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl border border-gray-100 shadow-lg z-20 overflow-hidden">
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

      {/* Banner */}
      <div className="relative h-48 bg-[#1a1a2e] overflow-hidden shrink-0">
        {clientProfile?.coverImageUrl ? (
          <img src={clientProfile.coverImageUrl} alt="Cover" className="w-full h-full object-cover opacity-60" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#2d2d4e] to-[#1a1a2e]">
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #4f8ef7 0%, transparent 50%), radial-gradient(circle at 80% 20%, #7c3aed 0%, transparent 40%)" }} />
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 px-8 pb-6 flex items-end gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center shrink-0 overflow-hidden">
            {clientProfile?.logoImageUrl
              ? <img src={clientProfile.logoImageUrl} alt="Logo" className="w-full h-full object-contain p-1" />
              : <span className="text-white text-xl font-bold">{initials}</span>
            }
          </div>
          <div className="pb-0.5">
            <h1 className="text-white text-2xl font-bold leading-tight">
              {loading ? <span className="block w-40 h-7 bg-white/20 rounded animate-pulse" /> : displayName}
            </h1>
            {clientProfile?.executiveDirectorName && (
              <p className="text-white/70 text-sm mt-0.5">Executive Director: {clientProfile.executiveDirectorName}</p>
            )}
          </div>
        </div>
        <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-3 py-1 rounded-full border border-white/20">
          Admin View
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-8 shrink-0">
        <nav className="flex gap-1 -mb-px">
          {([
            { id: "info", label: "Client Information", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
            { id: "tasks", label: "Task Calendar", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id ? "border-[#1a1a2e] text-[#1a1a2e]" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <main className="flex-1 px-8 py-6 w-full">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1a1a2e] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === "info" && <ClientInfoTab profile={clientProfile} />}
            {activeTab === "tasks" && <TaskCalendarTab tasks={tasks} />}
          </>
        )}
      </main>
    </div>
  );
}
