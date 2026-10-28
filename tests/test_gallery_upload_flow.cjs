const assert = require('assert');

const BASE_URL = 'http://localhost:3000';

async function runTest() {
  console.log('================================================================');
  console.log('   TEST ALUR UPLOAD & PENYIMPANAN GALERI FOTO WEDDING STUDIO    ');
  console.log('================================================================');

  // 1. Periksa status sistem & storage provider
  const statusRes = await fetch(`${BASE_URL}/api/system/status`);
  const statusData = await statusRes.json();
  console.log('[1/5] Status Sistem:', {
    db: statusData.database?.provider,
    storage: statusData.storage?.provider,
  });
  assert(statusRes.status === 200, 'Endpoint status harus 200 OK');
  assert(statusData.storage?.provider === 'supabase_storage', 'Harus menggunakan supabase_storage');

  // 2. Login / Register user uji coba
  const testEmail = `gallery_test_${Date.now()}@example.com`;
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: 'Password123!',
      full_name: 'Tester Galeri',
    }),
  });
  assert(regRes.status === 201, 'Registrasi user gagal');
  const regData = await regRes.json();
  const token = regData.token;
  console.log('[2/5] Registrasi User Berhasil. User ID:', regData.user.id);

  // Buat wedding baru
  const createWeddingRes = await fetch(`${BASE_URL}/api/weddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: 'Pernikahan Uji Galeri',
    }),
  });
  assert(createWeddingRes.status === 201, 'Gagal membuat undangan pernikahan');
  const weddingData = (await createWeddingRes.json()).wedding;
  const weddingId = weddingData.id;
  console.log('[2/5] Undangan berhasil dibuat. ID:', weddingId);

  // 3. Uji Upload Foto ke /api/media/upload
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const genuinePngBuffer = Buffer.from([
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

  const testFilename = 'foto_prewedding_pantai.png';
  const captionExpected = 'foto_prewedding_pantai';

  const multipartBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${testFilename}"\r\nContent-Type: image/png\r\n\r\n`),
    genuinePngBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const uploadRes = await fetch(`${BASE_URL}/api/media/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  const uploadJson = await uploadRes.json();
  console.log('[3/5] Respons Upload:', {
    status: uploadRes.status,
    url: uploadJson.url,
    filename: uploadJson.filename,
  });

  assert(uploadRes.status === 201, 'Upload harus menghasilkan HTTP 201');
  assert(uploadJson.url, 'Respons upload harus memiliki field url');
  assert(uploadJson.url.includes('/wedding-photos/'), 'URL foto harus tersimpan di bucket wedding-photos');
  assert(!uploadJson.url.includes('/wedding-media/'), 'URL foto TIDAK boleh memakai bucket wedding-media');

  // Periksa bahwa URL publik dapat diakses
  const checkUrlRes = await fetch(uploadJson.url);
  assert(checkUrlRes.status === 200, 'URL gambar Supabase harus dapat diakses (HTTP 200)');
  console.log('[3/5] Verifikasi URL Publik: HTTP 200 OK');

  // 4. Uji Penolakan File Ilegal / Format Salah
  const badBoundary = '----BadBoundary' + Math.random().toString(36).substring(2);
  const badBody = Buffer.concat([
    Buffer.from(`--${badBoundary}\r\nContent-Disposition: form-data; name="file"; filename="script.png"\r\nContent-Type: image/png\r\n\r\n`),
    Buffer.from('<script>alert("fake")</script>'),
    Buffer.from(`\r\n--${badBoundary}--\r\n`),
  ]);

  const badUploadRes = await fetch(`${BASE_URL}/api/media/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${badBoundary}`,
    },
    body: badBody,
  });
  const badUploadJson = await badUploadRes.json();
  assert(badUploadRes.status === 400, 'File tidak valid harus ditolak (HTTP 400)');
  assert(badUploadJson.error, 'Pesan error harus dikembalikan');
  console.log('[4/5] Uji Penolakan File Ilegal: Berhasil ditolak dengan error:', badUploadJson.error);

  // 5. Simpan ke database melalui updateWedding dan simulasi muat ulang halaman (GET)
  const newGalleryItem = {
    id: `g_${Date.now()}`,
    url: uploadJson.url, // (1) URL publik diisi ke field url
    caption: captionExpected, // (2) nama file ke keterangan/caption
  };

  const updateRes = await fetch(`${BASE_URL}/api/weddings/${weddingId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      gallery_photos: [newGalleryItem],
    }),
  });
  assert(updateRes.status === 200, 'Gagal update galeri wedding');

  // Simulasi muat ulang halaman (GET /api/weddings/:id)
  const getWeddingRes = await fetch(`${BASE_URL}/api/weddings/${weddingId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const getWeddingJson = await getWeddingRes.json();
  const reloadedGallery = getWeddingJson.wedding.gallery_photos;

  console.log('[5/5] Data Galeri Pasca-Muat Ulang:', reloadedGallery);
  assert(Array.isArray(reloadedGallery), 'gallery_photos harus berupa array');
  assert(reloadedGallery.length === 1, 'Harus ada 1 foto di galeri');
  assert(reloadedGallery[0].url === uploadJson.url, 'Field url harus berisi URL publik Supabase');
  assert(reloadedGallery[0].caption === captionExpected, 'Field caption harus berisi nama file tanpa ekstensi');

  console.log('\n================================================================');
  console.log('✅ SEMUA 5 TAHAP PENGUJIAN GALERI FOTO BERHASIL 100%!');
  console.log('================================================================\n');
}

runTest().catch((err) => {
  console.error('\n❌ PENGUJIAN GAGAL:', err);
  process.exit(1);
});
