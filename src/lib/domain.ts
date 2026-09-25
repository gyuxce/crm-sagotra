export const LEAD_STATUSES = [
  { value: "new", label: "Baru" },
  { value: "contacted", label: "Dihubungi" },
  { value: "quoted", label: "Ditawari harga" },
  { value: "confirmed", label: "Dikonfirmasi" },
  { value: "completed", label: "Selesai" },
  { value: "cancelled", label: "Batal" },
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number]["value"];
export type StaffRole = "owner_admin" | "operations";
export type PaymentStatus = "unpaid" | "paid";

export interface Lead {
  _id: string;
  _createdAt?: string;
  name?: string;
  email?: string;
  phone?: string;
  experienceId?: string;
  experienceSlug?: string;
  experienceTitle?: string;
  salePrice?: number;
  preferredDate?: string;
  groupSize?: number;
  message?: string;
  source?: string;
  leadChannel?: "form" | "whatsapp" | string;
  status: string;
  submittedAt?: string;
  statusUpdatedAt?: string;
  statusUpdatedBy?: string;
  bookingId?: string;
  bookingCreatedAt?: string;
}

export const EXPERIENCE_CATEGORIES = [
  { value: "heritage", label: "Warisan & Budaya" },
  { value: "arts", label: "Seni & Pembelajaran" },
  { value: "culinary", label: "Kuliner" },
  { value: "community", label: "Komunitas & Kreatif" },
] as const;

export type ExperienceCategory = (typeof EXPERIENCE_CATEGORIES)[number]["value"];

export function getExperienceCategoryLabel(category?: string): string | undefined {
  return EXPERIENCE_CATEGORIES.find((item) => item.value === category)?.label;
}

export interface ExperienceOption {
  _id: string;
  slug: string;
  title: string;
  category?: string;
  destinationSlug?: string;
}

export interface PartnerOption {
  _id: string;
  name: string;
}

export interface ExperiencePricing {
  _id: string;
  experienceId: string;
  experienceSlug: string;
  experienceTitle: string;
  baseCostPrice: number;
  markupPercent: number;
  salePrice: number;
  updatedAt?: string;
  updatedBy?: string;
}

export interface BookingPriceDefault {
  experienceId: string;
  baseCostPrice?: number;
  salePrice: number;
}

export interface Booking {
  _id: string;
  leadId: string;
  experienceId?: string;
  experienceSlug?: string;
  experienceTitle?: string;
  partnerId?: string;
  leadName?: string;
  leadPhone?: string;
  visitDate: string;
  groupSize: number;
  paymentStatus: PaymentStatus;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  costPrice?: number;
  salePrice?: number;
}

export interface ActivityEvent {
  _id: string;
  eventType: "status" | "booking_created" | "payment_status" | "contact_updated" | "pricing_updated" | string;
  leadId?: string;
  bookingId?: string;
  experienceId?: string;
  fromValue?: string;
  toValue?: string;
  actorName: string;
  actorEmail: string;
  at: string;
}

export interface Staff {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
}

export function getLeadStatusLabel(status: string): string {
  return LEAD_STATUSES.find((item) => item.value === status)?.label ?? `Perlu ditinjau (${status})`;
}

export function calculatePricing(baseCostPrice: number, markupPercent: number) {
  const salePrice = Math.round(baseCostPrice * (1 + markupPercent / 100));
  const marginAmount = salePrice - baseCostPrice;
  const marginPercent = salePrice === 0 ? 0 : (marginAmount / salePrice) * 100;

  return { salePrice, marginAmount, marginPercent };
}

export function calculateConversionRate(totalLeads: number, convertedLeads: number): number {
  if (totalLeads <= 0) return 0;
  return Math.round((convertedLeads / totalLeads) * 1000) / 10;
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export function formatDateTime(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}
