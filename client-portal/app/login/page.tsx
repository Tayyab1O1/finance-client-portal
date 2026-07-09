"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (authLoading || !user) return;
    if (!profile) return;
    router.replace(profile.role === "admin" ? "/admin" : "/dashboard");
  }, [user, profile, authLoading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Keep spinner going — useEffect redirects once profile loads, unmounting this page
    } catch {
      showToast("Invalid email or password. Please try again.");
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="w-8 h-8 border-4 border-harvest border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen grid md:grid-cols-[0.92fr_1.08fr] bg-paper">
      {/* Brand panel */}
      <div className="hidden md:flex relative flex-col justify-between overflow-hidden bg-harvest px-12 py-10 text-white">
        <div
          aria-hidden="true"
          className="absolute -top-[6%] -right-[10%] w-[80%] h-[68%] opacity-40"
          style={{
            background: "var(--buttercup)",
            borderRadius: "42% 58% 55% 45% / 45% 40% 60% 55%",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-[3%] -right-[5%] w-[44%] h-[38%] opacity-25"
          style={{
            backgroundImage: "radial-gradient(#fff 1.6px, transparent 1.6px)",
            backgroundSize: "15px 15px",
            WebkitMaskImage: "radial-gradient(circle at 70% 30%, #000 0%, transparent 75%)",
            maskImage: "radial-gradient(circle at 70% 30%, #000 0%, transparent 75%)",
          }}
        />

        <img
          src="/logo.svg"
          alt="Sympl Finance"
          className="relative z-10 self-start h-16 w-auto"
          style={{ filter: "brightness(0) invert(1)" }}
        />

        <div className="relative z-10">
          <p className="font-serif italic text-3xl leading-snug mb-3">Nonprofit finances,<br />made sympl.</p>
          <p className="text-white/80 text-sm max-w-xs">
            Everything about your books, reports, and financials — in one place, built for nonprofits.
          </p>
        </div>

        <p className="relative z-10 text-xs text-white/60">
          © {new Date().getFullYear()} Sympl Finance. All rights reserved.
        </p>
      </div>

      {/* Login form */}
      <div className="relative flex flex-col items-center px-4 pt-24 pb-10 md:justify-center md:pt-16">
        <img
          src="/logo.svg"
          alt="Sympl Finance"
          className="absolute top-5 left-5 sm:top-7 sm:left-7 h-14 sm:h-16 w-auto md:hidden"
        />

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <p className="kicker text-xs font-bold tracking-[0.18em] uppercase text-harvest mb-2">Client Portal</p>
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Welcome back.</h2>
          </div>

          <div className="w-full bg-white rounded-2xl shadow-[0_16px_34px_rgba(0,34,54,0.1)] border border-black/[0.06] p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-1.5">Email address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-harvest focus:border-transparent transition"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-harvest focus:border-transparent transition"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-yolk text-foreground py-2.5 rounded-full text-sm font-semibold hover:bg-harvest hover:text-white disabled:opacity-60 disabled:cursor-not-allowed transition mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-foreground/40 border-t-transparent rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : "Sign in"}
              </button>
            </form>
          </div>

          <p className="mt-6 text-xs text-ink-soft md:hidden">
            © {new Date().getFullYear()} Sympl Finance. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
