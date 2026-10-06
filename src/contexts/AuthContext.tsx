import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Family, FamilyMember } from "../lib/types";

// A person can now belong to more than one family (multi-family membership,
// PRD §27) — one family_members row per family, same user_id. MyFamilyProfile
// is that row plus its family's name, for the switcher UI in Settings.
export interface MyFamilyProfile extends FamilyMember {
  family_name: string;
}

const ACTIVE_PROFILE_KEY_PREFIX = "bookie_active_profile_";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  member: FamilyMember | null;
  family: Family | null;
  allMembers: FamilyMember[];
  myProfiles: MyFamilyProfile[];
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshFamily: () => Promise<void>;
  switchProfile: (memberId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<FamilyMember | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [allMembers, setAllMembers] = useState<FamilyMember[]>([]);
  const [myProfiles, setMyProfiles] = useState<MyFamilyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  async function loadActiveFamilyAndMembers(activeMember: FamilyMember) {
    const [familyRes, membersRes] = await Promise.all([
      supabase.from("families").select("*").eq("id", activeMember.family_id).single(),
      supabase.from("family_members").select("*").eq("family_id", activeMember.family_id).order("created_at"),
    ]);
    setMember(activeMember);
    setFamily(familyRes.data as Family | null);
    setAllMembers((membersRes.data as FamilyMember[]) || []);
  }

  async function loadFamilyData(userId: string) {
    // A user may have several family_members rows now (one per family they
    // belong to) — fetch all of them, not .single(), plus each row's family
    // name for the switcher.
    const { data: profilesData } = await supabase
      .from("family_members")
      .select("*, families(name)")
      .eq("user_id", userId)
      .order("is_primary", { ascending: false })
      .order("created_at");

    const profiles = ((profilesData ?? []) as Array<FamilyMember & { families: { name: string } | null }>).map((p) => ({
      ...p,
      family_name: p.families?.name ?? "Family",
    }));
    setMyProfiles(profiles);

    if (profiles.length === 0) {
      setMember(null);
      setFamily(null);
      setAllMembers([]);
      return;
    }

    const rememberedId = localStorage.getItem(ACTIVE_PROFILE_KEY_PREFIX + userId);
    const active =
      profiles.find((p) => p.id === rememberedId) ??
      profiles.find((p) => p.is_primary) ??
      profiles[0];

    const [, adminRes] = await Promise.all([
      loadActiveFamilyAndMembers(active),
      supabase.rpc("is_super_admin"),
    ]);
    setIsAdmin(adminRes.data === true);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadFamilyData(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadFamilyData(session.user.id);
      } else {
        setMember(null);
        setFamily(null);
        setAllMembers([]);
        setMyProfiles([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setMember(null);
    setFamily(null);
    setAllMembers([]);
    setMyProfiles([]);
    setIsAdmin(false);
  }

  async function refreshFamily() {
    if (user) await loadFamilyData(user.id);
  }

  async function switchProfile(memberId: string) {
    if (!user) return;
    const target = myProfiles.find((p) => p.id === memberId);
    if (!target) return;
    localStorage.setItem(ACTIVE_PROFILE_KEY_PREFIX + user.id, memberId);
    await loadActiveFamilyAndMembers(target);
  }

  return (
    <AuthContext.Provider value={{
      user, session, member, family, allMembers, myProfiles, loading, isAdmin,
      signOut, refreshFamily, switchProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
