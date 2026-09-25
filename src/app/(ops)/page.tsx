import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getMonthlyMetrics, getRecentLeads } from "@/lib/data";
import { formatDateTime, formatRupiah, getLeadStatusLabel } from "@/lib/domain";

export default async function DashboardPage() {
  const staff = await requireStaff();
  const [metrics, recentLeads] = await Promise.all([getMonthlyMetrics(staff.role), getRecentLeads()]);

  return (
    <div className="page-stack">
      <section className="welcome-panel">
        <div>
          <span className="eyebrow">DASHBOARD OPERASIONAL</span>
          <h1>Selamat pagi, {staff.name.split(" ")[0]}.</h1>
          <p>Berikut aktivitas SAGOTRA bulan ini.</p>
        </div>
        <Link className="button button-light" href="/leads">Buka pipeline <span aria-hidden="true">→</span></Link>
        <div className="welcome-orbit orbit-one" /><div className="welcome-orbit orbit-two" />
      </section>

      <section className="stats-grid" aria-label="Ringkasan bulan ini">
        <article className="stat-card"><div className="stat-top"><span className="stat-icon icon-indigo">L</span><span className="stat-kicker">BULAN INI</span></div><p className="stat-value">{metrics.leadCount}</p><h2>Lead masuk</h2><p className="stat-foot">{metrics.channelCounts.whatsapp} WhatsApp · {metrics.channelCounts.form} formulir · {metrics.channelCounts.manual} manual</p></article>
        <article className="stat-card"><div className="stat-top"><span className="stat-icon icon-green">%</span><span className="stat-kicker">KONVERSI</span></div><p className="stat-value">{metrics.conversionRate}<span className="stat-unit">%</span></p><h2>Lead terkonfirmasi</h2><p className="stat-foot">{metrics.convertedLeadCount} dari {metrics.leadCount} lead bulan ini</p></article>
        <article className="stat-card"><div className="stat-top"><span className="stat-icon icon-gold">B</span><span className="stat-kicker">BULAN INI</span></div><p className="stat-value">{metrics.bookingCount}</p><h2>Booking dibuat</h2><p className="stat-foot">Status pembayaran dicatat staf</p></article>
        {staff.role === "owner_admin" && <article className="stat-card stat-card-finance"><div className="stat-top"><span className="stat-icon icon-purple">↗</span><span className="stat-kicker">OWNER / ADMIN</span></div><p className="stat-value stat-money">{formatRupiah(metrics.marginTotal ?? 0)}</p><h2>Margin booking</h2><p className="stat-foot">Selisih harga jual dan modal bulan ini</p></article>}
      </section>

      <section className="content-card recent-card">
        <div className="section-heading"><div><span className="eyebrow">INBOX</span><h2>Lead terbaru</h2></div><Link className="text-link" href="/leads">Lihat semua <span aria-hidden="true">→</span></Link></div>
        {recentLeads.length === 0 ? <div className="empty-state"><span className="empty-symbol" aria-hidden="true">·</span><h3>Belum ada lead</h3><p>Tambahkan lead manual atau terima inquiry dari formulir dan klik WhatsApp.</p></div> : (
          <div className="table-wrap"><table className="data-table"><thead><tr><th>Nama / sumber</th><th>Pengalaman</th><th>Status</th><th>Masuk</th><th /></tr></thead><tbody>{recentLeads.map((lead) => <tr key={lead._id}><td><strong>{lead.name || (lead.leadChannel === "whatsapp" ? "Intent WhatsApp" : lead.leadChannel === "manual" ? "Lead manual" : "Lead tanpa nama")}</strong><small>{lead.leadChannel === "whatsapp" ? "WhatsApp" : lead.leadChannel === "manual" ? "Manual" : "Formulir"}{lead.phone ? ` · ${lead.phone}` : " · kontak belum tersedia"}</small></td><td>{lead.experienceTitle || "Belum dipilih"}</td><td><span className={`status-badge status-${lead.status}`}>{getLeadStatusLabel(lead.status)}</span></td><td>{formatDateTime(lead.submittedAt || lead._createdAt)}</td><td><Link className="row-link" href={`/leads/${lead._id}`} aria-label="Buka detail lead">→</Link></td></tr>)}</tbody></table></div>
        )}
      </section>

      <p className="privacy-note"><span className="privacy-lock" aria-hidden="true">•</span> Database CRM, audit, dan katalog pengalaman/partner sepenuhnya disimpan di Supabase.</p>
    </div>
  );
}
