import Link from "next/link";
import { signOutAction } from "@/app/auth-actions";

export default function AccessDeniedPage() {
  return (
    <main className="auth-page access-page">
      <section className="auth-form-wrap">
        <div className="auth-form-card">
          <span className="eyebrow">AKSES TERBATAS</span>
          <h1>Akun ini belum diizinkan.</h1>
          <p>Akun ini belum memiliki profil staf CRM yang valid. Hubungi Owner/Admin untuk menambahkan akun ke Supabase.</p>
          <div className="access-actions"><form action={signOutAction}><button className="button button-primary" type="submit">Keluar dari akun ini</button></form><Link className="button button-quiet" href="/sign-in">Kembali ke login</Link></div>
        </div>
      </section>
    </main>
  );
}
