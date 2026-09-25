"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { deleteBookingAction, updatePaymentStatusAction } from "@/app/actions";
import { formatDate, formatDateTime, formatRupiah, type Booking, type StaffRole } from "@/lib/domain";

interface BookingRow extends Booking {
  leadName?: string;
  leadPhone?: string;
}

export function BookingTable({ initialBookings, role }: { initialBookings: BookingRow[]; role: StaffRole }) {
  const router = useRouter();
  const [bookings, setBookings] = useState(initialBookings);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => setBookings(initialBookings), [initialBookings]);

  async function changePayment(id: string, paymentStatus: "unpaid" | "paid") {
    if (pendingId) return;
    const previous = bookings;
    setPendingId(id);
    setMessage("");
    setBookings((items) => items.map((booking) => booking._id === id ? { ...booking, paymentStatus } : booking));
    const formData = new FormData();
    formData.set("bookingId", id);
    formData.set("paymentStatus", paymentStatus);
    try {
      const result = await updatePaymentStatusAction(formData);
      if (result.status === "error") {
        setBookings(previous);
        setMessage(result.message);
      } else {
        router.refresh();
      }
    } catch {
      setBookings(previous);
      setMessage("Status pembayaran belum tersimpan. Coba lagi.");
    } finally {
      setPendingId(null);
    }
  }

  async function deleteBooking(id: string, leadName: string) {
    if (pendingId) return;
    if (!confirm(`Hapus booking untuk "${leadName}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    const previous = bookings;
    setPendingId(id);
    setMessage("");
    setBookings((items) => items.filter((booking) => booking._id !== id));
    const formData = new FormData();
    formData.set("bookingId", id);
    try {
      const result = await deleteBookingAction({ status: "idle", message: "" }, formData);
      if (result.status === "error") {
        setBookings(previous);
        setMessage(result.message);
      } else {
        router.refresh();
      }
    } catch {
      setBookings(previous);
      setMessage("Booking belum terhapus. Coba lagi.");
    } finally {
      setPendingId(null);
    }
  }

  if (bookings.length === 0) return <div className="empty-state"><span className="empty-symbol" aria-hidden="true">·</span><h3>Belum ada booking</h3><p>Konversi lead berstatus Dikonfirmasi menjadi booking dari formulir di atas.</p></div>;

  return (
    <>
      {message && <p className="form-message is-error" role="alert">{message}</p>}
      <div className="table-wrap"><table className="data-table booking-table">
        <thead><tr><th>Lead</th><th>Pengalaman</th><th>Kunjungan</th><th>Rombongan</th><th>Pembayaran</th>{role === "owner_admin" ? <><th>Modal</th><th>Jual</th><th>Margin</th></> : <th>Harga jual</th>}<th>Dibuat</th><th /></tr></thead>
        <tbody>{bookings.map((booking) => {
          const margin = (booking.salePrice ?? 0) - (booking.costPrice ?? 0);
          const marginPercent = booking.salePrice ? (margin / booking.salePrice) * 100 : 0;
          return <tr key={booking._id}>
            <td><Link className="table-primary-link" href={`/leads/${booking.leadId}`}>{booking.leadName || "Lead tanpa nama"}</Link><small>{booking.leadPhone || "Kontak belum tersedia"}</small></td>
            <td>{booking.experienceTitle || "—"}</td>
            <td>{formatDate(booking.visitDate)}</td>
            <td>{booking.groupSize} orang</td>
            <td><div className="payment-control"><span className={`status-badge status-${booking.paymentStatus}`}>{booking.paymentStatus === "paid" ? "Lunas" : "Belum dibayar"}</span><select aria-label={`Ubah pembayaran untuk ${booking.leadName || "booking"}`} value={booking.paymentStatus} disabled={pendingId === booking._id || pendingId !== null} onChange={(event) => void changePayment(booking._id, event.target.value as "unpaid" | "paid")}><option value="unpaid">Belum dibayar</option><option value="paid">Lunas</option></select></div></td>
            {role === "owner_admin" ? <><td className="booking-table-finance">{formatRupiah(booking.costPrice ?? 0)}</td><td className="booking-table-finance">{formatRupiah(booking.salePrice ?? 0)}</td><td className="booking-table-finance">{formatRupiah(margin)}<small>{marginPercent.toFixed(1)}% dari harga jual</small></td></> : <td>{formatRupiah(booking.salePrice ?? 0)}</td>}
            <td>{formatDateTime(booking.createdAt)}</td>
            <td><button className="button button-danger button-small" type="button" disabled={pendingId !== null} onClick={() => void deleteBooking(booking._id, booking.leadName || "booking ini")}>Hapus</button></td>
          </tr>;
        })}</tbody>
      </table></div>
    </>
  );
}
