import { AppShell } from "@/components/AppShell";
import { requireStaff } from "@/lib/auth";

export default async function OpsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const staff = await requireStaff();
  return <AppShell staff={staff}>{children}</AppShell>;
}
