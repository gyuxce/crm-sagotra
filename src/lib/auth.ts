import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Staff, StaffRole } from "./domain";
import { createSupabaseAdminClient, createSupabaseServerClient, isSupabaseConfigured } from "./supabase/server";

async function staffForUser(user: User): Promise<Staff | null> {
  const email = user.email?.trim().toLowerCase();
  const admin = createSupabaseAdminClient();
  if (!email || !admin) return null;

  const { data: profile, error } = await admin
    .from("crm_staff_profiles")
    .select("email, display_name, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !profile || profile.email.trim().toLowerCase() !== email) return null;
  if (profile.role !== "owner_admin" && profile.role !== "operations") return null;

  return {
    id: user.id,
    email,
    name: profile.display_name.trim() || email,
    role: profile.role as StaffRole,
  };
}

// The ops layout and every page under it each need the current staff member.
// Without this, that's a Supabase Auth call plus a crm_staff_profiles query
// repeated twice per request. React's cache() dedupes it to once per request.
const loadAuthState = cache(async (): Promise<{ user: User | null; staff: Staff | null }> => {
  if (!isSupabaseConfigured) return { user: null, staff: null };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { user: null, staff: null };

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, staff: null };
  return { user, staff: await staffForUser(user) };
});

export async function getCurrentStaff(): Promise<Staff | null> {
  const { staff } = await loadAuthState();
  return staff;
}

export async function requireStaff(): Promise<Staff> {
  if (!isSupabaseConfigured) redirect("/sign-in?setup=supabase");
  const { user, staff } = await loadAuthState();
  if (!user) redirect("/sign-in");
  if (!staff) redirect("/access-denied");
  return staff;
}

export async function requireOwner(): Promise<Staff> {
  const staff = await requireStaff();
  if (staff.role !== "owner_admin") redirect("/access-denied");
  return staff;
}
