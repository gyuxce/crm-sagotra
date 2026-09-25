import { BookingForm } from "@/components/BookingForm";
import { BookingTable } from "@/components/BookingTable";
import { requireStaff } from "@/lib/auth";
import { getBookingSalePrices, getBookings, getExperienceOptions, getLeads, getPartnerOptions, getPricing } from "@/lib/data";

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const [staff, search] = await Promise.all([requireStaff(), searchParams]);
  const [bookings, allLeads, experiences, partners, priceDefaults] = await Promise.all([
    getBookings(staff.role),
    getLeads(),
    getExperienceOptions(),
    getPartnerOptions(),
    staff.role === "owner_admin"
      ? getPricing().then((items) => items.map(({ experienceId, baseCostPrice, salePrice }) => ({ experienceId, baseCostPrice, salePrice })))
      : getBookingSalePrices(),
  ]);
  const bookedLeadIds = new Set(bookings.map((booking) => booking.leadId));
  const eligibleLeads = allLeads.filter((lead) => lead.status === "confirmed" && !bookedLeadIds.has(lead._id));
  const defaultLeadId = eligibleLeads.some((lead) => lead._id === search.lead) ? search.lead : undefined;

  return (
    <div className="page-stack">
      <div className="page-heading"><div><span className="eyebrow">PELANGGAN & KUNJUNGAN</span><h1>Booking</h1><p>Konversi lead terkonfirmasi dan kelola status pembayaran.</p></div><span className="role-chip">{bookings.length} booking</span></div>
      <BookingForm leads={eligibleLeads} experiences={experiences} partners={partners} priceDefaults={priceDefaults} role={staff.role} defaultLeadId={defaultLeadId} />
      <section className="content-card"><div className="section-heading"><div><span className="eyebrow">CATATAN BOOKING</span><h2>Semua booking</h2></div></div><BookingTable initialBookings={bookings} role={staff.role} /></section>
      <p className="privacy-note"><span className="privacy-lock" aria-hidden="true">•</span> Harga jual dapat dilihat staf operasional; harga modal dan margin hanya untuk Owner/Admin.</p>
    </div>
  );
}
