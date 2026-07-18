import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Family, FamilyMember } from "../lib/types";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  member: FamilyMember | null;
  family: Family | null;
  allMembers: FamilyMember[];
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshFamily: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<FamilyMember | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [allMembers, setAllMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  async function loadFamilyData(userId: string) {
    const { data: memberData } = await supabase
      .from("family_members")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!memberData) {
      setMember(null);
      setFamily(null);
      setAllMembers([]);
      return;
    }

    setMember(memberData as FamilyMember);

    const [familyRes, membersRes, adminRes] = await Promise.all([
      supabase.from("families").select("*").eq("id", memberData.family_id).single(),
      supabase.from("family_members").select("*").eq("family_id", memberData.family_id).order("created_at"),
      supabase.rpc("is_super_admin"),
    ]);

    setFamily(familyRes.data as Family | null);
    setAllMembers((membersRes.data as FamilyMember[]) || []);
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
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setMember(null);
    setFamily(null);
    setAllMembers([]);
    setIsAdmin(false);
  }

  async function refreshFamily() {
    if (user) await loadFamilyData(user.id);
  }

  return (
    <AuthContext.Provider value={{ user, session, member, family, allMembers, loading, isAdmin, signOut, refreshFamily }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
