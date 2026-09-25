"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/auth-actions";
import type { Staff } from "@/lib/domain";

const navigation = [
  { href: "/", label: "Ringkasan", short: "R" },
  { href: "/leads", label: "Pipeline lead", short: "L" },
  { href: "/bookings", label: "Booking", short: "B" },
] as const;

export function AppShell({ staff, children }: { staff: Staff; children: React.ReactNode }) {
  const pathname = usePathname();
  const items = staff.role === "owner_admin" ? [...navigation, { href: "/pricing", label: "Harga pengalaman", short: "H" }] : navigation;

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link href="/" className="brand-lockup" aria-label="SAGOTRA Ops beranda">
          <span className="brand-mark">S</span>
          <span>
            <strong>SAGOTRA</strong>
            <small>OPS DESK</small>
          </span>
        </Link>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Navigasi utama">
          {items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href} className={`nav-item${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>
                <span className="nav-icon" aria-hidden="true">{item.short}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-note">
          <span className="status-dot" />
          <span><strong>Database aktif</strong><small>Supabase · CRM privat</small></span>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark">S</span><strong>SAGOTRA Ops</strong></div>
          <div className="topbar-spacer" />
          <div className="staff-label"><span className="role-chip">{staff.role === "owner_admin" ? "Owner / Admin" : "Operasional"}</span><span className="staff-name">{staff.name}</span></div>
          <form action={signOutAction}><button className="button button-quiet button-small" type="submit">Keluar</button></form>
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
