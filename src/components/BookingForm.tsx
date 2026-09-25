"use client";

import { startTransition, useActionState, useMemo, useState } from "react";
import { createPartnerAction, deletePartnerAction, updatePartnerAction, createBookingAction, type FormState } from "@/app/actions";
import { formatRupiah, type BookingPriceDefault, type ExperienceOption, type Lead, type PartnerOption, type StaffRole } from "@/lib/domain";

const initialFormState: FormState = { status: "idle", message: "" };

// None of these are real <form> elements: this whole block sits inside the
// booking <form>, and HTML forbids nesting forms. Actions are dispatched
// manually via startTransition instead of relying on form submission.
function PartnerRow({ partner }: { partner: PartnerOption }) {
  const [name, setName] = useState(partner.name);
  const [renameState, renameAction, renamePending] = useActionState(updatePartnerAction, initialFormState);
  const [deleteState, deleteAction, deletePending] = useActionState(deletePartnerAction, initialFormState);
  const pending = renamePending || deletePending;

  function saveName() {
    if (!name.trim() || name === partner.name) return;
    const formData = new FormData();
    formData.set("partnerId", partner._id);
    formData.set("name", name);
    startTransition(() => renameAction(formData));
  }

  function removePartner() {
    if (!confirm(`Hapus partner "${partner.name}"?`)) return;
    const formData = new FormData();
    formData.set("partnerId", partner._id);
    startTransition(() => deleteAction(formData));
  }

  return (
    <div className="inline-add-form">
      <input
        value={name}
        maxLength={200}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); saveName(); } }}
      />
      <button className="button button-secondary button-small" type="button" onClick={saveName} disabled={pending || name === partner.name}>{renamePending ? "Menyimpan…" : "Simpan"}</button>
      <button className="button-link is-danger" type="button" onClick={removePartner} disabled={pending}>{deletePending ? "Menghapus…" : "Hapus"}</button>
      {renameState.message && <p className={`form-message ${renameState.status === "error" ? "is-error" : "is-success"}`} role="status">{renameState.message}</p>}
      {deleteState.message && <p className="form-message is-error" role="alert">{deleteState.message}</p>}
    </div>
  );
}

function AddPartnerForm({ partners }: { partners: PartnerOption[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [state, action, pending] = useActionState(createPartnerAction, initialFormState);

  function submitPartner() {
    if (!name.trim()) return;
    const formData = new FormData();
    formData.set("name", name);
    startTransition(() => action(formData));
    setName("");
  }

  return (
    <div className="add-partner-form">
      <button type="button" className="button button-secondary button-small" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? "Tutup" : "Kelola partner"}
      </button>
      {open && (
        <div className="partner-manager">
          {partners.map((partner) => <PartnerRow key={partner._id} partner={partner} />)}
          <div className="inline-add-form">
            <input
              placeholder="Nama partner baru"
              maxLength={200}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submitPartner(); } }}
            />
            <button className="button button-primary button-small" type="button" onClick={submitPartner} disabled={pending}>{pending ? "Menyimpan…" : "Tambah"}</button>
            {state.message && <p className={`form-message ${state.status === "error" ? "is-error" : "is-success"}`} role="status">{state.message}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export function BookingForm({
  leads,
  experiences,
  partners,
  priceDefaults,
  role,
  defaultLeadId,
}: {
  leads: Lead[];
  experiences: ExperienceOption[];
  partners: PartnerOption[];
  priceDefaults: BookingPriceDefault[];
  role: StaffRole;
  defaultLeadId?: string;
}) {
  const initialLead = leads.find((lead) => lead._id === defaultLeadId) ?? leads[0];
  const [state, action, pending] = useActionState(createBookingAction, initialFormState);
  const [leadId, setLeadId] = useState(initialLead?._id ?? "");
  const [experienceId, setExperienceId] = useState(initialLead?.experienceId ?? "");
  const [groupSize, setGroupSize] = useState(String(initialLead?.groupSize ?? 1));
  const pricingByExperience = useMemo(() => new Map(priceDefaults.map((item) => [item.experienceId, item])), [priceDefaults]);
  const currentPrice = pricingByExperience.get(experienceId);
  const selectedLead = leads.find((lead) => lead._id === leadId);

  function selectLead(nextId: string) {
    const nextLead = leads.find((lead) => lead._id === nextId);
    setLeadId(nextId);
    setExperienceId(nextLead?.experienceId ?? "");
    setGroupSize(String(nextLead?.groupSize ?? 1));
  }

  return (
    <section className="content-card booking-form-card">
      <div className="section-heading"><div><span className="eyebrow">KONVERSI LEAD</span><h2>Buat booking dari lead terkonfirmasi</h2><p>Harga tersimpan sebagai snapshot dan tidak berubah saat harga pengalaman diperbarui.</p></div></div>
      {leads.length === 0 ? <div className="empty-inline">Belum ada lead berstatus Dikonfirmasi yang belum memiliki booking.</div> : experiences.length === 0 ? <div className="empty-inline">Belum ada pengalaman. Tambahkan di menu Harga terlebih dahulu.</div> : (
        <form action={action}>
          <div className="form-grid">
            <div className="form-field full-width"><label htmlFor="booking-lead">Lead *</label><select id="booking-lead" name="leadId" value={leadId} onChange={(event) => selectLead(event.target.value)} required><option value="">Pilih lead</option>{leads.map((lead) => <option key={lead._id} value={lead._id}>{lead.name || (lead.leadChannel === "whatsapp" ? "Intent WhatsApp" : lead.leadChannel === "manual" ? "Lead manual" : "Lead tanpa nama")} · {lead.experienceTitle || "Pengalaman belum dipilih"}</option>)}</select>{selectedLead?.phone && <small className="form-help">{selectedLead.phone}</small>}</div>
            <div className="form-field"><label htmlFor="booking-experience">Pengalaman *</label><select id="booking-experience" name="experienceId" value={experienceId} onChange={(event) => setExperienceId(event.target.value)} required><option value="">Pilih pengalaman</option>{experiences.map((experience) => <option key={experience._id} value={experience._id}>{experience.title}</option>)}</select></div>
            <div className="form-field"><label htmlFor="booking-partner">Partner (opsional)</label><select id="booking-partner" name="partnerId" defaultValue=""><option value="">Belum ditentukan</option>{partners.map((partner) => <option key={partner._id} value={partner._id}>{partner.name}</option>)}</select><AddPartnerForm partners={partners} /></div>
            <div className="form-field"><label htmlFor="booking-date">Tanggal kunjungan *</label><input id="booking-date" name="visitDate" type="date" required /></div>
            <div className="form-field"><label htmlFor="booking-group">Jumlah rombongan *</label><input id="booking-group" name="groupSize" type="number" min="1" step="1" value={groupSize} onChange={(event) => setGroupSize(event.target.value)} required /></div>
            <div className="form-field"><label htmlFor="booking-payment">Status pembayaran</label><select id="booking-payment" name="paymentStatus" defaultValue="unpaid"><option value="unpaid">Belum dibayar</option><option value="paid">Lunas</option></select></div>
            {role === "owner_admin" ? <>
              <div className="form-divider" />
              <div className="form-field"><label htmlFor="booking-cost">Harga modal · Rp</label><input key={`cost-${experienceId}`} id="booking-cost" name="costPrice" type="number" min="0" step="1" defaultValue={currentPrice?.baseCostPrice ?? ""} placeholder="Harga default" /><small className="form-help">Owner/Admin saja. Dibiarkan kosong untuk memakai harga pengalaman.</small></div>
              <div className="form-field"><label htmlFor="booking-sale">Harga jual · Rp</label><input key={`sale-${experienceId}`} id="booking-sale" name="salePrice" type="number" step="1" defaultValue={currentPrice?.salePrice ?? ""} placeholder="Harga default" /><small className="form-help">{currentPrice ? `Harga default: ${formatRupiah(currentPrice.salePrice)}.` : "Belum ada harga default untuk pengalaman ini."}</small></div>
            </> : <div className="form-field full-width"><div className="read-only-price"><small>Harga jual</small><strong>{currentPrice ? formatRupiah(currentPrice.salePrice) : "Belum diatur"}</strong></div><small className="form-help">Harga jual tersedia untuk staf operasional; harga modal dan margin hanya terlihat oleh Owner/Admin.</small></div>}
          </div>
          <div className="form-actions"><button className="button button-primary" type="submit" disabled={pending}>{pending ? "Menyimpan…" : "Buat booking"}</button></div>
          {state.message && <p className={`form-message ${state.status === "error" ? "is-error" : "is-success"}`} role="status">{state.message}</p>}
        </form>
      )}
    </section>
  );
}
