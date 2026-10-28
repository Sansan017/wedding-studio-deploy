import React, { useState } from 'react';
import {
  Heart,
  Sparkles,
  ArrowRight,
  Check,
  Globe,
  Share2,
  Users,
  Smartphone,
  ShieldCheck,
  Database,
  Music,
  Eye,
} from 'lucide-react';
import { THEME_PRESETS, ThemeId } from '../../types/wedding';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
  onViewDemo: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onGetStarted,
  onLogin,
  onViewDemo,
}) => {
  const [selectedThemeTab, setSelectedThemeTab] = useState<ThemeId>('minimalist-ivory');
  const [showDocsModal, setShowDocsModal] = useState(false);

  const bannerImg = '/src/assets/images/wedding_banner_floral_1792819792887.jpg';
  const coupleImg = '/src/assets/images/wedding_couple_portrait_1792819792980.jpg';

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-slate-800 font-sans selection:bg-amber-200">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP BAR CONTRACT (Zone 1 - Zone 2 - Zone 3) */}
      {/* ------------------------------------------------------------- */}
      <header className="bg-white/80 backdrop-blur-md border-b border-stone-200 sticky top-0 z-40 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-8 max-w-full">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
          <Heart size={18} className="fill-amber-600 text-amber-600 shrink-0" />
          <span className="font-bold text-base sm:text-lg tracking-tight text-neutral-900 font-serif truncate">
            <span className="inline sm:hidden">Wedding Studio</span>
            <span className="hidden sm:inline">Wedding Studio Free</span>
          </span>
        </div>

        {/* Zone 2: 4-5 single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-600">
          <a href="#fitur" className="hover:text-neutral-900 transition-colors whitespace-nowrap shrink-0">
            Fitur Utama
          </a>
          <a href="#tema" className="hover:text-neutral-900 transition-colors whitespace-nowrap shrink-0">
            6 Tema Mewah
          </a>
          <a href="#rsvp" className="hover:text-neutral-900 transition-colors whitespace-nowrap shrink-0">
            RSVP & WhatsApp
          </a>
          <button
            onClick={() => setShowDocsModal(true)}
            className="hover:text-neutral-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer text-left"
          >
            Database & Setup
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <button
            onClick={onLogin}
            className="text-xs font-semibold text-neutral-700 hover:text-neutral-900 px-2 sm:px-3 py-1.5 sm:py-2 cursor-pointer"
          >
            Masuk
          </button>
          <button
            onClick={onGetStarted}
            className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-all shadow-xs cursor-pointer whitespace-nowrap shrink-0"
          >
            <span className="inline sm:hidden">Daftar</span>
            <span className="hidden sm:inline">Mulai Buat Gratis</span>
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. HERO SECTION */}
      {/* ------------------------------------------------------------- */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-16 lg:pt-20 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100/70 border border-amber-200/60 text-xs font-medium text-amber-900">
              <Sparkles size={13} className="text-amber-700" />
              <span>Platform Undangan Pernikahan Digital 100% Gratis</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-serif text-neutral-900 leading-[1.15] tracking-tight">
              Kirim Kabar Bahagia dengan Undangan Mewah & Tanpa Coding.
            </h1>

            <p className="text-sm sm:text-base text-neutral-600 leading-relaxed max-w-xl">
              Ciptakan website undangan pernikahan digital yang estetik, responsif, dan siap dibagikan ke WhatsApp tamu. Dilengkapi konfirmasi kehadiran (RSVP), amplop digital, musik instrumen romantis, dan peta lokasi interaktif.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <button
                onClick={onGetStarted}
                className="px-6 py-3.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer"
              >
                <span>Mulai Buat Undangan Sekarang</span>
                <ArrowRight size={16} />
              </button>

              <button
                onClick={onViewDemo}
                className="px-5 py-3.5 bg-white border border-stone-300 hover:bg-stone-50 text-neutral-800 rounded-xl text-xs sm:text-sm font-medium flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <Eye size={16} />
                <span>Lihat Contoh Undangan</span>
              </button>
            </div>

            <div className="pt-4 flex items-center gap-6 text-xs text-neutral-500">
              <div className="flex items-center gap-1.5">
                <Check size={14} className="text-emerald-600" />
                <span>Paket Free Tersedia</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check size={14} className="text-emerald-600" />
                <span>Tanpa Iklan Mengganggu</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check size={14} className="text-emerald-600" />
                <span>Desain Responsif HP & Laptop</span>
              </div>
            </div>
          </div>

          {/* Hero Visual Showcase */}
          <div className="relative mx-auto max-w-md lg:max-w-none">
            <div className="relative z-10 rounded-2xl overflow-hidden shadow-2xl border-4 border-white bg-white">
              <img
                src={coupleImg}
                alt="Contoh Undangan Wedding Studio"
                className="w-full h-80 sm:h-96 object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="p-6 bg-white space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span className="font-semibold text-amber-800">Raden & Annisa</span>
                  <span>12 Desember 2026</span>
                </div>
                <h3 className="font-serif text-xl font-bold text-neutral-900">
                  The Wedding Celebration of Raden & Annisa
                </h3>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Menyatukan dua hati dalam ikatan suci pernikahan. Dilengkapi konfirmasi kehadiran online & buku tamu.
                </p>
              </div>
            </div>

            {/* Floating feature pill */}
            <div className="absolute -bottom-4 -left-4 z-20 bg-white p-3.5 rounded-xl shadow-xl border border-stone-200 hidden sm:flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Share2 size={18} />
              </div>
              <div className="text-left text-xs">
                <div className="font-bold text-neutral-900">WhatsApp Generator</div>
                <div className="text-[11px] text-neutral-500">Kirim dengan nama tamu otomatis</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 3. FEATURE HIGHLIGHTS */}
      {/* ------------------------------------------------------------- */}
      <section id="fitur" className="bg-white py-16 border-y border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs uppercase tracking-widest text-amber-700 font-semibold">
              Fitur Terlengkap
            </span>
            <h2 className="text-3xl font-bold font-serif text-neutral-900">
              Semua Kebutuhan Undangan Digital dalam Satu Platform
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600">
              Dirancang untuk kemudahan calon pengantin tanpa perlu repot dengan keahlian teknis.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'Editor Live Dua Area',
                desc: 'Lihat perubahan teks, tema, dan urutan bagian secara langsung pada layar ponsel simulasi seketika.',
                icon: Smartphone,
              },
              {
                title: 'Buku Tamu & RSVP Real-time',
                desc: 'Tamu dapat mengonfirmasi kehadiran serta menuliskan doa restu. Pantau jumlah tamu dan ekspor CSV dari dashboard.',
                icon: Users,
              },
              {
                title: 'Amplop Digital & Kado Fisik',
                desc: 'Sediakan rekening BCA, Mandiri, BSI dengan tombol salin otomatis 1-klik, serta alamat pengiriman kado.',
                icon: Heart,
              },
              {
                title: 'Musik Latar Romantis',
                desc: 'Alunan instrumen piano klasik lembut bawaan yang berputar otomatis saat tamu membuka amplop undangan.',
                icon: Music,
              },
              {
                title: 'Generator Teks WhatsApp',
                desc: 'Format pesan undangan formal atau santai dengan nama tamu personal yang langsung membuka aplikasi WhatsApp.',
                icon: Share2,
              },
              {
                title: 'Keamanan Data & Privasi (RLS)',
                desc: 'Proyek undangan dilindungi otorisasi pengguna. Hanya Anda yang dapat mengedit atau menghapus data proyek Anda.',
                icon: ShieldCheck,
              },
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="p-6 rounded-2xl border border-stone-200/80 bg-[#FAF8F5]/60 hover:bg-[#FAF8F5] transition-all space-y-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                    <Icon size={20} />
                  </div>
                  <h3 className="font-bold text-base text-neutral-900">{f.title}</h3>
                  <p className="text-xs text-neutral-600 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 4. THEME SHOWCASE SECTION */}
      {/* ------------------------------------------------------------- */}
      <section id="tema" className="py-16 max-w-6xl mx-auto px-4 sm:px-6 space-y-10">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <span className="text-xs uppercase tracking-widest text-amber-700 font-semibold">
            Pilihan Desain
          </span>
          <h2 className="text-3xl font-bold font-serif text-neutral-900">
            6 Tema Mewah dengan Karakter Visual Unik
          </h2>
          <p className="text-xs sm:text-sm text-neutral-600">
            Setiap tema dilengkapi harmoni warna, komposisi tipografi serif/sans yang proporsional, dan ornamen eksklusif.
          </p>
        </div>

        {/* Theme tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {(Object.keys(THEME_PRESETS) as ThemeId[]).map((tId) => {
            const p = THEME_PRESETS[tId];
            return (
              <button
                key={tId}
                onClick={() => setSelectedThemeTab(tId)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  selectedThemeTab === tId
                    ? 'bg-neutral-900 text-white shadow-sm'
                    : 'bg-white border border-stone-200 text-neutral-600 hover:bg-stone-50'
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>

        {/* Theme Detail Showcase Card */}
        {(() => {
          const currentPreset = THEME_PRESETS[selectedThemeTab];
          return (
            <div
              className="p-8 sm:p-12 rounded-3xl border shadow-lg max-w-3xl mx-auto text-center space-y-6 transition-all"
              style={{
                backgroundColor: currentPreset.colors.background,
                borderColor: `${currentPreset.colors.secondary}50`,
                color: currentPreset.colors.text,
              }}
            >
              <div className="w-12 h-1 mx-auto rounded-full" style={{ backgroundColor: currentPreset.colors.primary }} />

              <span className="text-xs uppercase tracking-[0.25em] font-medium opacity-75">
                Tema: {currentPreset.name} ({currentPreset.badge})
              </span>

              <h3
                className="text-3xl sm:text-4xl font-bold font-serif"
                style={{ color: currentPreset.colors.primary }}
              >
                Raden Febrian & Annisa Putri
              </h3>

              <p className="text-xs sm:text-sm max-w-md mx-auto opacity-80 leading-relaxed italic">
                "{currentPreset.description}"
              </p>

              {/* Color swatches */}
              <div className="flex items-center justify-center gap-3 pt-2">
                {[
                  currentPreset.colors.background,
                  currentPreset.colors.primary,
                  currentPreset.colors.secondary,
                  currentPreset.colors.accent,
                ].map((c, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1">
                    <div
                      className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: c }}
                    />
                    <span className="font-mono text-[10px] opacity-60 uppercase">{c}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <button
                  onClick={onGetStarted}
                  className="px-6 py-2.5 rounded-xl font-medium text-xs shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer text-white"
                  style={{ backgroundColor: currentPreset.colors.primary }}
                >
                  Gunakan Tema Ini Gratis
                </button>
              </div>
            </div>
          );
        })()}
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 5. DATABASE & SETUP MODAL */}
      {/* ------------------------------------------------------------- */}
      {showDocsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database size={18} className="text-amber-700" />
                <h3 className="font-bold text-sm text-neutral-900">Arsitektur & Panduan Setup Supabase / PostgreSQL</h3>
              </div>
              <button
                onClick={() => setShowDocsModal(false)}
                className="text-neutral-400 hover:text-neutral-700 text-xs font-semibold"
              >
                Tutup
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-neutral-700 leading-relaxed">
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200">
                <strong>Status Saat Ini:</strong> Server full-stack Express berjalan dengan database relasional SQLite ACID aktif (`data/production_wedding_studio.sqlite3`) dengan mode WAL dan penegakan foreign keys. Anda dapat langsung mendaftar, mengunggah foto, dan mempublikasikan undangan tanpa memerlukan konfigurasi Supabase eksternal!
              </div>

              <h4 className="font-bold text-neutral-900 text-sm">Integrasi Supabase (PostgreSQL & RLS)</h4>
              <p>
                File migrasi lengkap dengan skema tabel (<code className="bg-stone-100 px-1 py-0.5 rounded">profiles</code>, <code className="bg-stone-100 px-1 py-0.5 rounded">weddings</code>, <code className="bg-stone-100 px-1 py-0.5 rounded">rsvps</code>, <code className="bg-stone-100 px-1 py-0.5 rounded">guest_messages</code>) dan kebijakan Row Level Security (RLS) tersedia di:
              </p>
              <pre className="p-3 bg-stone-900 text-amber-300 rounded-xl font-mono text-[11px] overflow-x-auto">
                /supabase/migrations/001_initial_schema.sql
              </pre>

              <h4 className="font-bold text-neutral-900 text-sm">Variabel Lingkungan (Environment Variables)</h4>
              <p>Tambahkan variabel berikut pada file <code className="bg-stone-100 px-1 py-0.5 rounded">.env</code> untuk mengaktifkan koneksi Supabase langsung:</p>
              <pre className="p-3 bg-stone-900 text-stone-200 rounded-xl font-mono text-[11px]">
{`VITE_SUPABASE_URL="https://YOUR_PROJECT_ID.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOi..."`}
              </pre>

              <h4 className="font-bold text-neutral-900 text-sm">Kebijakan Row Level Security (RLS)</h4>
              <ul className="list-disc pl-5 space-y-1 text-neutral-600">
                <li>Pengguna hanya dapat membaca, mengubah, dan menghapus proyek pernikahan miliknya sendiri.</li>
                <li>Halaman publik (<code className="bg-stone-100 px-1 py-0.5 rounded">/u/:slug</code>) hanya dapat diakses oleh umum jika status <code className="bg-stone-100 px-1 py-0.5 rounded">is_published = true</code>.</li>
                <li>Tamu umum dapat mengirimkan konfirmasi kehadiran (RSVP) tanpa perlu mendaftar akun.</li>
                <li>Hanya pemilik undangan yang dapat melihat rekapitulasi data kehadiran tamu.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. FOOTER */}
      {/* ------------------------------------------------------------- */}
      <footer className="bg-white border-t border-stone-200 py-10 text-xs text-neutral-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Heart size={16} className="text-amber-600 fill-amber-600" />
            <span className="font-bold text-neutral-800">Wedding Studio Free</span>
            <span>— Platform Pembuat Undangan Pernikahan Digital Otomatis.</span>
          </div>

          <div className="flex items-center gap-4 text-neutral-600">
            <button onClick={() => setShowDocsModal(true)} className="hover:underline cursor-pointer">
              Setup Database
            </button>
            <span>·</span>
            <button onClick={onLogin} className="hover:underline cursor-pointer">
              Login Pengguna
            </button>
            <span>·</span>
            <span>© 2026 Wedding Studio Free</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
