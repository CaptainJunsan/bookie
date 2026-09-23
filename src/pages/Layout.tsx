import { Outlet, NavLink, useLocation, useNavigate } from "react-router";
import {
  BookMarked, LayoutDashboard, Compass, Users, Menu,
  Settings, LogOut, Share2, UserPlus, ShieldCheck, X,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../app/components/ui/utils";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { ageGroupNeedsReview } from "../lib/types";

export default function Layout() {
  const { user, family, member, allMembers } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isAdminRoute = location.pathname.startsWith("/admin");

  const isAppRoute =
    user &&
    family &&
    !isAdminRoute &&
    !["/", "/auth", "/onboarding"].includes(location.pathname) &&
    !location.pathname.startsWith("/invite") &&
    !location.pathname.startsWith("/join") &&
    !location.pathname.startsWith("/register-school") &&
    !location.pathname.startsWith("/homeschool");

  // Show badge if any member is missing an age group OR has a legacy band needing review
  const missingAgeGroups =
    allMembers.some((m) => !m.age_group) ||
    allMembers.some((m) => ageGroupNeedsReview(m.age_group));

  // Club notification dot
  const [hasClubNotifs, setHasClubNotifs] = useState(false);
  useEffect(() => {
    if (!member || !isAppRoute) return;
    const memberIds = allMembers.map((m) => m.id);
    if (!memberIds.length) return;
    supabase
      .from("club_notifications")
      .select("id", { count: "exact", head: true })
      .in("member_id", memberIds)
      .eq("seen", false)
      .then(({ count }) => setHasClubNotifs((count ?? 0) > 0));
  }, [member, allMembers, location.pathname]);

  // Hamburger drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Super-admin check
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  useEffect(() => {
    if (!user) return;
    supabase
      .from("super_admins")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .then(({ count }) => setIsSuperAdmin((count ?? 0) > 0));
  }, [user]);

  async function handleLogout() {
    setDrawerOpen(false);
    await supabase.auth.signOut();
    navigate("/");
  }

  async function handleShareApp() {
    const url = import.meta.env.VITE_APP_URL ?? window.location.origin;
    const shareData = {
      title: "Bookie — Family Reading Tracker",
      text: "Track every book your family reads together. Free. 📚",
      url,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
    }
    setDrawerOpen(false);
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">

      {/* ── Desktop sidebar ── */}
      {isAppRoute && (
        <aside className="hidden lg:flex flex-col w-60 xl:w-64 border-r border-border bg-card sticky top-0 h-screen shrink-0">
          {/* Logo */}
          <div className="px-5 py-5 border-b border-border">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
            >
              <span className="text-2xl">📚</span>
              <span className="font-display font-bold text-xl text-primary tracking-tight">Bookie</span>
            </button>
            <p className="text-xs text-muted-foreground mt-1 font-medium truncate">{family.name}</p>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            <SideNavItem to="/dashboard" icon={<LayoutDashboard size={18} />} label="Home" />
            <SideNavItem to="/books"     icon={<BookMarked size={18} />}     label="Library" />
            <SideNavItem to="/clubs"     icon={<Users size={18} />}          label="Clubs" badge={hasClubNotifs} />
            <SideNavItem to="/explore"   icon={<Compass size={18} />}        label="Explore" />
          </nav>

          {/* Bottom actions */}
          <div className="px-3 py-3 border-t border-border space-y-0.5">
            <SideNavItem to="/settings" icon={<Settings size={18} />} label="Settings" badge={missingAgeGroups} />
            {isSuperAdmin && (
              <SideNavItem to="/admin" icon={<ShieldCheck size={18} />} label="Admin" />
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-colors text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogOut size={18} />
              Sign out
            </button>
          </div>

          {/* User */}
          <div className="px-4 py-4 border-t border-border">
            <button
              onClick={() => navigate("/settings")}
              className="flex items-center gap-3 w-full hover:opacity-80 transition-opacity text-left"
            >
              <span className="text-2xl shrink-0">{member?.avatar_emoji || "👤"}</span>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{member?.nickname}</p>
                <p className="text-xs text-muted-foreground truncate">{member?.role}</p>
              </div>
            </button>
          </div>
        </aside>
      )}

      {/* ── Mobile header ── */}
      {isAppRoute && (
        <header className="sticky top-0 z-40 bg-card/95 border-b border-border backdrop-blur-sm lg:hidden">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
            <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2">
              <span className="text-2xl">📚</span>
              <span className="font-display font-bold text-lg text-primary tracking-tight">Bookie</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground font-medium hidden xs:block">{family.name}</span>
              {/* Hamburger / avatar button */}
              <button
                onClick={() => setDrawerOpen(true)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-foreground bg-secondary hover:bg-muted transition-colors relative"
                aria-label="Open menu"
              >
                <Menu size={20} />
                {missingAgeGroups && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 border border-card" />
                )}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* ── Hamburger Drawer (mobile) ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Panel — slides in from right */}
          <div className="absolute right-0 top-0 h-full w-72 max-w-[85vw] bg-card border-l border-border flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
              <button
                onClick={() => { setDrawerOpen(false); navigate("/settings"); }}
                className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
              >
                <span className="text-3xl shrink-0">{member?.avatar_emoji || "👤"}</span>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{member?.nickname}</p>
                  <p className="text-xs text-muted-foreground truncate">{member?.role}</p>
                </div>
              </button>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Nav items */}
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              <DrawerItem
                icon={<Settings size={18} />}
                label="Settings"
                badge={missingAgeGroups}
                onClick={() => { setDrawerOpen(false); navigate("/settings"); }}
              />
              <DrawerItem
                icon={<UserPlus size={18} />}
                label="Invite a family member"
                onClick={() => { setDrawerOpen(false); navigate("/settings?invite=1"); }}
              />
              <DrawerItem
                icon={<Share2 size={18} />}
                label="Share Bookie"
                onClick={handleShareApp}
              />
              {isSuperAdmin && (
                <>
                  <div className="border-t border-border my-2" />
                  <DrawerItem
                    icon={<ShieldCheck size={18} />}
                    label="Admin Dashboard"
                    onClick={() => { setDrawerOpen(false); navigate("/admin"); }}
                    highlight
                  />
                </>
              )}
            </nav>

            {/* Sign out */}
            <div className="px-3 pb-6 pt-2 border-t border-border">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-colors text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <LogOut size={18} />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page content ── */}
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>

      {/* ── Mobile bottom nav ── */}
      {isAppRoute && (
        <nav className="sticky bottom-0 z-40 bg-card/95 border-t border-border backdrop-blur-sm pb-safe lg:hidden">
          <div className="max-w-2xl mx-auto px-1 pt-1.5 pb-[18px] flex items-center justify-around">
            <NavItem to="/dashboard" icon={<LayoutDashboard size={22} />} label="Home" />
            <NavItem to="/books"     icon={<BookMarked size={22} />}      label="Library" />
            <NavItem to="/clubs"     icon={<Users size={22} />}           label="Clubs" badge={hasClubNotifs} />
            <NavItem to="/explore"   icon={<Compass size={22} />}         label="Explore" />
          </div>
        </nav>
      )}
    </div>
  );
}

// ─── Nav item components ──────────────────────────────────────────────────────

function NavItem({
  to, icon, label, badge,
}: { to: string; icon: React.ReactNode; label: string; badge?: boolean }) {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <NavLink
      to={to}
      className={cn(
        "flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all min-w-[56px] relative",
        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span className={cn(
        "relative p-1.5 rounded-xl transition-colors",
        isActive && "bg-primary/10"
      )}>
        {icon}
        {badge && (
          <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-amber-400 border border-card" />
        )}
      </span>
      <span className={cn(
        "text-[10px] font-bold tracking-wide",
        isActive ? "text-primary" : "text-muted-foreground"
      )}>
        {label}
      </span>
    </NavLink>
  );
}

function SideNavItem({
  to, icon, label, badge,
}: { to: string; icon: React.ReactNode; label: string; badge?: boolean }) {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <NavLink
      to={to}
      className={cn(
        "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-colors text-sm font-semibold relative",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <span className="relative shrink-0">
        {icon}
        {badge && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 border border-card" />
        )}
      </span>
      {label}
    </NavLink>
  );
}

function DrawerItem({
  icon, label, badge, onClick, highlight,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-colors text-sm font-semibold text-left relative",
        highlight
          ? "text-school hover:bg-school/10"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <span className="relative shrink-0">
        {icon}
        {badge && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 border border-card" />
        )}
      </span>
      {label}
    </button>
  );
}
