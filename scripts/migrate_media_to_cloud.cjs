#!/usr/bin/env node

/**
 * Wedding Studio Free — Media to Cloud Storage Migration Utility
 * Migrates local /uploads files to Supabase Storage bucket without deleting local files.
 *
 * Usage:
 *   node scripts/migrate_media_to_cloud.cjs [--dry-run]
 *
 * Environment variables:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_STORAGE_BUCKET (default: 'wedding-media')
 */

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { createClient } = require('@supabase/supabase-js');

const ROOT_DIR = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT_DIR, 'data', 'production_wedding_studio.sqlite3');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');

const isDryRun = process.argv.includes('--dry-run');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'wedding-media';

async function runMediaMigration() {
  console.log('================================================================');
  console.log('     WEDDING STUDIO FREE — MEDIA TO CLOUD STORAGE MIGRATION     ');
  console.log('================================================================');
  console.log(`Mode Operasi: ${isDryRun ? 'SIMULASI (DRY RUN)' : 'EKSEKUSI NYATA'}`);

  if (!fs.existsSync(UPLOADS_DIR)) {
    console.log('[INFO] Direktori /uploads tidak ditemukan atau belum ada file yang diunggah.');
    return;
  }

  const localFiles = fs.readdirSync(UPLOADS_DIR).filter(f => fs.statSync(path.join(UPLOADS_DIR, f)).isFile());
  console.log(`[INFO] Ditemukan ${localFiles.length} berkas di direktori lokal /uploads`);

  if (isDryRun && (!supabaseUrl || !supabaseKey)) {
    console.log('\n[DRY RUN BERHASIL] Validasi direktori media lokal selesai.');
    console.log(`Berkas yang siap dimigrasikan: ${localFiles.length}`);
    for (const f of localFiles.slice(0, 5)) {
      console.log(`  - ${f}`);
    }
    if (localFiles.length > 5) console.log(`  ...dan ${localFiles.length - 5} berkas lainnya.`);
    return;
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error('\n[FATAL] Kredensial Supabase Storage belum disediakan.');
    console.log('Harap tentukan di environment:');
    console.log('  export SUPABASE_URL="https://[YOUR_PROJECT_REF].supabase.co"');
    console.log('  export SUPABASE_SERVICE_ROLE_KEY="[YOUR_SERVICE_ROLE_KEY]"');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`\n[1/3] Memeriksa ketersediaan Bucket '${bucketName}' di Supabase...`);
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error(`[FATAL] Gagal mengakses Supabase Storage: ${listError.message}`);
    process.exit(1);
  }

  const bucketExists = buckets.some(b => b.name === bucketName);
  if (!bucketExists) {
    console.log(`[INFO] Bucket '${bucketName}' belum ada. Membuat bucket publik baru...`);
    if (!isDryRun) {
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 5242880, // 5MB
      });
      if (createError) {
        console.error(`[FATAL] Gagal membuat bucket: ${createError.message}`);
        process.exit(1);
      }
      console.log(`  ✓ Bucket '${bucketName}' berhasil dibuat.`);
    }
  } else {
    console.log(`  ✓ Bucket '${bucketName}' ditemukan.`);
  }

  console.log('\n[2/3] Memindahkan berkas media ke cloud storage...');
  let migratedCount = 0;
  let failedCount = 0;

  for (const filename of localFiles) {
    const filePath = path.join(UPLOADS_DIR, filename);
    const fileBuffer = fs.readFileSync(filePath);
    const mimeType = filename.endsWith('.png') ? 'image/png' : filename.endsWith('.webp') ? 'image/webp' : 'image/jpeg';

    if (isDryRun) {
      console.log(`  [DRY RUN] Akan mengunggah: ${filename}`);
      migratedCount++;
      continue;
    }

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filename, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.warn(`  [GAGAL] Mengunggah ${filename}: ${uploadError.message}`);
      failedCount++;
    } else {
      const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filename);
      console.log(`  ✓ Berhasil: ${filename} -> ${urlData.publicUrl}`);
      migratedCount++;
    }
  }

  console.log('\n[3/3] Rekapitulasi Migrasi Media:');
  console.log(`  - Berhasil diproses : ${migratedCount}`);
  console.log(`  - Gagal             : ${failedCount}`);
  console.log('----------------------------------------------------------------');
  console.log('✅ CATATAN KEAMANAN: Berkas lokal di /uploads TIDAK DIHAPUS.');
  console.log('   Penyimpanan cadangan lokal tetap dipertahankan untuk pemulihan.');
  console.log('================================================================');
}

if (require.main === module) {
  runMediaMigration().catch(err => {
    console.error('Media migration failed:', err);
    process.exit(1);
  });
}

module.exports = { runMediaMigration };
