"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export default function BookkeeperNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useAuth();

  async function handleSignOut() {
    await signOut(auth);
    router.replace("/login");
  }

  return (
    <header className="bg-[#1a1a2e] px-3 sm:px-6 py-3 flex items-center justify-between shrink-0 gap-2">
      <div className="flex items-center gap-3 sm:gap-6 min-w-0">
        <Link href="/bookkeeper" className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <img src="/logo.svg" alt="Sympl Finance" className="h-6 sm:h-7 w-auto" />
          <span className="hidden sm:inline text-white/30 text-xs font-medium px-2 py-0.5 rounded bg-white/10">BOOKKEEPER</span>
        </Link>
        <nav className="flex items-center gap-1 min-w-0">
          <Link href="/bookkeeper"
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-sm transition whitespace-nowrap ${pathname === "/bookkeeper" ? "bg-white/15 text-white" : "text-white/60 hover:text-white hover:bg-white/10"}`}>
            My Clients
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-1 sm:gap-3 shrink-0">
        <span className="hidden md:inline text-white/50 text-xs max-w-[160px] truncate">{profile?.email}</span>
        <button onClick={handleSignOut} title="Sign out"
          className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm transition p-2.5 sm:p-0">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
