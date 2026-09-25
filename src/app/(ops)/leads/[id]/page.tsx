import { notFound } from "next/navigation";
import { LeadDetail } from "@/components/LeadDetail";
import { requireStaff } from "@/lib/auth";
import { getBookingForLead, getLead, getLeadActivity } from "@/lib/data";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, staff] = await Promise.all([params, requireStaff()]);
  const [lead, activity, booking] = await Promise.all([
    getLead(id),
    getLeadActivity(id),
    getBookingForLead(id, staff.role),
  ]);
  if (!lead) notFound();
  return <LeadDetail lead={lead} activity={activity} booking={booking} role={staff.role} />;
}
