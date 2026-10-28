import crypto from 'crypto';
import pg from 'pg';
import {
  sqliteDb,
  hashPasswordBcrypt,
  verifyPassword,
  parseWeddingRow,
  transactionalPublishCheck,
} from './db';

const { Pool } = pg;

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  plan_tier: string;
  created_at: string;
  updated_at: string;
}

export interface SessionResult {
  rawToken: string;
  expiresAt: number;
}

export interface DatabaseAdapter {
  getProviderName(): string;
  isPostgres(): boolean;

  // User methods
  getUserByEmail(email: string): Promise<UserRecord | null>;
  getUserById(id: string): Promise<UserRecord | null>;
  createUser(user: UserRecord): Promise<void>;
  updateUser(id: string, updates: { full_name?: string; password_hash?: string; updated_at?: string }): Promise<void>;
  countUsers(): Promise<number>;

  // Session methods
  createSession(userId: string): Promise<SessionResult>;
  validateSession(rawToken: string): Promise<UserRecord | null>;
  revokeSession(rawToken: string): Promise<void>;
  revokeAllUserSessions(userId: string): Promise<void>;

  // Wedding methods
  getWeddingsByOwner(ownerId: string): Promise<any[]>;
  getWeddingById(id: string): Promise<any | null>;
  getPublishedWeddingBySlug(slug: string): Promise<any | null>;
  createWedding(data: any): Promise<void>;
  updateWedding(id: string, ownerId: string, data: any): Promise<boolean>;
  deleteWedding(id: string, ownerId: string): Promise<boolean>;
  checkPublishQuota(userId: string, weddingId: string, willBePublished: boolean): Promise<boolean>;

  // RSVP methods
  getRsvps(weddingId: string): Promise<any[]>;
  insertRsvp(data: any): Promise<void>;
  deleteRsvp(rsvpId: string, weddingId: string): Promise<boolean>;

  // Guest message methods
  getGuestMessages(weddingId: string): Promise<any[]>;
  insertGuestMessage(data: any): Promise<void>;
  deleteGuestMessage(wishId: string, weddingId: string): Promise<boolean>;

  // Media file methods
  insertMediaFile(record: any): Promise<void>;
  getMediaFilesByUser(userId: string): Promise<any[]>;
  deleteMediaFile(id: string, userId: string): Promise<boolean>;

  // Utility methods
  isSlugTaken(slug: string, excludeWeddingId?: string): Promise<boolean>;
  getCounts(): Promise<{ users: number; weddings: number; rsvps: number; guest_messages: number; media_files: number }>;
}

// -----------------------------------------------------------------------------
// SQLITE IMPLEMENTATION (Default, zero external dependency, high concurrency WAL)
// -----------------------------------------------------------------------------
export class SqliteDatabaseAdapter implements DatabaseAdapter {
  getProviderName(): string {
    return 'sqlite (data/production_wedding_studio.sqlite3)';
  }

  isPostgres(): boolean {
    return false;
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const row = sqliteDb.prepare(`
      SELECT id, email, password_hash, full_name, plan_tier, created_at, updated_at
      FROM users WHERE email = ?
    `).get(email.toLowerCase().trim()) as any;
    return row || null;
  }

  async getUserById(id: string): Promise<UserRecord | null> {
    const row = sqliteDb.prepare(`
      SELECT id, email, password_hash, full_name, plan_tier, created_at, updated_at
      FROM users WHERE id = ?
    `).get(id) as any;
    return row || null;
  }

  async createUser(user: UserRecord): Promise<void> {
    sqliteDb.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, plan_tier, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      user.email.toLowerCase().trim(),
      user.password_hash,
      user.full_name.trim(),
      user.plan_tier || 'free',
      user.created_at,
      user.updated_at
    );
  }

  async updateUser(id: string, updates: { full_name?: string; password_hash?: string; updated_at?: string }): Promise<void> {
    if (updates.full_name) {
      sqliteDb.prepare(`UPDATE users SET full_name = ?, updated_at = ? WHERE id = ?`).run(
        updates.full_name.trim(),
        updates.updated_at || new Date().toISOString(),
        id
      );
    }
    if (updates.password_hash) {
      sqliteDb.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`).run(
        updates.password_hash,
        updates.updated_at || new Date().toISOString(),
        id
      );
    }
  }

  async countUsers(): Promise<number> {
    const res = sqliteDb.prepare(`SELECT COUNT(*) as count FROM users`).get() as any;
    return res?.count || 0;
  }

  async createSession(userId: string): Promise<SessionResult> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = new Date().toISOString();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    sqliteDb.prepare(`
      INSERT INTO sessions (token_hash, user_id, created_at, expires_at, is_revoked)
      VALUES (?, ?, ?, ?, 0)
    `).run(tokenHash, userId, now, expiresAt);

    return { rawToken, expiresAt };
  }

  async validateSession(rawToken: string): Promise<UserRecord | null> {
    if (!rawToken || rawToken.length < 32) return null;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = Date.now();

    const row = sqliteDb.prepare(`
      SELECT s.token_hash, s.expires_at, s.is_revoked,
             u.id, u.email, u.full_name, u.plan_tier, u.created_at, u.updated_at, u.password_hash
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token_hash = ? AND s.is_revoked = 0 AND s.expires_at > ?
    `).get(tokenHash, now) as any;

    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      password_hash: row.password_hash,
      full_name: row.full_name,
      plan_tier: row.plan_tier,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async revokeSession(rawToken: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    sqliteDb.prepare(`UPDATE sessions SET is_revoked = 1 WHERE token_hash = ?`).run(tokenHash);
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    sqliteDb.prepare(`UPDATE sessions SET is_revoked = 1 WHERE user_id = ?`).run(userId);
  }

  async getWeddingsByOwner(ownerId: string): Promise<any[]> {
    const rows = sqliteDb.prepare(`
      SELECT * FROM weddings WHERE owner_id = ? ORDER BY created_at DESC
    `).all(ownerId);
    return rows.map(parseWeddingRow);
  }

  async getWeddingById(id: string): Promise<any | null> {
    const row = sqliteDb.prepare(`SELECT * FROM weddings WHERE id = ?`).get(id);
    return parseWeddingRow(row);
  }

  async getPublishedWeddingBySlug(slug: string): Promise<any | null> {
    const row = sqliteDb.prepare(`SELECT * FROM weddings WHERE LOWER(slug) = LOWER(?) AND is_published = 1`).get(slug);
    return parseWeddingRow(row);
  }

  async createWedding(data: any): Promise<void> {
    sqliteDb.prepare(`
      INSERT INTO weddings (
        id, owner_id, title, slug, is_published, theme_id, font_pair,
        color_palette, hero_layout, cover_image, groom, bride, events,
        love_stories, gallery_photos, bank_accounts, gift_address,
        dress_code, quote, sections_order, audio_bg, free_plan_badge,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.owner_id,
      data.title,
      data.slug,
      data.is_published ? 1 : 0,
      data.theme_id,
      data.font_pair,
      typeof data.color_palette === 'string' ? data.color_palette : JSON.stringify(data.color_palette || {}),
      data.hero_layout || 'classic_centered',
      data.cover_image || null,
      typeof data.groom === 'string' ? data.groom : JSON.stringify(data.groom || {}),
      typeof data.bride === 'string' ? data.bride : JSON.stringify(data.bride || {}),
      typeof data.events === 'string' ? data.events : JSON.stringify(data.events || []),
      typeof data.love_stories === 'string' ? data.love_stories : JSON.stringify(data.love_stories || []),
      typeof data.gallery_photos === 'string' ? data.gallery_photos : JSON.stringify(data.gallery_photos || []),
      typeof data.bank_accounts === 'string' ? data.bank_accounts : JSON.stringify(data.bank_accounts || []),
      typeof data.gift_address === 'string' ? data.gift_address : JSON.stringify(data.gift_address || {}),
      typeof data.dress_code === 'string' ? data.dress_code : JSON.stringify(data.dress_code || {}),
      typeof data.quote === 'string' ? data.quote : JSON.stringify(data.quote || {}),
      typeof data.sections_order === 'string' ? data.sections_order : JSON.stringify(data.sections_order || []),
      typeof data.audio_bg === 'string' ? data.audio_bg : JSON.stringify(data.audio_bg || {}),
      data.free_plan_badge ? 1 : 0,
      data.created_at,
      data.updated_at
    );
  }

  async updateWedding(id: string, ownerId: string, data: any): Promise<boolean> {
    const willBePublished = Boolean(data.is_published);

    sqliteDb.exec('BEGIN IMMEDIATE');
    try {
      const existing = sqliteDb.prepare(`SELECT id, is_published FROM weddings WHERE id = ? AND owner_id = ?`).get(id, ownerId) as any;
      if (!existing) {
        sqliteDb.exec('ROLLBACK');
        return false;
      }

      if (willBePublished && existing.is_published !== 1) {
        const userRow = sqliteDb.prepare(`SELECT plan_tier FROM users WHERE id = ?`).get(ownerId) as any;
        const planTier = userRow?.plan_tier || 'free';
        if (planTier === 'free') {
          const activeCountRow = sqliteDb.prepare(`
            SELECT COUNT(*) as count FROM weddings
            WHERE owner_id = ? AND is_published = 1 AND id != ?
          `).get(ownerId, id) as any;
          if (activeCountRow && activeCountRow.count >= 1) {
            sqliteDb.exec('ROLLBACK');
            const err: any = new Error('Batas paket Free tercapai: Maksimal 1 undangan yang dipublikasikan secara aktif. Harap nonaktifkan publikasi undangan lain terlebih dahulu.');
            err.code = 'QUOTA_EXCEEDED';
            throw err;
          }
        }
      }

      sqliteDb.prepare(`
        UPDATE weddings SET
          title = ?,
          slug = COALESCE(?, slug),
          theme_id = ?,
          font_pair = ?,
          color_palette = ?,
          hero_layout = ?,
          cover_image = ?,
          groom = ?,
          bride = ?,
          events = ?,
          love_stories = ?,
          gallery_photos = ?,
          bank_accounts = ?,
          gift_address = ?,
          dress_code = ?,
          quote = ?,
          sections_order = ?,
          audio_bg = ?,
          is_published = ?,
          updated_at = ?
        WHERE id = ? AND owner_id = ?
      `).run(
        data.title,
        data.slug || null,
        data.theme_id,
        data.font_pair,
        typeof data.color_palette === 'string' ? data.color_palette : JSON.stringify(data.color_palette || {}),
        data.hero_layout,
        data.cover_image,
        typeof data.groom === 'string' ? data.groom : JSON.stringify(data.groom || {}),
        typeof data.bride === 'string' ? data.bride : JSON.stringify(data.bride || {}),
        typeof data.events === 'string' ? data.events : JSON.stringify(data.events || []),
        typeof data.love_stories === 'string' ? data.love_stories : JSON.stringify(data.love_stories || []),
        typeof data.gallery_photos === 'string' ? data.gallery_photos : JSON.stringify(data.gallery_photos || []),
        typeof data.bank_accounts === 'string' ? data.bank_accounts : JSON.stringify(data.bank_accounts || []),
        typeof data.gift_address === 'string' ? data.gift_address : JSON.stringify(data.gift_address || {}),
        typeof data.dress_code === 'string' ? data.dress_code : JSON.stringify(data.dress_code || {}),
        typeof data.quote === 'string' ? data.quote : JSON.stringify(data.quote || {}),
        typeof data.sections_order === 'string' ? data.sections_order : JSON.stringify(data.sections_order || []),
        typeof data.audio_bg === 'string' ? data.audio_bg : JSON.stringify(data.audio_bg || {}),
        willBePublished ? 1 : 0,
        new Date().toISOString(),
        id,
        ownerId
      );

      sqliteDb.exec('COMMIT');
      return true;
    } catch (e) {
      sqliteDb.exec('ROLLBACK');
      throw e;
    }
  }

  async deleteWedding(id: string, ownerId: string): Promise<boolean> {
    const info = sqliteDb.prepare(`DELETE FROM weddings WHERE id = ? AND owner_id = ?`).run(id, ownerId);
    return info.changes > 0;
  }

  async checkPublishQuota(userId: string, weddingId: string, willBePublished: boolean): Promise<boolean> {
    return transactionalPublishCheck(userId, weddingId, willBePublished);
  }

  async getRsvps(weddingId: string): Promise<any[]> {
    return sqliteDb.prepare(`SELECT * FROM rsvps WHERE wedding_id = ? ORDER BY created_at DESC`).all(weddingId);
  }

  async insertRsvp(data: any): Promise<void> {
    sqliteDb.prepare(`
      INSERT INTO rsvps (id, wedding_id, guest_name, attendance, pax_count, message, ip_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.wedding_id,
      data.guest_name,
      data.attendance,
      data.pax_count || 1,
      data.message || null,
      data.ip_hash || null,
      data.created_at
    );
  }

  async deleteRsvp(rsvpId: string, weddingId: string): Promise<boolean> {
    const info = sqliteDb.prepare(`DELETE FROM rsvps WHERE id = ? AND wedding_id = ?`).run(rsvpId, weddingId);
    return info.changes > 0;
  }

  async getGuestMessages(weddingId: string): Promise<any[]> {
    return sqliteDb.prepare(`
      SELECT * FROM guest_messages WHERE wedding_id = ? AND is_approved = 1 ORDER BY created_at DESC
    `).all(weddingId);
  }

  async insertGuestMessage(data: any): Promise<void> {
    sqliteDb.prepare(`
      INSERT INTO guest_messages (id, wedding_id, sender_name, relationship, message, is_approved, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.wedding_id,
      data.sender_name,
      data.relationship || 'Tamu Undangan',
      data.message,
      data.is_approved ? 1 : 0,
      data.created_at
    );
  }

  async deleteGuestMessage(wishId: string, weddingId: string): Promise<boolean> {
    const info = sqliteDb.prepare(`DELETE FROM guest_messages WHERE id = ? AND wedding_id = ?`).run(wishId, weddingId);
    return info.changes > 0;
  }

  async insertMediaFile(record: any): Promise<void> {
    sqliteDb.prepare(`
      INSERT INTO media_files (id, user_id, original_name, stored_filename, mime_type, size_bytes, file_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.user_id,
      record.original_name,
      record.stored_filename,
      record.mime_type,
      record.size_bytes,
      record.file_path,
      record.created_at
    );
  }

  async getMediaFilesByUser(userId: string): Promise<any[]> {
    return sqliteDb.prepare(`SELECT * FROM media_files WHERE user_id = ? ORDER BY created_at DESC`).all(userId);
  }

  async deleteMediaFile(id: string, userId: string): Promise<boolean> {
    const info = sqliteDb.prepare(`DELETE FROM media_files WHERE id = ? AND user_id = ?`).run(id, userId);
    return info.changes > 0;
  }

  async isSlugTaken(slug: string, excludeWeddingId?: string): Promise<boolean> {
    if (excludeWeddingId) {
      const row = sqliteDb.prepare(`SELECT id FROM weddings WHERE LOWER(slug) = LOWER(?) AND id != ?`).get(slug, excludeWeddingId);
      return !!row;
    }
    const row = sqliteDb.prepare(`SELECT id FROM weddings WHERE LOWER(slug) = LOWER(?)`).get(slug);
    return !!row;
  }

  async getCounts(): Promise<{ users: number; weddings: number; rsvps: number; guest_messages: number; media_files: number }> {
    return {
      users: (sqliteDb.prepare(`SELECT COUNT(*) as c FROM users`).get() as any)?.c || 0,
      weddings: (sqliteDb.prepare(`SELECT COUNT(*) as c FROM weddings`).get() as any)?.c || 0,
      rsvps: (sqliteDb.prepare(`SELECT COUNT(*) as c FROM rsvps`).get() as any)?.c || 0,
      guest_messages: (sqliteDb.prepare(`SELECT COUNT(*) as c FROM guest_messages`).get() as any)?.c || 0,
      media_files: (sqliteDb.prepare(`SELECT COUNT(*) as c FROM media_files`).get() as any)?.c || 0,
    };
  }
}

// -----------------------------------------------------------------------------
// POSTGRESQL IMPLEMENTATION (Persistent Cloud DB, Supabase/Neon/Cloud SQL)
// -----------------------------------------------------------------------------
export class PostgresDatabaseAdapter implements DatabaseAdapter {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }

  getProviderName(): string {
    return 'PostgreSQL (Cloud Database / Supabase)';
  }

  isPostgres(): boolean {
    return true;
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const res = await this.pool.query(
      `SELECT id, email, password_hash, full_name, plan_tier, created_at, updated_at
       FROM public.users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );
    return res.rows[0] || null;
  }

  async getUserById(id: string): Promise<UserRecord | null> {
    const res = await this.pool.query(
      `SELECT id, email, password_hash, full_name, plan_tier, created_at, updated_at
       FROM public.users WHERE id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async createUser(user: UserRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO public.users (id, email, password_hash, full_name, plan_tier, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO NOTHING`,
      [
        user.id,
        user.email.toLowerCase().trim(),
        user.password_hash,
        user.full_name.trim(),
        user.plan_tier || 'free',
        user.created_at,
        user.updated_at,
      ]
    );
  }

  async updateUser(id: string, updates: { full_name?: string; password_hash?: string; updated_at?: string }): Promise<void> {
    if (updates.full_name) {
      await this.pool.query(
        `UPDATE public.users SET full_name = $1, updated_at = $2 WHERE id = $3`,
        [updates.full_name.trim(), updates.updated_at || new Date().toISOString(), id]
      );
    }
    if (updates.password_hash) {
      await this.pool.query(
        `UPDATE public.users SET password_hash = $1, updated_at = $2 WHERE id = $3`,
        [updates.password_hash, updates.updated_at || new Date().toISOString(), id]
      );
    }
  }

  async countUsers(): Promise<number> {
    const res = await this.pool.query(`SELECT COUNT(*) as count FROM public.users`);
    return parseInt(res.rows[0]?.count || '0', 10);
  }

  async createSession(userId: string): Promise<SessionResult> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    await this.pool.query(
      `INSERT INTO public.sessions (token_hash, user_id, created_at, expires_at, is_revoked)
       VALUES ($1, $2, NOW(), $3, FALSE)`,
      [tokenHash, userId, expiresAt]
    );

    return { rawToken, expiresAt };
  }

  async validateSession(rawToken: string): Promise<UserRecord | null> {
    if (!rawToken || rawToken.length < 32) return null;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = Date.now();

    const res = await this.pool.query(
      `SELECT s.token_hash, s.expires_at, s.is_revoked,
              u.id, u.email, u.full_name, u.plan_tier, u.created_at, u.updated_at, u.password_hash
       FROM public.sessions s
       JOIN public.users u ON s.user_id = u.id
       WHERE s.token_hash = $1 AND s.is_revoked = FALSE AND s.expires_at > $2`,
      [tokenHash, now]
    );

    return res.rows[0] || null;
  }

  async revokeSession(rawToken: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await this.pool.query(`UPDATE public.sessions SET is_revoked = TRUE WHERE token_hash = $1`, [tokenHash]);
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.pool.query(`UPDATE public.sessions SET is_revoked = TRUE WHERE user_id = $1`, [userId]);
  }

  async getWeddingsByOwner(ownerId: string): Promise<any[]> {
    const res = await this.pool.query(
      `SELECT * FROM public.weddings WHERE owner_id = $1 ORDER BY created_at DESC`,
      [ownerId]
    );
    return res.rows.map(parseWeddingRow);
  }

  async getWeddingById(id: string): Promise<any | null> {
    const res = await this.pool.query(`SELECT * FROM public.weddings WHERE id = $1`, [id]);
    return res.rows[0] ? parseWeddingRow(res.rows[0]) : null;
  }

  async getPublishedWeddingBySlug(slug: string): Promise<any | null> {
    const res = await this.pool.query(
      `SELECT * FROM public.weddings WHERE LOWER(slug) = LOWER($1) AND is_published = TRUE`,
      [slug]
    );
    return res.rows[0] ? parseWeddingRow(res.rows[0]) : null;
  }

  async createWedding(data: any): Promise<void> {
    await this.pool.query(
      `INSERT INTO public.weddings (
        id, owner_id, title, slug, is_published, theme_id, font_pair,
        color_palette, hero_layout, cover_image, groom, bride, events,
        love_stories, gallery_photos, bank_accounts, gift_address,
        dress_code, quote, sections_order, audio_bg, free_plan_badge,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
      [
        data.id,
        data.owner_id,
        data.title,
        data.slug,
        !!data.is_published,
        data.theme_id,
        data.font_pair,
        JSON.stringify(data.color_palette || {}),
        data.hero_layout || 'classic_centered',
        data.cover_image || null,
        JSON.stringify(data.groom || {}),
        JSON.stringify(data.bride || {}),
        JSON.stringify(data.events || []),
        JSON.stringify(data.love_stories || []),
        JSON.stringify(data.gallery_photos || []),
        JSON.stringify(data.bank_accounts || []),
        JSON.stringify(data.gift_address || {}),
        JSON.stringify(data.dress_code || {}),
        JSON.stringify(data.quote || {}),
        JSON.stringify(data.sections_order || []),
        JSON.stringify(data.audio_bg || {}),
        !!data.free_plan_badge,
        data.created_at,
        data.updated_at,
      ]
    );
  }

  async updateWedding(id: string, ownerId: string, data: any): Promise<boolean> {
    const willBePublished = Boolean(data.is_published);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Check current publication state
      const currentRes = await client.query(
        `SELECT id, is_published FROM public.weddings WHERE id = $1 AND owner_id = $2`,
        [id, ownerId]
      );
      if (currentRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      const wasPublished = currentRes.rows[0].is_published === true;

      // Atomic lock and quota verification if transitioning to published
      if (willBePublished && !wasPublished) {
        const userRes = await client.query(
          `SELECT id, plan_tier FROM public.users WHERE id = $1 FOR UPDATE`,
          [ownerId]
        );
        const planTier = userRes.rows[0]?.plan_tier || 'free';

        if (planTier === 'free') {
          const countRes = await client.query(
            `SELECT COUNT(*) as count FROM public.weddings
             WHERE owner_id = $1 AND is_published = TRUE AND id != $2`,
            [ownerId, id]
          );
          const count = parseInt(countRes.rows[0]?.count || '0', 10);
          if (count >= 1) {
            await client.query('ROLLBACK');
            const err: any = new Error('Batas paket Free tercapai: Maksimal 1 undangan yang dipublikasikan secara aktif. Harap nonaktifkan publikasi undangan lain terlebih dahulu.');
            err.code = 'QUOTA_EXCEEDED';
            throw err;
          }
        }
      }

      const res = await client.query(
        `UPDATE public.weddings SET
          title = $1,
          slug = COALESCE($2, slug),
          theme_id = $3,
          font_pair = $4,
          color_palette = $5,
          hero_layout = $6,
          cover_image = $7,
          groom = $8,
          bride = $9,
          events = $10,
          love_stories = $11,
          gallery_photos = $12,
          bank_accounts = $13,
          gift_address = $14,
          dress_code = $15,
          quote = $16,
          sections_order = $17,
          audio_bg = $18,
          is_published = $19,
          updated_at = NOW()
        WHERE id = $20 AND owner_id = $21`,
        [
          data.title,
          data.slug || null,
          data.theme_id,
          data.font_pair,
          JSON.stringify(data.color_palette || {}),
          data.hero_layout,
          data.cover_image,
          JSON.stringify(data.groom || {}),
          JSON.stringify(data.bride || {}),
          JSON.stringify(data.events || []),
          JSON.stringify(data.love_stories || []),
          JSON.stringify(data.gallery_photos || []),
          JSON.stringify(data.bank_accounts || []),
          JSON.stringify(data.gift_address || {}),
          JSON.stringify(data.dress_code || {}),
          JSON.stringify(data.quote || {}),
          JSON.stringify(data.sections_order || []),
          JSON.stringify(data.audio_bg || {}),
          willBePublished,
          id,
          ownerId,
        ]
      );

      await client.query('COMMIT');
      return (res.rowCount ?? 0) > 0;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async deleteWedding(id: string, ownerId: string): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM public.weddings WHERE id = $1 AND owner_id = $2`,
      [id, ownerId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async checkPublishQuota(userId: string, weddingId: string, willBePublished: boolean): Promise<boolean> {
    if (!willBePublished) return true;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const userRes = await client.query(`SELECT plan_tier FROM public.users WHERE id = $1`, [userId]);
      const planTier = userRes.rows[0]?.plan_tier || 'free';

      if (planTier === 'free') {
        const countRes = await client.query(
          `SELECT COUNT(*) as count FROM public.weddings
           WHERE owner_id = $1 AND is_published = TRUE AND id != $2`,
          [userId, weddingId]
        );
        const count = parseInt(countRes.rows[0]?.count || '0', 10);
        if (count >= 1) {
          await client.query('ROLLBACK');
          return false;
        }
      }
      await client.query('COMMIT');
      return true;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async getRsvps(weddingId: string): Promise<any[]> {
    const res = await this.pool.query(
      `SELECT * FROM public.rsvps WHERE wedding_id = $1 ORDER BY created_at DESC`,
      [weddingId]
    );
    return res.rows;
  }

  async insertRsvp(data: any): Promise<void> {
    await this.pool.query(
      `INSERT INTO public.rsvps (id, wedding_id, guest_name, attendance, pax_count, message, ip_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        data.id,
        data.wedding_id,
        data.guest_name,
        data.attendance,
        data.pax_count || 1,
        data.message || null,
        data.ip_hash || null,
        data.created_at,
      ]
    );
  }

  async deleteRsvp(rsvpId: string, weddingId: string): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM public.rsvps WHERE id = $1 AND wedding_id = $2`,
      [rsvpId, weddingId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async getGuestMessages(weddingId: string): Promise<any[]> {
    const res = await this.pool.query(
      `SELECT * FROM public.guest_messages WHERE wedding_id = $1 AND is_approved = TRUE ORDER BY created_at DESC`,
      [weddingId]
    );
    return res.rows;
  }

  async insertGuestMessage(data: any): Promise<void> {
    await this.pool.query(
      `INSERT INTO public.guest_messages (id, wedding_id, sender_name, relationship, message, is_approved, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        data.id,
        data.wedding_id,
        data.sender_name,
        data.relationship || 'Tamu Undangan',
        data.message,
        data.is_approved !== false,
        data.created_at,
      ]
    );
  }

  async deleteGuestMessage(wishId: string, weddingId: string): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM public.guest_messages WHERE id = $1 AND wedding_id = $2`,
      [wishId, weddingId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async insertMediaFile(record: any): Promise<void> {
    await this.pool.query(
      `INSERT INTO public.media_files (id, user_id, original_name, stored_filename, mime_type, size_bytes, file_path, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        record.id,
        record.user_id,
        record.original_name,
        record.stored_filename,
        record.mime_type,
        record.size_bytes,
        record.file_path,
        record.created_at,
      ]
    );
  }

  async getMediaFilesByUser(userId: string): Promise<any[]> {
    const res = await this.pool.query(
      `SELECT * FROM public.media_files WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return res.rows;
  }

  async deleteMediaFile(id: string, userId: string): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM public.media_files WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async isSlugTaken(slug: string, excludeWeddingId?: string): Promise<boolean> {
    if (excludeWeddingId) {
      const res = await this.pool.query(
        `SELECT id FROM public.weddings WHERE LOWER(slug) = LOWER($1) AND id != $2`,
        [slug, excludeWeddingId]
      );
      return res.rows.length > 0;
    }
    const res = await this.pool.query(
      `SELECT id FROM public.weddings WHERE LOWER(slug) = LOWER($1)`,
      [slug]
    );
    return res.rows.length > 0;
  }

  async getCounts(): Promise<{ users: number; weddings: number; rsvps: number; guest_messages: number; media_files: number }> {
    const [u, w, r, g, m] = await Promise.all([
      this.pool.query('SELECT COUNT(*) as c FROM public.users'),
      this.pool.query('SELECT COUNT(*) as c FROM public.weddings'),
      this.pool.query('SELECT COUNT(*) as c FROM public.rsvps'),
      this.pool.query('SELECT COUNT(*) as c FROM public.guest_messages'),
      this.pool.query('SELECT COUNT(*) as c FROM public.media_files'),
    ]);
    return {
      users: parseInt(u.rows[0]?.c || '0', 10),
      weddings: parseInt(w.rows[0]?.c || '0', 10),
      rsvps: parseInt(r.rows[0]?.c || '0', 10),
      guest_messages: parseInt(g.rows[0]?.c || '0', 10),
      media_files: parseInt(m.rows[0]?.c || '0', 10),
    };
  }
}

// -----------------------------------------------------------------------------
// ADAPTER FACTORY
// -----------------------------------------------------------------------------
let activeDatabaseAdapter: DatabaseAdapter | null = null;

export function getDatabaseAdapter(): DatabaseAdapter {
  if (activeDatabaseAdapter) return activeDatabaseAdapter;

  const pgUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  const forceSqlite = process.env.DATABASE_PROVIDER === 'sqlite';

  if (!forceSqlite && pgUrl) {
    console.log(`[Database] Menggunakan PostgreSQL / Supabase adapter`);
    activeDatabaseAdapter = new PostgresDatabaseAdapter(pgUrl);
  } else {
    activeDatabaseAdapter = new SqliteDatabaseAdapter();
  }

  return activeDatabaseAdapter;
}

export function resetDatabaseAdapterCache(): void {
  activeDatabaseAdapter = null;
}
