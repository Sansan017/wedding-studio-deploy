import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const DB_FILE = path.join(DATA_DIR, 'production_wedding_studio.sqlite3');
const OLD_JSON_DB = path.join(DATA_DIR, 'db.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const sqliteDb = new DatabaseSync(DB_FILE);

// Enable WAL mode for high concurrency & Foreign Keys
sqliteDb.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
`);

// Initialize Production Relational Schemas
sqliteDb.exec(`
  -- 1. USERS TABLE
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    plan_tier TEXT NOT NULL DEFAULT 'free',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

  -- 2. SESSIONS TABLE (Cryptographically secure server-managed sessions)
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    is_revoked INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

  -- 3. WEDDINGS TABLE
  CREATE TABLE IF NOT EXISTS weddings (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    is_published INTEGER NOT NULL DEFAULT 0,
    theme_id TEXT NOT NULL DEFAULT 'minimalist-ivory',
    font_pair TEXT NOT NULL DEFAULT 'cormorant-jakarta',
    color_palette TEXT NOT NULL,
    hero_layout TEXT DEFAULT 'classic_centered',
    cover_image TEXT,
    groom TEXT NOT NULL,
    bride TEXT NOT NULL,
    events TEXT NOT NULL,
    love_stories TEXT NOT NULL,
    gallery_photos TEXT NOT NULL,
    bank_accounts TEXT NOT NULL,
    gift_address TEXT NOT NULL,
    dress_code TEXT NOT NULL,
    quote TEXT NOT NULL,
    sections_order TEXT NOT NULL,
    audio_bg TEXT NOT NULL,
    free_plan_badge INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_weddings_owner_id ON weddings(owner_id);
  CREATE INDEX IF NOT EXISTS idx_weddings_slug ON weddings(slug);

  -- 4. RSVPS TABLE
  CREATE TABLE IF NOT EXISTS rsvps (
    id TEXT PRIMARY KEY,
    wedding_id TEXT NOT NULL,
    guest_name TEXT NOT NULL,
    attendance TEXT NOT NULL,
    pax_count INTEGER NOT NULL DEFAULT 1,
    message TEXT,
    ip_hash TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (wedding_id) REFERENCES weddings(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_rsvps_wedding_id ON rsvps(wedding_id);

  -- 5. GUEST_MESSAGES TABLE
  CREATE TABLE IF NOT EXISTS guest_messages (
    id TEXT PRIMARY KEY,
    wedding_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    relationship TEXT NOT NULL DEFAULT 'Tamu Undangan',
    message TEXT NOT NULL,
    is_approved INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    FOREIGN KEY (wedding_id) REFERENCES weddings(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_guest_messages_wedding_id ON guest_messages(wedding_id);

  -- 6. MEDIA_FILES TABLE (Uploaded physical photos)
  CREATE TABLE IF NOT EXISTS media_files (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    original_name TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_media_files_user_id ON media_files(user_id);
`);

// -------------------------------------------------------------
// CRYPTOGRAPHY & PASSWORD HASHING (bcrypt + legacy upgrade)
// -------------------------------------------------------------
const BCRYPT_SALT_ROUNDS = 10;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 Days

export function hashPasswordBcrypt(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_SALT_ROUNDS);
}

export function verifyPassword(password: string, storedHash: string): { valid: boolean; needsUpgrade: boolean } {
  // If storedHash is already bcrypt
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
    const valid = bcrypt.compareSync(password, storedHash);
    return { valid, needsUpgrade: false };
  }

  // Legacy SHA-256 fallback verification
  const legacyHash = crypto.createHash('sha256').update(password + '_wedding_studio_salt').digest('hex');
  if (legacyHash === storedHash) {
    // Valid password using legacy salt, mark for transparent upgrade
    return { valid: true, needsUpgrade: true };
  }

  return { valid: false, needsUpgrade: false };
}

// -------------------------------------------------------------
// SESSION MANAGEMENT (Cryptographically Random 256-bit Tokens)
// -------------------------------------------------------------
function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function createSession(userId: string): { rawToken: string; expiresAt: number } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const now = new Date().toISOString();
  const expiresAt = Date.now() + SESSION_TTL_MS;

  const stmt = sqliteDb.prepare(`
    INSERT INTO sessions (token_hash, user_id, created_at, expires_at, is_revoked)
    VALUES (?, ?, ?, ?, 0)
  `);
  stmt.run(tokenHash, userId, now, expiresAt);

  return { rawToken, expiresAt };
}

export function validateSession(rawToken: string): any | null {
  if (!rawToken || typeof rawToken !== 'string') return null;

  const tokenHash = hashToken(rawToken);
  const stmt = sqliteDb.prepare(`
    SELECT s.token_hash, s.user_id, s.expires_at, s.is_revoked,
           u.id as u_id, u.email, u.full_name, u.plan_tier, u.created_at as u_created_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token_hash = ?
  `);

  const row = stmt.get(tokenHash) as any;
  if (!row) return null;

  // Check if session has been revoked
  if (row.is_revoked === 1) {
    return null;
  }

  // Check if session has expired
  if (Date.now() > row.expires_at) {
    return null;
  }

  return {
    id: row.u_id,
    email: row.email,
    full_name: row.full_name,
    plan_tier: row.plan_tier,
    created_at: row.u_created_at,
  };
}

export function revokeSession(rawToken: string): boolean {
  if (!rawToken) return false;
  const tokenHash = hashToken(rawToken);
  const stmt = sqliteDb.prepare(`UPDATE sessions SET is_revoked = 1 WHERE token_hash = ?`);
  const result = stmt.run(tokenHash);
  return result.changes > 0;
}

export function revokeAllUserSessions(userId: string) {
  const stmt = sqliteDb.prepare(`UPDATE sessions SET is_revoked = 1 WHERE user_id = ?`);
  stmt.run(userId);
}

// -------------------------------------------------------------
// DATA MIGRATION FROM OLD JSON DB (If exists)
// -------------------------------------------------------------
function migrateLegacyJsonDb() {
  try {
    const userCount = sqliteDb.prepare(`SELECT COUNT(*) as count FROM users`).get() as any;
    if (userCount && userCount.count > 0) {
      // Database already seeded / populated
      return;
    }

    if (fs.existsSync(OLD_JSON_DB)) {
      const data = JSON.parse(fs.readFileSync(OLD_JSON_DB, 'utf-8'));

      // Migrate Users
      if (Array.isArray(data.users)) {
        const insertUser = sqliteDb.prepare(`
          INSERT OR IGNORE INTO users (id, email, password_hash, full_name, plan_tier, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const u of data.users) {
          // If old hash was SHA256 or demo, keep hash or convert
          insertUser.run(
            u.id,
            u.email,
            u.password_hash || hashPasswordBcrypt('demo12345'),
            u.full_name,
            u.plan_tier || 'free',
            u.created_at || new Date().toISOString(),
            new Date().toISOString()
          );
        }
      }

      // Migrate Weddings
      if (Array.isArray(data.weddings)) {
        const insertWedding = sqliteDb.prepare(`
          INSERT OR IGNORE INTO weddings (
            id, owner_id, title, slug, is_published, theme_id, font_pair,
            color_palette, hero_layout, cover_image, groom, bride, events,
            love_stories, gallery_photos, bank_accounts, gift_address,
            dress_code, quote, sections_order, audio_bg, free_plan_badge,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const w of data.weddings) {
          insertWedding.run(
            w.id,
            w.owner_id,
            w.title,
            w.slug,
            w.is_published ? 1 : 0,
            w.theme_id || 'minimalist-ivory',
            w.font_pair || 'cormorant-jakarta',
            JSON.stringify(w.color_palette || {}),
            w.hero_layout || 'classic_centered',
            w.cover_image || '',
            JSON.stringify(w.groom || {}),
            JSON.stringify(w.bride || {}),
            JSON.stringify(w.events || []),
            JSON.stringify(w.love_stories || []),
            JSON.stringify(w.gallery_photos || []),
            JSON.stringify(w.bank_accounts || []),
            JSON.stringify(w.gift_address || {}),
            JSON.stringify(w.dress_code || {}),
            JSON.stringify(w.quote || {}),
            JSON.stringify(w.sections_order || []),
            JSON.stringify(w.audio_bg || {}),
            w.free_plan_badge ? 1 : 0,
            w.created_at || new Date().toISOString(),
            w.updated_at || new Date().toISOString()
          );
        }
      }

      // Migrate RSVPs
      if (Array.isArray(data.rsvps)) {
        const insertRsvp = sqliteDb.prepare(`
          INSERT OR IGNORE INTO rsvps (id, wedding_id, guest_name, attendance, pax_count, message, ip_hash, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const r of data.rsvps) {
          insertRsvp.run(
            r.id,
            r.wedding_id,
            r.guest_name,
            r.attendance,
            r.pax_count || 1,
            r.message || '',
            r.ip_hash || '',
            r.created_at || new Date().toISOString()
          );
        }
      }

      // Migrate Guest Messages
      if (Array.isArray(data.guest_messages)) {
        const insertWish = sqliteDb.prepare(`
          INSERT OR IGNORE INTO guest_messages (id, wedding_id, sender_name, relationship, message, is_approved, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const m of data.guest_messages) {
          insertWish.run(
            m.id,
            m.wedding_id,
            m.sender_name,
            m.relationship || 'Tamu Undangan',
            m.message,
            m.is_approved ? 1 : 0,
            m.created_at || new Date().toISOString()
          );
        }
      }

      console.log('Successfully migrated legacy json database to production SQLite.');
    } else {
      // Seed initial demo user and wedding
      seedInitialData();
    }
  } catch (err) {
    console.error('Error during database migration:', err);
  }
}

function seedInitialData() {
  const defaultUser = {
    id: 'user_demo_01',
    email: 'demo@weddingstudio.id',
    password_hash: hashPasswordBcrypt('demo12345'),
    full_name: 'Raden Febrian',
    plan_tier: 'free',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const insertUser = sqliteDb.prepare(`
    INSERT OR IGNORE INTO users (id, email, password_hash, full_name, plan_tier, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertUser.run(
    defaultUser.id,
    defaultUser.email,
    defaultUser.password_hash,
    defaultUser.full_name,
    defaultUser.plan_tier,
    defaultUser.created_at,
    defaultUser.updated_at
  );

  const defaultWedding = {
    id: 'wed_demo_001',
    owner_id: 'user_demo_01',
    title: 'The Wedding of Raden & Annisa',
    slug: 'raden-annisa-demo',
    is_published: 1,
    theme_id: 'minimalist-ivory',
    font_pair: 'cormorant-jakarta',
    color_palette: JSON.stringify({
      primary: '#8C7355',
      secondary: '#C5A880',
      accent: '#B89758',
      background: '#FAF8F5',
      surface: '#FFFFFF',
      text: '#2C2623',
      textMuted: '#786F66',
    }),
    hero_layout: 'classic_centered',
    cover_image: '/src/assets/images/wedding_couple_portrait_1792819792980.jpg',
    groom: JSON.stringify({
      name: 'Raden Febrian Pratama, S.Kom',
      nickname: 'Raden',
      father: 'Bpk. Hendra Febrian',
      mother: 'Ibu Ratna Dewi',
      bio: 'Putra pertama dari dua bersaudara yang berprofesi sebagai UI/UX Designer & Entrepreneur.',
      instagram: '@radenfebrian',
      photo_url: '/src/assets/images/wedding_groom_photo_1792819793218.jpg',
    }),
    bride: JSON.stringify({
      name: 'Annisa Putri Maharani, S.Ds',
      nickname: 'Annisa',
      father: 'Bpk. Joko Susanto',
      mother: 'Ibu Sri Rahayu',
      bio: 'Putri bungsu dari tiga bersaudara yang berprofesi sebagai Fashion Stylist & Florist.',
      instagram: '@annisaputri',
      photo_url: '/src/assets/images/wedding_bride_photo_1792819793289.jpg',
    }),
    events: JSON.stringify([
      {
        id: 'ev-akad',
        title: 'Akad Nikah',
        date: '2026-12-12',
        start_time: '08:00',
        end_time: '10:00',
        timezone: 'WIB',
        location_name: 'Masjid Raya Al-Ikhlas',
        address: 'Jl. Melati Indah No. 18, Kebayoran Baru, Jakarta Selatan',
        maps_url: 'https://maps.google.com/?q=Jakarta',
        is_active: true,
      },
      {
        id: 'ev-resepsi',
        title: 'Resepsi Pernikahan',
        date: '2026-12-12',
        start_time: '11:00',
        end_time: '14:00',
        timezone: 'WIB',
        location_name: 'The Glass House Garden Pavilion',
        address: 'Jl. Jenderal Sudirman Kav. 52, SCBD, Jakarta Selatan',
        maps_url: 'https://maps.google.com/?q=Jakarta',
        is_active: true,
      },
    ]),
    love_stories: JSON.stringify([
      {
        id: 'ls-1',
        year: '2021',
        title: 'Pertemuan Pertama di Kafe Bandung',
        description: 'Bermula dari secangkir kopi hangat saat menghadiri seminar desain kreatif.',
        photo_url: '/src/assets/images/wedding_banner_floral_1792819792887.jpg',
      },
      {
        id: 'ls-2',
        year: '2023',
        title: 'Menjalin Komitmen Bersama',
        description: 'Setelah melewati banyak cerita, kami memutuskan untuk melangkah bersama.',
        photo_url: '/src/assets/images/wedding_couple_portrait_1792819792980.jpg',
      },
    ]),
    gallery_photos: JSON.stringify([
      { id: 'g-1', url: '/src/assets/images/wedding_couple_portrait_1792819792980.jpg', caption: 'Momen penuh tawa bahagia' },
      { id: 'g-2', url: '/src/assets/images/wedding_banner_floral_1792819792887.jpg', caption: 'Suasana dekorasi penuh bunga' },
      { id: 'g-3', url: '/src/assets/images/wedding_bride_photo_1792819793289.jpg', caption: 'Keanggunan dalam balutan putih' },
      { id: 'g-4', url: '/src/assets/images/wedding_groom_photo_1792819793218.jpg', caption: 'Senyum penuh syukur' },
    ]),
    bank_accounts: JSON.stringify([
      {
        id: 'ba-1',
        bank_name: 'Bank Central Asia (BCA)',
        account_number: '8271928374',
        account_holder: 'Raden Febrian Pratama',
      },
      {
        id: 'ba-2',
        bank_name: 'Bank Mandiri',
        account_number: '1370019283746',
        account_holder: 'Annisa Putri Maharani',
      },
    ]),
    gift_address: JSON.stringify({
      recipient_name: 'Raden & Annisa',
      phone: '0812-3456-7890',
      address: 'Jl. Kemang Raya No. 45, Mampang Prapatan, Jakarta Selatan 12730',
      note: 'Titipkan di resepsionis / pos satpam atas nama Raden & Annisa',
    }),
    dress_code: JSON.stringify({
      title: 'Dress Code Tamu Undangan',
      description: 'Formal / Batik / Earth Tone & Champagne Nuance',
      colors: ['#FAF8F5', '#C5A880', '#536B54', '#8C7355', '#2C2623'],
    }),
    quote: JSON.stringify({
      text: 'Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan pasangan-pasangan untukmu dari jenismu sendiri...',
      source: 'QS. Ar-Rum: 21',
    }),
    sections_order: JSON.stringify([
      { id: 'hero', label: 'Cover & Pembuka', is_enabled: true },
      { id: 'quote', label: 'Kutipan & Doa', is_enabled: true },
      { id: 'couple', label: 'Mempelai Pria & Wanita', is_enabled: true },
      { id: 'events', label: 'Waktu & Tempat Acara', is_enabled: true },
      { id: 'countdown', label: 'Hitung Mundur Waktu', is_enabled: true },
      { id: 'story', label: 'Kisah Cinta (Love Story)', is_enabled: true },
      { id: 'gallery', label: 'Galeri Foto Mempelai', is_enabled: true },
      { id: 'dresscode', label: 'Dress Code & Panduan', is_enabled: true },
      { id: 'rsvp', label: 'Konfirmasi Kehadiran (RSVP)', is_enabled: true },
      { id: 'wishes', label: 'Buku Tamu & Ucapan Doa', is_enabled: true },
      { id: 'gifts', label: 'Amplop Digital / Hadiah', is_enabled: true },
    ]),
    audio_bg: JSON.stringify({
      enabled: true,
      title: 'Canon in D (Romantic Piano)',
      artist: 'Wedding Studio Collection',
      url: '',
      auto_play: false,
    }),
    free_plan_badge: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const insertWedding = sqliteDb.prepare(`
    INSERT OR IGNORE INTO weddings (
      id, owner_id, title, slug, is_published, theme_id, font_pair,
      color_palette, hero_layout, cover_image, groom, bride, events,
      love_stories, gallery_photos, bank_accounts, gift_address,
      dress_code, quote, sections_order, audio_bg, free_plan_badge,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertWedding.run(
    defaultWedding.id,
    defaultWedding.owner_id,
    defaultWedding.title,
    defaultWedding.slug,
    defaultWedding.is_published,
    defaultWedding.theme_id,
    defaultWedding.font_pair,
    defaultWedding.color_palette,
    defaultWedding.hero_layout,
    defaultWedding.cover_image,
    defaultWedding.groom,
    defaultWedding.bride,
    defaultWedding.events,
    defaultWedding.love_stories,
    defaultWedding.gallery_photos,
    defaultWedding.bank_accounts,
    defaultWedding.gift_address,
    defaultWedding.dress_code,
    defaultWedding.quote,
    defaultWedding.sections_order,
    defaultWedding.audio_bg,
    defaultWedding.free_plan_badge,
    defaultWedding.created_at,
    defaultWedding.updated_at
  );

  // Seed sample RSVP
  sqliteDb.prepare(`
    INSERT OR IGNORE INTO rsvps (id, wedding_id, guest_name, attendance, pax_count, message, ip_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'rsvp_demo_01',
    'wed_demo_001',
    'Bpk. Hendra & Ibu Sinta',
    'hadir',
    2,
    'Selamat berbahagia untuk Raden & Annisa! Semoga sakinah mawaddah warahmah.',
    'hash_01',
    new Date().toISOString()
  );

  // Seed sample guest wish
  sqliteDb.prepare(`
    INSERT OR IGNORE INTO guest_messages (id, wedding_id, sender_name, relationship, message, is_approved, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'wish_demo_01',
    'wed_demo_001',
    'Bpk. Hendra & Ibu Sinta',
    'Keluarga Besar',
    'Selamat berbahagia untuk Raden & Annisa! Semoga selalu rukun, bahagia, dan penuh berkah.',
    1,
    new Date().toISOString()
  );
}

// Run migration on startup
migrateLegacyJsonDb();

// -------------------------------------------------------------
// TRANSACTIONAL WEDDING OPERATIONS (Prevents Race Conditions)
// -------------------------------------------------------------
export function safeParseJson(val: any, fallback: any = {}) {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

export function parseWeddingRow(row: any): any {
  if (!row) return null;
  return {
    ...row,
    is_published: row.is_published === 1 || row.is_published === true,
    free_plan_badge: row.free_plan_badge === 1 || row.free_plan_badge === true,
    color_palette: safeParseJson(row.color_palette, {}),
    groom: safeParseJson(row.groom, {}),
    bride: safeParseJson(row.bride, {}),
    events: safeParseJson(row.events, []),
    love_stories: safeParseJson(row.love_stories, []),
    gallery_photos: safeParseJson(row.gallery_photos, []),
    bank_accounts: safeParseJson(row.bank_accounts, []),
    gift_address: safeParseJson(row.gift_address, {}),
    dress_code: safeParseJson(row.dress_code, {}),
    quote: safeParseJson(row.quote, {}),
    sections_order: safeParseJson(row.sections_order, []),
    audio_bg: safeParseJson(row.audio_bg, {}),
  };
}

export function transactionalPublishCheck(userId: string, weddingId: string, willBePublished: boolean): boolean {
  if (!willBePublished) return true;

  // Run in immediate transaction lock
  sqliteDb.exec('BEGIN IMMEDIATE');
  try {
    const userRow = sqliteDb.prepare(`SELECT plan_tier FROM users WHERE id = ?`).get(userId) as any;
    const planTier = userRow?.plan_tier || 'free';

    if (planTier === 'free') {
      const activeCountRow = sqliteDb.prepare(`
        SELECT COUNT(*) as count FROM weddings
        WHERE owner_id = ? AND is_published = 1 AND id != ?
      `).get(userId, weddingId) as any;

      if (activeCountRow && activeCountRow.count >= 1) {
        sqliteDb.exec('ROLLBACK');
        return false;
      }
    }

    sqliteDb.exec('COMMIT');
    return true;
  } catch (e) {
    sqliteDb.exec('ROLLBACK');
    throw e;
  }
}
