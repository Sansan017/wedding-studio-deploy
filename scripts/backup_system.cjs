#!/usr/bin/env node

/**
 * Wedding Studio Free — Backup System
 * Exports database records and media files with SHA-256 checksums and verification manifest.
 * Usage: node scripts/backup_system.cjs [output_dir]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const ROOT_DIR = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT_DIR, 'data', 'production_wedding_studio.sqlite3');
const UPLOADS_PATH = path.join(ROOT_DIR, 'uploads');
const BACKUPS_DIR = process.argv[2] || path.join(ROOT_DIR, 'backups');

function sha256File(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const hash = crypto.createHash('sha256');
  const fileBuffer = fs.readFileSync(filePath);
  hash.update(fileBuffer);
  return hash.digest('hex');
}

function runBackup() {
  console.log('================================================================');
  console.log('       WEDDING STUDIO FREE — SYSTEM BACKUP UTILITY              ');
  console.log('================================================================');

  if (!fs.existsSync(DB_PATH)) {
    console.error(`[ERROR] Database SQLite tidak ditemukan pada: ${DB_PATH}`);
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const targetDir = path.join(BACKUPS_DIR, `backup-${timestamp}`);
  fs.mkdirSync(targetDir, { recursive: true });

  console.log(`[1/4] Mengambil snapshot database SQLite...`);
  // Open active db to flush WAL pages into main file
  const activeDb = new DatabaseSync(DB_PATH);
  try {
    activeDb.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch (e) {
    // ignore if locked
  }

  const backupDbPath = path.join(targetDir, 'production_wedding_studio.sqlite3');
  fs.copyFileSync(DB_PATH, backupDbPath);
  const dbChecksum = sha256File(backupDbPath);

  console.log(`[2/4] Mengekspor data terstruktur ke format JSON Portable...`);
  const db = new DatabaseSync(backupDbPath);
  
  const tables = ['users', 'sessions', 'weddings', 'rsvps', 'guest_messages', 'media_files'];
  const exportedData = {};
  const counts = {};

  for (const table of tables) {
    try {
      const rows = db.prepare(`SELECT * FROM ${table}`).all();
      // Mask password_hash in visual log, keep preserved in export for disaster recovery
      exportedData[table] = rows;
      counts[table] = rows.length;
    } catch (err) {
      console.warn(`[WARN] Tabel ${table} tidak ditemukan atau kosong: ${err.message}`);
      exportedData[table] = [];
      counts[table] = 0;
    }
  }

  const jsonExportPath = path.join(targetDir, 'database_export.json');
  fs.writeFileSync(jsonExportPath, JSON.stringify(exportedData, null, 2), 'utf-8');
  const jsonChecksum = sha256File(jsonExportPath);

  console.log(`[3/4] Mengarsipkan file media dari /uploads...`);
  const targetUploadsDir = path.join(targetDir, 'uploads');
  fs.mkdirSync(targetUploadsDir, { recursive: true });

  let mediaFilesCount = 0;
  const mediaChecksums = {};

  if (fs.existsSync(UPLOADS_PATH)) {
    const files = fs.readdirSync(UPLOADS_PATH);
    for (const file of files) {
      const srcFile = path.join(UPLOADS_PATH, file);
      const stat = fs.statSync(srcFile);
      if (stat.isFile()) {
        const destFile = path.join(targetUploadsDir, file);
        fs.copyFileSync(srcFile, destFile);
        mediaChecksums[file] = sha256File(destFile);
        mediaFilesCount++;
      }
    }
  }

  console.log(`[4/4] Membuat berkas verifikasi integritas manifest.json...`);
  const manifest = {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    environment: 'wedding-studio-free-beta',
    sourceDatabase: 'SQLite',
    counts,
    mediaFilesCount,
    checksums: {
      sqliteDb: dbChecksum,
      databaseExportJson: jsonChecksum,
      mediaFiles: mediaChecksums,
    },
  };

  const manifestPath = path.join(targetDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log('----------------------------------------------------------------');
  console.log('✅ BACKUP BERHASIL DISELESAIKAN!');
  console.log(`Lokasi Target : ${targetDir}`);
  console.log(`Jumlah Data   : `);
  for (const [tbl, count] of Object.entries(counts)) {
    console.log(`  - ${tbl.padEnd(16)}: ${count} baris`);
  }
  console.log(`  - File Media      : ${mediaFilesCount} berkas`);
  console.log(`Checksum SHA-256 : ${dbChecksum.substring(0, 16)}...`);
  console.log('================================================================');

  return { targetDir, manifest };
}

if (require.main === module) {
  runBackup();
}

module.exports = { runBackup, sha256File };
