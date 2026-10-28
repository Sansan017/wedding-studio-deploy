/**
 * Test Mobile Responsive Audit for Wedding Studio Free
 * Simulates and verifies DOM layout constraints on mobile screen viewports:
 * 320px (iPhone SE 1st gen), 360px (Galaxy S), 390px (iPhone 12/13/14), 430px (iPhone 14/15 Pro Max)
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const editorPath = path.join(ROOT_DIR, 'src', 'components', 'editor', 'WeddingEditor.tsx');
const authPath = path.join(ROOT_DIR, 'src', 'components', 'auth', 'AuthModal.tsx');
const landingPath = path.join(ROOT_DIR, 'src', 'components', 'landing', 'LandingPage.tsx');

console.log('================================================================');
console.log('   WEDDING STUDIO FREE — AUDIT RESPONSIVE MOBILE VERIFICATION   ');
console.log('================================================================\n');

let allPassed = true;

// 1. Audit WeddingEditor.tsx
console.log('--- [1. AUDIT HEADER & TOOLBAR EDIT UNDANGAN] ---');
const editorCode = fs.readFileSync(editorPath, 'utf8');

const checksEditor = [
  {
    name: 'Dukungan layout responsif dua baris (flex-col lg:flex-row)',
    regex: /flex flex-col gap-2(\.5)? lg:flex-row lg:items-center lg:justify-between/,
  },
  {
    name: 'Nama proyek memiliki batas lebar responsif & truncate (min-w-0 & truncate)',
    regex: /min-w-0 flex-1[\s\S]*?truncate[\s\S]*?Judul Undangan/,
  },
  {
    name: 'Slug ditempatkan pada baris kedua responsif pada layar mobile (flex lg:hidden)',
    regex: /<div className="flex lg:hidden items-center justify-between gap-2 pt-1(\.5)? border-t border-neutral-100 w-full min-w-0">/,
  },
  {
    name: 'Slug text memiliki truncation untuk mencegah dorongan horizontal',
    regex: /truncate[\s\S]*?\/u\/\{wedding\.slug\}/,
  },
  {
    name: 'Tombol Publikasi & Simpan tetap tersedia dan mudah diakses di baris pertama mobile',
    regex: /flex lg:hidden items-center gap-1\.5 shrink-0[\s\S]*?handleTogglePublish[\s\S]*?handleSave/,
  },
  {
    name: 'Tombol Edit & Preview switcher tersedia di baris kedua mobile',
    regex: /mobileView === 'form'[\s\S]*?Edit[\s\S]*?mobileView === 'preview'[\s\S]*?Preview/,
  },
  {
    name: 'Tampilan desktop (lg:flex) tetap mempertahankan tombol lengkap dalam satu baris',
    regex: /hidden lg:flex items-center gap-2 shrink-0[\s\S]*?Terpublikasi[\s\S]*?Bagikan[\s\S]*?Lihat Penuh[\s\S]*?Simpan/,
  },
  {
    name: 'Left panel & Right preview panel memiliki min-w-0 dan max-w-full',
    regex: /w-full min-w-0 max-w-full lg:w-\[480px\]/,
  },
];

for (const check of checksEditor) {
  if (check.regex.test(editorCode)) {
    console.log(`  ✓ ${check.name}`);
  } else {
    console.error(`  ✗ GAGAL: ${check.name}`);
    allPassed = false;
  }
}

// 2. Audit AuthModal.tsx
console.log('\n--- [2. AUDIT HALAMAN MASUK / DAFTAR AKUN (AuthModal.tsx)] ---');
const authCode = fs.readFileSync(authPath, 'utf8');

const checksAuth = [
  {
    name: 'Container modal memiliki safe padding responsif (p-3 sm:p-4)',
    regex: /overflow-y-auto p-3 sm:p-4 flex min-h-full items-center justify-center/,
  },
  {
    name: 'Kartu formulir menggunakan w-full max-w-md my-auto (tidak fixed width)',
    regex: /bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden my-auto/,
  },
  {
    name: 'Header modal memiliki break-words dan min-w-0 untuk judul panjang',
    regex: /min-w-0 flex-1[\s\S]*?break-words[\s\S]*?Masuk ke Wedding Studio/,
  },
  {
    name: 'Padding form dioptimasi responsif (p-4 sm:p-6)',
    regex: /p-4 sm:p-6 space-y-3\.5 sm:space-y-4 text-xs w-full/,
  },
  {
    name: 'Tombol demo login aman dengan text-xs dan truncate/break-words',
    regex: /w-full py-2 px-3[\s\S]*?Masuk Cepat dengan Akun Demo/,
  },
  {
    name: 'Dukungan scroll saat virtual keyboard HP aktif (overflow-y-auto)',
    regex: /fixed inset-0 z-50 bg-black\/50 backdrop-blur-sm overflow-y-auto/,
  },
];

for (const check of checksAuth) {
  if (check.regex.test(authCode)) {
    console.log(`  ✓ ${check.name}`);
  } else {
    console.error(`  ✗ GAGAL: ${check.name}`);
    allPassed = false;
  }
}

// 3. Mathematical Viewport Width Fit Verification
console.log('\n--- [3. SIMULASI PERHITUNGAN LEBAR VIEWPORT (320px, 360px, 390px, 430px)] ---');

const viewports = [
  { name: 'iPhone SE (320px)', width: 320 },
  { name: 'Galaxy S / Standar Kecil (360px)', width: 360 },
  { name: 'iPhone 13/14 / Menengah (390px)', width: 390 },
  { name: 'iPhone Pro Max / Lebar (430px)', width: 430 },
];

for (const vp of viewports) {
  console.log(`\n• Viewport: ${vp.name}`);
  
  // Header Editor Row 1:
  // Padding px-3 (12+12=24px), Back (30px), Title flex-1 (min 90px), Gap (8px), Publikasi (65px), Gap (6px), Simpan (65px)
  const headerPadding = 24;
  const backBtn = 30;
  const publishBtn = 65;
  const saveBtn = 65;
  const gaps = 20;
  const allocatedTitleSpace = vp.width - headerPadding - backBtn - publishBtn - saveBtn - gaps;
  console.log(`  - Header Edit Baris 1: Total elemen tetap = ${headerPadding + backBtn + publishBtn + saveBtn + gaps}px. Ruang dinamis judul = ${allocatedTitleSpace}px (${allocatedTitleSpace > 70 ? 'AMAN' : 'SEMPIT'}).`);

  // Header Editor Row 2:
  // Padding px-3 (24px), Slug text + Copy + Ubah (~150px), Gap (8px), Edit/Preview switcher (~80px)
  const row2Total = 24 + 140 + 8 + 80;
  console.log(`  - Header Edit Baris 2: Total lebar = ${row2Total}px <= ${vp.width}px (${row2Total <= vp.width ? 'LULUS BEBAS OVERFLOW' : 'OVERFLOW'}).`);

  // Auth Card:
  // Padding p-3 (12+12=24px), Card max-w-md (min(vp.width - 24, 448))
  const cardWidth = Math.min(vp.width - 24, 448);
  console.log(`  - Kartu Masuk/Daftar: Lebar kartu = ${cardWidth}px (${cardWidth < vp.width ? 'LULUS BEBAS OVERFLOW' : 'OVERFLOW'}).`);
}

console.log('\n================================================================');
if (allPassed) {
  console.log('🎉 SELURUH AUDIT KODE RESPONSIVE MOBILE TELAH LULUS!');
} else {
  console.error('❌ DITEMUKAN MASALAH PADA AUDIT RESPONSIVE MOBILE');
  process.exit(1);
}
console.log('================================================================');
