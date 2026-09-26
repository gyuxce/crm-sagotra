"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import type { ActivityEvent, Booking, Lead, StaffRole } from "@/lib/domain";
import { formatDate, formatDateTime, formatRupiah, getLeadStatusLabel } from "@/lib/domain";
import { deleteLeadAction, saveLeadContactAction, type FormState } from "@/app/actions";
import { ConfirmDialog } from "./ConfirmDialog";

const initialFormState: FormState = { status: "idle", message: "" };

function DeleteLeadButton({ leadId, leadName }: { leadId: string; leadName: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteLeadAction, initialFormState);

  function confirmDelete() {
    const formData = new FormData();
    formData.set("leadId", leadId);
    startTransition(() => action(formData));
    setOpen(false);
  }

  return (
    <>
      <button className="button button-danger button-small" type="button" onClick={() => setOpen(true)} disabled={pending}>{pending ? "Menghapus…" : "Hapus lead"}</button>
      {state.message && <p className="form-message is-error" role="alert">{state.message}</p>}
      <ConfirmDialog
        open={open}
        title="Hapus lead?"
        message={`Hapus lead "${leadName}"? Riwayat aktivitasnya ikut terhapus dan tindakan ini tidak bisa dibatalkan.`}
        pending={pending}
        onConfirm={confirmDelete}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

function eventTitle(event: ActivityEvent): string {
  if (event.eventType === "lead_created") return event.toValue === "manual" ? "Lead dicatat manual" : "Lead masuk";
  if (event.eventType === "status") return `Status: ${getLeadStatusLabel(event.fromValue || "") || "—"} → ${getLeadStatusLabel(event.toValue || "")}`;
  if (event.eventType === "booking_created") return "Booking dibuat";
  if (event.eventType === "payment_status") return `Pembayaran: ${event.fromValue || "—"} → ${event.toValue || "—"}`;
  if (event.eventType === "contact_updated") return "Kontak lead diperbarui";
  if (event.eventType === "pricing_updated") return "Harga pengalaman diperbarui";
  return event.eventType;
}

function ContactForm({ lead }: { lead: Lead }) {
  const [state, action, pending] = useActionState(saveLeadContactAction, initialFormState);
  return (
    <form action={action}>
      <input type="hidden" name="leadId" value={lead._id} />
      <div className="form-grid">
        <div className="form-field"><label htmlFor="lead-name">Nama</label><input id="lead-name" name="name" maxLength={120} defaultValue={lead.name || ""} autoComplete="name" /></div>
        <div className="form-field"><label htmlFor="lead-phone">Nomor telepon / WhatsApp</label><input id="lead-phone" name="phone" maxLength={40} defaultValue={lead.phone || ""} autoComplete="tel" /></div>
        <div className="form-field full-width"><label htmlFor="lead-email">Email</label><input id="lead-email" name="email" type="email" maxLength={254} defaultValue={lead.email || ""} autoComplete="email" /></div>
      </div>
      <div className="form-actions"><button className="button button-primary button-small" type="submit" disabled={pending}>{pending ? "Menyimpan…" : "Simpan kontak"}</button></div>
      {state.message && <p className={`form-message ${state.status === "error" ? "is-error" : "is-success"}`} role="status">{state.message}</p>}
    </form>
  );
}

function LeadBooking({ booking, role }: { booking: Booking | null; role: StaffRole }) {
  if (!booking) return null;
  return (
    <section className="detail-card">
      <h2>Booking terhubung</h2>
      <div className="detail-data">
        <div className="detail-field"><small>Pengalaman</small><strong>{booking.experienceTitle || "—"}</strong></div>
        <div className="detail-field"><small>Tanggal kunjungan</small><strong>{formatDate(booking.visitDate)}</strong></div>
        <div className="detail-field"><small>Jumlah rombongan</small><strong>{booking.groupSize} orang</strong></div>
        <div className="detail-field"><small>Pembayaran</small><strong>{booking.paymentStatus === "paid" ? "Lunas" : "Belum dibayar"}</strong></div>
        {role === "owner_admin" ? <>
          <div className="detail-field"><small>Harga modal</small><strong>{formatRupiah(booking.costPrice ?? 0)}</strong></div>
          <div className="detail-field"><small>Harga jual</small><strong>{formatRupiah(booking.salePrice ?? 0)}</strong></div>
          <div className="detail-field"><small>Margin</small><strong>{formatRupiah((booking.salePrice ?? 0) - (booking.costPrice ?? 0))}</strong></div>
        </> : <div className="detail-field"><small>Harga jual</small><strong>{formatRupiah(booking.salePrice ?? 0)}</strong></div>}
      </div>
      <p className="form-help">Dibuat {formatDateTime(booking.createdAt)} · harga tersimpan sebagai snapshot booking.</p>
    </section>
  );
}

export function LeadDetail({ lead, activity, booking, role }: { lead: Lead; activity: ActivityEvent[]; booking: Booking | null; role: StaffRole }) {
  const hasBooking = Boolean(booking);
  return (
    <div className="page-stack">
      <div><div className="breadcrumb"><Link href="/leads">Pipeline lead</Link><span>/</span><span>Detail</span></div><div className="page-heading"><div><span className="eyebrow">LEAD DETAIL</span><h1>{lead.name || (lead.leadChannel === "whatsapp" ? "Intent WhatsApp" : lead.leadChannel === "manual" ? "Lead manual" : "Lead tanpa nama")}</h1><p>{lead.leadChannel === "whatsapp" ? "Masuk dari klik WhatsApp" : lead.leadChannel === "manual" ? "Dicatat manual oleh staf" : "Masuk dari formulir website"} · {formatDateTime(lead.submittedAt || lead._createdAt)}</p></div><span className={`status-badge status-${lead.status}`}>{getLeadStatusLabel(lead.status)}</span></div></div>
      {lead.leadChannel === "whatsapp" && (!lead.name || !lead.phone) && <p className="intent-notice">Ini adalah intent klik WhatsApp, bukan bukti pesan terkirim. Website tidak menerima nama atau nomor pengunjung saat CTA diklik; tambahkan kontak setelah pengunjung menghubungi tim.</p>}
      <div className="detail-grid">
        <div className="detail-stack">
          <section className="detail-card">
            <h2>Informasi lead</h2>
            <div className="detail-data">
              <div className="detail-field"><small>Pengalaman</small><strong>{lead.experienceTitle || "Belum dipilih"}</strong></div>
              {lead.experienceId && <div className="detail-field"><small>Harga jual saat ini</small><strong>{lead.salePrice === undefined ? "Belum ditetapkan" : formatRupiah(lead.salePrice)}</strong></div>}
              <div className="detail-field"><small>Sumber halaman</small><strong>{lead.source || "—"}</strong></div>
              <div className="detail-field"><small>Nomor telepon</small><strong>{lead.phone || "Belum tersedia"}</strong></div>
              <div className="detail-field"><small>Email</small><strong>{lead.email || "Belum tersedia"}</strong></div>
              <div className="detail-field"><small>Tanggal pilihan</small><strong>{formatDate(lead.preferredDate)}</strong></div>
              <div className="detail-field"><small>Jumlah rombongan</small><strong>{lead.groupSize ? `${lead.groupSize} orang` : "—"}</strong></div>
              <div className="detail-field"><small>Status terakhir diubah</small><strong>{lead.statusUpdatedAt ? `${formatDateTime(lead.statusUpdatedAt)} · ${lead.statusUpdatedBy || "staf"}` : "Belum ada perubahan status"}</strong></div>
              {lead.message && <div className="detail-field"><small>Pesan</small><strong>{lead.message}</strong></div>}
            </div>
            {!hasBooking && lead.status === "confirmed" && <div className="form-actions"><Link className="button button-primary button-small" href={`/bookings?lead=${encodeURIComponent(lead._id)}`}>Buat booking</Link></div>}
          </section>
          <LeadBooking booking={booking} role={role} />
          <section className="detail-card"><h2>Riwayat aktivitas</h2>{activity.length === 0 ? <p className="form-help">Belum ada perubahan status atau booking.</p> : <div className="activity-list">{activity.map((event) => <div className="activity-item" key={event._id}><span className="activity-marker" /><div className="activity-copy"><strong>{eventTitle(event)}</strong><small>{event.actorName} · {formatDateTime(event.at)}</small></div></div>)}</div>}</section>
        </div>
        <div className="detail-stack">
          <section className="detail-card"><h2>Perbarui kontak</h2><p className="form-help">Kontak dapat berasal dari formulir, chat, telepon, atau pencatatan manual.</p><ContactForm lead={lead} /></section>
          <section className="detail-card danger-zone">
            <h2>Hapus lead</h2>
            <p className="form-help">Menghapus lead ini juga menghapus riwayat aktivitasnya. {hasBooking ? "Lead ini punya booking terkait — hapus booking-nya dulu sebelum bisa menghapus lead." : "Tindakan ini tidak bisa dibatalkan."}</p>
            <DeleteLeadButton leadId={lead._id} leadName={lead.name || "ini"} />
          </section>
        </div>
      </div>
    </div>
  );
}
