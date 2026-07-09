"use client";

import { useAuth } from "@/context/AuthContext";
import ClientPortalView from "@/components/dashboard/ClientPortalView";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const { profile } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOut(auth);
    router.replace("/login");
  }

  if (!profile?.clientId) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3 flex items-center justify-between">
        <img src="/logo.svg" alt="Sympl Finance" className="h-6 sm:h-7 w-auto" />
        <button onClick={handleSignOut}
          className="text-sm text-gray-500 hover:text-[#1a1a2e] transition flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </header>
      <ClientPortalView clientId={profile.clientId} />
    </div>
  );
}
