const assert = require('assert');

const BASE_URL = 'http://localhost:3000';

async function runUploadHtmlDiagnosisTest() {
  console.log('================================================================');
  console.log('   PENGUJIAN SPESIFIK AKAR MASALAH UPLOAD & RESPONS NON-JSON    ');
  console.log('================================================================\n');

  // Test 1: Verifikasi /api mengembalikan JSON 404 (BUKAN index.html status 200)
  console.log('[Uji 1] Memeriksa bahwa permintaan ke /api mengembalikan JSON 404...');
  const apiRootRes = await fetch(`${BASE_URL}/api`);
  const apiRootContentType = apiRootRes.headers.get('content-type') || '';
  const apiRootText = await apiRootRes.text();
  console.log('  Status:', apiRootRes.status);
  console.log('  Content-Type:', apiRootContentType);
  assert(apiRootRes.status === 404, 'Rute /api harus mengembalikan HTTP 404');
  assert(apiRootContentType.includes('application/json'), 'Rute /api harus mengembalikan format JSON, bukan HTML');
  assert(!apiRootText.includes('<!doctype') && !apiRootText.includes('<html'), 'Rute /api TIDAK boleh mengembalikan dokumen HTML');
  console.log('  ✓ [LULUS] Rute /api terlindungi dari fallback SPA HTML.\n');

  // Test 2: Verifikasi /api/rute-tak-dikenal mengembalikan JSON 404
  console.log('[Uji 2] Memeriksa bahwa endpoint tak dikenal mengembalikan JSON 404...');
  const unknownApiRes = await fetch(`${BASE_URL}/api/endpoint-tak-ada`);
  const unknownApiContentType = unknownApiRes.headers.get('content-type') || '';
  const unknownApiJson = await unknownApiRes.json();
  console.log('  Status:', unknownApiRes.status);
  console.log('  Pesan Error:', unknownApiJson.error);
  assert(unknownApiRes.status === 404, 'Endpoint tak dikenal harus HTTP 404');
  assert(unknownApiContentType.includes('application/json'), 'Harus berformat JSON');
  assert(unknownApiJson.error && unknownApiJson.error.includes('tidak ditemukan'), 'Harus menyertakan pesan error jelas');
  console.log('  ✓ [LULUS] Endpoint tak dikenal selalu mengembalikan JSON 404.\n');

  // Test 3: Verifikasi POST /api/media/upload tanpa token mengembalikan JSON 401
  console.log('[Uji 3] Memeriksa bahwa POST /api/media/upload tanpa token mengembalikan JSON 401...');
  const unauthUploadRes = await fetch(`${BASE_URL}/api/media/upload`, {
    method: 'POST',
  });
  const unauthUploadContentType = unauthUploadRes.headers.get('content-type') || '';
  const unauthUploadJson = await unauthUploadRes.json();
  console.log('  Status:', unauthUploadRes.status);
  console.log('  Pesan Error:', unauthUploadJson.error);
  assert(unauthUploadRes.status === 401, 'Upload tanpa token harus HTTP 401');
  assert(unauthUploadContentType.includes('application/json'), 'Otorisasi gagal harus berformat JSON, bukan HTML');
  assert(unauthUploadJson.error, 'Harus mengembalikan field error');
  console.log('  ✓ [LULUS] Handler upload backend menerima request dan menolak unauth dengan JSON 401.\n');

  // Test 4: Registrasi user dan upload berkas gambar valid ke Supabase Storage
  console.log('[Uji 4] Melakukan upload berkas gambar asli dengan autentikasi...');
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `diagnosis_upload_${Date.now()}@weddingstudio.test`,
      password: 'SafePassword123!',
      full_name: 'Pengantin Uji Diagnosis',
    }),
  });
  assert(regRes.status === 201, 'Registrasi harus 201');
  const { token, user } = await regRes.json();

  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
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

  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="prewedding_pantai.png"\r\nContent-Type: image/png\r\n\r\n`),
    genuinePng,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const uploadRes = await fetch(`${BASE_URL}/api/media/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: payload,
  });

  const uploadContentType = uploadRes.headers.get('content-type') || '';
  const uploadJson = await uploadRes.json();
  console.log('  Status Upload:', uploadRes.status);
  console.log('  Content-Type:', uploadContentType);
  console.log('  URL Gambar Publik:', uploadJson.url);
  console.log('  Filename Tersimpan:', uploadJson.filename);

  assert(uploadRes.status === 201, 'Upload harus mengembalikan HTTP 201 Created');
  assert(uploadContentType.includes('application/json'), 'Respons upload harus format JSON murni');
  assert(uploadJson.url && uploadJson.url.startsWith('https://'), 'URL harus berupa tautan publik HTTPS');
  assert(uploadJson.url.includes('/wedding-photos/'), 'URL harus berasal dari bucket wedding-photos');
  assert(!uploadJson.url.includes('/wedding-media/'), 'URL TIDAK boleh berasal dari fallback wedding-media');
  console.log('  ✓ [LULUS] Berkas tersimpan ke Supabase Storage bucket tunggal wedding-photos.\n');

  // Test 5: Akses langsung ke URL Supabase Storage
  console.log('[Uji 5] Menguji aksesibilitas publik URL gambar di Supabase Storage...');
  const directCdnRes = await fetch(uploadJson.url);
  console.log('  Status GET CDN:', directCdnRes.status);
  console.log('  Content-Type CDN:', directCdnRes.headers.get('content-type'));
  assert(directCdnRes.status === 200, 'Gambar harus dapat diakses publik tanpa login');
  assert(directCdnRes.headers.get('content-type')?.includes('image/png'), 'Content-Type harus image/png');
  console.log('  ✓ [LULUS] URL publik Supabase Storage live dan dapat diakses browser untuk preview.\n');

  // Test 6: Simpan ke galeri undangan dan verifikasi muat ulang (reload)
  console.log('[Uji 6] Menyimpan foto ke galeri undangan dan memverifikasi persistensi...');
  const createWeddingRes = await fetch(`${BASE_URL}/api/weddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: 'Pernikahan Uji Diagnosis',
      slug: `diag-${Date.now().toString(36)}`,
    }),
  });
  const { wedding } = await createWeddingRes.json();

  const galleryItem = {
    id: `g_${Date.now()}`,
    url: uploadJson.url,
    caption: 'prewedding_pantai',
  };

  const updateRes = await fetch(`${BASE_URL}/api/weddings/${wedding.id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      gallery_photos: [galleryItem],
    }),
  });
  assert(updateRes.status === 200, 'Simpan galeri harus HTTP 200');

  // Muat ulang (GET /api/weddings/:id)
  const reloadRes = await fetch(`${BASE_URL}/api/weddings/${wedding.id}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const reloaded = (await reloadRes.json()).wedding;
  console.log('  Foto Galeri Tersimpan Pasca-Muat Ulang:', reloaded.gallery_photos);
  assert(reloaded.gallery_photos && reloaded.gallery_photos.length === 1, 'Harus ada 1 foto di galeri');
  assert(reloaded.gallery_photos[0].url === uploadJson.url, 'URL foto harus cocok persis dengan URL upload');
  assert(reloaded.gallery_photos[0].caption === 'prewedding_pantai', 'Caption harus cocok');
  console.log('  ✓ [LULUS] Data galeri tersimpan di DB relasional dan bertahan setelah muat ulang.\n');

  console.log('================================================================');
  console.log('🎉 SELURUH 6 UJI DIAGNOSIS & INTEGRITAS UPLOAD BERHASIL 100%!   ');
  console.log('================================================================');
}

runUploadHtmlDiagnosisTest().catch((err) => {
  console.error('DIAGNOSIS TEST GAGAL:', err);
  process.exit(1);
});
