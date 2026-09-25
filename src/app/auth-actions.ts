"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentStaff } from "@/lib/auth";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type SignInState = { status: "idle" | "error"; message: string };

const signInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function signInAction(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { status: "error", message: "Masukkan email dan kata sandi yang valid." };
  if (!isSupabaseConfigured) return { status: "error", message: "Konfigurasi Supabase belum lengkap." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "error", message: "Konfigurasi Supabase belum lengkap." };

  try {
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return { status: "error", message: "Email atau kata sandi tidak cocok." };

    const staff = await getCurrentStaff();
    if (!staff) {
      await supabase.auth.signOut();
      return { status: "error", message: "Akun belum ditambahkan ke daftar staf CRM." };
    }
  } catch {
    return { status: "error", message: "Login belum tersedia. Periksa konfigurasi Supabase." };
  }

  redirect("/");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/sign-in");
}
