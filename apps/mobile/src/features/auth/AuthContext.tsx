import type { Session } from "@supabase/supabase-js";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getPaymentsProvider } from "../../services/payments/getPaymentsProvider";
import { isSupabaseConfigured, supabase } from "../../services/supabase/client";

export type AuthProfile = {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  role: string;
  status: string;
  isCreator: boolean;
};

type AuthResult = { ok: boolean; error?: string };

type AuthState = {
  /** True when Supabase env vars are present and real auth is active. */
  isRealAuth: boolean;
  isLoading: boolean;
  isSignedIn: boolean;
  session: Session | null;
  profile: AuthProfile | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signInWithMagicLink: (email: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, handle: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  requestAccountDeletion: () => Promise<AuthResult>;
  cancelAccountDeletion: () => Promise<AuthResult>;
  deletionRequested: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

const mockProfile: AuthProfile = {
  id: "user_me",
  handle: "vuqiro_user",
  displayName: "Vuqiro User",
  bio: "",
  role: "user",
  status: "active",
  isCreator: false
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [mockSignedIn, setMockSignedIn] = useState(false);
  const [deletionRequested, setDeletionRequested] = useState(false);

  const loadProfile = useCallback(async (activeSession: Session | null) => {
    if (!supabase || !activeSession) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("id, handle, display_name, bio, role, status, is_creator")
      .eq("auth_user_id", activeSession.user.id)
      .maybeSingle();
    if (data) {
      setProfile({
        id: data.id,
        handle: data.handle,
        displayName: data.display_name,
        bio: data.bio,
        role: data.role,
        status: data.status,
        isCreator: data.is_creator
      });
      setDeletionRequested(data.status === "deletion_requested");
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadProfile(data.session).finally(() => setIsLoading(false));
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      loadProfile(nextSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, [loadProfile]);

  // Configure the payments provider with the auth user id so RevenueCat's
  // app_user_id matches what the webhook resolves against.
  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;
    getPaymentsProvider()
      .configure(userId)
      .catch((error) => console.warn("[payments] configure failed:", error?.message ?? error));
  }, [session?.user.id]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) {
      setMockSignedIn(true);
      return { ok: true };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { ok: false, error: error.message } : { ok: true };
  }, []);

  const signInWithMagicLink = useCallback(async (email: string): Promise<AuthResult> => {
    if (!supabase) {
      setMockSignedIn(true);
      return { ok: true };
    }
    const { error } = await supabase.auth.signInWithOtp({ email });
    return error ? { ok: false, error: error.message } : { ok: true };
  }, []);

  const signUp = useCallback(async (email: string, password: string, handle: string): Promise<AuthResult> => {
    if (!supabase) {
      setMockSignedIn(true);
      return { ok: true };
    }
    const cleanHandle = handle.replace(/^@/, "").toLowerCase();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { handle: cleanHandle, display_name: cleanHandle } }
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) {
      setMockSignedIn(false);
      return;
    }
    await supabase.auth.signOut();
  }, []);

  const requestAccountDeletion = useCallback(async (): Promise<AuthResult> => {
    setDeletionRequested(true);
    if (!supabase || !profile) return { ok: true };
    const { error } = await supabase.from("account_deletion_requests").insert({ profile_id: profile.id });
    if (error) {
      setDeletionRequested(false);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }, [profile]);

  const cancelAccountDeletion = useCallback(async (): Promise<AuthResult> => {
    setDeletionRequested(false);
    if (!supabase || !profile) return { ok: true };
    const { error } = await supabase
      .from("account_deletion_requests")
      .update({ status: "cancelled" })
      .eq("profile_id", profile.id)
      .eq("status", "requested");
    return error ? { ok: false, error: error.message } : { ok: true };
  }, [profile]);

  const value = useMemo<AuthState>(
    () => ({
      isRealAuth: isSupabaseConfigured,
      isLoading,
      isSignedIn: isSupabaseConfigured ? session !== null : mockSignedIn,
      session,
      profile: isSupabaseConfigured ? profile : mockSignedIn ? mockProfile : null,
      signIn,
      signInWithMagicLink,
      signUp,
      signOut,
      requestAccountDeletion,
      cancelAccountDeletion,
      deletionRequested
    }),
    [
      isLoading,
      session,
      profile,
      mockSignedIn,
      signIn,
      signInWithMagicLink,
      signUp,
      signOut,
      requestAccountDeletion,
      cancelAccountDeletion,
      deletionRequested
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
