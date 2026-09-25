"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LEAD_STATUSES, formatDateTime, formatRupiah, getLeadStatusLabel, type Lead, type LeadStatus } from "@/lib/domain";
import { updateLeadStatusAction } from "@/app/actions";

export function LeadBoard({ initialLeads }: { initialLeads: Lead[] }) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropStatus, setDropStatus] = useState<LeadStatus | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => setLeads(initialLeads), [initialLeads]);

  async function moveLead(id: string, status: LeadStatus) {
    if (pending) return;
    const before = leads;
    setPending(true);
    setMessage("");
    setLeads((current) => current.map((lead) => lead._id === id ? { ...lead, status } : lead));
    const formData = new FormData();
    formData.set("leadId", id);
    formData.set("status", status);
    try {
      const result = await updateLeadStatusAction(formData);
      if (result.status === "error") {
        setLeads(before);
        setMessage(result.message);
      } else {
        router.refresh();
      }
    } catch {
      setLeads(before);
      setMessage("Perubahan status belum tersimpan. Coba lagi.");
    } finally {
      setPending(false);
      setDraggingId(null);
      setDropStatus(null);
    }
  }

  const legacyLeads = leads.filter((lead) => !LEAD_STATUSES.some((status) => status.value === lead.status));

  return (
    <div>
      {message && <p className="form-message is-error" role="alert">{message}</p>}
      <div className="pipeline-wrap">
        <div className="pipeline" aria-label="Pipeline lead">
          {LEAD_STATUSES.map((status) => {
            const columnLeads = leads.filter((lead) => lead.status === status.value);
            return (
              <section
                key={status.value}
                className={`pipeline-column${dropStatus === status.value ? " is-drop-target" : ""}`}
                onDragOver={(event) => { event.preventDefault(); setDropStatus(status.value); }}
                onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropStatus(null); }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggingId) void moveLead(draggingId, status.value);
                }}
                aria-label={`${status.label}, ${columnLeads.length} lead`}
              >
                <div className="pipeline-column-head"><h2>{status.label}</h2><span className="pipeline-count">{columnLeads.length}</span></div>
                <div className="pipeline-cards">
                  {columnLeads.map((lead) => (
                    <article
                      key={lead._id}
                      className={`lead-card${draggingId === lead._id ? " is-dragging" : ""}`}
                      draggable={!pending}
                      onDragStart={(event) => { setDraggingId(lead._id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", lead._id); }}
                      onDragEnd={() => { setDraggingId(null); setDropStatus(null); }}
                    >
                      <div className="lead-card-top">
                        <div className="lead-card-title"><strong>{lead.name || (lead.leadChannel === "whatsapp" ? "Intent WhatsApp" : lead.leadChannel === "manual" ? "Lead manual" : "Lead tanpa nama")}</strong><small>{lead.phone || "Kontak belum tersedia"}</small></div>
                        <span className="lead-channel">{lead.leadChannel === "whatsapp" ? "WhatsApp" : lead.leadChannel === "manual" ? "Manual" : "Formulir"}</span>
                      </div>
                      <p className="lead-card-experience">{lead.experienceTitle || "Pengalaman belum dipilih"}</p>
                      {lead.experienceId && <p className="lead-card-price">{lead.salePrice === undefined ? "Harga belum ditetapkan" : formatRupiah(lead.salePrice)}</p>}
                      <div className="lead-card-meta"><span>{formatDateTime(lead.submittedAt || lead._createdAt)}</span><span>{lead.source || "—"}</span></div>
                      <div className="lead-card-actions">
                        <Link href={`/leads/${lead._id}`}>Detail lead →</Link>
                        <select
                          className="status-select"
                          aria-label={`Ubah status ${lead.name || "lead"}`}
                          value={lead.status}
                          disabled={pending}
                          onChange={(event) => void moveLead(lead._id, event.target.value as LeadStatus)}
                        >
                          <option value={lead.status} disabled>{getLeadStatusLabel(lead.status)}</option>
                          {LEAD_STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      {legacyLeads.length > 0 && (
        <section className="legacy-section">
          <h2>Status lama perlu ditinjau</h2>
          <p>Lead dengan status dari skema lama tetap ditampilkan dan tidak dipindahkan otomatis. Buka detail atau pilih status pipeline baru.</p>
          <div className="legacy-list">{legacyLeads.map((lead) => <div className="legacy-item" key={lead._id}><Link href={`/leads/${lead._id}`}>{lead.name || lead.experienceTitle || "Lead tanpa nama"}</Link><span className="status-badge">{lead.status}</span><select className="status-select" aria-label={`Pindahkan lead ${lead.name || "tanpa nama"}`} value={lead.status} disabled={pending} onChange={(event) => void moveLead(lead._id, event.target.value as LeadStatus)}><option value={lead.status} disabled>{getLeadStatusLabel(lead.status)}</option>{LEAD_STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>)}</div>
        </section>
      )}
    </div>
  );
}
