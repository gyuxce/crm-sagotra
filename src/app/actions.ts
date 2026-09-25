"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwner, requireStaff } from "@/lib/auth";
import { calculatePricing, type ExperienceOption, type PaymentStatus } from "@/lib/domain";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type FormState = {
  status: "idle" | "success" | "error";
  message: string;
};

const idleState: FormState = { status: "idle", message: "" };
const leadStatusSchema = z.enum(["new", "contacted", "quoted", "confirmed", "completed", "cancelled"]);
const paymentStatusSchema = z.enum(["unpaid", "paid"]);

function database() {
  const client = createSupabaseAdminClient();
  if (!client) throw new Error("Supabase URL and server-only service role key are required.");
  return client;
}

function value(formData: FormData, name: string): string {
  const item = formData.get(name);
  return typeof item === "string" ? item.trim() : "";
}

function validCalendarDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function rpcErrorMessage(message: string, fallback: string): string {
  if (message.includes("Lead not found")) return "Lead tidak ditemukan.";
  if (message.includes("Booking not found")) return "Booking tidak ditemukan.";
  if (message.includes("requires a confirmed lead")) return "Booking hanya dapat dibuat dari lead berstatus Dikonfirmasi.";
  if (message.includes("duplicate key")) return "Lead ini sudah memiliki booking.";
  return fallback;
}

export async function createManualLeadAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const manualLeadSchema = z.object({
    name: z.string().trim().max(120),
    email: z.string().trim().max(254).email().or(z.literal("")),
    phone: z.string().trim().max(40),
    experienceId: z.string().trim(),
    preferredDate: z.string().trim(),
    groupSize: z.union([z.literal(""), z.coerce.number().int().safe().positive()]),
    message: z.string().trim().max(4000),
  }).refine((lead) => Boolean(lead.name || lead.phone || lead.email), "Masukkan setidaknya satu kontak.");
  const parsed = manualLeadSchema.safeParse({
    name: value(formData, "name"),
    email: value(formData, "email"),
    phone: value(formData, "phone"),
    experienceId: value(formData, "experienceId"),
    preferredDate: value(formData, "preferredDate"),
    groupSize: value(formData, "groupSize"),
    message: value(formData, "message"),
  });
  if (!parsed.success) return { status: "error", message: "Masukkan kontak yang valid untuk lead baru." };

  const input = parsed.data;
  if (input.preferredDate && !validCalendarDate(input.preferredDate)) {
    return { status: "error", message: "Tanggal kunjungan tidak valid." };
  }
  let experience: ExperienceOption | null = null;
  if (input.experienceId) {
    const experienceResult = await database()
      .from("crm_experiences")
      .select("id, slug, title")
      .eq("id", input.experienceId)
      .maybeSingle();
    if (experienceResult.error || !experienceResult.data) return { status: "error", message: "Pengalaman tidak ditemukan." };
    experience = { _id: experienceResult.data.id, slug: experienceResult.data.slug, title: experienceResult.data.title };
  }

  try {
    const { error } = await database().rpc("crm_create_manual_lead", {
      p_name: input.name || null,
      p_email: input.email || null,
      p_phone: input.phone || null,
      p_experience_id: experience?._id ?? null,
      p_experience_slug: experience?.slug ?? null,
      p_experience_title: experience?.title ?? null,
      p_preferred_date: input.preferredDate || null,
      p_group_size: input.groupSize === "" ? null : input.groupSize,
      p_message: input.message || null,
      p_actor_user_id: staff.id,
      p_actor_name: staff.name,
      p_actor_email: staff.email,
    });
    if (error) return { status: "error", message: "Lead baru belum tersimpan. Periksa koneksi database." };
  } catch {
    return { status: "error", message: "Lead baru belum tersimpan. Periksa konfigurasi Supabase." };
  }

  revalidatePath("/");
  revalidatePath("/leads");
  return { status: "success", message: "Lead baru ditambahkan." };
}

export async function updateLeadStatusAction(formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const id = z.string().uuid().safeParse(value(formData, "leadId"));
  const parsedStatus = leadStatusSchema.safeParse(value(formData, "status"));
  if (!id.success || !parsedStatus.success) return { status: "error", message: "Status lead tidak valid." };

  const { error } = await database().rpc("crm_update_lead_status", {
    p_lead_id: id.data,
    p_status: parsedStatus.data,
    p_actor_user_id: staff.id,
    p_actor_name: staff.name,
    p_actor_email: staff.email,
  });
  if (error) return { status: "error", message: rpcErrorMessage(error.message, "Status lead belum tersimpan.") };

  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath(`/leads/${id.data}`);
  return { status: "success", message: "Status lead diperbarui." };
}

export async function saveLeadContactAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const id = z.string().uuid().safeParse(value(formData, "leadId"));
  const contactSchema = z.object({
    name: z.string().trim().max(120),
    phone: z.string().trim().max(40),
    email: z.string().trim().max(254).email().or(z.literal("")),
  });
  const parsed = contactSchema.safeParse({
    name: value(formData, "name"),
    phone: value(formData, "phone"),
    email: value(formData, "email"),
  });
  if (!id.success || !parsed.success) return { status: "error", message: "Periksa kembali data kontak." };

  const { error } = await database().rpc("crm_update_lead_contact", {
    p_lead_id: id.data,
    p_name: parsed.data.name || null,
    p_phone: parsed.data.phone || null,
    p_email: parsed.data.email || null,
    p_actor_user_id: staff.id,
    p_actor_name: staff.name,
    p_actor_email: staff.email,
  });
  if (error) return { status: "error", message: rpcErrorMessage(error.message, "Kontak lead belum tersimpan.") };

  revalidatePath(`/leads/${id.data}`);
  revalidatePath("/leads");
  return { status: "success", message: "Kontak lead disimpan." };
}

export async function savePricingAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireOwner();
  const pricingSchema = z.object({
    experienceId: z.string().trim().min(1),
    experienceSlug: z.string().trim().min(1),
    experienceTitle: z.string().trim().min(1).max(200),
    baseCostPrice: z.coerce.number().int().safe().nonnegative(),
    markupPercent: z.coerce.number().finite().min(0).max(1000),
  });
  const parsed = pricingSchema.safeParse({
    experienceId: value(formData, "experienceId"),
    experienceSlug: value(formData, "experienceSlug"),
    experienceTitle: value(formData, "experienceTitle"),
    baseCostPrice: value(formData, "baseCostPrice"),
    markupPercent: value(formData, "markupPercent"),
  });
  if (!parsed.success) return { status: "error", message: "Harga modal dan markup harus berupa angka valid." };

  const data = parsed.data;
  const experienceExists = await database().from("crm_experiences").select("id").eq("id", data.experienceId).maybeSingle();
  if (experienceExists.error || !experienceExists.data) return { status: "error", message: "Pengalaman tidak ditemukan." };

  const prices = calculatePricing(data.baseCostPrice, data.markupPercent);
  if (!Number.isSafeInteger(prices.salePrice)) return { status: "error", message: "Harga jual hasil markup terlalu besar." };
  const { error } = await database().rpc("crm_save_experience_pricing", {
    p_experience_id: data.experienceId,
    p_experience_slug: data.experienceSlug,
    p_experience_title: data.experienceTitle,
    p_base_cost_price: data.baseCostPrice,
    p_markup_percent: data.markupPercent,
    p_sale_price: prices.salePrice,
    p_actor_user_id: staff.id,
    p_actor_name: staff.name,
    p_actor_email: staff.email,
  });
  if (error) return { status: "error", message: "Harga belum tersimpan. Periksa koneksi database." };

  revalidatePath("/pricing");
  revalidatePath("/bookings");
  revalidatePath("/");
  return { status: "success", message: "Harga pengalaman disimpan." };
}

export async function createBookingAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const bookingSchema = z.object({
    leadId: z.string().uuid(),
    experienceId: z.string().trim().min(1),
    partnerId: z.string().trim(),
    visitDate: z.string().trim().refine(validCalendarDate, "Tanggal kunjungan tidak valid."),
    groupSize: z.coerce.number().int().safe().positive(),
    paymentStatus: paymentStatusSchema,
    costPrice: z.union([z.literal(""), z.coerce.number().int().safe().nonnegative()]),
    salePrice: z.union([z.literal(""), z.coerce.number().int().safe().nonnegative()]),
  });
  const parsed = bookingSchema.safeParse({
    leadId: value(formData, "leadId"),
    experienceId: value(formData, "experienceId"),
    partnerId: value(formData, "partnerId"),
    visitDate: value(formData, "visitDate"),
    groupSize: value(formData, "groupSize"),
    paymentStatus: value(formData, "paymentStatus"),
    costPrice: value(formData, "costPrice"),
    salePrice: value(formData, "salePrice"),
  });
  if (!parsed.success) return { status: "error", message: "Periksa tanggal, pengalaman, jumlah rombongan, dan status pembayaran." };

  const input = parsed.data;
  const client = database();
  const leadResult = await client.from("crm_leads").select("id, status").eq("id", input.leadId).maybeSingle();
  if (leadResult.error || !leadResult.data) return { status: "error", message: "Lead tidak ditemukan." };
  if (leadResult.data.status !== "confirmed") {
    return { status: "error", message: "Booking hanya dapat dibuat dari lead berstatus Dikonfirmasi." };
  }

  const experienceResult = await client
    .from("crm_experiences")
    .select("id, slug, title")
    .eq("id", input.experienceId)
    .maybeSingle();
  if (experienceResult.error || !experienceResult.data) return { status: "error", message: "Pengalaman tidak ditemukan." };
  const experience: ExperienceOption = {
    _id: experienceResult.data.id,
    slug: experienceResult.data.slug,
    title: experienceResult.data.title,
  };

  if (input.partnerId) {
    const partnerResult = await client.from("crm_partners").select("id").eq("id", input.partnerId).maybeSingle();
    if (partnerResult.error || !partnerResult.data) return { status: "error", message: "Partner tidak ditemukan." };
  }

  const pricingResult = await client
    .from("crm_experience_pricing")
    .select("base_cost_price, sale_price")
    .eq("experience_id", input.experienceId)
    .maybeSingle();
  const pricing = pricingResult.data;
  if (pricingResult.error || !pricing) {
    return { status: "error", message: "Harga pengalaman belum diatur. Minta Owner/Admin mengisi harga di menu Harga." };
  }

  const owner = staff.role === "owner_admin";
  const costPrice = owner && input.costPrice !== "" ? input.costPrice : pricing.base_cost_price;
  const salePrice = owner && input.salePrice !== "" ? input.salePrice : pricing.sale_price;
  if (!Number.isSafeInteger(costPrice) || !Number.isSafeInteger(salePrice)) {
    return { status: "error", message: "Harga booking tidak valid." };
  }

  const { error } = await client.rpc("crm_create_booking", {
    p_lead_id: input.leadId,
    p_experience_id: experience._id,
    p_experience_slug: experience.slug,
    p_experience_title: experience.title,
    p_partner_id: input.partnerId || null,
    p_visit_date: input.visitDate,
    p_group_size: input.groupSize,
    p_payment_status: input.paymentStatus as PaymentStatus,
    p_cost_price: costPrice,
    p_sale_price: salePrice,
    p_actor_user_id: staff.id,
    p_actor_name: staff.name,
    p_actor_email: staff.email,
  });
  if (error) return { status: "error", message: rpcErrorMessage(error.message, "Booking gagal dibuat.") };

  revalidatePath("/bookings");
  revalidatePath(`/leads/${input.leadId}`);
  revalidatePath("/");
  return { status: "success", message: "Booking berhasil dibuat." };
}

export async function updatePaymentStatusAction(formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const bookingId = z.string().uuid().safeParse(value(formData, "bookingId"));
  const parsedStatus = paymentStatusSchema.safeParse(value(formData, "paymentStatus"));
  if (!bookingId.success || !parsedStatus.success) return { status: "error", message: "Status pembayaran tidak valid." };

  const result = await database().from("crm_bookings").select("lead_id").eq("id", bookingId.data).maybeSingle();
  if (result.error || !result.data) return { status: "error", message: "Booking tidak ditemukan." };
  const { error } = await database().rpc("crm_update_booking_payment", {
    p_booking_id: bookingId.data,
    p_payment_status: parsedStatus.data,
    p_actor_user_id: staff.id,
    p_actor_name: staff.name,
    p_actor_email: staff.email,
  });
  if (error) return { status: "error", message: rpcErrorMessage(error.message, "Status pembayaran belum tersimpan.") };

  revalidatePath("/bookings");
  revalidatePath(`/leads/${result.data.lead_id}`);
  return { status: "success", message: "Status pembayaran diperbarui." };
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createExperienceAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const experienceSchema = z.object({
    title: z.string().trim().min(1).max(200),
    slug: z.string().trim().min(1).max(200),
    category: z.enum(["heritage", "arts", "culinary", "community"]).or(z.literal("")),
    destinationSlug: z.string().trim().max(200),
  });
  const rawTitle = value(formData, "title");
  const parsed = experienceSchema.safeParse({
    title: rawTitle,
    slug: value(formData, "slug") || slugify(rawTitle),
    category: value(formData, "category"),
    destinationSlug: value(formData, "destinationSlug"),
  });
  if (!parsed.success) return { status: "error", message: "Nama pengalaman tidak boleh kosong." };

  const { error } = await database().from("crm_experiences").insert({
    slug: parsed.data.slug,
    title: parsed.data.title,
    category: parsed.data.category || null,
    destination_slug: parsed.data.destinationSlug || null,
  });
  if (error) {
    if (error.message.includes("duplicate key")) return { status: "error", message: "Slug pengalaman sudah dipakai." };
    return { status: "error", message: "Pengalaman belum tersimpan. Periksa koneksi database." };
  }

  revalidatePath("/pricing");
  revalidatePath("/leads");
  revalidatePath("/bookings");
  return { status: "success", message: "Pengalaman baru ditambahkan." };
}

export async function createPartnerAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  const partnerSchema = z.object({ name: z.string().trim().min(1).max(200) });
  const parsed = partnerSchema.safeParse({ name: value(formData, "name") });
  if (!parsed.success) return { status: "error", message: "Nama partner tidak boleh kosong." };

  const { error } = await database().from("crm_partners").insert({ name: parsed.data.name });
  if (error) return { status: "error", message: "Partner belum tersimpan. Periksa koneksi database." };

  revalidatePath("/bookings");
  return { status: "success", message: "Partner baru ditambahkan." };
}

export async function updatePartnerAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  const id = z.string().uuid().safeParse(value(formData, "partnerId"));
  const parsed = z.object({ name: z.string().trim().min(1).max(200) }).safeParse({ name: value(formData, "name") });
  if (!id.success || !parsed.success) return { status: "error", message: "Nama partner tidak boleh kosong." };

  const { error } = await database().from("crm_partners").update({ name: parsed.data.name }).eq("id", id.data);
  if (error) return { status: "error", message: "Partner belum tersimpan. Periksa koneksi database." };

  revalidatePath("/bookings");
  return { status: "success", message: "Partner diperbarui." };
}

export async function deletePartnerAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  const id = z.string().uuid().safeParse(value(formData, "partnerId"));
  if (!id.success) return { status: "error", message: "Partner tidak valid." };

  const { error } = await database().from("crm_partners").delete().eq("id", id.data);
  if (error) return { status: "error", message: "Partner belum terhapus. Coba lagi." };

  revalidatePath("/bookings");
  return { status: "success", message: "Partner dihapus." };
}

export async function updateExperienceAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const id = z.string().uuid().safeParse(value(formData, "experienceId"));
  const experienceSchema = z.object({
    title: z.string().trim().min(1).max(200),
    slug: z.string().trim().min(1).max(200),
    category: z.enum(["heritage", "arts", "culinary", "community"]).or(z.literal("")),
    destinationSlug: z.string().trim().max(200),
  });
  const parsed = experienceSchema.safeParse({
    title: value(formData, "title"),
    slug: value(formData, "slug"),
    category: value(formData, "category"),
    destinationSlug: value(formData, "destinationSlug"),
  });
  if (!id.success || !parsed.success) return { status: "error", message: "Nama dan slug pengalaman tidak boleh kosong." };

  const { error } = await database().from("crm_experiences").update({
    title: parsed.data.title,
    slug: parsed.data.slug,
    category: parsed.data.category || null,
    destination_slug: parsed.data.destinationSlug || null,
  }).eq("id", id.data);
  if (error) {
    if (error.message.includes("duplicate key")) return { status: "error", message: "Slug sudah dipakai pengalaman lain." };
    return { status: "error", message: "Pengalaman belum tersimpan. Periksa koneksi database." };
  }

  revalidatePath("/pricing");
  revalidatePath("/leads");
  revalidatePath("/bookings");
  return { status: "success", message: "Pengalaman diperbarui." };
}

export async function deleteExperienceAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const id = z.string().uuid().safeParse(value(formData, "experienceId"));
  if (!id.success) return { status: "error", message: "Pengalaman tidak valid." };

  await database().from("crm_experience_pricing").delete().eq("experience_id", id.data);
  const { error } = await database().from("crm_experiences").delete().eq("id", id.data);
  if (error) return { status: "error", message: "Pengalaman belum terhapus. Coba lagi." };

  revalidatePath("/pricing");
  revalidatePath("/leads");
  revalidatePath("/bookings");
  return { status: "success", message: "Pengalaman dihapus." };
}

export async function deleteBookingAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  const id = z.string().uuid().safeParse(value(formData, "bookingId"));
  if (!id.success) return { status: "error", message: "Booking tidak valid." };

  const result = await database().from("crm_bookings").select("lead_id").eq("id", id.data).maybeSingle();
  if (result.error || !result.data) return { status: "error", message: "Booking tidak ditemukan." };

  const { error } = await database().from("crm_bookings").delete().eq("id", id.data);
  if (error) return { status: "error", message: "Booking belum terhapus. Coba lagi." };

  revalidatePath("/bookings");
  revalidatePath(`/leads/${result.data.lead_id}`);
  revalidatePath("/");
  return { status: "success", message: "Booking dihapus." };
}

export async function deleteLeadAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  const id = z.string().uuid().safeParse(value(formData, "leadId"));
  if (!id.success) return { status: "error", message: "Lead tidak valid." };

  const { error } = await database().from("crm_leads").delete().eq("id", id.data);
  if (error) {
    if (error.code === "23503") return { status: "error", message: "Lead ini masih punya booking terkait. Hapus booking-nya dulu." };
    return { status: "error", message: "Lead belum terhapus. Coba lagi." };
  }

  revalidatePath("/leads");
  revalidatePath("/");
  redirect("/leads");
}
