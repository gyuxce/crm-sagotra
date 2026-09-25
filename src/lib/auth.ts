import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
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

export async function getCurrentStaff(): Promise<Staff | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return staffForUser(user);
}

export async function requireStaff(): Promise<Staff> {
  if (!isSupabaseConfigured) redirect("/sign-in?setup=supabase");
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/sign-in?setup=supabase");

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/sign-in");
  const staff = await staffForUser(user);
  if (!staff) redirect("/access-denied");
  return staff;
}

export async function requireOwner(): Promise<Staff> {
  const staff = await requireStaff();
  if (staff.role !== "owner_admin") redirect("/access-denied");
  return staff;
}
