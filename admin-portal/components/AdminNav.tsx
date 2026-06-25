"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export default function AdminNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useAuth();

  async function handleSignOut() {
    await signOut(auth);
    router.replace("/login");
  }

  return (
    <header className="bg-[#1a1a2e] px-6 py-3 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="Sympl Finance" className="h-7 w-auto" />
          <span className="text-white/30 text-xs font-medium px-2 py-0.5 rounded bg-white/10">ADMIN</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link href="/dashboard"
            className={`px-3 py-1.5 rounded-lg text-sm transition ${pathname === "/dashboard" ? "bg-white/15 text-white" : "text-white/60 hover:text-white hover:bg-white/10"}`}>
            Dashboard
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/settings"
          title="Settings"
          className={`p-2 rounded-lg transition ${pathname === "/settings" ? "bg-white/15 text-white" : "text-white/60 hover:text-white hover:bg-white/10"}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
        <span className="text-white/50 text-xs">{profile?.email}</span>
        <button onClick={handleSignOut}
          className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </div>
    </header>
  );
}
