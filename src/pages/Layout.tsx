import { Outlet, NavLink, useLocation, useNavigate } from "react-router";
import { BookMarked, LayoutDashboard, PlusCircle, Settings, Search } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../app/components/ui/utils";

export default function Layout() {
  const { user, family, member } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isAppRoute =
    user &&
    family &&
    !["/", "/auth", "/onboarding"].includes(location.pathname) &&
    !location.pathname.startsWith("/invite");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {isAppRoute && (
        <header className="sticky top-0 z-40 bg-card border-b border-border backdrop-blur-sm">
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

      <main className="flex-1">
        <Outlet />
      </main>

      {isAppRoute && (
        <nav className="sticky bottom-0 z-40 bg-card border-t border-border pb-safe">
          <div className="max-w-2xl mx-auto px-2 pt-2 pb-3 flex items-center justify-around">
            {/* Left side */}
            <NavItem to="/dashboard" icon={<LayoutDashboard size={20} />} label="Home" />
            <NavItem to="/books" icon={<BookMarked size={20} />} label="Library" />

            {/* Centre add button */}
            <NavLink to="/books/add" className="flex flex-col items-center gap-0.5">
              <span className="w-12 h-12 -mt-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/30">
                <PlusCircle size={22} />
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground mt-0.5">Add</span>
            </NavLink>

            {/* Right side */}
            <NavItem to="/search" icon={<Search size={20} />} label="Search" />
            <NavItem to="/settings" icon={<Settings size={20} />} label="Settings" />
          </div>
        </nav>
      )}
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <NavLink
      to={to}
      className={cn(
        "flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors min-w-[52px]",
        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      <span className="text-[10px] font-semibold">{label}</span>
    </NavLink>
  );
}
