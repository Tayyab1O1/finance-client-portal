"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

function isSessionExpired(firebaseUser: User): boolean {
  const lastSignIn = firebaseUser.metadata.lastSignInTime;
  if (!lastSignIn) return false;
  return Date.now() - new Date(lastSignIn).getTime() > SESSION_DURATION_MS;
}

interface UserProfile {
  uid: string;
  email: string;
  role: "admin" | "client";
  clientId: string | null;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, profile: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && isSessionExpired(firebaseUser)) {
        await signOut(auth);
        return;
      }

      setUser(firebaseUser);
      if (firebaseUser) {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Periodic check — expires session mid-use without requiring navigation
  useEffect(() => {
    const interval = setInterval(() => {
      const currentUser = auth.currentUser;
      if (currentUser && isSessionExpired(currentUser)) {
        signOut(auth);
      }
    }, 60 * 1000); // check every minute

    return () => clearInterval(interval);
  }, []);

  return <AuthContext.Provider value={{ user, profile, loading }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
