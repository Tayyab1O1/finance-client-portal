"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getClientProfile, getClientTasks } from "@/lib/firestore";
import type { ClientProfile, Task } from "@/lib/types";
import ClientInfoTab from "./ClientInfoTab";
import TaskCalendarTab from "./TaskCalendarTab";
import FormsTab from "./FormsTab";
import DashboardPanel from "./DashboardPanel";

type Tab = "info" | "tasks" | "forms" | "payable" | "receivable";

const TABS = [
  { id: "info" as const, label: "Client Information", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  { id: "tasks" as const, label: "Task Calendar", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { id: "forms" as const, label: "Forms", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { id: "payable" as const, label: "Payable / Expense", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
  { id: "receivable" as const, label: "Receivables", icon: "M17 9V7a4 4 0 00-8 0v2M5 9h14l1 12H4L5 9z" },
];

interface Props {
  clientId: string;
  overlayLabel?: string;
}

export default function ClientPortalView({ clientId, overlayLabel }: Props) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("info");

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
    <>
      {/* Banner */}
      <div className="relative h-32 sm:h-40 md:h-48 bg-[#1a1a2e] overflow-hidden shrink-0">
        {clientProfile?.coverImageUrl ? (
          <img src={clientProfile.coverImageUrl} alt="Cover" className="w-full h-full object-cover opacity-60" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#2d2d4e] to-[#1a1a2e]">
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #4f8ef7 0%, transparent 50%), radial-gradient(circle at 80% 20%, #7c3aed 0%, transparent 40%)" }} />
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 md:px-8 pb-3 sm:pb-5 md:pb-6 flex items-end gap-3 sm:gap-4">
          <div className="w-11 h-11 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center shrink-0 overflow-hidden">
            {clientProfile?.logoImageUrl
              ? <img src={clientProfile.logoImageUrl} alt="Logo" className="w-full h-full object-contain p-1" />
              : <span className="text-white text-base sm:text-xl font-bold">{initials}</span>
            }
          </div>
          <div className="pb-0.5 min-w-0">
            <h1 className="text-white text-lg sm:text-xl md:text-2xl font-bold leading-tight truncate">
              {loading ? <span className="block w-40 h-7 bg-white/20 rounded animate-pulse" /> : displayName}
            </h1>
            {clientProfile?.executiveDirectorName && (
              <p className="text-white/70 text-xs sm:text-sm mt-0.5 truncate">Executive Director: {clientProfile.executiveDirectorName}</p>
            )}
          </div>
        </div>
        {overlayLabel && (
          <div className="absolute top-2 sm:top-3 right-2 sm:right-3 bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-2.5 sm:px-3 py-1 rounded-full border border-white/20">
            {overlayLabel}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 md:px-8 shrink-0 overflow-x-auto">
        <nav className="flex gap-1 -mb-px w-max sm:w-auto">
          {TABS.filter(tab => {
            // Admin always sees every tab regardless of the client-facing enable
            // toggles — those toggles control what the client (and bookkeeper)
            // see, never what admin can inspect/manage. See RULES.md.
            if (isAdmin) return true;
            if (tab.id === "forms") return clientProfile?.formsEnabled && !!clientProfile.forms?.length;
            if (tab.id === "payable" || tab.id === "receivable") return !!clientProfile?.dashboardsEnabled?.[tab.id];
            return true;
          }).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id ? "border-[#1a1a2e] text-[#1a1a2e]" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <main className="flex-1 px-4 sm:px-6 md:px-8 py-5 sm:py-6 w-full">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1a1a2e] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === "info" && <ClientInfoTab profile={clientProfile} />}
            {activeTab === "tasks" && <TaskCalendarTab tasks={tasks} />}
            {activeTab === "forms" && <FormsTab forms={clientProfile?.forms ?? []} />}
            {activeTab === "payable" && <DashboardPanel clientId={clientId} dashboardType="payable" />}
            {activeTab === "receivable" && <DashboardPanel clientId={clientId} dashboardType="receivable" />}
          </>
        )}
      </main>
    </>
  );
}
