const assert = require('assert');

const BASE_URL = 'http://localhost:3000';
const CLOUD_RUN_DEV_URL = 'https://ais-dev-k3e332jyesdkykimbnexr5-415559490732.asia-east1.run.app';
const CLOUD_RUN_PRE_URL = 'https://ais-pre-k3e332jyesdkykimbnexr5-415559490732.asia-east1.run.app';

async function runFinalProductReadinessAudit() {
  console.log('================================================================');
  console.log('   AUDIT KESIAPAN PRODUK FINAL & VERIFIKASI WEDDING STUDIO FREE ');
  console.log('================================================================\n');

  const report = {
    passed: [],
    failed: [],
    prerequisitesOrRestricted: [],
    blockingIssues: [],
  };

  // -------------------------------------------------------------
  // PILAR 1: AUTENTIKASI, SESI, DAN KEAMANAN AKUN
  // -------------------------------------------------------------
  console.log('--- [PILAR 1] PENGUJIAN AUTENTIKASI DAN SESI ---');
  try {
    const emailA = `audit_owner_${Date.now()}@weddingstudio.test`;
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailA, password: 'StrongPassword123!', full_name: 'Budi Santoso' }),
    });
    assert(regRes.status === 201, 'Registrasi harus HTTP 201');
    const { token: tokenA, user: userA } = await regRes.json();
    assert(tokenA && tokenA.length === 64, 'Token harus 256-bit hexadecimal string');
    assert(userA.email === emailA, 'Email user harus cocok');

    // Login ulang
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailA, password: 'StrongPassword123!' }),
    });
    assert(loginRes.status === 200, 'Login harus HTTP 200');

    // Validasi sesi aktif
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(meRes.status === 200, 'GET /api/auth/me harus HTTP 200');

    report.passed.push('Autentikasi (Registrasi, Login, Validasi Sesi Bearer)');
    console.log('  ✓ [LULUS] Autentikasi dan token sesi 256-bit berfungsi sempurna.');

    // -------------------------------------------------------------
    // PILAR 2: PEMBUATAN, PENGEDITAN, DAN PERSISTENSI UNDANGAN
    // -------------------------------------------------------------
    console.log('\n--- [PILAR 2] PENGUJIAN PEMBUATAN & PENGEDITAN UNDANGAN ---');
    const slugA = `pernikahan-budi-siti-${Date.now().toString(36)}`;
    const createRes = await fetch(`${BASE_URL}/api/weddings`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Pernikahan Budi & Siti',
        slug: slugA,
        theme_id: 'minimalist-sage',
        is_published: true,
      }),
    });
    assert(createRes.status === 201, 'Pembuatan wedding harus HTTP 201');
    const { wedding: weddingA } = await createRes.json();
    assert(weddingA.id && weddingA.slug === slugA, 'ID dan slug harus terbentuk');

    // Edit detail undangan (Groom, Bride, Event, Story)
    const updatePayload = {
      groom: { ...weddingA.groom, name: 'Budi Santoso, S.Kom.', nickname: 'Budi' },
      bride: { ...weddingA.bride, name: 'Siti Aminah, S.Pd.', nickname: 'Siti' },
      events: [
        {
          id: 'ev_akad',
          title: 'Akad Nikah',
          date: '2026-12-20',
          start_time: '08:00',
          end_time: '10:00',
          location_name: 'Masjid Raya Al-Ikhlas',
          address: 'Jl. Melati No. 12, Bandung',
          maps_url: 'https://maps.app.goo.gl/sample',
        },
      ],
      love_stories: [
        { id: 'ls_1', year: '2022', title: 'Pertemuan Pertama', description: 'Bertemu di perpustakaan kampus.' },
      ],
    };

    const updateRes = await fetch(`${BASE_URL}/api/weddings/${weddingA.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload),
    });
    assert(updateRes.status === 200, 'Update wedding harus HTTP 200');

    // Reload dan verifikasi konsistensi data
    const reloadRes = await fetch(`${BASE_URL}/api/weddings/${weddingA.id}`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(reloadRes.status === 200, 'Reload wedding harus HTTP 200');
    const reloaded = (await reloadRes.json()).wedding;
    assert(reloaded.groom.name === 'Budi Santoso, S.Kom.', 'Data mempelai pria harus cocok');
    assert(reloaded.bride.name === 'Siti Aminah, S.Pd.', 'Data mempelai wanita harus cocok');
    assert(reloaded.events.length === 1 && reloaded.events[0].title === 'Akad Nikah', 'Acara harus persisten');
    assert(reloaded.love_stories.length === 1, 'Love story harus persisten');

    report.passed.push('Pembuatan, Pengeditan & Persistensi Data Undangan (PostgreSQL Cloud)');
    console.log('  ✓ [LULUS] Data undangan berhasil disimpan dan dimuat ulang tanpa cacat.');

    // -------------------------------------------------------------
    // PILAR 3: UPLOAD FOTO, SUPABASE STORAGE & PENGELOLAAN GALERI
    // -------------------------------------------------------------
    console.log('\n--- [PILAR 3] PENGUJIAN UPLOAD FOTO & INTEGRITAS BUCKET SUPABASE ---');
    // Uji 1: Penolakan berkas palsu
    const badBoundary = '----BadBoundary' + Math.random().toString(36).substring(2);
    const fakePayload = Buffer.concat([
      Buffer.from(`--${badBoundary}\r\nContent-Disposition: form-data; name="file"; filename="virus.png"\r\nContent-Type: image/png\r\n\r\n`),
      Buffer.from('<?php echo "evil"; ?>'),
      Buffer.from(`\r\n--${badBoundary}--\r\n`),
    ]);
    const badUploadRes = await fetch(`${BASE_URL}/api/media/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': `multipart/form-data; boundary=${badBoundary}` },
      body: fakePayload,
    });
    assert(badUploadRes.status === 400, 'Berkas palsu harus ditolak HTTP 400');
    console.log('  ✓ [LULUS] Berkas palsu ditolak oleh validasi signature file kriptografis.');

    // Uji 2: Upload gambar PNG valid
    const genuineBoundary = '----GenBoundary' + Math.random().toString(36).substring(2);
    const genuinePng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82,
    ]);
    const uploadPayload = Buffer.concat([
      Buffer.from(`--${genuineBoundary}\r\nContent-Disposition: form-data; name="file"; filename="prewedding_budi_siti.png"\r\nContent-Type: image/png\r\n\r\n`),
      genuinePng,
      Buffer.from(`\r\n--${genuineBoundary}--\r\n`),
    ]);
    const uploadRes = await fetch(`${BASE_URL}/api/media/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': `multipart/form-data; boundary=${genuineBoundary}` },
      body: uploadPayload,
    });
    assert(uploadRes.status === 201, 'Upload foto valid harus HTTP 201');
    const uploadData = await uploadRes.json();
    assert(uploadData.url && uploadData.url.startsWith('https://'), 'URL publik harus HTTPS');
    assert(uploadData.url.includes('/wedding-photos/'), 'Wajib memakai bucket wedding-photos');
    assert(!uploadData.url.includes('/wedding-media/'), 'Tidak boleh memakai fallback wedding-media');
    console.log('  ✓ [LULUS] Upload foto berhasil ke bucket tunggal wedding-photos.');

    // Uji 3: Akses langsung URL CDN foto
    const cdnRes = await fetch(uploadData.url);
    assert(cdnRes.status === 200, 'Foto harus dapat diakses publik via CDN (HTTP 200)');
    assert(cdnRes.headers.get('content-type')?.includes('image/png'), 'Content-type harus image/png');
    console.log('  ✓ [LULUS] URL CDN foto publik aktif dan dapat dimuat oleh tag <img> browser.');

    // Uji 4: Tambahkan foto ke galeri undangan dan simpan
    const galleryPhoto = {
      id: `g_${Date.now()}`,
      url: uploadData.url,
      caption: 'prewedding_budi_siti',
    };
    const saveGalleryRes = await fetch(`${BASE_URL}/api/weddings/${weddingA.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ gallery_photos: [galleryPhoto] }),
    });
    assert(saveGalleryRes.status === 200, 'Simpan galeri harus HTTP 200');

    // Uji 5: Muat ulang galeri
    const checkGalleryRes = await fetch(`${BASE_URL}/api/weddings/${weddingA.id}`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const checkWedding = (await checkGalleryRes.json()).wedding;
    assert(checkWedding.gallery_photos && checkWedding.gallery_photos.length === 1, 'Galeri harus berisi 1 foto');
    assert(checkWedding.gallery_photos[0].url === uploadData.url, 'URL galeri harus cocok');
    assert(checkWedding.gallery_photos[0].caption === 'prewedding_budi_siti', 'Caption harus cocok');

    report.passed.push('Upload Media & Pengelolaan Galeri Foto (Supabase Storage wedding-photos)');
    console.log('  ✓ [LULUS] Galeri foto terhubung persisten dengan URL CDN Supabase.');

    // -------------------------------------------------------------
    // PILAR 4: HALAMAN PUBLIK TAMU & INTERAKSI (RSVP & BUKU TAMU)
    // -------------------------------------------------------------
    console.log('\n--- [PILAR 4] PENGUJIAN HALAMAN PUBLIK TAMU & RSVP ---');
    // Tamu membuka undangan publik tanpa login
    const publicRes = await fetch(`${BASE_URL}/api/public/weddings/${slugA}`);
    assert(publicRes.status === 200, 'GET undangan publik harus HTTP 200 tanpa login');
    const publicWedding = (await publicRes.json()).wedding;
    assert(publicWedding.title === 'Pernikahan Budi & Siti', 'Judul publik harus cocok');
    assert(publicWedding.gallery_photos.length === 1, 'Foto galeri harus tampil di halaman tamu');
    assert(publicWedding.owner_id === undefined, 'Field owner_id TIDAK boleh bocor ke publik');
    assert(publicWedding.password_hash === undefined, 'Password hash TIDAK boleh bocor ke publik');
    console.log('  ✓ [LULUS] Undangan publik dapat dibuka tamu tanpa login dengan perlindungan privasi.');

    // Tamu mengirimkan RSVP & ucapan doa
    const rsvpRes = await fetch(`${BASE_URL}/api/public/weddings/${slugA}/rsvp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guest_name: 'Bpk. Ahmad Subarjo & Keluarga',
        attendance: 'hadir',
        pax_count: 2,
        message: 'Selamat berbahagia, semoga langgeng sampai anak cucu!',
        relationship: 'Keluarga Mempelai Pria',
      }),
    });
    assert(rsvpRes.status === 201, 'Kirim RSVP harus HTTP 201');
    const rsvpData = await rsvpRes.json();
    assert(rsvpData.rsvp && rsvpData.rsvp.guest_name.includes('Ahmad Subarjo'), 'Data tamu harus tersimpan');
    console.log('  ✓ [LULUS] Tamu dapat mengirim RSVP dan ucapan doa tanpa login.');

    // Pemilik memeriksa daftar RSVP tamu
    const ownerRsvpRes = await fetch(`${BASE_URL}/api/weddings/${weddingA.id}/rsvps`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(ownerRsvpRes.status === 200, 'Pemilik dapat melihat RSVP');
    const { rsvps } = await ownerRsvpRes.json();
    assert(rsvps && rsvps.length >= 1, 'RSVP tamu harus muncul di dashboard pemilik');
    console.log('  ✓ [LULUS] Pemilik dapat mengelola dan memantau konfirmasi kehadiran tamu.');

    report.passed.push('Halaman Publik Tamu & Interaksi RSVP/Ucapan');

    // -------------------------------------------------------------
    // PILAR 5: BATASAN PAKET FREE & OTORISASI MULTI-USER (ANTI-IDOR)
    // -------------------------------------------------------------
    console.log('\n--- [PILAR 5] PENGUJIAN BATASAN PAKET FREE & ANTI-IDOR ---');
    // User B mencoba mengakses/mengubah undangan User A
    const emailB = `audit_attacker_${Date.now()}@weddingstudio.test`;
    const regBRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailB, password: 'StrongPassword123!', full_name: 'Attacker' }),
    });
    const { token: tokenB } = await regBRes.json();

    const idorGetRes = await fetch(`${BASE_URL}/api/weddings/${weddingA.id}`, {
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    assert(idorGetRes.status === 403, 'Akses lintas akun harus ditolak HTTP 403 (IDOR Protection)');

    const idorPutRes = await fetch(`${BASE_URL}/api/weddings/${weddingA.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hacked Title' }),
    });
    assert(idorPutRes.status === 403, 'Ubah lintas akun harus ditolak HTTP 403');

    const idorDelRes = await fetch(`${BASE_URL}/api/weddings/${weddingA.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    assert(idorDelRes.status === 403, 'Hapus lintas akun harus ditolak HTTP 403');
    console.log('  ✓ [LULUS] Seluruh endpoint manajemen terlindungi Anti-IDOR.');

    // Batasan paket Free: Undangan kedua otomatis jadi draf
    const createBRes = await fetch(`${BASE_URL}/api/weddings`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Undangan Kedua Budi', is_published: true }),
    });
    assert(createBRes.status === 201, 'Pembuatan undangan kedua harus berhasil sebagai draf');
    const { wedding: weddingB } = await createBRes.json();
    assert(weddingB.is_published === false || weddingB.is_published === 0, 'Undangan kedua otomatis menjadi draf');

    // Mencoba mempublikasikan undangan kedua saat undangan pertama masih aktif harus ditolak HTTP 400
    const publishBRes = await fetch(`${BASE_URL}/api/weddings/${weddingB.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: true }),
    });
    assert(publishBRes.status === 400, 'Publikasi undangan kedua harus ditolak HTTP 400 pada paket Free');
    console.log('  ✓ [LULUS] Kuota paket Free (tepat 1 undangan terpublikasi) ditegakkan.');

    report.passed.push('Otorisasi Multi-User (Anti-IDOR) & Batasan Paket Free');

    // -------------------------------------------------------------
    // PILAR 6: RUTE 404 API & SPA FALLBACK SHIELD
    // -------------------------------------------------------------
    console.log('\n--- [PILAR 6] PENGUJIAN PENYARINGAN RUTE API & SPA FALLBACK ---');
    const rootApiRes = await fetch(`${BASE_URL}/api`);
    assert(rootApiRes.status === 404 && rootApiRes.headers.get('content-type')?.includes('application/json'), 'Rute /api harus JSON 404');

    const unknownApiRes = await fetch(`${BASE_URL}/api/random-nonexistent-path`);
    assert(unknownApiRes.status === 404 && unknownApiRes.headers.get('content-type')?.includes('application/json'), 'Rute /api/* tak dikenal harus JSON 404');
    console.log('  ✓ [LULUS] Seluruh panggilan API tak dikenal dilindungi JSON 404 murni (tidak pernah mengembalikan HTML 200).');

    report.passed.push('Shield Rute API JSON 404 & SPA Fallback');

  } catch (err) {
    console.error('AUDIT ERROR:', err);
    report.failed.push(`Kegagalan Audit: ${err.message}`);
  }

  // -------------------------------------------------------------
  // PILAR 7: STATUS CLOUD RUN DEPLOYMENT EKSTERNAL
  // -------------------------------------------------------------
  console.log('\n--- [PILAR 7] PROBING STATUS LIVE CLOUD RUN HOSTING ---');
  try {
    const devProbe = await fetch(CLOUD_RUN_DEV_URL, { redirect: 'manual' });
    console.log('  Development URL Status:', devProbe.status, devProbe.headers.get('location') || '');
    
    const preProbe = await fetch(CLOUD_RUN_PRE_URL, { redirect: 'manual' });
    console.log('  Shared App URL Status:', preProbe.status, preProbe.headers.get('location') || '');

    if (devProbe.status === 302 && (devProbe.headers.get('location') || '').includes('cookie_check')) {
      report.prerequisitesOrRestricted.push(
        'Akses Cloud Run eksternal (cURL/CLI tanpa browser) dibatasi oleh Google Frontend AI Studio Iframe Authentication Bridge (HTTP 302). Akses harus dilakukan melalui sesi browser yang login dengan akun revanfebrian016@gmail.com.'
      );
    }
  } catch (probeErr) {
    report.prerequisitesOrRestricted.push(`Probing Cloud Run: ${probeErr.message}`);
  }

  console.log('\n================================================================');
  console.log(`HASIL AKHIR AUDIT: ${report.passed.length} PILAR LULUS, ${report.failed.length} GAGAL`);
  console.log('================================================================\n');

  return report;
}

runFinalProductReadinessAudit().then((r) => {
  if (r.failed.length > 0) {
    process.exit(1);
  }
});
