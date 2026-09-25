import { MissingExperiences, PricingManager } from "@/components/PricingManager";
import { requireOwner } from "@/lib/auth";
import { getExperienceOptions, getPricing, getUnmatchedSanityExperiences } from "@/lib/data";

export default async function PricingPage() {
  await requireOwner();
  const [experiences, pricing, missingFromCrm] = await Promise.all([
    getExperienceOptions(),
    getPricing(),
    getUnmatchedSanityExperiences(),
  ]);

  return (
    <div className="page-stack">
      <div className="page-heading"><div><span className="eyebrow">OWNER / ADMIN</span><h1>Harga pengalaman</h1><p>Harga modal dan markup tersimpan di database CRM; harga jual dihitung otomatis.</p></div></div>
      {missingFromCrm.length > 0 && (
        <section className="content-card missing-experiences-card">
          <div className="section-heading"><div><span className="eyebrow">PERIKSA SLUG</span><h2>Pengalaman di Sanity belum ada di CRM</h2><p>Harga jual hanya tampil di website kalau slug di CRM sama persis dengan slug di Sanity. Tambahkan yang berikut supaya tidak terlewat.</p></div></div>
          <MissingExperiences items={missingFromCrm} />
        </section>
      )}
      <section className="content-card"><div className="section-heading"><div><span className="eyebrow">ATURAN HARGA</span><h2>Pengalaman SAGOTRA</h2><p>Harga jual = harga modal × (1 + markup). Hasil dibulatkan ke rupiah terdekat.</p></div></div><PricingManager experiences={experiences} pricing={pricing} /></section>
      <p className="privacy-note"><span className="privacy-lock" aria-hidden="true">•</span> Harga modal dan markup tetap internal; hanya harga jual yang dipublikasikan ke website dan terlihat oleh staf operasional.</p>
    </div>
  );
}

