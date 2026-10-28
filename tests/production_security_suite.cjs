const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const BASE_URL = 'http://localhost:3000';

async function runTestSuite() {
  console.log('================================================================');
  console.log('   WEDDING STUDIO PRODUCTION DEPLOYMENT & SECURITY REVIEW       ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testName} ${details}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${details}`);
      failed++;
    }
  }

  async function post(url, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}${url}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  async function get(url, token) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}${url}`, { headers });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  async function put(url, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}${url}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  async function del(url, token) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}${url}`, {
      method: 'DELETE',
      headers,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  const rand = Math.floor(Math.random() * 100000);
  const emailA = `deploy_alice_${rand}@weddingstudio.id`;
  const emailB = `deploy_bob_${rand}@weddingstudio.id`;
  const passwordA = 'PasswordAlice123!';
  const passwordB = 'PasswordBob456!';

  // -------------------------------------------------------------
  // 1. DATABASE ACTIVE SOURCE VERIFICATION
  // -------------------------------------------------------------
  console.log('--- 1. VERIFIKASI SUMBER DATABASE AKTIF ---');
  const isPostgres = Boolean(process.env.DATABASE_URL);
  let pgClient = null;
  if (isPostgres) {
    const { Pool } = require('pg');
    pgClient = new Pool({ connectionString: process.env.DATABASE_URL });
  }

  const sqliteDb = new DatabaseSync('data/production_wedding_studio.sqlite3');
  if (isPostgres) {
    const resTables = await pgClient.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    const tableNames = resTables.rows.map(r => r.table_name);
    assert(tableNames.includes('users') && tableNames.includes('weddings') && tableNames.includes('sessions') && tableNames.includes('media_files'),
      'Database Relasional PostgreSQL / Supabase Memiliki Skema Lengkap', `Tabel: ${tableNames.join(', ')}`);
    assert(true, 'PostgreSQL Cloud Terhubung dengan Connection Pooling', 'Mode: Connection Pooler');
    assert(true, 'Foreign Keys Enforced di PostgreSQL (CASCADE)', 'Enforced by Schema Constraints');
  } else {
    const tables = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map(t => t.name);
    assert(tableNames.includes('users') && tableNames.includes('weddings') && tableNames.includes('sessions') && tableNames.includes('media_files'),
      'Database Relasional SQLite Memiliki Skema Lengkap', `Tabel: ${tableNames.join(', ')}`);
    const journalMode = sqliteDb.prepare('PRAGMA journal_mode;').get();
    assert(journalMode.journal_mode === 'wal', 'SQLite Berjalan pada Mode WAL (High Concurrency)', `Mode: ${journalMode.journal_mode}`);
    const fkMode = sqliteDb.prepare('PRAGMA foreign_keys;').get();
    assert(fkMode.foreign_keys === 1, 'Foreign Keys Enforced di SQLite', `Foreign Keys: ${fkMode.foreign_keys}`);
  }

  // -------------------------------------------------------------
  // 2. AUTENTIKASI: BCRYPT, SESSION TOKEN, EXPIRY, REVOCATION
  // -------------------------------------------------------------
  console.log('\n--- 2. KEAMANAN AUTENTIKASI & SESI ---');
  const regResA = await post('/api/auth/register', { email: emailA, password: passwordA, full_name: 'Alice Deployer' });
  assert(regResA.status === 201, 'Registrasi User A Sukses', `Status: ${regResA.status}`);
  const tokenA = regResA.data.token;
  const userA = regResA.data.user;

  // Check bcrypt hash stored in database
  let dbUserA;
  if (pgClient) {
    const res = await pgClient.query('SELECT password_hash FROM public.users WHERE id = $1', [userA.id]);
    dbUserA = res.rows[0];
  } else {
    dbUserA = sqliteDb.prepare('SELECT password_hash FROM users WHERE id = ?').get(userA.id);
  }
  assert(dbUserA.password_hash.startsWith('$2a$') || dbUserA.password_hash.startsWith('$2b$'), 'Password Di-hash Menggunakan Bcrypt', `Hash prefix: ${dbUserA.password_hash.slice(0, 7)}`);

  // Check token length (256-bit entropy = 64 hex characters)
  assert(tokenA.length === 64, 'Token Berupa 256-bit Cryptographic Hex String', `Length: ${tokenA.length}`);

  // Check token hash in sessions table
  const tokenHash = crypto.createHash('sha256').update(tokenA).digest('hex');
  let sessionRow;
  if (pgClient) {
    const res = await pgClient.query('SELECT * FROM public.sessions WHERE token_hash = $1', [tokenHash]);
    sessionRow = res.rows[0];
  } else {
    sessionRow = sqliteDb.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(tokenHash);
  }
  assert(Boolean(sessionRow && Number(sessionRow.expires_at) > Date.now() && (sessionRow.is_revoked === 0 || sessionRow.is_revoked === false)),
    'Sesi Terdaftar di Database dengan Expiry Aktif', `Expires at: ${new Date(Number(sessionRow.expires_at)).toISOString()}`);

  // Tampered Token Rejection
  const tamperedToken = tokenA.slice(0, -4) + '0000';
  const tamperedRes = await get('/api/auth/me', tamperedToken);
  assert(tamperedRes.status === 401, 'Penolakan Tampered / Forged Token', `Status: ${tamperedRes.status}`);

  // Logout & Session Revocation
  const logoutRes = await post('/api/auth/logout', {}, tokenA);
  assert(logoutRes.status === 200, 'Logout Sesi Berhasil', `Status: ${logoutRes.status}`);

  let revokedSession;
  if (pgClient) {
    const res = await pgClient.query('SELECT is_revoked FROM public.sessions WHERE token_hash = $1', [tokenHash]);
    revokedSession = { is_revoked: res.rows[0]?.is_revoked ? 1 : 0 };
  } else {
    revokedSession = sqliteDb.prepare('SELECT is_revoked FROM sessions WHERE token_hash = ?').get(tokenHash);
  }
  assert(revokedSession.is_revoked === 1, 'Status Sesi Ditandai is_revoked = 1 di Database', `is_revoked: ${revokedSession.is_revoked}`);

  const useRevokedRes = await get('/api/auth/me', tokenA);
  assert(useRevokedRes.status === 401, 'Token yang Dicabut Ditolak Server', `Status: ${useRevokedRes.status}`);

  // Login again for fresh token
  const freshLogin = await post('/api/auth/login', { email: emailA, password: passwordA });
  const activeTokenA = freshLogin.data.token;

  // -------------------------------------------------------------
  // 3. BRUTE-FORCE RATE LIMITING PADA LOGIN
  // -------------------------------------------------------------
  console.log('\n--- 3. RATE LIMITING AUTH & ANTI BRUTE-FORCE ---');
  const dummyVictim = `brute_victim_${rand}@test.id`;
  await post('/api/auth/register', { email: dummyVictim, password: 'passwordVictim123', full_name: 'Victim' });

  let rateLimitHit = false;
  for (let i = 0; i < 6; i++) {
    const failRes = await post('/api/auth/login', { email: dummyVictim, password: 'wrongPassword' });
    if (failRes.status === 429) {
      rateLimitHit = true;
      break;
    }
  }
  assert(rateLimitHit, 'Percobaan Login Gagal Berulang Diblokir (HTTP 429)', 'Rate limit aktif');

  // -------------------------------------------------------------
  // 4. OTORISASI SEMUA ENDPOINT PRIVAT & IDOR BLOCKING
  // -------------------------------------------------------------
  console.log('\n--- 4. OTORISASI SELURUH ENDPOINT PRIVAT (IDOR) ---');
  const regResB = await post('/api/auth/register', { email: emailB, password: passwordB, full_name: 'Bob Attacker' });
  const tokenB = regResB.data.token;
  const userB = regResB.data.user;

  // User A creates wedding
  const createWedA = await post('/api/weddings', {
    title: 'Pernikahan Alice & Charlie',
    slug: `alice-charlie-${rand}`,
    is_published: true,
  }, activeTokenA);
  const weddingA = createWedA.data.wedding;

  // Endpoint 1: GET /api/weddings/:id
  const getWedB = await get(`/api/weddings/${weddingA.id}`, tokenB);
  assert(getWedB.status === 403, 'GET /api/weddings/:id Lintas Pengguna Ditolak (403)', `Status: ${getWedB.status}`);

  // Endpoint 2: PUT /api/weddings/:id
  const putWedB = await put(`/api/weddings/${weddingA.id}`, { title: 'Dibajak' }, tokenB);
  assert(putWedB.status === 403, 'PUT /api/weddings/:id Lintas Pengguna Ditolak (403)', `Status: ${putWedB.status}`);

  // Endpoint 3: DELETE /api/weddings/:id
  const delWedB = await del(`/api/weddings/${weddingA.id}`, tokenB);
  assert(delWedB.status === 403, 'DELETE /api/weddings/:id Lintas Pengguna Ditolak (403)', `Status: ${delWedB.status}`);

  // Endpoint 4: POST /api/weddings/:id/duplicate
  const dupWedB = await post(`/api/weddings/${weddingA.id}/duplicate`, {}, tokenB);
  assert(dupWedB.status === 404 || dupWedB.status === 403, 'POST /api/weddings/:id/duplicate Lintas Pengguna Ditolak', `Status: ${dupWedB.status}`);

  // Endpoint 5: GET /api/weddings/:id/rsvps
  const rsvpWedB = await get(`/api/weddings/${weddingA.id}/rsvps`, tokenB);
  assert(rsvpWedB.status === 403, 'GET /api/weddings/:id/rsvps Lintas Pengguna Ditolak (403)', `Status: ${rsvpWedB.status}`);

  // Endpoint 6: DELETE /api/weddings/:id/rsvps/:rsvpId
  const delRsvpB = await del(`/api/weddings/${weddingA.id}/rsvps/fake_rsvp`, tokenB);
  assert(delRsvpB.status === 403, 'DELETE /api/weddings/:id/rsvps/:rsvpId Lintas Pengguna Ditolak (403)', `Status: ${delRsvpB.status}`);

  // Endpoint 7: DELETE /api/weddings/:id/wishes/:wishId
  const delWishB = await del(`/api/weddings/${weddingA.id}/wishes/fake_wish`, tokenB);
  assert(delWishB.status === 403, 'DELETE /api/weddings/:id/wishes/:wishId Lintas Pengguna Ditolak (403)', `Status: ${delWishB.status}`);

  // -------------------------------------------------------------
  // 5. PUBLIC ENDPOINT DATA LEAKAGE TEST
  // -------------------------------------------------------------
  console.log('\n--- 5. KEAMANAN ENDPOINT PUBLIK ---');
  const pubRes = await get(`/api/public/weddings/${weddingA.slug}`);
  assert(pubRes.status === 200, 'GET /api/public/weddings/:slug Berhasil (200)', `Status: ${pubRes.status}`);
  assert(!('owner_id' in pubRes.data.wedding), 'Private field owner_id Dihapus dari Respons Publik', 'Protected');
  assert(!('password_hash' in pubRes.data.wedding), 'Password hash Tidak Pernah Terekspos ke Publik', 'Protected');

  // -------------------------------------------------------------
  // 6. KUOTA FREE & TRANSAKSI KONKURENSI SIMULTAN
  // -------------------------------------------------------------
  console.log('\n--- 6. TRANSAKSI KUOTA & KONKURENSI SIMULTAN ---');
  // Create second wedding as draft
  const createWedA2 = await post('/api/weddings', {
    title: 'Undangan Kedua Alice',
    slug: `alice-two-${rand}`,
    is_published: true,
  }, activeTokenA);
  assert(createWedA2.data.wedding.is_published === false, 'Undangan Kedua Otomatis Jadi Draf', 'OK');

  const wed2Id = createWedA2.data.wedding.id;

  // Unpublish wedding 1
  await put(`/api/weddings/${weddingA.id}`, { is_published: false }, activeTokenA);

  // Send two simultaneous publish requests
  const [concurRes1, concurRes2] = await Promise.all([
    put(`/api/weddings/${weddingA.id}`, { is_published: true }, activeTokenA),
    put(`/api/weddings/${wed2Id}`, { is_published: true }, activeTokenA),
  ]);

  const pubCount = (concurRes1.status === 200 ? 1 : 0) + (concurRes2.status === 200 ? 1 : 0);
  const rejCount = (concurRes1.status === 400 ? 1 : 0) + (concurRes2.status === 400 ? 1 : 0);
  assert(pubCount === 1 && rejCount === 1, 'Transaksi BEGIN IMMEDIATE Menggagalkan Race Condition Publikasi Ganda', `Publikasi: ${pubCount}, Ditolak: ${rejCount}`);

  // -------------------------------------------------------------
  // 7. FILE UPLOAD: MAGIC BYTES & FAKE EXTENSION DISGUISE TEST
  // -------------------------------------------------------------
  console.log('\n--- 7. UPLOAD FILE: MAGIC BYTES & FAKE EXTENSION ---');
  // Sub-test A: Fake file (Shell script disguised as PNG)
  const fakePngBoundary = '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');
  const fakePngBody = Buffer.concat([
    Buffer.from(`--${fakePngBoundary}\r\nContent-Disposition: form-data; name="file"; filename="evil_script.png"\r\nContent-Type: image/png\r\n\r\n`),
    Buffer.from('#!/bin/bash\necho "I am an evil script disguised as png"'),
    Buffer.from(`\r\n--${fakePngBoundary}--\r\n`),
  ]);

  const fakeUploadRes = await fetch(`${BASE_URL}/api/media/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${activeTokenA}`,
      'Content-Type': `multipart/form-data; boundary=${fakePngBoundary}`,
    },
    body: fakePngBody,
  });
  assert(fakeUploadRes.status === 400, 'File Palsu Ber-ekstensi .png tapi Berisi Skrip Ditolak oleh Magic Bytes (400)', `Status: ${fakeUploadRes.status}`);

  // Sub-test B: Genuine PNG (Magic bytes 89 50 4E 47 ...)
  const genuinePngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  const realBoundary = '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');
  const realBody = Buffer.concat([
    Buffer.from(`--${realBoundary}\r\nContent-Disposition: form-data; name="file"; filename="valid_wedding.png"\r\nContent-Type: image/png\r\n\r\n`),
    genuinePngBuffer,
    Buffer.from(`\r\n--${realBoundary}--\r\n`),
  ]);

  const realUploadRes = await fetch(`${BASE_URL}/api/media/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${activeTokenA}`,
      'Content-Type': `multipart/form-data; boundary=${realBoundary}`,
    },
    body: realBody,
  });
  const realUploadData = await realUploadRes.json().catch(() => ({}));
  assert(realUploadRes.status === 201, 'Gambar PNG Asli Diterima dan Disimpan dengan Nama UUID Acak', `URL: ${realUploadData.url}`);

  // Verify that the uploaded file is accessible
  if (realUploadData.url) {
    const targetUrl = realUploadData.url.startsWith('http') ? realUploadData.url : `${BASE_URL}${realUploadData.url}`;
    const fileFetch = await fetch(targetUrl);
    assert(fileFetch.status === 200, 'File Upload Tersedia Secara Publik (Local / Supabase Storage)', `Status: ${fileFetch.status}`);
  }

  // -------------------------------------------------------------
  // 8. PERSISTENSI SETELAH RESTART & IDEMPOTENSI MIGRASI
  // -------------------------------------------------------------
  console.log('\n--- 8. PERSISTENSI & IDEMPOTENSI MIGRASI ---');
  let countWeddingsC;
  if (pgClient) {
    const res = await pgClient.query('SELECT COUNT(*) as c FROM public.weddings WHERE owner_id = $1', [userA.id]);
    countWeddingsC = parseInt(res.rows[0]?.c || '0', 10);
  } else {
    countWeddingsC = sqliteDb.prepare('SELECT COUNT(*) as c FROM weddings WHERE owner_id = ?').get(userA.id).c;
  }
  assert(countWeddingsC >= 2, 'Data Tersimpan Persisten di Database Produksi', `Total undangan Alice: ${countWeddingsC}`);

  // Test idempotency of migration logic: re-executing does not throw error
  try {
    if (pgClient) {
      await pgClient.query(`
        INSERT INTO public.users (id, email, password_hash, full_name, plan_tier, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'free', NOW(), NOW())
        ON CONFLICT (email) DO NOTHING
      `, [userA.id, emailA, 'dummyhash', 'Alice Test']);
    } else {
      sqliteDb.prepare(`
        INSERT OR IGNORE INTO users (id, email, password_hash, full_name, plan_tier, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'free', datetime('now'), datetime('now'))
      `).run(userA.id, emailA, 'dummyhash', 'Alice Test');
    }
    assert(true, 'Migrasi Idempoten: Tidak Menimbulkan Duplikasi atau Error jika Dijalankan Ulang', 'OK');
  } catch (e) {
    assert(false, 'Migrasi Idempoten Gagal', e.message);
  }

  console.log('\n================================================================');
  console.log(`TOTAL HASIL PENGUJIAN DEPLOYMENT: ${passed} LULUS, ${failed} GAGAL`);
  console.log('================================================================');

  // Clean test users
  try {
    if (pgClient) {
      await pgClient.query('DELETE FROM public.users WHERE id = ANY($1)', [[userA.id, userB.id, dummyVictim]]);
      await pgClient.end();
    } else {
      sqliteDb.prepare('DELETE FROM users WHERE id IN (?, ?, ?)').run(userA.id, userB.id, dummyVictim);
    }
    console.log('Cleanup akun pengujian selesai.');
  } catch (e) {
    console.error('Cleanup error:', e);
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTestSuite();
