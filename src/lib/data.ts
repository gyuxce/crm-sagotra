import "server-only";

import { contentSanity, isContentSanityConfigured } from "./sanity";
import type {
  ActivityEvent,
  Booking,
  BookingPriceDefault,
  ExperienceOption,
  ExperiencePricing,
  Lead,
  PartnerOption,
  StaffRole,
} from "./domain";
import { calculateConversionRate } from "./domain";
import { createSupabaseAdminClient } from "./supabase/server";

interface LeadRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  experience_id: string | null;
  experience_slug: string | null;
  experience_title: string | null;
  preferred_date: string | null;
  group_size: number | null;
  message: string | null;
  source: string;
  channel: string;
  status: string;
  submitted_at: string;
  status_updated_at: string | null;
  status_updated_by: string | null;
}

interface LeadSalePriceRow {
  experience_id: string;
  experience_slug: string;
  sale_price: number;
}

interface ActivityRow {
  id: string;
  event_type: ActivityEvent["eventType"];
  lead_id: string | null;
  booking_id: string | null;
  experience_id: string | null;
  from_value: string | null;
  to_value: string | null;
  actor_name: string;
  actor_email: string;
  at: string;
}

interface PricingRow {
  experience_id: string;
  experience_slug: string;
  experience_title: string;
  base_cost_price?: number;
  markup_percent?: number;
  sale_price: number;
  updated_at?: string;
  updated_by?: string;
}

interface BookingRow {
  id: string;
  lead_id: string;
  experience_id: string;
  experience_slug: string;
  experience_title: string;
  partner_id: string | null;
  visit_date: string;
  group_size: number;
  payment_status: "unpaid" | "paid";
  cost_price?: number;
  sale_price: number;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

interface LeadContactRow {
  id: string;
  name: string | null;
  phone: string | null;
}

function database() {
  const client = createSupabaseAdminClient();
  if (!client) throw new Error("Supabase URL and server-only service role key are required.");
  return client;
}

function requireData<T>(result: { data: T | null; error: { message: string } | null }, operation: string): T {
  if (result.error) throw new Error(`${operation}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${operation}: no data returned.`);
  return result.data;
}

function checkError(result: { error: { message: string } | null }, operation: string): void {
  if (result.error) throw new Error(`${operation}: ${result.error.message}`);
}

function toLead(row: LeadRow): Lead {
  return {
    _id: row.id,
    _createdAt: row.submitted_at,
    name: row.name ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    experienceId: row.experience_id ?? undefined,
    experienceSlug: row.experience_slug ?? undefined,
    experienceTitle: row.experience_title ?? undefined,
    preferredDate: row.preferred_date ?? undefined,
    groupSize: row.group_size ?? undefined,
    message: row.message ?? undefined,
    source: row.source,
    leadChannel: row.channel,
    status: row.status,
    submittedAt: row.submitted_at,
    statusUpdatedAt: row.status_updated_at ?? undefined,
    statusUpdatedBy: row.status_updated_by ?? undefined,
  };
}

async function attachLeadSalePrices(leads: Lead[]): Promise<Lead[]> {
  if (leads.length === 0) return leads;
  const result = await database().from("crm_experience_pricing").select("experience_id,experience_slug,sale_price");
  const prices = requireData<LeadSalePriceRow[]>(result, "Load lead sale prices");
  const pricesByExperienceId = new Map(prices.map((price) => [price.experience_id, price.sale_price]));
  const pricesByExperienceSlug = new Map(prices.map((price) => [price.experience_slug, price.sale_price]));
  return leads.map((lead) => ({
    ...lead,
    salePrice: (lead.experienceId ? pricesByExperienceId.get(lead.experienceId) : undefined)
      ?? (lead.experienceSlug ? pricesByExperienceSlug.get(lead.experienceSlug) : undefined),
  }));
}

function toActivity(row: ActivityRow): ActivityEvent {
  return {
    _id: row.id,
    eventType: row.event_type,
    leadId: row.lead_id ?? undefined,
    bookingId: row.booking_id ?? undefined,
    experienceId: row.experience_id ?? undefined,
    fromValue: row.from_value ?? undefined,
    toValue: row.to_value ?? undefined,
    actorName: row.actor_name,
    actorEmail: row.actor_email,
    at: row.at,
  };
}

function toPricing(row: PricingRow): ExperiencePricing {
  return {
    _id: row.experience_id,
    experienceId: row.experience_id,
    experienceSlug: row.experience_slug,
    experienceTitle: row.experience_title,
    baseCostPrice: row.base_cost_price ?? 0,
    markupPercent: row.markup_percent ?? 0,
    salePrice: row.sale_price,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

function toBooking(row: BookingRow, contact?: LeadContactRow): Booking {
  return {
    _id: row.id,
    leadId: row.lead_id,
    experienceId: row.experience_id,
    experienceSlug: row.experience_slug,
    experienceTitle: row.experience_title,
    partnerId: row.partner_id ?? undefined,
    leadName: contact?.name ?? undefined,
    leadPhone: contact?.phone ?? undefined,
    visitDate: row.visit_date,
    groupSize: row.group_size,
    paymentStatus: row.payment_status,
    createdAt: row.created_at,
    createdBy: row.created_by ?? undefined,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by ?? undefined,
    costPrice: row.cost_price,
    salePrice: row.sale_price,
  };
}

function jakartaMonthBounds(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const start = new Date(Date.UTC(year, month - 1, 1) - 7 * 60 * 60 * 1000);
  const end = new Date(Date.UTC(year, month, 1) - 7 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function getLeads(): Promise<Lead[]> {
  const result = await database().from("crm_leads").select("*").order("submitted_at", { ascending: false });
  return attachLeadSalePrices(requireData<LeadRow[]>(result, "Load leads").map(toLead));
}

export async function getRecentLeads(): Promise<Lead[]> {
  const result = await database().from("crm_leads").select("*").order("submitted_at", { ascending: false }).limit(6);
  return attachLeadSalePrices(requireData<LeadRow[]>(result, "Load recent leads").map(toLead));
}

export async function getLead(id: string): Promise<Lead | null> {
  const result = await database().from("crm_leads").select("*").eq("id", id).maybeSingle();
  checkError(result, "Load lead");
  if (!result.data) return null;
  const [lead] = await attachLeadSalePrices([toLead(result.data as LeadRow)]);
  return lead;
}

export async function getLeadActivity(id: string): Promise<ActivityEvent[]> {
  const result = await database()
    .from("crm_activity_events")
    .select("*")
    .eq("lead_id", id)
    .order("at", { ascending: false })
    .limit(100);
  return requireData<ActivityRow[]>(result, "Load lead activity").map(toActivity);
}

interface ExperienceRow {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  destination_slug: string | null;
}

interface PartnerRow {
  id: string;
  name: string;
}

export async function getExperienceOptions(): Promise<ExperienceOption[]> {
  const result = await database()
    .from("crm_experiences")
    .select("id, slug, title, category, destination_slug")
    .order("title", { ascending: true });
  return requireData<ExperienceRow[]>(result, "Load experiences").map((row) => ({
    _id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category ?? undefined,
    destinationSlug: row.destination_slug ?? undefined,
  }));
}

export async function getPartnerOptions(): Promise<PartnerOption[]> {
  const result = await database().from("crm_partners").select("id, name").order("name", { ascending: true });
  return requireData<PartnerRow[]>(result, "Load partners").map((row) => ({ _id: row.id, name: row.name }));
}

export interface UnmatchedSanityExperience {
  slug: string;
  title: string;
  category?: string;
  destinationSlug?: string;
}

interface SanityExperienceRow {
  slug: string | null;
  title: string;
  category?: string;
  destinationSlug?: string;
}

export async function getUnmatchedSanityExperiences(): Promise<UnmatchedSanityExperience[]> {
  if (!isContentSanityConfigured) return [];
  try {
    const [sanityExperiences, existingResult] = await Promise.all([
      contentSanity().fetch<SanityExperienceRow[]>(
        `*[_type == "experience"] {
          "slug": slug.current,
          "title": coalesce(title.id, title.en, slug.current),
          category,
          "destinationSlug": destination->slug.current
        }`,
      ),
      database().from("crm_experiences").select("slug"),
    ]);
    const existingSlugs = new Set(requireData<{ slug: string }[]>(existingResult, "Load experience slugs").map((row) => row.slug));
    return sanityExperiences
      .filter((experience): experience is SanityExperienceRow & { slug: string } => Boolean(experience.slug))
      .filter((experience) => !existingSlugs.has(experience.slug))
      .map((experience) => ({
        slug: experience.slug,
        title: experience.title,
        category: experience.category,
        destinationSlug: experience.destinationSlug,
      }));
  } catch {
    return [];
  }
}

export async function getPricing(): Promise<ExperiencePricing[]> {
  const result = await database()
    .from("crm_experience_pricing")
    .select("experience_id, experience_slug, experience_title, base_cost_price, markup_percent, sale_price, updated_at, updated_by")
    .order("experience_title", { ascending: true });
  return requireData<PricingRow[]>(result, "Load pricing").map(toPricing);
}

export async function getBookingSalePrices(): Promise<BookingPriceDefault[]> {
  const result = await database().from("crm_experience_pricing").select("experience_id, sale_price");
  return requireData<{ experience_id: string; sale_price: number }[]>(result, "Load booking sale prices")
    .map((row) => ({ experienceId: row.experience_id, salePrice: row.sale_price }));
}

async function attachLeadContacts(rows: BookingRow[]): Promise<Booking[]> {
  if (rows.length === 0) return [];
  const leadIds = [...new Set(rows.map((row) => row.lead_id))];
  const result = await database().from("crm_leads").select("id, name, phone").in("id", leadIds);
  const contacts = requireData<LeadContactRow[]>(result, "Load booking contacts");
  const byId = new Map(contacts.map((contact) => [contact.id, contact]));
  return rows.map((row) => toBooking(row, byId.get(row.lead_id)));
}

export async function getBookings(role: StaffRole): Promise<Booking[]> {
  const result = role === "owner_admin"
    ? await database()
      .from("crm_bookings")
      .select("id, lead_id, experience_id, experience_slug, experience_title, partner_id, visit_date, group_size, payment_status, cost_price, sale_price, created_at, created_by, updated_at, updated_by")
      .order("created_at", { ascending: false })
    : await database()
      .from("crm_bookings")
      .select("id, lead_id, experience_id, experience_slug, experience_title, partner_id, visit_date, group_size, payment_status, sale_price, created_at, created_by, updated_at, updated_by")
      .order("created_at", { ascending: false });
  const rows = requireData<BookingRow[]>(
    result as unknown as { data: BookingRow[] | null; error: { message: string } | null },
    "Load bookings",
  );
  return attachLeadContacts(rows);
}

export async function getBookingForLead(leadId: string, role: StaffRole): Promise<Booking | null> {
  const result = role === "owner_admin"
    ? await database()
      .from("crm_bookings")
      .select("id, lead_id, experience_id, experience_slug, experience_title, partner_id, visit_date, group_size, payment_status, cost_price, sale_price, created_at, created_by, updated_at, updated_by")
      .eq("lead_id", leadId)
      .maybeSingle()
    : await database()
      .from("crm_bookings")
      .select("id, lead_id, experience_id, experience_slug, experience_title, partner_id, visit_date, group_size, payment_status, sale_price, created_at, created_by, updated_at, updated_by")
      .eq("lead_id", leadId)
      .maybeSingle();
  checkError(result, "Load booking");
  if (!result.data) return null;
  const bookings = await attachLeadContacts([result.data as BookingRow]);
  return bookings[0] ?? null;
}


export async function getBookingActivity(bookingId: string): Promise<ActivityEvent[]> {
  const result = await database()
    .from("crm_activity_events")
    .select("*")
    .eq("booking_id", bookingId)
    .order("at", { ascending: false })
    .limit(100);
  return requireData<ActivityRow[]>(result, "Load booking activity").map(toActivity);
}

export interface MonthlyMetrics {
  leadCount: number;
  convertedLeadCount: number;
  conversionRate: number;
  bookingCount: number;
  marginTotal?: number;
  channelCounts: { form: number; whatsapp: number; manual: number; other: number };
}

export async function getMonthlyMetrics(role: StaffRole, now = new Date()): Promise<MonthlyMetrics> {
  const { start, end } = jakartaMonthBounds(now);
  const client = database();
  const [leadResult, bookingResult] = await Promise.all([
    client.from("crm_leads").select("status, channel").gte("submitted_at", start).lt("submitted_at", end),
    role === "owner_admin"
      ? client.from("crm_bookings").select("id, cost_price, sale_price").gte("created_at", start).lt("created_at", end)
      : client.from("crm_bookings").select("id").gte("created_at", start).lt("created_at", end),
  ]);
  const leads = requireData<{ status: string; channel: string }[]>(leadResult, "Load monthly leads");
  const bookings = requireData<{ id: string; cost_price?: number; sale_price?: number }[]>(
    bookingResult as unknown as { data: { id: string; cost_price?: number; sale_price?: number }[] | null; error: { message: string } | null },
    "Load monthly bookings",
  );
  const convertedLeadCount = leads.filter((lead) => ["confirmed", "completed"].includes(lead.status)).length;
  const channelCounts = leads.reduce(
    (counts, lead) => {
      if (lead.channel === "form") counts.form += 1;
      else if (lead.channel === "whatsapp") counts.whatsapp += 1;
      else if (lead.channel === "manual") counts.manual += 1;
      else counts.other += 1;
      return counts;
    },
    { form: 0, whatsapp: 0, manual: 0, other: 0 },
  );

  const metrics: MonthlyMetrics = {
    leadCount: leads.length,
    convertedLeadCount,
    conversionRate: calculateConversionRate(leads.length, convertedLeadCount),
    bookingCount: bookings.length,
    channelCounts,
  };
  if (role === "owner_admin") {
    metrics.marginTotal = bookings.reduce(
      (total, booking) => total + (booking.sale_price ?? 0) - (booking.cost_price ?? 0),
      0,
    );
  }
  return metrics;
}
