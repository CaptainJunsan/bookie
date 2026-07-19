import { Outlet, NavLink, useLocation, useNavigate } from "react-router";
import { BookMarked, LayoutDashboard, PlusCircle, Settings, Search, Users } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../app/components/ui/utils";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

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
    !location.pathname.startsWith("/invite");

  const missingAgeGroups = allMembers.some((m) => !m.age_group);

  // Club notification dot — unseen club notifications for any family member
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
            <NavLink
              to="/books/add"
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity mb-2"
            >
              <PlusCircle size={18} />
              Add new book
            </NavLink>
            <div className="border-t border-border my-2" />
            <SideNavItem to="/dashboard" icon={<LayoutDashboard size={18} />} label="Home" />
            <SideNavItem to="/books" icon={<BookMarked size={18} />} label="Library" />
            <SideNavItem to="/search" icon={<Search size={18} />} label="Search" />
            <SideNavItem to="/clubs" icon={<Users size={18} />} label="Clubs" badge={hasClubNotifs} />
            <SideNavItem to="/settings" icon={<Settings size={18} />} label="Settings" badge={missingAgeGroups} />
          </nav>

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
        <header className="sticky top-0 z-40 bg-card border-b border-border backdrop-blur-sm lg:hidden">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
            <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2">
              <span className="text-2xl">📚</span>
              <span className="font-display font-bold text-lg text-primary tracking-tight">Bookie</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground font-medium">{family.name}</span>
              <button
                onClick={() => navigate("/settings")}
                className="w-8 h-8 rounded-full flex items-center justify-center text-lg bg-secondary hover:bg-muted transition-colors"
                title={member?.nickname}
              >
                {member?.avatar_emoji || "👤"}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* ── Page content ── */}
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>

      {/* ── Floating Add Book button (mobile only) ── */}
      {isAppRoute && (
        <NavLink
          to="/books/add"
          className="fixed bottom-[5.5rem] right-4 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xl shadow-primary/35 hover:opacity-90 active:scale-95 transition-all lg:hidden"
          aria-label="Add new book"
        >
          <PlusCircle size={24} />
        </NavLink>
      )}

      {/* ── Mobile bottom nav ── */}
      {isAppRoute && (
        <nav className="sticky bottom-0 z-40 bg-card border-t border-border pb-safe lg:hidden">
          <div className="max-w-2xl mx-auto px-2 pt-2 pb-[22px] flex items-center justify-around">
            <NavItem to="/dashboard" icon={<LayoutDashboard size={20} />} label="Home" />
            <NavItem to="/books" icon={<BookMarked size={20} />} label="Library" />
            <NavItem to="/search" icon={<Search size={20} />} label="Search" />
            <NavItem to="/clubs" icon={<Users size={20} />} label="Clubs" badge={hasClubNotifs} />
            <NavItem to="/settings" icon={<Settings size={20} />} label="Settings" badge={missingAgeGroups} />
          </div>
        </nav>
      )}
    </div>
  );
}

function NavItem({ to, icon, label, badge }: { to: string; icon: React.ReactNode; label: string; badge?: boolean }) {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <NavLink
      to={to}
      className={cn(
        "flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors min-w-[52px] relative",
        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span className="relative">
        {icon}
        {badge && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 border border-card" />
        )}
      </span>
      <span className="text-[10px] font-semibold">{label}</span>
    </NavLink>
  );
}

function SideNavItem({
  to, icon, label, badge,
}: {
  to: string; icon: React.ReactNode; label: string; badge?: boolean;
}) {
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
