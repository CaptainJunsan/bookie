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
import SettingsPage from "../pages/SettingsPage";

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
      { path: "auth", Component: AuthPage, loader: requireNoAuth },
      { path: "invite/:token", Component: InvitePage },
      { path: "onboarding", Component: OnboardingPage, loader: requireAuth },
      { path: "dashboard", Component: DashboardPage, loader: requireAuthWithFamily },
      { path: "books", Component: BooksPage, loader: requireAuthWithFamily },
      { path: "books/add", Component: AddBookPage, loader: requireAuthWithFamily },
      { path: "books/:id", Component: BookDetailPage, loader: requireAuthWithFamily },
      { path: "search", Component: SearchPage, loader: requireAuthWithFamily },
      { path: "settings", Component: SettingsPage, loader: requireAuthWithFamily },
    ],
  },
]);
