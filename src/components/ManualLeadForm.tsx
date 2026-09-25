"use client";

import { useActionState, useState } from "react";
import { createManualLeadAction, type FormState } from "@/app/actions";
import type { ExperienceOption } from "@/lib/domain";

const initialState: FormState = { status: "idle", message: "" };

export function ManualLeadForm({ experiences }: { experiences: ExperienceOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createManualLeadAction, initialState);

  return (
    <section className="content-card manual-lead-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">CATAT LEAD DI CRM</span>
          <h2>Lead dari telepon, event, atau walk-in</h2>
          <p>Catat pelanggan langsung di CRM tanpa menunggu inquiry dari situs.</p>
        </div>
        <button className="button button-primary button-small" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? "Tutup form" : "Tambah lead manual"}
        </button>
      </div>
      {open && (
        <form action={action} className="manual-lead-form">
          <div className="form-grid">
            <div className="form-field"><label htmlFor="manual-lead-name">Nama</label><input id="manual-lead-name" name="name" maxLength={120} autoComplete="name" /></div>
            <div className="form-field"><label htmlFor="manual-lead-phone">Nomor telepon / WhatsApp</label><input id="manual-lead-phone" name="phone" maxLength={40} autoComplete="tel" /></div>
            <div className="form-field"><label htmlFor="manual-lead-email">Email</label><input id="manual-lead-email" name="email" type="email" maxLength={254} autoComplete="email" /></div>
            <div className="form-field"><label htmlFor="manual-lead-experience">Pengalaman (opsional)</label><select id="manual-lead-experience" name="experienceId" defaultValue=""><option value="">Belum dipilih</option>{experiences.map((experience) => <option key={experience._id} value={experience._id}>{experience.title}</option>)}</select></div>
            <div className="form-field"><label htmlFor="manual-lead-date">Tanggal minat (opsional)</label><input id="manual-lead-date" name="preferredDate" type="date" /></div>
            <div className="form-field"><label htmlFor="manual-lead-group">Jumlah rombongan (opsional)</label><input id="manual-lead-group" name="groupSize" type="number" min="1" step="1" /></div>
            <div className="form-field full-width"><label htmlFor="manual-lead-message">Catatan</label><textarea id="manual-lead-message" name="message" maxLength={4000} rows={3} /></div>
          </div>
          <div className="form-actions"><button className="button button-primary button-small" type="submit" disabled={pending}>{pending ? "Menyimpan…" : "Simpan lead"}</button></div>
          {state.message && <p className={`form-message ${state.status === "error" ? "is-error" : "is-success"}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
        </form>
      )}
    </section>
  );
}
