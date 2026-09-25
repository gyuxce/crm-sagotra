import { LeadBoard } from "@/components/LeadBoard";
import { ManualLeadForm } from "@/components/ManualLeadForm";
import { requireStaff } from "@/lib/auth";
import { getExperienceOptions, getLeads } from "@/lib/data";

export default async function LeadsPage() {
  await requireStaff();
  const [leads, experiences] = await Promise.all([getLeads(), getExperienceOptions()]);

  return (
    <div className="page-stack">
      <div className="page-heading"><div><span className="eyebrow">CUSTOMER RELATIONSHIP</span><h1>Pipeline lead</h1><p>Geser kartu ke tahap berikutnya atau gunakan pilihan status.</p></div><span className="role-chip">{leads.length} lead</span></div>
      <ManualLeadForm experiences={experiences} />
      {leads.length === 0 ? <section className="content-card empty-state"><span className="empty-symbol" aria-hidden="true">·</span><h3>Pipeline masih kosong</h3><p>Tambahkan lead langsung atau tunggu inquiry dari situs.</p></section> : <LeadBoard initialLeads={leads} />}
    </div>
  );
}
