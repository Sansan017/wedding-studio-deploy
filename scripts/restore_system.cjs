#!/usr/bin/env node

/**
 * Wedding Studio Free — Restore System
 * Restores SQLite database and media files from a verified backup directory.
 * Usage: node scripts/restore_system.cjs <backup_directory_path>
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const ROOT_DIR = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT_DIR, 'data', 'production_wedding_studio.sqlite3');
const UPLOADS_PATH = path.join(ROOT_DIR, 'uploads');

function sha256File(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const hash = crypto.createHash('sha256');
  const fileBuffer = fs.readFileSync(filePath);
  hash.update(fileBuffer);
  return hash.digest('hex');
}

function runRestore(backupDir) {
  console.log('================================================================');
  console.log('       WEDDING STUDIO FREE — SYSTEM RESTORE UTILITY             ');
  console.log('================================================================');

  if (!backupDir) {
    // If not supplied, search for the latest backup in backups/
    const backupsRoot = path.join(ROOT_DIR, 'backups');
    if (fs.existsSync(backupsRoot)) {
      const dirs = fs.readdirSync(backupsRoot).filter(d => d.startsWith('backup-')).sort().reverse();
      if (dirs.length > 0) {
        backupDir = path.join(backupsRoot, dirs[0]);
        console.log(`[INFO] Menggunakan backup terbaru yang terdeteksi: ${dirs[0]}`);
      }
    }
  }

  if (!backupDir || !fs.existsSync(backupDir)) {
    console.error(`[ERROR] Direktori backup tidak ditemukan: ${backupDir}`);
    process.exit(1);
  }

  const manifestPath = path.join(backupDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`[ERROR] Berkas manifest.json tidak ditemukan di ${backupDir}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log(`[INFO] Tanggal Backup: ${manifest.createdAt}`);

  // Step 1: Verify Checksums
  console.log(`[1/4] Memverifikasi integritas checksum SHA-256...`);
  const backupDbPath = path.join(backupDir, 'production_wedding_studio.sqlite3');
  const currentDbChecksum = sha256File(backupDbPath);
  if (currentDbChecksum !== manifest.checksums.sqliteDb) {
    console.error(`[ERROR] Checksum SQLite DB tidak cocok! Diharapkan: ${manifest.checksums.sqliteDb}, Ditemukan: ${currentDbChecksum}`);
    process.exit(1);
  }
  console.log(`  ✓ Checksum SQLite DB Valid (${currentDbChecksum.substring(0, 16)}...)`);

  // Step 2: Restore Database
  console.log(`[2/4] Mengembalikan berkas database ke ${DB_PATH}...`);
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.copyFileSync(backupDbPath, DB_PATH);
  console.log(`  ✓ Database SQLite berhasil dipulihkan.`);

  // Step 3: Restore Media Files
  console.log(`[3/4] Mengembalikan berkas media ke ${UPLOADS_PATH}...`);
  fs.mkdirSync(UPLOADS_PATH, { recursive: true });
  const backupUploadsDir = path.join(backupDir, 'uploads');
  let restoredMediaCount = 0;

  if (fs.existsSync(backupUploadsDir)) {
    const files = fs.readdirSync(backupUploadsDir);
    for (const file of files) {
      const src = path.join(backupUploadsDir, file);
      const dest = path.join(UPLOADS_PATH, file);
      fs.copyFileSync(src, dest);
      restoredMediaCount++;
    }
  }
  console.log(`  ✓ ${restoredMediaCount} berkas media berhasil dipulihkan.`);

  // Step 4: Consistency & Integrity Check
  console.log(`[4/4] Memeriksa konsistensi relasi dan tautan media pasca-pemulihan...`);
  const db = new DatabaseSync(DB_PATH);
  
  // Verify row counts
  for (const [table, expectedCount] of Object.entries(manifest.counts)) {
    try {
      const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
      if (row.count !== expectedCount) {
        console.warn(`  [WARN] Tabel ${table}: jumlah baris (${row.count}) berbeda dengan manifest (${expectedCount})`);
      } else {
        console.log(`  ✓ Tabel ${table.padEnd(16)}: ${row.count} baris (Sesuai)`);
      }
    } catch (err) {
      console.warn(`  [WARN] Gagal memeriksa tabel ${table}: ${err.message}`);
    }
  }

  // Check media file link consistency
  const mediaRows = db.prepare(`SELECT stored_filename FROM media_files`).all();
  let missingFiles = 0;
  for (const row of mediaRows) {
    const filePath = path.join(UPLOADS_PATH, row.stored_filename);
    if (!fs.existsSync(filePath)) {
      missingFiles++;
      console.warn(`  [WARN] File referensi ${row.stored_filename} tidak ditemukan di disk.`);
    }
  }

  console.log('----------------------------------------------------------------');
  if (missingFiles === 0) {
    console.log('✅ PEMULIHAN SUKSES TANPA KEHILANGAN DATA ATAU REFERENSI!');
  } else {
    console.log(`⚠️ PEMULIHAN SELESAI DENGAN CATATAN: ${missingFiles} berkas fisik tidak ditemukan.`);
  }
  console.log('================================================================');

  return { success: true, missingFiles };
}

if (require.main === module) {
  const targetDir = process.argv[2];
  runRestore(targetDir);
}

module.exports = { runRestore };
