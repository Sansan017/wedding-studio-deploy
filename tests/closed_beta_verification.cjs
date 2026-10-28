#!/usr/bin/env node

/**
 * Wedding Studio Free — Comprehensive Closed Beta Verification Test Suite
 * Tests all 8 security, persistence, auth, IDOR, concurrency, backup, and restore criteria.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const { runBackup } = require('../scripts/backup_system.cjs');
const { runRestore } = require('../scripts/restore_system.cjs');

const BASE_URL = 'http://127.0.0.1:3000';
const DB_PATH = path.join(__dirname, '..', 'data', 'production_wedding_studio.sqlite3');

async function get(url, token = null) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${url}`, { headers });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function post(url, body, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function put(url, body, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function del(url, token = null) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'DELETE',
    headers,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function runBetaVerification() {
  console.log('================================================================');
  console.log('   WEDDING STUDIO FREE — CLOSED BETA VERIFICATION TEST SUITE    ');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testName} ${details ? '(' + details + ')' : ''}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${details ? '(' + details + ')' : ''}`);
      failed++;
    }
  }

  // TEST 1: System Status Endpoint
  console.log('\n--- 1. AUDIT STATUS ARSITEKTUR RUNTIME ---');
  const isPostgres = Boolean(process.env.DATABASE_URL);
  let pgPool = null;
  if (isPostgres) {
    const { Pool } = require('pg');
    pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }

  const statusRes = await get('/api/system/status');
  assert(statusRes.status === 200, 'Endpoint /api/system/status Berfungsi', `Status: ${statusRes.status}`);
  assert(
    statusRes.data?.database?.mode === 'WAL' || statusRes.data?.database?.mode === 'Connection Pooling',
    'Mode Database Aktif Valid (WAL / Connection Pooling)',
    `Mode: ${statusRes.data?.database?.mode}`
  );
  assert(
    statusRes.data?.storage?.provider !== undefined,
    'Storage Provider Terverifikasi Aktif',
    `Provider: ${statusRes.data?.storage?.provider}`
  );

  // TEST 2: Auth Flow (Register, Login, Token, Expiry, Revoke)
  console.log('\n--- 2. AUTENTIKASI, SESI, EXPIRY & REVOCATION ---');
  const userAEmail = `beta_alice_${Date.now()}@example.com`;
  const userBEmail = `beta_bob_${Date.now()}@example.com`;
  const password = 'PasswordPalingAman123!';

  const regA = await post('/api/auth/register', { email: userAEmail, password, full_name: 'Alice Beta' });
  assert(regA.status === 201, 'Registrasi Akun A Berhasil', `ID: ${regA.data?.user?.id}`);

  const loginA = await post('/api/auth/login', { email: userAEmail, password });
  assert(loginA.status === 200, 'Login Akun A Berhasil', `Token length: ${loginA.data?.token?.length}`);
  const tokenA = loginA.data?.token;

  // Verify bcrypt in database
  const sqlite = new DatabaseSync(DB_PATH);
  let userARow;
  if (pgPool) {
    const res = await pgPool.query('SELECT password_hash FROM public.users WHERE email = $1', [userAEmail]);
    userARow = res.rows[0];
  } else {
    userARow = sqlite.prepare('SELECT password_hash FROM users WHERE email = ?').get(userAEmail);
  }
  assert(userARow?.password_hash?.startsWith('$2b$10$'), 'Password Hash Menggunakan Bcrypt Cost 10');

  // Verify token format (64 hex characters)
  assert(/^[a-f0-9]{64}$/.test(tokenA), 'Session Token 256-bit Hexadecimal Kriptografis');

  // Test logout and session revocation
  const logoutA = await post('/api/auth/logout', {}, tokenA);
  assert(logoutA.status === 200, 'Logout Sesi Berhasil');

  const revokedTest = await get('/api/auth/me', tokenA);
  assert(revokedTest.status === 401, 'Token yang Telah Dicabut Ditolak (HTTP 401)');

  // Re-login to get fresh token
  const freshLoginA = await post('/api/auth/login', { email: userAEmail, password });
  const activeTokenA = freshLoginA.data?.token;

  // Register and Login User B
  const regB = await post('/api/auth/register', { email: userBEmail, password, full_name: 'Bob Beta' });
  const loginB = await post('/api/auth/login', { email: userBEmail, password });
  const tokenB = loginB.data?.token;

  // TEST 3: Multi-Tenancy & IDOR Isolation
  console.log('\n--- 3. ISOLASI DATA ANTAR-PENGGUNA (ANTI-IDOR) ---');
  // Create wedding for User A
  const createWedA = await post('/api/weddings', {
    title: 'Pernikahan Alice & Partner',
    slug: `alice-wedding-${Date.now().toString(36)}`,
    theme_id: 'minimalist-ivory',
    is_published: false,
  }, activeTokenA);
  assert(createWedA.status === 201, 'User A Membuat Undangan');
  const wedAId = createWedA.data?.wedding?.id;

  // User B tries to read User A's wedding
  const readWedOther = await get(`/api/weddings/${wedAId}`, tokenB);
  assert(readWedOther.status === 403, 'User B Ditolak Mengakses Undangan User A (HTTP 403)');

  // User B tries to update User A's wedding
  const updateWedOther = await put(`/api/weddings/${wedAId}`, { title: 'Hacked by Bob' }, tokenB);
  assert(updateWedOther.status === 403, 'User B Ditolak Mengubah Undangan User A (HTTP 403)');

  // User B tries to delete User A's wedding
  const deleteWedOther = await del(`/api/weddings/${wedAId}`, tokenB);
  assert(deleteWedOther.status === 403, 'User B Ditolak Menghapus Undangan User A (HTTP 403)');

  // TEST 4: Free Quota & Concurrent Publish Race Condition
  console.log('\n--- 4. KUOTA FREE & PENCEGAHAN RACE CONDITION SIMULTAN ---');
  // Create second draft for User A
  const createWedA2 = await post('/api/weddings', {
    title: 'Undangan Kedua Alice',
    slug: `alice-second-${Date.now().toString(36)}`,
    is_published: false,
  }, activeTokenA);
  const wedA2Id = createWedA2.data?.wedding?.id;

  // Attempt concurrent publish on both weddings simultaneously
  const publishReq1 = put(`/api/weddings/${wedAId}`, { ...createWedA.data.wedding, is_published: true }, activeTokenA);
  const publishReq2 = put(`/api/weddings/${wedA2Id}`, { ...createWedA2.data.wedding, is_published: true }, activeTokenA);
  const [resPub1, resPub2] = await Promise.all([publishReq1, publishReq2]);

  const pubSuccessCount = (resPub1.status === 200 ? 1 : 0) + (resPub2.status === 200 ? 1 : 0);
  const pubBlockedCount = (resPub1.status === 400 ? 1 : 0) + (resPub2.status === 400 ? 1 : 0);

  assert(pubSuccessCount === 1, 'Tepat 1 Undangan Berhasil Dipublikasikan', `Success: ${pubSuccessCount}`);
  assert(pubBlockedCount === 1, 'Undangan Kedua Ditolak Kuota Free (HTTP 400)', `Blocked: ${pubBlockedCount}`);

  // TEST 5: Public Endpoint Data Sanitization
  console.log('\n--- 5. KEAMANAN ENDPOINT PUBLIK ---');
  const publishedWedding = resPub1.status === 200 ? createWedA.data.wedding : createWedA2.data.wedding;
  const publicRes = await get(`/api/public/weddings/${publishedWedding.slug}`);
  assert(publicRes.status === 200, 'Halaman Publik Undangan Dapat Diakses Tamu');
  assert(publicRes.data?.wedding?.owner_id === undefined, 'Field Sensitif owner_id Dihapus dari Respon Publik');
  assert(publicRes.data?.wedding?.password_hash === undefined, 'Field Sensitif password_hash Tidak Terekspos');

  // TEST 6: File Upload Security & Magic Bytes Check
  console.log('\n--- 6. UPLOAD BERKAS, VALIDASI MAGIC BYTES & FAKE EXTENSION ---');
  // 6.1 Fake PNG containing malicious PHP script
  const fakePngBuffer = Buffer.from('<?php echo "evil script execution"; ?>');
  const boundary = '----WebKitFormBoundary' + crypto.randomBytes(8).toString('hex');

  let body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="shell.png"\r\nContent-Type: image/png\r\n\r\n`),
    fakePngBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const fakeUploadRes = await fetch(`${BASE_URL}/api/media/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Authorization: `Bearer ${activeTokenA}`,
    },
    body,
  });
  assert(fakeUploadRes.status === 400, 'File Kamuflase (.png palsu berisi skrip) Ditolak Magic Bytes (HTTP 400)');

  // 6.2 Valid 1x1 PNG image
  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);

  body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="photo.png"\r\nContent-Type: image/png\r\n\r\n`),
    validPngBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const validUploadRes = await fetch(`${BASE_URL}/api/media/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Authorization: `Bearer ${activeTokenA}`,
    },
    body,
  });
  const validUploadData = await validUploadRes.json().catch(() => null);
  assert(validUploadRes.status === 201, 'File Gambar PNG Valid Berhasil Diunggah', `URL: ${validUploadData?.url}`);

  // TEST 7: Backup and Disaster Recovery Procedure
  console.log('\n--- 7. PROSEDUR BACKUP & RESTORE DENGAN INTEGRITAS SHA-256 ---');
  const backupResult = runBackup();
  assert(backupResult?.manifest?.checksums?.sqliteDb, 'Backup Database & Media Berhasil Dibuat');

  const restoreResult = runRestore(backupResult.targetDir);
  assert(restoreResult?.success === true, 'Restore Database Berhasil Diverifikasi 100%');
  assert(restoreResult?.missingFiles === 0, 'Integritas Referensi File Media Sempurna (0 missing)');

  // TEST 8: Safe Migration Dry-Run
  console.log('\n--- 8. SIMULASI MIGRASI AMAN KE POSTGRESQL ---');
  const { execSync } = require('child_process');
  const dryRunOutput = execSync('node scripts/migrate_to_postgres.cjs --dry-run').toString();
  assert(dryRunOutput.includes('[DRY RUN BERHASIL]'), 'Simulasi Migrasi PostgreSQL Berjalan Aman');

  // CLEANUP TEST USERS
  try {
    if (pgPool) {
      await pgPool.query('DELETE FROM public.users WHERE email = ANY($1)', [[userAEmail, userBEmail]]);
      await pgPool.end();
    } else {
      sqlite.prepare('DELETE FROM users WHERE email IN (?, ?)').run(userAEmail, userBEmail);
    }
  } catch {}

  console.log('================================================================');
  console.log(`HASIL VERIFIKASI CLOSED BETA: ${passed} LULUS, ${failed} GAGAL`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runBetaVerification().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
