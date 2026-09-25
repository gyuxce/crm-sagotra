import { SignInForm } from "@/components/SignInForm";
import { isSupabaseConfigured } from "@/lib/supabase/server";


export default function SignInPage() {
  return (
    <main className="auth-page">
      <section className="auth-aside">
        <div className="brand-lockup auth-brand"><span className="brand-mark">S</span><span><strong>SAGOTRA</strong><small>OPS DESK</small></span></div>
        <div className="auth-message"><span className="eyebrow">INTERNAL OPERATIONS</span><h1>Satu tempat untuk setiap perjalanan.</h1><p>Kelola lead, booking, dan kerja sama partner SAGOTRA dengan lebih teratur.</p></div>
        <small className="auth-footnote">Akses khusus staf SAGOTRA.</small>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-mobile-title"><span className="brand-mark">S</span><strong>SAGOTRA Ops</strong></div>
        {isSupabaseConfigured ? (
          <div className="auth-form-card"><span className="eyebrow">SELAMAT DATANG</span><h2>Masuk ke dashboard</h2><p>Gunakan akun staf SAGOTRA yang telah dibuat di Supabase.</p><SignInForm /></div>
        ) : (
          <div className="auth-form-card setup-notice" role="status"><span className="eyebrow">KONFIGURASI DIBUTUHKAN</span><h2>Dashboard belum terhubung.</h2><p>Isi <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, dan <code>SUPABASE_SERVICE_ROLE_KEY</code> di environment server. CRM tetap terkunci sampai konfigurasi lengkap.</p></div>
        )}
      </section>
    </main>
  );
}
