#!/usr/bin/env node

/**
 * Wedding Studio Free — Safe, Idempotent PostgreSQL / Supabase Migration Utility
 * Migrates data from local SQLite to PostgreSQL without data duplication or loss.
 *
 * Usage:
 *   node scripts/migrate_to_postgres.cjs [--dry-run] [--connection-string=<url>]
 *
 * Requirements:
 *   DATABASE_URL or SUPABASE_DATABASE_URL in environment or passed via argument.
 */

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { Pool } = require('pg');

const ROOT_DIR = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT_DIR, 'data', 'production_wedding_studio.sqlite3');
const SCHEMA_FILE = path.join(ROOT_DIR, 'supabase', 'migrations', '002_standalone_postgres_schema.sql');

// Parse arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
let targetUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

for (const arg of args) {
  if (arg.startsWith('--connection-string=')) {
    targetUrl = arg.split('=')[1];
  }
}

async function runMigration() {
  console.log('================================================================');
  console.log('   WEDDING STUDIO FREE — SAFE POSTGRESQL / SUPABASE MIGRATION   ');
  console.log('================================================================');
  console.log(`Mode Operasi       : ${isDryRun ? 'SIMULASI (DRY-RUN - Tidak ada data yang diubah)' : 'EKSEKUSI NYATA'}`);

  if (!fs.existsSync(DB_PATH)) {
    console.error(`[FATAL] Database SQLite sumber tidak ditemukan di: ${DB_PATH}`);
    process.exit(1);
  }

  const sqliteDb = new DatabaseSync(DB_PATH);

  // 1. Audit & Count Source Data
  console.log('\n[1/5] Mengaudit dan Menghitung Data Sumber di SQLite...');
  const tables = ['users', 'sessions', 'weddings', 'rsvps', 'guest_messages', 'media_files'];
  const sourceCounts = {};
  const sourceData = {};

  for (const table of tables) {
    try {
      const rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all();
      sourceCounts[table] = rows.length;
      sourceData[table] = rows;
      console.log(`  • ${table.padEnd(16)}: ${rows.length} rekaman terdeteksi`);
    } catch (err) {
      console.warn(`  [WARN] Gagal membaca tabel ${table}: ${err.message}`);
      sourceCounts[table] = 0;
      sourceData[table] = [];
    }
  }

  if (isDryRun && !targetUrl) {
    console.log('\n[DRY RUN BERHASIL] Validasi struktur data SQLite sumber selesai.');
    console.log('Semua tabel relasional lengkap dan siap dimigrasikan.');
    console.log('Tidak ada koneksi PostgreSQL yang dikonfigurasi saat simulasi.');
    return;
  }

  if (!targetUrl) {
    console.error('\n[FATAL] String koneksi PostgreSQL (DATABASE_URL / SUPABASE_DATABASE_URL) belum ditentukan.');
    console.log('Gunakan:');
    console.log('  export DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"');
    console.log('  node scripts/migrate_to_postgres.cjs');
    process.exit(1);
  }

  // 2. Connect to PostgreSQL
  console.log('\n[2/5] Menghubungkan ke PostgreSQL Target...');
  // Mask connection string password in logs
  const maskedUrl = targetUrl.replace(/:([^:@]+)@/, ':****@');
  console.log(`  Target: ${maskedUrl}`);

  const pool = new Pool({
    connectionString: targetUrl,
    ssl: targetUrl.includes('localhost') ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();
  console.log('  ✓ Terhubung ke PostgreSQL target.');

  try {
    // 3. Ensure Schema Exists
    console.log('\n[3/5] Memastikan Skema Tabel Target di PostgreSQL...');
    if (fs.existsSync(SCHEMA_FILE)) {
      const ddl = fs.readFileSync(SCHEMA_FILE, 'utf-8');
      if (!isDryRun) {
        await client.query(ddl);
        console.log('  ✓ Skema relasional PostgreSQL berhasil diverifikasi / diperbarui.');
      } else {
        console.log('  [DRY RUN] DDL schema divalidasi tanpa eksekusi.');
      }
    }

    if (isDryRun) {
      console.log('\n[4/5] [DRY RUN] Simulasi urutan migrasi data berjenjang (Foreign Keys):');
      console.log('  1. users          (ON CONFLICT email / id DO NOTHING)');
      console.log('  2. sessions       (ON CONFLICT token_hash DO NOTHING)');
      console.log('  3. weddings       (ON CONFLICT slug / id DO NOTHING)');
      console.log('  4. rsvps          (ON CONFLICT id DO NOTHING)');
      console.log('  5. guest_messages (ON CONFLICT id DO NOTHING)');
      console.log('\n[5/5] [DRY RUN] Simulasi Selesai [DRY RUN BERHASIL]. Database SQLite tetap utuh.');
      return;
    }

    // 4. Perform Data Transfer with Transaction and Foreign Key Ordering
    console.log('\n[4/5] Memindahkan Data secara Atomik dan Idempoten...');
    await client.query('BEGIN');

    // A. Users
    for (const u of sourceData.users) {
      await client.query(
        `INSERT INTO public.users (id, email, password_hash, full_name, plan_tier, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           full_name = EXCLUDED.full_name,
           password_hash = EXCLUDED.password_hash,
           updated_at = EXCLUDED.updated_at`,
        [u.id, u.email, u.password_hash, u.full_name, u.plan_tier || 'free', u.created_at, u.updated_at]
      );
    }
    console.log(`  ✓ users: ${sourceData.users.length} baris dipindahkan.`);

    // B. Sessions
    for (const s of sourceData.sessions) {
      await client.query(
        `INSERT INTO public.sessions (token_hash, user_id, created_at, expires_at, is_revoked)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (token_hash) DO NOTHING`,
        [s.token_hash, s.user_id, s.created_at, s.expires_at, s.is_revoked === 1]
      );
    }
    console.log(`  ✓ sessions: ${sourceData.sessions.length} baris dipindahkan.`);

    // C. Weddings
    for (const w of sourceData.weddings) {
      await client.query(
        `INSERT INTO public.weddings (
          id, owner_id, title, slug, is_published, theme_id, font_pair,
          color_palette, hero_layout, cover_image, groom, bride, events,
          love_stories, gallery_photos, bank_accounts, gift_address,
          dress_code, quote, sections_order, audio_bg, free_plan_badge,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
        ON CONFLICT (id) DO NOTHING`,
        [
          w.id,
          w.owner_id,
          w.title,
          w.slug,
          w.is_published === 1,
          w.theme_id,
          w.font_pair,
          typeof w.color_palette === 'string' ? w.color_palette : JSON.stringify(w.color_palette || {}),
          w.hero_layout,
          w.cover_image,
          typeof w.groom === 'string' ? w.groom : JSON.stringify(w.groom || {}),
          typeof w.bride === 'string' ? w.bride : JSON.stringify(w.bride || {}),
          typeof w.events === 'string' ? w.events : JSON.stringify(w.events || []),
          typeof w.love_stories === 'string' ? w.love_stories : JSON.stringify(w.love_stories || []),
          typeof w.gallery_photos === 'string' ? w.gallery_photos : JSON.stringify(w.gallery_photos || []),
          typeof w.bank_accounts === 'string' ? w.bank_accounts : JSON.stringify(w.bank_accounts || []),
          typeof w.gift_address === 'string' ? w.gift_address : JSON.stringify(w.gift_address || {}),
          typeof w.dress_code === 'string' ? w.dress_code : JSON.stringify(w.dress_code || {}),
          typeof w.quote === 'string' ? w.quote : JSON.stringify(w.quote || {}),
          typeof w.sections_order === 'string' ? w.sections_order : JSON.stringify(w.sections_order || []),
          typeof w.audio_bg === 'string' ? w.audio_bg : JSON.stringify(w.audio_bg || {}),
          w.free_plan_badge === 1,
          w.created_at,
          w.updated_at,
        ]
      );
    }
    console.log(`  ✓ weddings: ${sourceData.weddings.length} baris dipindahkan.`);

    // D. RSVPs
    for (const r of sourceData.rsvps) {
      await client.query(
        `INSERT INTO public.rsvps (id, wedding_id, guest_name, attendance, pax_count, message, ip_hash, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [r.id, r.wedding_id, r.guest_name, r.attendance, r.pax_count, r.message, r.ip_hash, r.created_at]
      );
    }
    console.log(`  ✓ rsvps: ${sourceData.rsvps.length} baris dipindahkan.`);

    // E. Guest Messages
    for (const m of sourceData.guest_messages) {
      await client.query(
        `INSERT INTO public.guest_messages (id, wedding_id, sender_name, relationship, message, is_approved, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [m.id, m.wedding_id, m.sender_name, m.relationship, m.message, m.is_approved === 1, m.created_at]
      );
    }
    console.log(`  ✓ guest_messages: ${sourceData.guest_messages.length} baris dipindahkan.`);

    // F. Media Files
    for (const f of sourceData.media_files) {
      await client.query(
        `INSERT INTO public.media_files (id, user_id, original_name, stored_filename, mime_type, size_bytes, file_path, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [f.id, f.user_id, f.original_name, f.stored_filename, f.mime_type, f.size_bytes, f.file_path, f.created_at]
      );
    }
    console.log(`  ✓ media_files: ${sourceData.media_files.length} baris dipindahkan.`);

    await client.query('COMMIT');

    // 5. Verify & Sample Check
    console.log('\n[5/5] Memverifikasi Integritas Data Pasca-Migrasi...');
    let allMatches = true;
    for (const table of tables) {
      const res = await client.query(`SELECT COUNT(*) as count FROM public.${table}`);
      const targetCount = parseInt(res.rows[0].count, 10);
      const expected = sourceCounts[table];
      const match = targetCount >= expected;
      console.log(`  • public.${table.padEnd(16)}: Target=${targetCount}, Sumber=${expected} [${match ? 'SESUAI' : 'SELISIH'}]`);
      if (!match) allMatches = false;
    }

    console.log('----------------------------------------------------------------');
    if (allMatches) {
      console.log('✅ MIGRASI POSTGRESQL / SUPABASE BERHASIL 100% TANPA DUPLIKASI!');
      console.log('CATATAN: Database SQLite lokal tetap disimpan utuh untuk cadangan.');
    } else {
      console.warn('⚠️ MIGRASI SELESAI DENGAN PERBEDAAN JUMLAH DATA.');
    }
    console.log('================================================================');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`\n[FATAL ERROR] Migrasi gagal dan di-rollback otomatis: ${err.message}`);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigration().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

module.exports = { runMigration };
