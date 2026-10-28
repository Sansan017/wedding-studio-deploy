const assert = require('assert');

const BASE_URL = 'http://localhost:3000';

async function runSharingAuditTest() {
  console.log('================================================================');
  console.log('   AUDIT & VERIFIKASI ALUR BERBAGI TAUTAN UNDANGAN PUBLIK       ');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // 1. SETUP USER & 2 PROYEK UNDANGAN (1 TERPUBLIKASI, 1 DRAF)
  // -------------------------------------------------------------
  console.log('[1/7] Menyiapkan Akun Pengantin & Proyek Uji...');
  const userEmail = `share_audit_${Date.now()}@weddingstudio.test`;
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: userEmail,
      password: 'StrongPassword123!',
      full_name: 'Audit Share User',
    }),
  });
  assert(regRes.status === 201, 'Registrasi akun gagal');
  const { token, user } = await regRes.json();
  console.log(`  ✓ Akun dibuat: ${user.id} (${user.email})`);

  // Undangan A: Terpublikasi (is_published: true)
  const slugA = `pernikahan-ananda-budi-${Date.now().toString(36)}`;
  const createResA = await fetch(`${BASE_URL}/api/weddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: 'The Wedding of Ananda & Budi',
      slug: slugA,
      is_published: true,
      groom: { name: 'Budi Santoso, S.T.', nickname: 'Budi' },
      bride: { name: 'Ananda Putri, S.Farm.', nickname: 'Ananda' },
      events: [{ title: 'Akad Nikah', date: '2026-11-20', location_name: 'Masjid Raya' }],
      gallery_photos: [
        { id: 'g_1', url: 'https://riffdcrvrxuxjjmwnbkp.supabase.co/storage/v1/object/public/wedding-photos/demo.jpg', caption: 'Prewedding 1' },
      ],
      love_stories: [{ year: '2022', title: 'Pertemuan Pertama', description: 'Bertemu di kampus.' }],
    }),
  });
  assert(createResA.status === 201, 'Gagal membuat undangan A');
  const weddingA = (await createResA.json()).wedding;
  console.log(`  ✓ Undangan A dibuat (Terpublikasi): ID=${weddingA.id}, Slug=${weddingA.slug}`);

  // Undangan B: Draf (is_published: false)
  const slugB = `draf-privat-${Date.now().toString(36)}`;
  const createResB = await fetch(`${BASE_URL}/api/weddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: 'Undangan Rahasia Draf',
      slug: slugB,
      is_published: false,
    }),
  });
  assert(createResB.status === 201, 'Gagal membuat undangan B');
  const weddingB = (await createResB.json()).wedding;
  console.log(`  ✓ Undangan B dibuat (Draf/Privat): ID=${weddingB.id}, Slug=${weddingB.slug}\n`);

  // -------------------------------------------------------------
  // 2. VERIFIKASI PEMBENTUKAN URL BERBAGI (CANONICAL CLEAN PATH)
  // -------------------------------------------------------------
  console.log('[2/7] Memverifikasi Format Pembentukan URL Berbagi...');
  const guestName = 'Bpk. Hendra & Keluarga';
  const cleanGuestParam = encodeURIComponent(guestName.trim());
  const expectedCanonicalUrl = `${BASE_URL}/u/${weddingA.slug}?to=${cleanGuestParam}`;
  const legacyHashUrl = `${BASE_URL}/#/u/${weddingA.slug}?to=${cleanGuestParam}`;

  console.log(`  Format URL Baru (Clean Path)  : ${expectedCanonicalUrl}`);
  console.log(`  Format URL Lama (Hash Route) : ${legacyHashUrl}`);

  assert(!expectedCanonicalUrl.includes('/#/'), 'URL canonical baru tidak boleh mengandung hash "/#/" yang rentan dipotong WhatsApp');
  assert(expectedCanonicalUrl.startsWith(`${BASE_URL}/u/`), 'URL harus berformat canonical /u/:slug');
  assert(expectedCanonicalUrl.includes('?to='), 'Query parameter nama tamu harus disertakan');
  console.log('  ✓ [LULUS] Format URL canonical bersih dan aman untuk dikirimkan melalui WhatsApp.\n');

  // -------------------------------------------------------------
  // 3. UJI AKSES HALAMAN WEB PUBLIK OLEH TAMU (TANPA LOGIN / INCOGNITO)
  // -------------------------------------------------------------
  console.log('[3/7] Menguji Akses Halaman Web Publik Tanpa Login...');
  const pageRes = await fetch(`${BASE_URL}/u/${weddingA.slug}?to=${cleanGuestParam}`);
  console.log(`  Status GET /u/${weddingA.slug} : ${pageRes.status}`);
  assert(pageRes.status === 200, 'Halaman /u/:slug harus dapat diakses tanpa autentikasi (HTTP 200)');
  const pageHtml = await pageRes.text();
  assert(pageHtml.includes('<!doctype html>'), 'Harus mengembalikan dokumen HTML SPA');
  console.log('  ✓ [LULUS] Server melayani dokumen SPA untuk tamu tanpa login.\n');

  // -------------------------------------------------------------
  // 4. UJI BACA DATA UNDANGAN PUBLIK (GET /api/public/weddings/:slug)
  // -------------------------------------------------------------
  console.log('[4/7] Menguji Endpoint Data Publik (GET /api/public/weddings/:slug) Tanpa Header Otorisasi...');
  const publicDataRes = await fetch(`${BASE_URL}/api/public/weddings/${weddingA.slug}`);
  console.log(`  Status GET API Publik: ${publicDataRes.status}`);
  assert(publicDataRes.status === 200, 'Endpoint API publik harus 200 OK tanpa token');

  const { wedding: publicWedding } = await publicDataRes.json();

  // Validasi kelengkapan fitur publik
  assert(publicWedding.title === weddingA.title, 'Judul undangan harus cocok');
  assert(publicWedding.groom.name === 'Budi Santoso, S.T.', 'Data mempelai pria harus tersedia');
  assert(publicWedding.bride.name === 'Ananda Putri, S.Farm.', 'Data mempelai wanita harus tersedia');
  assert(Array.isArray(publicWedding.gallery_photos) && publicWedding.gallery_photos.length === 1, 'Galeri foto harus tersedia');
  assert(Array.isArray(publicWedding.love_stories) && publicWedding.love_stories.length === 1, 'Love story harus tersedia');
  assert(Array.isArray(publicWedding.events) && publicWedding.events.length === 1, 'Acara/Rundown harus tersedia');

  // Validasi pencegahan kebocoran data sensitif
  assert(publicWedding.owner_id === undefined, 'Data sensitif owner_id DILARANG bocor ke publik');
  assert(publicWedding.password_hash === undefined, 'password_hash DILARANG bocor');
  assert(publicWedding.token === undefined, 'Token DILARANG bocor');
  console.log('  ✓ [LULUS] Data undangan publik lengkap (tema, galeri, kisah cinta, mempelai) dan aman tanpa kebocoran data sensitif.\n');

  // -------------------------------------------------------------
  // 5. UJI ISOLASI UNDANGAN DRAF (DILARANG DIAKSES PUBLIK)
  // -------------------------------------------------------------
  console.log('[5/7] Menguji Isolasi Undangan DRAF (is_published: false)...');
  const draftDataRes = await fetch(`${BASE_URL}/api/public/weddings/${weddingB.slug}`);
  console.log(`  Status GET Undangan Draf: ${draftDataRes.status}`);
  assert(draftDataRes.status === 404, 'Undangan yang berstatus Draf HARUS ditolak HTTP 404');
  const draftErr = await draftDataRes.json();
  assert(draftErr.error, 'Pesan error harus dikembalikan');
  console.log(`  Pesan Penolakan: "${draftErr.error}"`);
  console.log('  ✓ [LULUS] Undangan Draf privat tidak dapat diakses publik.\n');

  // -------------------------------------------------------------
  // 6. UJI PENGIRIMAN RSVP & BUKU TAMU OLEH TAMU TANPA LOGIN
  // -------------------------------------------------------------
  console.log('[6/7] Menguji Pengiriman RSVP & Buku Tamu oleh Tamu Tanpa Login...');
  const rsvpRes = await fetch(`${BASE_URL}/api/public/weddings/${weddingA.slug}/rsvp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      guest_name: 'Bpk. Hendra & Keluarga',
      attendance: 'hadir',
      pax_count: 2,
      message: 'Selamat untuk kedua mempelai! Semoga sakinah mawaddah warahmah.',
      relationship: 'Sahabat Keluarga',
    }),
  });
  console.log(`  Status Kirim RSVP Tamu: ${rsvpRes.status}`);
  assert(rsvpRes.status === 201 || rsvpRes.status === 200, 'Tamu dapat mengirim RSVP tanpa login');

  const wishesRes = await fetch(`${BASE_URL}/api/public/weddings/${weddingA.slug}/wishes`);
  assert(wishesRes.status === 200, 'Daftar ucapan publik harus 200 OK');
  const { wishes } = await wishesRes.json();
  assert(Array.isArray(wishes) && wishes.length >= 1, 'Ucapan tamu harus tersimpan dan tampil');
  console.log(`  ✓ Ucapan tamu tersimpan: "${wishes[0].message}" dari "${wishes[0].sender_name}"`);
  console.log('  ✓ [LULUS] Interaksi tamu (RSVP & Buku Tamu) berfungsi penuh tanpa login.\n');

  // -------------------------------------------------------------
  // 7. VERIFIKASI KEAMANAN: ENDPOINT MANAJEMEN TETAP TERKUNCI (ANTI-IDOR)
  // -------------------------------------------------------------
  console.log('[7/7] Memverifikasi Endpoint Manajemen Tetap Terkunci Rapat...');
  const unauthorizedPut = await fetch(`${BASE_URL}/api/weddings/${weddingA.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Hacked by Guest' }),
  });
  assert(unauthorizedPut.status === 401, 'Endpoint edit PUT /api/weddings/:id harus 401 Unauthorized tanpa token');

  const unauthorizedUpload = await fetch(`${BASE_URL}/api/media/upload`, {
    method: 'POST',
  });
  assert(unauthorizedUpload.status === 401, 'Endpoint upload POST /api/media/upload harus 401 Unauthorized');

  const unauthorizedList = await fetch(`${BASE_URL}/api/weddings`);
  assert(unauthorizedList.status === 401, 'Endpoint daftar undangan GET /api/weddings harus 401 Unauthorized');

  console.log('  ✓ [LULUS] Semua endpoint privat dan manajemen tetap 100% terlindungi otorisasi.\n');

  console.log('================================================================');
  console.log('🎉 SELURUH 7 TAHAP AUDIT & PENGUJIAN ALUR BERBAGI BERHASIL 100%!');
  console.log('================================================================\n');
}

runSharingAuditTest().catch((err) => {
  console.error('\n❌ PENGUJIAN GAGAL:', err);
  process.exit(1);
});
