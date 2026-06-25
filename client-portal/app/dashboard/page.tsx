"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getClientProfile, getClientTasks } from "@/lib/firestore";
import type { ClientProfile, Task } from "@/lib/types";
import ClientInfoTab from "@/components/dashboard/ClientInfoTab";
import TaskCalendarTab from "@/components/dashboard/TaskCalendarTab";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

type Tab = "info" | "tasks";

export default function DashboardPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.clientId) return;

    async function load() {
      setLoading(true);
      const [cp, t] = await Promise.all([
        getClientProfile(profile!.clientId!),
        getClientTasks(profile!.clientId!),
      ]);
      setClientProfile(cp);
      setTasks(t);
      setLoading(false);
    }

    load();
  }, [profile]);

  async function handleSignOut() {
    await signOut(auth);
    router.replace("/login");
  }

  const displayName = clientProfile?.fullName || clientProfile?.clickupFolderName || "Client";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <img src="/logo.svg" alt="Sympl Finance" className="h-7 w-auto" />
        </div>
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-500 hover:text-[#1a1a2e] transition flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </header>

      {/* Banner */}
      <div className="relative h-48 bg-[#1a1a2e] overflow-hidden">
        {clientProfile?.coverImageUrl ? (
          <img
            src={clientProfile.coverImageUrl}
            alt="Cover"
            className="w-full h-full object-cover opacity-60"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#2d2d4e] to-[#1a1a2e]">
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #4f8ef7 0%, transparent 50%), radial-gradient(circle at 80% 20%, #7c3aed 0%, transparent 40%)" }}
            />
          </div>
        )}

        {/* Client identity */}
        <div className="absolute bottom-0 left-0 right-0 px-8 pb-6 flex items-end gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center shrink-0 overflow-hidden">
            {clientProfile?.logoImageUrl ? (
              <img src={clientProfile.logoImageUrl} alt="Logo" className="w-full h-full object-contain p-1" />
            ) : (
              <span className="text-white text-xl font-bold">{initials}</span>
            )}
          </div>
          <div className="pb-0.5">
            <h1 className="text-white text-2xl font-bold leading-tight">
              {loading ? (
                <span className="block w-40 h-7 bg-white/20 rounded animate-pulse" />
              ) : displayName}
            </h1>
            {clientProfile?.executiveDirectorName && (
              <p className="text-white/70 text-sm mt-0.5">
                Executive Director: {clientProfile.executiveDirectorName}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-8">
        <nav className="flex gap-1 -mb-px">
          {([
            { id: "info", label: "Client Information", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
            { id: "tasks", label: "Task Calendar", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-[#1a1a2e] text-[#1a1a2e]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
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
