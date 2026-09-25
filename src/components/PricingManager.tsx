"use client";

import { useActionState, useState } from "react";
import { createExperienceAction, deleteExperienceAction, savePricingAction, updateExperienceAction, type FormState } from "@/app/actions";
import { calculatePricing, EXPERIENCE_CATEGORIES, formatRupiah, getExperienceCategoryLabel, type ExperienceOption, type ExperiencePricing } from "@/lib/domain";

const initialFormState: FormState = { status: "idle", message: "" };

function CategorySelect({ id, defaultValue }: { id: string; defaultValue?: string }) {
  return (
    <select id={id} name="category" defaultValue={defaultValue ?? ""}>
      <option value="">Belum dikategorikan</option>
      {EXPERIENCE_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
    </select>
  );
}

function AddExperienceForm() {
  const [state, action, pending] = useActionState(createExperienceAction, initialFormState);

  return (
    <form action={action} className="form-grid add-experience-form">
      <div className="form-field"><label htmlFor="new-experience-title">Nama pengalaman baru</label><input id="new-experience-title" name="title" maxLength={200} required /></div>
      <div className="form-field"><label htmlFor="new-experience-slug">Slug (opsional)</label><input id="new-experience-slug" name="slug" maxLength={200} placeholder="dibuat otomatis dari nama" /></div>
      <div className="form-field"><label htmlFor="new-experience-category">Pilar kategori</label><CategorySelect id="new-experience-category" /></div>
      <div className="form-field"><label htmlFor="new-experience-destination">Slug destinasi (opsional)</label><input id="new-experience-destination" name="destinationSlug" maxLength={200} placeholder="sama seperti di Sanity" /></div>
      <div className="form-field"><button className="button button-secondary button-small" type="submit" disabled={pending}>{pending ? "Menambahkan…" : "Tambah pengalaman"}</button></div>
      {state.message && <p className={`form-message ${state.status === "error" ? "is-error" : "is-success"}`} role="status">{state.message}</p>}
    </form>
  );
}

function QuickAddExperienceForm({ experience }: { experience: { slug: string; title: string; category?: string; destinationSlug?: string } }) {
  const [state, action, pending] = useActionState(createExperienceAction, initialFormState);

  return (
    <form action={action} className="quick-add-experience-form">
      <input type="hidden" name="title" value={experience.title} />
      <input type="hidden" name="slug" value={experience.slug} />
      <CategorySelect id={`quick-category-${experience.slug}`} defaultValue={experience.category} />
      <input name="destinationSlug" defaultValue={experience.destinationSlug ?? ""} maxLength={200} placeholder="Slug destinasi" />
      <button className="button button-primary button-small" type="submit" disabled={pending}>{pending ? "Menambahkan…" : "Tambah ke CRM"}</button>
      {state.message && <p className={`form-message ${state.status === "error" ? "is-error" : "is-success"}`} role="status">{state.message}</p>}
    </form>
  );
}

export function MissingExperiences({ items }: { items: { slug: string; title: string; category?: string; destinationSlug?: string }[] }) {
  return (
    <ul className="missing-experiences-list">
      {items.map((experience) => (
        <li key={experience.slug} className="missing-experience-row">
          <div className="missing-experience-info"><strong>{experience.title}</strong><small>{experience.slug}</small></div>
          <QuickAddExperienceForm experience={experience} />
        </li>
      ))}
    </ul>
  );
}

function DeleteExperienceButton({ experienceId, title }: { experienceId: string; title: string }) {
  const [state, action, pending] = useActionState(deleteExperienceAction, initialFormState);
  return (
    <form
      action={action}
      onSubmit={(event) => { if (!confirm(`Hapus pengalaman "${title}" dari CRM? Harga yang tersimpan ikut terhapus.`)) event.preventDefault(); }}
    >
      <input type="hidden" name="experienceId" value={experienceId} />
      <button className="button-link is-danger" type="submit" disabled={pending}>{pending ? "Menghapus…" : "Hapus"}</button>
      {state.message && <p className="form-message is-error" role="alert">{state.message}</p>}
    </form>
  );
}

function EditExperienceForm({ experience }: { experience: ExperienceOption }) {
  const [state, action, pending] = useActionState(updateExperienceAction, initialFormState);
  return (
    <form action={action} className="form-grid edit-experience-form">
      <input type="hidden" name="experienceId" value={experience._id} />
      <div className="form-field"><label htmlFor={`edit-title-${experience._id}`}>Nama</label><input id={`edit-title-${experience._id}`} name="title" maxLength={200} defaultValue={experience.title} required /></div>
      <div className="form-field"><label htmlFor={`edit-slug-${experience._id}`}>Slug</label><input id={`edit-slug-${experience._id}`} name="slug" maxLength={200} defaultValue={experience.slug} required /></div>
      <div className="form-field"><label htmlFor={`edit-category-${experience._id}`}>Pilar kategori</label><CategorySelect id={`edit-category-${experience._id}`} defaultValue={experience.category} /></div>
      <div className="form-field"><label htmlFor={`edit-destination-${experience._id}`}>Slug destinasi</label><input id={`edit-destination-${experience._id}`} name="destinationSlug" maxLength={200} defaultValue={experience.destinationSlug ?? ""} /></div>
      <div className="form-field"><button className="button button-secondary button-small" type="submit" disabled={pending}>{pending ? "Menyimpan…" : "Simpan perubahan"}</button></div>
      {state.message && <p className={`form-message ${state.status === "error" ? "is-error" : "is-success"}`} role="status">{state.message}</p>}
    </form>
  );
}

function PricingRow({ experience, pricing }: { experience: ExperienceOption; pricing?: ExperiencePricing }) {
  const [state, action, pending] = useActionState(savePricingAction, initialFormState);
  const [cost, setCost] = useState(String(pricing?.baseCostPrice ?? ""));
  const [markup, setMarkup] = useState(String(pricing?.markupPercent ?? 10));
  const [editing, setEditing] = useState(false);
  const costNumber = Number(cost);
  const markupNumber = Number(markup);
  const calculated = Number.isFinite(costNumber) && Number.isFinite(markupNumber) && cost !== "" && markup !== ""
    ? calculatePricing(costNumber, markupNumber)
    : null;

  return (
    <div>
      <div className="pricing-row">
        <div className="pricing-experience">
          <strong>{experience.title}</strong>
          <small>{experience.slug}{getExperienceCategoryLabel(experience.category) ? ` · ${getExperienceCategoryLabel(experience.category)}` : ""}</small>
          <div className="pricing-row-actions">
            <button type="button" className="button-link" onClick={() => setEditing((value) => !value)}>{editing ? "Batal edit" : "Edit"}</button>
            <DeleteExperienceButton experienceId={experience._id} title={experience.title} />
          </div>
        </div>
        {/* display:contents so these fields participate directly in .pricing-row's grid, without nesting a <form> inside another <form>. */}
        <form action={action} className="pricing-save-fields">
          <input type="hidden" name="experienceId" value={experience._id} />
          <input type="hidden" name="experienceSlug" value={experience.slug} />
          <input type="hidden" name="experienceTitle" value={experience.title} />
          <div className="form-field"><label htmlFor={`cost-${experience._id}`}>Harga modal · Rp</label><input id={`cost-${experience._id}`} name="baseCostPrice" type="number" min="0" step="1" value={cost} onChange={(event) => setCost(event.target.value)} required /></div>
          <div className="form-field"><label htmlFor={`markup-${experience._id}`}>Markup · %</label><input id={`markup-${experience._id}`} name="markupPercent" type="number" min="0" max="1000" step="0.1" value={markup} onChange={(event) => setMarkup(event.target.value)} required /></div>
          <div className="form-field"><span className="form-help">Harga jual otomatis</span><div className="calculated-price">{calculated ? formatRupiah(calculated.salePrice) : "Masukkan harga"}</div></div>
          <button className="button button-primary button-small pricing-save-button" type="submit" disabled={pending}>{pending ? "Menyimpan…" : "Simpan harga"}</button>
          {state.message && <p className={`form-message ${state.status === "error" ? "is-error" : "is-success"}`} role="status">{state.message}</p>}
        </form>
      </div>
      {editing && <EditExperienceForm experience={experience} />}
    </div>
  );
}

export function PricingManager({ experiences, pricing }: { experiences: ExperienceOption[]; pricing: ExperiencePricing[] }) {
  const pricingById = new Map(pricing.map((item) => [item.experienceId, item]));

  return (
    <div className="pricing-manager">
      <AddExperienceForm />
      {experiences.length === 0 ? (
        <div className="empty-state"><span className="empty-symbol" aria-hidden="true">·</span><h3>Pengalaman belum tersedia</h3><p>Tambahkan pengalaman baru di atas untuk mulai mengatur harga.</p></div>
      ) : (
        <div className="pricing-list">{experiences.map((experience) => <PricingRow key={experience._id} experience={experience} pricing={pricingById.get(experience._id)} />)}</div>
      )}
    </div>
  );
}
