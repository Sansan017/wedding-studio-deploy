const assert = require('assert');

const BASE_URL = 'http://localhost:3000';

async function runComprehensiveVerification() {
  console.log('================================================================');
  console.log('   VERIFIKASI REAL PENYELESAIAN BUG GALERI WEDDING STUDIO       ');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // TAHAP 1: Verifikasi CORS Preflight (Solusi Akar Masalah Failed to Fetch)
  // -------------------------------------------------------------
  console.log('[Tahap 1] Menguji CORS Preflight OPTIONS pada endpoint API...');
  const preflightRes = await fetch(`${BASE_URL}/api/weddings/test-cors-id`, {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://ais-pre-preview.cloudworkstations.dev',
      'Access-Control-Request-Method': 'PUT',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  });
  console.log('  Status Preflight:', preflightRes.status);
  console.log('  Access-Control-Allow-Origin:', preflightRes.headers.get('access-control-allow-origin'));
  console.log('  Access-Control-Allow-Headers:', preflightRes.headers.get('access-control-allow-headers'));
  assert(preflightRes.status === 204, 'Preflight OPTIONS harus mengembalikan 204 No Content');
  assert(
    preflightRes.headers.get('access-control-allow-origin') === 'https://ais-pre-preview.cloudworkstations.dev',
    'Preflight harus menyertakan Access-Control-Allow-Origin yang cocok dengan origin klien'
  );
  console.log('  ✓ [LULUS] Preflight CORS berfungsi sempurna, mencegah "Failed to fetch" di browser.\n');

  // -------------------------------------------------------------
  // TAHAP 2: Registrasi & Pembuatan Undangan Pengujian
  // -------------------------------------------------------------
  console.log('[Tahap 2] Melakukan autentikasi dan pembuatan proyek undangan...');
  const userEmail = `gallery_verified_${Date.now()}@weddingstudio.test`;
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: userEmail,
      password: 'SafePassword123!',
      full_name: 'Pengantin Verifikasi',
    }),
  });
  assert(regRes.status === 201, 'Registrasi harus HTTP 201');
  const { token, user } = await regRes.json();

  const createRes = await fetch(`${BASE_URL}/api/weddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: 'Pernikahan Denny & Clara',
      slug: `denny-clara-${Date.now().toString(36)}`,
      is_published: true,
    }),
  });
  assert(createRes.status === 201, 'Pembuatan wedding harus HTTP 201');
  const { wedding } = await createRes.json();
  const weddingId = wedding.id;
  const weddingSlug = wedding.slug;
  console.log(`  ✓ [LULUS] Akun ${user.id} & Undangan ${weddingId} (${weddingSlug}) berhasil dibuat.\n`);

  // -------------------------------------------------------------
  // TAHAP 3: Uji Upload File Palsu (Harus Ditolak dengan Error Jelas)
  // -------------------------------------------------------------
  console.log('[Tahap 3] Menguji penolakan berkas palsu/kamuflase (script bertopeng PNG)...');
  const badBoundary = '----BadBoundary' + Math.random().toString(36).substring(2);
  const fakePngPayload = Buffer.concat([
    Buffer.from(`--${badBoundary}\r\nContent-Disposition: form-data; name="file"; filename="hacker.png"\r\nContent-Type: image/png\r\n\r\n`),
    Buffer.from('<script>evilCode()</script>'),
    Buffer.from(`\r\n--${badBoundary}--\r\n`),
  ]);

  const badUploadRes = await fetch(`${BASE_URL}/api/media/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${badBoundary}`,
    },
    body: fakePngPayload,
  });
  const badUploadData = await badUploadRes.json();
  console.log('  Status Upload Palsu:', badUploadRes.status);
  console.log('  Pesan Error:', badUploadData.error);
  assert(badUploadRes.status === 400, 'Berkas palsu harus ditolak HTTP 400');
  assert(badUploadData.error && badUploadData.error.includes('ditolak'), 'Harus menampilkan alasan penolakan');
  console.log('  ✓ [LULUS] Berkas palsu ditolak oleh validasi signature file kriptografis.\n');

  // -------------------------------------------------------------
  // TAHAP 4: Uji Upload Gambar Valid ke Supabase Storage
  // -------------------------------------------------------------
  console.log('[Tahap 4] Menguji upload foto valid (PNG 1x1 asli) ke bucket SUPABASE_MEDIA_BUCKET...');
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

  const testFileName = 'prewedding_denny_clara.png';
  const expectedCaption = 'prewedding_denny_clara';
  const goodBoundary = '----GoodBoundary' + Math.random().toString(36).substring(2);
  const goodMultipart = Buffer.concat([
    Buffer.from(`--${goodBoundary}\r\nContent-Disposition: form-data; name="file"; filename="${testFileName}"\r\nContent-Type: image/png\r\n\r\n`),
    genuinePng,
    Buffer.from(`\r\n--${goodBoundary}--\r\n`),
  ]);

  const uploadRes = await fetch(`${BASE_URL}/api/media/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${goodBoundary}`,
    },
    body: goodMultipart,
  });

  const uploadData = await uploadRes.json();
  console.log('  Status Upload:', uploadRes.status);
  console.log('  URL Publik:', uploadData.url);
  console.log('  Filename Tersimpan:', uploadData.filename);
  assert(uploadRes.status === 201, 'Upload berhasil harus HTTP 201');
  assert(typeof uploadData.url === 'string' && uploadData.url.startsWith('http'), 'URL publik harus string http valid');
  assert(uploadData.url.includes('/wedding-photos/'), 'URL foto harus berada di bucket "wedding-photos"');
  assert(!uploadData.url.includes('/wedding-media/'), 'URL foto DILARANG keras memakai fallback ke wedding-media');
  console.log('  ✓ [LULUS] Berkas tersimpan ke Supabase Storage bucket wedding-photos dan mengembalikan URL publik valid.\n');

  // -------------------------------------------------------------
  // TAHAP 5: Uji Akses Publik Langsung ke URL Foto
  // -------------------------------------------------------------
  console.log('[Tahap 5] Menguji akses HTTP GET langsung ke URL foto Supabase Storage...');
  const directGetRes = await fetch(uploadData.url);
  console.log('  Status Akses Langsung URL:', directGetRes.status);
  console.log('  Content-Type Gambar:', directGetRes.headers.get('content-type'));
  assert(directGetRes.status === 200, 'URL publik gambar harus dapat diakses bebas tanpa otorisasi (HTTP 200)');
  console.log('  ✓ [LULUS] URL foto Supabase Storage dapat diakses secara publik dan siap tampil di preview browser.\n');

  // -------------------------------------------------------------
  // TAHAP 6: Uji Simpan Undangan dengan Galeri Foto (PUT /api/weddings/:id)
  // -------------------------------------------------------------
  console.log('[Tahap 6] Menguji penyimpanan undangan dengan foto galeri (PUT /api/weddings/:id)...');
  const newGalleryItem = {
    id: `g_${Date.now()}_test`,
    url: uploadData.url, // URL hasil upload masuk ke field url
    caption: expectedCaption, // Nama file menjadi caption
  };

  const saveRes = await fetch(`${BASE_URL}/api/weddings/${weddingId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Origin': 'https://ais-pre-preview.cloudworkstations.dev',
    },
    body: JSON.stringify({
      ...wedding,
      gallery_photos: [newGalleryItem],
    }),
  });

  console.log('  Status Simpan (PUT):', saveRes.status);
  assert(saveRes.status === 200, 'Simpan undangan harus HTTP 200 OK');
  const savedData = await saveRes.json();
  assert(Array.isArray(savedData.wedding.gallery_photos), 'gallery_photos harus berupa array');
  assert(savedData.wedding.gallery_photos.length === 1, 'Harus ada 1 item foto di galeri');
  assert(savedData.wedding.gallery_photos[0].url === uploadData.url, 'URL foto di galeri harus cocok');
  assert(savedData.wedding.gallery_photos[0].caption === expectedCaption, 'Caption harus sesuai');
  assert(savedData.wedding.title === wedding.title, 'Data judul undangan tidak boleh hilang');
  console.log('  ✓ [LULUS] Undangan dan galeri berhasil disimpan tanpa merusak data lainnya.\n');

  // -------------------------------------------------------------
  // TAHAP 7: Uji Muat Ulang Halaman Editor (GET /api/weddings/:id)
  // -------------------------------------------------------------
  console.log('[Tahap 7] Menguji muat ulang (reload) editor (GET /api/weddings/:id)...');
  const reloadRes = await fetch(`${BASE_URL}/api/weddings/${weddingId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  assert(reloadRes.status === 200, 'Muat ulang editor harus HTTP 200');
  const reloadedData = await reloadRes.json();
  const reloadedItem = reloadedData.wedding.gallery_photos[0];
  console.log('  Foto Tersimpan Pasca-Muat Ulang:', reloadedItem);
  assert(reloadedItem.url === uploadData.url, 'URL foto tetap utuh');
  assert(reloadedItem.caption === expectedCaption, 'Caption foto tetap utuh');
  console.log('  ✓ [LULUS] Data galeri foto bertahan persisten setelah reload.\n');

  // -------------------------------------------------------------
  // TAHAP 8: Uji Tampilan Galeri pada Halaman Undangan Publik (GET /api/public/weddings/:slug)
  // -------------------------------------------------------------
  console.log('[Tahap 8] Menguji tampilan publik undangan tamu (GET /api/public/weddings/:slug)...');
  const publicRes = await fetch(`${BASE_URL}/api/public/weddings/${weddingSlug}`);
  console.log('  Status GET Publik:', publicRes.status);
  assert(publicRes.status === 200, 'Halaman publik harus HTTP 200');
  const publicData = await publicRes.json();
  assert(Array.isArray(publicData.wedding.gallery_photos), 'Publik harus menerima gallery_photos');
  assert(publicData.wedding.gallery_photos.length === 1, 'Publik memiliki 1 foto');
  assert(publicData.wedding.gallery_photos[0].url === uploadData.url, 'URL foto publik cocok');
  assert(!publicData.wedding.owner_id, 'owner_id tidak boleh bocor ke publik');
  console.log('  ✓ [LULUS] Galeri foto tampil di halaman undangan publik tamu.\n');

  console.log('================================================================');
  console.log('🎉 SEMUA 8 TAHAP PENGUJIAN INTEGRITAS GALERI & CORS BERHASIL 100%!');
  console.log('================================================================');
}

runComprehensiveVerification().catch((err) => {
  console.error('\n❌ VERIFIKASI GAGAL:', err);
  process.exit(1);
});
