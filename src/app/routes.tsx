import { createBrowserRouter, redirect } from "react-router";
import { supabase } from "../lib/supabase";
import Layout from "../pages/Layout";
import LandingPage from "../pages/LandingPage";
import AuthPage from "../pages/AuthPage";
import OnboardingPage from "../pages/OnboardingPage";
import InvitePage from "../pages/InvitePage";
import DashboardPage from "../pages/DashboardPage";
import BooksPage from "../pages/BooksPage";
import BookDetailPage from "../pages/BookDetailPage";
import AddBookPage from "../pages/AddBookPage";
import SearchPage from "../pages/SearchPage";
import ExplorePage from "../pages/ExplorePage";
import SchoolsPage from "../pages/SchoolsPage";
import SchoolDetailPage from "../pages/SchoolDetailPage";
import RegisterSchoolPage from "../pages/RegisterSchoolPage";
import HomeschoolGuidePage from "../pages/HomeschoolGuidePage";
import JoinPage from "../pages/JoinPage";
import SettingsPage from "../pages/SettingsPage";
import AdminDashboard from "../pages/AdminDashboard";
import ClubsPage from "../pages/ClubsPage";
import ClubDetailPage from "../pages/ClubDetailPage";
import ClubInvitePage from "../pages/ClubInvitePage";
import AboutPage from "../pages/AboutPage";
import PrivacyPage from "../pages/PrivacyPage";
import TermsPage from "../pages/TermsPage";

async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw redirect("/auth");
  return null;
}

async function requireNoAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const { data: member } = await supabase
      .from("family_members")
      .select("id")
      .eq("user_id", session.user.id)
      .single();
    throw redirect(member ? "/dashboard" : "/onboarding");
  }
  return null;
}

async function requireAuthWithFamily() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw redirect("/auth");
  const { data: member } = await supabase
    .from("family_members")
    .select("id")
    .eq("user_id", session.user.id)
    .single();
  if (!member) throw redirect("/onboarding");
  return null;
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: LandingPage, loader: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: member } = await supabase
            .from("family_members").select("id").eq("user_id", session.user.id).single();
          if (member) throw redirect("/dashboard");
        }
        return null;
      }},
      { path: "auth",                Component: AuthPage,        loader: requireNoAuth },
      { path: "invite/:token",        Component: InvitePage },
      { path: "onboarding",           Component: OnboardingPage,  loader: requireAuth },
      { path: "dashboard",            Component: DashboardPage,   loader: requireAuthWithFamily },
      { path: "books",                Component: BooksPage,       loader: requireAuthWithFamily },
      { path: "books/add",            Component: AddBookPage,     loader: requireAuthWithFamily },
      { path: "books/:id",            Component: BookDetailPage,  loader: requireAuthWithFamily },
      // /search kept for backward compat; content absorbed into ExplorePage
      { path: "search",               Component: SearchPage,      loader: requireAuthWithFamily },
      // New Explore tab (4th nav slot)
      { path: "explore",              Component: ExplorePage,     loader: requireAuthWithFamily },
      { path: "schools",              Component: SchoolsPage,     loader: requireAuthWithFamily },
      { path: "schools/:id",          Component: SchoolDetailPage, loader: requireAuthWithFamily },
      // Public — no account needed to apply, or to read the homeschool guide.
      { path: "register-school",      Component: RegisterSchoolPage },
      { path: "homeschool",           Component: HomeschoolGuidePage },
      // Universal join code route: class codes, handover codes, staff invites,
      // school-admin claims. No requireAuthWithFamily — JoinPage handles the
      // signed-out and no-family cases itself.
      { path: "join",                 Component: JoinPage },
      { path: "join/:code",           Component: JoinPage },
      { path: "settings",             Component: SettingsPage,    loader: requireAuthWithFamily },
      { path: "clubs",                Component: ClubsPage,       loader: requireAuthWithFamily },
      { path: "clubs/invite/:token",  Component: ClubInvitePage },
      { path: "clubs/:id",            Component: ClubDetailPage,  loader: requireAuthWithFamily },
      { path: "admin",                Component: AdminDashboard,  loader: requireAuthWithFamily },
      { path: "about",                Component: AboutPage },
      { path: "privacy",              Component: PrivacyPage },
      { path: "terms",                Component: TermsPage },
    ],
  },
]);
