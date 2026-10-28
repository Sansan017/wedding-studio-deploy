import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import multer from 'multer';
import {
  hashPasswordBcrypt,
  verifyPassword,
} from './src/server/db';
import { getStorageAdapter } from './src/server/storage_adapter';
import { getDatabaseAdapter } from './src/server/database_adapter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global process error handlers to prevent silent crashes and dropped socket connections
process.on('uncaughtException', (err) => {
  console.error('[Process uncaughtException]', err?.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Process unhandledRejection]', reason);
});

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Trust reverse proxy (Cloud Run / load balancer) for accurate IP resolution
app.set('trust proxy', 1);

// Universal CORS & Preflight Middleware (supports browser iframe previews, localhost, and cross-origin tools)
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range, Cache-Control'
  );
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type');
  if (req.headers.origin) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Preflight requests return immediate 204
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(express.json({ limit: '10mb' }));

// Serve uploaded media files securely
app.use(
  '/uploads',
  express.static(UPLOADS_DIR, {
    maxAge: '7d',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  })
);

// -------------------------------------------------------------
// RATE LIMITING UTILITIES (Dual-key: per IP and per Account)
// -------------------------------------------------------------
interface RateLimitRecord {
  attempts: number;
  firstAttemptTime: number;
  blockedUntil: number;
}

const loginRateLimitMap = new Map<string, RateLimitRecord>();
const rsvpRateLimitMap = new Map<string, number>();

function checkLoginRateLimit(key: string, maxAttempts = 5): boolean {
  const now = Date.now();
  const record = loginRateLimitMap.get(key);
  if (!record) return true;

  if (record.blockedUntil > now) {
    return false; // Still blocked
  }

  // Reset window after 60 seconds
  if (now - record.firstAttemptTime > 60000) {
    loginRateLimitMap.delete(key);
    return true;
  }

  return record.attempts < maxAttempts;
}

function recordFailedLogin(key: string, maxAttempts = 5) {
  const now = Date.now();
  const record = loginRateLimitMap.get(key);
  if (!record || now - record.firstAttemptTime > 60000) {
    loginRateLimitMap.set(key, {
      attempts: 1,
      firstAttemptTime: now,
      blockedUntil: 0,
    });
  } else {
    record.attempts += 1;
    if (record.attempts >= maxAttempts) {
      record.blockedUntil = now + 60000; // Block for 1 minute
    }
  }
}

function resetLoginRateLimit(key: string) {
  loginRateLimitMap.delete(key);
}

// -------------------------------------------------------------
// SECURE AUTHENTICATION MIDDLEWARE
// -------------------------------------------------------------
export interface AuthenticatedRequest extends Request {
  authUser?: {
    id: string;
    email: string;
    full_name: string;
    plan_tier: string;
    created_at: string;
  };
  rawToken?: string;
}

async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sesi tidak ditemukan atau header otorisasi hilang.' });
  }

  const rawToken = authHeader.split(' ')[1];
  try {
    const dbAdapter = getDatabaseAdapter();
    const user = await dbAdapter.validateSession(rawToken);

    if (!user) {
      return res.status(401).json({ error: 'Sesi tidak valid atau telah kedaluwarsa. Silakan login kembali.' });
    }

    req.authUser = user;
    req.rawToken = rawToken;
    next();
  } catch (err: any) {
    return res.status(500).json({ error: `Gagal memvalidasi sesi: ${err.message}` });
  }
}

// -------------------------------------------------------------
// SECURE FILE UPLOAD CONFIGURATION (Multer)
// -------------------------------------------------------------
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    // Generate secure cryptographically random UUID filename, ignore user-supplied names
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    const uniqueFilename = `${crypto.randomUUID()}${safeExt}`;
    cb(null, uniqueFilename);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipe file tidak didukung. Harap unggah gambar JPG, PNG, atau WebP.'));
    }
  },
});

// -------------------------------------------------------------
// 1. AUTHENTICATION ROUTES
// -------------------------------------------------------------
app.post('/api/auth/register', async (req: Request, res: Response): Promise<any> => {
  const { email, password, full_name } = req.body;
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'Email, kata sandi, dan nama lengkap wajib diisi.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
  }

  const dbAdapter = getDatabaseAdapter();
  const cleanEmail = email.toLowerCase().trim();
  const existing = await dbAdapter.getUserByEmail(cleanEmail);
  if (existing) {
    return res.status(409).json({ error: 'Email sudah terdaftar. Silakan login.' });
  }

  const newUserId = `usr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const passwordHash = hashPasswordBcrypt(password);
  const now = new Date().toISOString();

  await dbAdapter.createUser({
    id: newUserId,
    email: cleanEmail,
    password_hash: passwordHash,
    full_name: full_name.trim(),
    plan_tier: 'free',
    created_at: now,
    updated_at: now,
  });

  const session = await dbAdapter.createSession(newUserId);
  return res.status(201).json({
    token: session.rawToken,
    expiresAt: session.expiresAt,
    user: {
      id: newUserId,
      email: cleanEmail,
      full_name: full_name.trim(),
      plan_tier: 'free',
      created_at: now,
    },
  });
});

app.post('/api/auth/login', async (req: Request, res: Response): Promise<any> => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
  }

  const clientIp = req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || 'ip';
  const cleanEmail = email.toLowerCase().trim();
  const ipKey = `ip_${clientIp}`;
  const accountKey = `acc_${cleanEmail}`;

  if (!checkLoginRateLimit(ipKey, 10) || !checkLoginRateLimit(accountKey, 5)) {
    return res.status(429).json({
      error: 'Terlalu banyak percobaan login yang gagal. Silakan coba lagi setelah 1 menit.',
    });
  }

  const dbAdapter = getDatabaseAdapter();
  const userRow = await dbAdapter.getUserByEmail(cleanEmail);

  if (!userRow) {
    recordFailedLogin(ipKey, 10);
    recordFailedLogin(accountKey, 5);
    return res.status(401).json({ error: 'Email atau kata sandi tidak sesuai.' });
  }

  const verification = verifyPassword(password, userRow.password_hash);
  if (!verification.valid) {
    recordFailedLogin(ipKey, 10);
    recordFailedLogin(accountKey, 5);
    return res.status(401).json({ error: 'Email atau kata sandi tidak sesuai.' });
  }

  // If password was hashed with legacy algorithm, perform transparent automatic upgrade to bcrypt
  if (verification.needsUpgrade) {
    const upgradedHash = hashPasswordBcrypt(password);
    await dbAdapter.updateUser(userRow.id, {
      password_hash: upgradedHash,
      updated_at: new Date().toISOString(),
    });
  }

  resetLoginRateLimit(ipKey);
  resetLoginRateLimit(accountKey);
  const session = await dbAdapter.createSession(userRow.id);

  return res.json({
    token: session.rawToken,
    expiresAt: session.expiresAt,
    user: {
      id: userRow.id,
      email: userRow.email,
      full_name: userRow.full_name,
      plan_tier: userRow.plan_tier,
      created_at: userRow.created_at,
    },
  });
});

app.post('/api/auth/logout', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  if (req.rawToken) {
    const dbAdapter = getDatabaseAdapter();
    await dbAdapter.revokeSession(req.rawToken);
  }
  return res.json({ message: 'Sesi berhasil diakhiri.' });
});

app.get('/api/auth/me', authMiddleware, (req: AuthenticatedRequest, res: Response): any => {
  return res.json({ user: req.authUser });
});

app.put('/api/auth/profile', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const user = req.authUser!;
  const { full_name, new_password } = req.body;
  const dbAdapter = getDatabaseAdapter();
  const now = new Date().toISOString();

  if (full_name) {
    await dbAdapter.updateUser(user.id, {
      full_name: full_name.trim(),
      updated_at: now,
    });
    user.full_name = full_name.trim();
  }

  if (new_password && new_password.length >= 6) {
    const newHash = hashPasswordBcrypt(new_password);
    await dbAdapter.updateUser(user.id, {
      password_hash: newHash,
      updated_at: now,
    });
    // Revoke all other active sessions for this user on password change
    await dbAdapter.revokeAllUserSessions(user.id);
  }

  return res.json({ user });
});

app.post('/api/auth/reset-password-request', (req: Request, res: Response): any => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email wajib diisi.' });
  return res.json({
    message: 'Jika email terdaftar, tautan pemulihan kata sandi telah dikirimkan ke kotak masuk Anda.',
  });
});

// -------------------------------------------------------------
// 2. PRODUCTION MEDIA FILE UPLOAD ROUTE
// -------------------------------------------------------------
app.post(
  '/api/media/upload',
  authMiddleware,
  (req: AuthenticatedRequest, res: Response): any => {
    upload.single('file')(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Ukuran file melebihi batas maksimum 5MB.' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Tidak ada file yang diunggah.' });
      }

      // Cryptographic Magic Bytes (File Signature) Validation
      try {
        const headerBuf = Buffer.alloc(16);
        const fd = fs.openSync(req.file.path, 'r');
        fs.readSync(fd, headerBuf, 0, 16, 0);
        fs.closeSync(fd);

        const isJpeg = headerBuf[0] === 0xff && headerBuf[1] === 0xd8 && headerBuf[2] === 0xff;
        const isPng =
          headerBuf[0] === 0x89 &&
          headerBuf[1] === 0x50 &&
          headerBuf[2] === 0x4e &&
          headerBuf[3] === 0x47 &&
          headerBuf[4] === 0x0d &&
          headerBuf[5] === 0x0a &&
          headerBuf[6] === 0x1a &&
          headerBuf[7] === 0x0a;
        const isWebp =
          headerBuf.toString('ascii', 0, 4) === 'RIFF' &&
          headerBuf.toString('ascii', 8, 12) === 'WEBP';

        if (!isJpeg && !isPng && !isWebp) {
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(400).json({
            error: 'File ditolak: Signature atau format file bukan gambar JPEG, PNG, atau WebP yang valid.',
          });
        }
      } catch (e) {
        if (req.file?.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ error: 'Gagal memverifikasi keabsahan file gambar.' });
      }

      console.log(`[Upload API] POST /api/media/upload diterima: user=${req.authUser!.id}, size=${req.file.size}B, mime=${req.file.mimetype}`);

      // Use configured StorageAdapter (Local or Supabase Cloud Storage)
      const storageAdapter = getStorageAdapter();
      const dbAdapter = getDatabaseAdapter();

      storageAdapter
        .saveFile(req.file, req.authUser!.id)
        .then(async (result) => {
          const now = new Date().toISOString();
          // Store in relational media_files table via active adapter
          await dbAdapter.insertMediaFile({
            id: result.id,
            user_id: req.authUser!.id,
            original_name: req.file!.originalname,
            stored_filename: result.filename,
            mime_type: result.mimeType,
            size_bytes: result.size,
            file_path: result.url,
            created_at: now,
          });

          console.log(`[Upload API] Sukses menyimpan berkas: id=${result.id}, provider=${storageAdapter.providerName}`);
          return res.status(201).json({
            id: result.id,
            url: result.url,
            filename: result.filename,
            size: result.size,
            mimeType: result.mimeType,
          });
        })
        .catch((err) => {
          console.error(`[Upload API] Gagal menyimpan berkas via ${storageAdapter.providerName}:`, err.message);
          return res.status(500).json({ error: `Gagal menyimpan berkas media: ${err.message}` });
        });
    });
  }
);

// -------------------------------------------------------------
// SYSTEM & DEPLOYMENT HEALTH STATUS ROUTE
// -------------------------------------------------------------
app.get('/api/system/status', async (_req: Request, res: Response): Promise<any> => {
  const dbAdapter = getDatabaseAdapter();
  const storageAdapter = getStorageAdapter();

  const counts = await dbAdapter.getCounts();

  return res.json({
    app: 'Wedding Studio Free',
    version: '1.0.0-beta',
    environment: process.env.NODE_ENV || 'production',
    database: {
      provider: dbAdapter.getProviderName(),
      isPostgres: dbAdapter.isPostgres(),
      mode: dbAdapter.isPostgres() ? 'Connection Pooling' : 'WAL',
    },
    storage: {
      provider: storageAdapter.providerName,
      isRemote: storageAdapter.isRemote(),
      ephemeralRisk: !storageAdapter.isRemote(),
    },
    counts,
  });
});

// -------------------------------------------------------------
// 3. WEDDING PROJECTS (PRIVATE / CRUD)
// -------------------------------------------------------------

app.get('/api/weddings', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const userId = req.authUser!.id;
  const dbAdapter = getDatabaseAdapter();
  const weddings = await dbAdapter.getWeddingsByOwner(userId);
  return res.json({ weddings });
});

app.post('/api/weddings', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const userId = req.authUser!.id;
  const weddingData = req.body;
  const dbAdapter = getDatabaseAdapter();

  let isPublished = weddingData.is_published === true;

  // Transactional quota check
  if (isPublished) {
    const canPublish = await dbAdapter.checkPublishQuota(userId, 'new', true);
    if (!canPublish) {
      isPublished = false;
    }
  }

  // Ensure unique slug
  let slug = weddingData.slug ? weddingData.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-') : '';
  if (!slug) {
    slug = `wedding-${Date.now().toString(36)}`;
  }

  const isTaken = await dbAdapter.isSlugTaken(slug);
  if (isTaken) {
    slug = `${slug}-${Math.floor(100 + Math.random() * 900)}`;
  }

  const newId = `wed_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const now = new Date().toISOString();

  await dbAdapter.createWedding({
    id: newId,
    owner_id: userId,
    title: weddingData.title || 'Undangan Pernikahan',
    slug,
    is_published: isPublished,
    theme_id: weddingData.theme_id || 'minimalist-ivory',
    font_pair: weddingData.font_pair || 'cormorant-jakarta',
    color_palette: weddingData.color_palette || {},
    hero_layout: weddingData.hero_layout || 'classic_centered',
    cover_image: weddingData.cover_image || '',
    groom: weddingData.groom || {},
    bride: weddingData.bride || {},
    events: weddingData.events || [],
    love_stories: weddingData.love_stories || [],
    gallery_photos: weddingData.gallery_photos || [],
    bank_accounts: weddingData.bank_accounts || [],
    gift_address: weddingData.gift_address || {},
    dress_code: weddingData.dress_code || {},
    quote: weddingData.quote || {},
    sections_order: weddingData.sections_order || [],
    audio_bg: weddingData.audio_bg || {},
    free_plan_badge: weddingData.free_plan_badge !== false,
    created_at: now,
    updated_at: now,
  });

  const wedding = await dbAdapter.getWeddingById(newId);
  return res.status(201).json({ wedding });
});

app.get('/api/weddings/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const userId = req.authUser!.id;
  const dbAdapter = getDatabaseAdapter();
  const wedding = await dbAdapter.getWeddingById(req.params.id);

  if (!wedding) {
    return res.status(404).json({ error: 'Undangan tidak ditemukan.' });
  }

  // Strict ownership check in server
  if (wedding.owner_id !== userId) {
    return res.status(403).json({ error: 'Akses ditolak. Anda bukan pemilik undangan ini.' });
  }

  return res.json({ wedding });
});

app.put('/api/weddings/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const userId = req.authUser!.id;
  const weddingId = req.params.id;
  const dbAdapter = getDatabaseAdapter();

  const wedding = await dbAdapter.getWeddingById(weddingId);
  if (!wedding) return res.status(404).json({ error: 'Undangan tidak ditemukan.' });

  if (wedding.owner_id !== userId) {
    return res.status(403).json({ error: 'Akses ditolak.' });
  }

  const updates = req.body;
  const willBePublished = updates.is_published !== undefined ? Boolean(updates.is_published) : (wedding.is_published === true || wedding.is_published === 1);

  // Concurrency-safe atomic transaction check for Free Plan Quota
  if (willBePublished && !(wedding.is_published === true || wedding.is_published === 1)) {
    const canPublish = await dbAdapter.checkPublishQuota(userId, weddingId, true);
    if (!canPublish) {
      return res.status(400).json({
        error: 'Batas paket Free tercapai: Maksimal 1 undangan yang dipublikasikan secara aktif. Harap nonaktifkan publikasi undangan lain terlebih dahulu.',
      });
    }
  }

  // Prevent slug collision
  let cleanSlug = wedding.slug;
  if (updates.slug && updates.slug !== wedding.slug) {
    cleanSlug = updates.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const isTaken = await dbAdapter.isSlugTaken(cleanSlug, weddingId);
    if (isTaken) {
      return res.status(409).json({ error: 'Alamat slug ini sudah digunakan oleh undangan lain. Silakan pilih slug lain.' });
    }
  }

  try {
    let galleryPhotos = wedding.gallery_photos;
    if (updates.gallery_photos !== undefined) {
      if (Array.isArray(updates.gallery_photos)) {
        if (updates.gallery_photos.length > 12) {
          return res.status(400).json({
            error: 'Batas paket Free tercapai: Maksimal 12 foto dalam galeri.',
          });
        }
        galleryPhotos = updates.gallery_photos.map((p: any, idx: number) => ({
          id: typeof p?.id === 'string' && p.id ? p.id : `g_${Date.now()}_${idx}`,
          url: typeof p?.url === 'string' ? p.url.trim() : '',
          caption: typeof p?.caption === 'string' ? p.caption.trim() : '',
        }));
      } else {
        galleryPhotos = [];
      }
    }

    await dbAdapter.updateWedding(weddingId, userId, {
      title: updates.title !== undefined ? updates.title : wedding.title,
      slug: cleanSlug,
      theme_id: updates.theme_id !== undefined ? updates.theme_id : wedding.theme_id,
      font_pair: updates.font_pair !== undefined ? updates.font_pair : wedding.font_pair,
      color_palette: updates.color_palette !== undefined ? updates.color_palette : wedding.color_palette,
      hero_layout: updates.hero_layout !== undefined ? updates.hero_layout : wedding.hero_layout,
      cover_image: updates.cover_image !== undefined ? updates.cover_image : wedding.cover_image,
      groom: updates.groom !== undefined ? updates.groom : wedding.groom,
      bride: updates.bride !== undefined ? updates.bride : wedding.bride,
      events: updates.events !== undefined ? updates.events : wedding.events,
      love_stories: updates.love_stories !== undefined ? updates.love_stories : wedding.love_stories,
      gallery_photos: galleryPhotos,
      bank_accounts: updates.bank_accounts !== undefined ? updates.bank_accounts : wedding.bank_accounts,
      gift_address: updates.gift_address !== undefined ? updates.gift_address : wedding.gift_address,
      dress_code: updates.dress_code !== undefined ? updates.dress_code : wedding.dress_code,
      quote: updates.quote !== undefined ? updates.quote : wedding.quote,
      sections_order: updates.sections_order !== undefined ? updates.sections_order : wedding.sections_order,
      audio_bg: updates.audio_bg !== undefined ? updates.audio_bg : wedding.audio_bg,
      is_published: willBePublished,
    });
  } catch (err: any) {
    if (err.code === 'QUOTA_EXCEEDED' || err.message?.includes('Batas paket Free tercapai')) {
      return res.status(400).json({
        error: 'Batas paket Free tercapai: Maksimal 1 undangan yang dipublikasikan secara aktif. Harap nonaktifkan publikasi undangan lain terlebih dahulu.',
      });
    }
    console.error('[Error PUT /api/weddings/:id]', err?.message || 'Update failed');
    return res.status(500).json({ error: `Gagal memperbarui undangan: ${err.message}` });
  }

  const updatedWedding = await dbAdapter.getWeddingById(weddingId);
  return res.json({ wedding: updatedWedding });
});

app.delete('/api/weddings/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const userId = req.authUser!.id;
  const weddingId = req.params.id;
  const dbAdapter = getDatabaseAdapter();

  const wedding = await dbAdapter.getWeddingById(weddingId);
  if (!wedding) return res.status(404).json({ error: 'Undangan tidak ditemukan.' });

  if (wedding.owner_id !== userId) {
    return res.status(403).json({ error: 'Akses ditolak.' });
  }

  await dbAdapter.deleteWedding(weddingId, userId);
  return res.json({ message: 'Undangan berhasil dihapus.', id: weddingId });
});

app.post('/api/weddings/:id/duplicate', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const userId = req.authUser!.id;
  const dbAdapter = getDatabaseAdapter();
  const original = await dbAdapter.getWeddingById(req.params.id);

  if (!original || original.owner_id !== userId) {
    return res.status(404).json({ error: 'Undangan tidak ditemukan.' });
  }

  const dupId = `wed_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const dupSlug = `${original.slug}-copy-${Math.floor(100 + Math.random() * 900)}`;
  const now = new Date().toISOString();

  await dbAdapter.createWedding({
    id: dupId,
    owner_id: userId,
    title: `${original.title} (Salinan)`,
    slug: dupSlug,
    is_published: false,
    theme_id: original.theme_id,
    font_pair: original.font_pair,
    color_palette: original.color_palette,
    hero_layout: original.hero_layout,
    cover_image: original.cover_image,
    groom: original.groom,
    bride: original.bride,
    events: original.events,
    love_stories: original.love_stories,
    gallery_photos: original.gallery_photos,
    bank_accounts: original.bank_accounts,
    gift_address: original.gift_address,
    dress_code: original.dress_code,
    quote: original.quote,
    sections_order: original.sections_order,
    audio_bg: original.audio_bg,
    free_plan_badge: original.free_plan_badge,
    created_at: now,
    updated_at: now,
  });

  const dup = await dbAdapter.getWeddingById(dupId);
  return res.status(201).json({ wedding: dup });
});

// -------------------------------------------------------------
// 4. RSVP MANAGEMENT (OWNER ONLY)
// -------------------------------------------------------------
app.get('/api/weddings/:id/rsvps', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const userId = req.authUser!.id;
  const weddingId = req.params.id;
  const dbAdapter = getDatabaseAdapter();

  const wedding = await dbAdapter.getWeddingById(weddingId);
  if (!wedding || wedding.owner_id !== userId) {
    return res.status(403).json({ error: 'Akses ditolak.' });
  }

  const [rsvps, wishes] = await Promise.all([
    dbAdapter.getRsvps(weddingId),
    dbAdapter.getGuestMessages(weddingId),
  ]);

  const stats = {
    totalResponses: rsvps.length,
    hadir: rsvps.filter((r: any) => r.attendance === 'hadir').length,
    tidakHadir: rsvps.filter((r: any) => r.attendance === 'tidak_hadir').length,
    ragu: rsvps.filter((r: any) => r.attendance === 'ragu').length,
    totalGuestsPax: rsvps
      .filter((r: any) => r.attendance === 'hadir')
      .reduce((acc: number, curr: any) => acc + (curr.pax_count || 1), 0),
  };

  return res.json({ rsvps, wishes, stats });
});

app.delete('/api/weddings/:id/rsvps/:rsvpId', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const userId = req.authUser!.id;
  const { id: weddingId, rsvpId } = req.params;
  const dbAdapter = getDatabaseAdapter();

  const wedding = await dbAdapter.getWeddingById(weddingId);
  if (!wedding || wedding.owner_id !== userId) {
    return res.status(403).json({ error: 'Akses ditolak.' });
  }

  await dbAdapter.deleteRsvp(rsvpId, weddingId);
  return res.json({ message: 'RSVP berhasil dihapus.' });
});

app.delete('/api/weddings/:id/wishes/:wishId', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const userId = req.authUser!.id;
  const { id: weddingId, wishId } = req.params;
  const dbAdapter = getDatabaseAdapter();

  const wedding = await dbAdapter.getWeddingById(weddingId);
  if (!wedding || wedding.owner_id !== userId) {
    return res.status(403).json({ error: 'Akses ditolak.' });
  }

  await dbAdapter.deleteGuestMessage(wishId, weddingId);
  return res.json({ message: 'Ucapan berhasil dihapus.' });
});

// -------------------------------------------------------------
// 5. PUBLIC INVITATION ROUTES (BY SLUG)
// -------------------------------------------------------------
app.get('/api/public/weddings/:slug', async (req: Request, res: Response): Promise<any> => {
  const dbAdapter = getDatabaseAdapter();
  const slug = (req.params.slug || '').trim().replace(/^\/+|\/+$/g, '').toLowerCase();
  const wedding = await dbAdapter.getPublishedWeddingBySlug(slug);

  if (!wedding) {
    const isTaken = await dbAdapter.isSlugTaken(slug);
    if (isTaken) {
      return res.status(403).json({
        error: 'Undangan ini belum dipublikasikan oleh pemiliknya (status draf privat).',
        is_draft: true,
      });
    }
    return res.status(404).json({ error: 'Undangan pernikahan tidak ditemukan atau link sudah tidak aktif.' });
  }

  // Strip private owner_id
  const { owner_id, ...publicData } = wedding;
  return res.json({ wedding: publicData });
});

app.get('/api/public/weddings/:slug/wishes', async (req: Request, res: Response): Promise<any> => {
  const dbAdapter = getDatabaseAdapter();
  const slug = (req.params.slug || '').trim().replace(/^\/+|\/+$/g, '').toLowerCase();
  const wedding = await dbAdapter.getPublishedWeddingBySlug(slug);

  if (!wedding) {
    return res.status(404).json({ error: 'Undangan tidak ditemukan atau belum dipublikasikan.' });
  }

  const wishes = await dbAdapter.getGuestMessages(wedding.id);
  return res.json({ wishes });
});

app.post('/api/public/weddings/:slug/wishes', async (req: Request, res: Response): Promise<any> => {
  const dbAdapter = getDatabaseAdapter();
  const slug = (req.params.slug || '').trim().replace(/^\/+|\/+$/g, '').toLowerCase();
  const wedding = await dbAdapter.getPublishedWeddingBySlug(slug);

  if (!wedding) {
    return res.status(404).json({ error: 'Undangan tidak ditemukan atau belum dipublikasikan.' });
  }

  // Rate Limiter per client IP (3 seconds throttle)
  const clientIp = req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress || 'unknown';
  const nowMs = Date.now();
  const lastTime = rsvpRateLimitMap.get(clientIp) || 0;
  if (nowMs - lastTime < 3000) {
    return res.status(429).json({ error: 'Mohon tunggu beberapa detik sebelum mengirim ucapan doa lagi.' });
  }
  rsvpRateLimitMap.set(clientIp, nowMs);

  const { sender_name, message, relationship } = req.body;

  if (!sender_name || typeof sender_name !== 'string' || sender_name.trim().length === 0) {
    return res.status(400).json({ error: 'Nama pengirim wajib diisi.' });
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Pesan ucapan doa wajib diisi.' });
  }

  const cleanName = sender_name.trim().substring(0, 100);
  const cleanMessage = String(message).trim().substring(0, 500);
  const cleanRel = relationship ? String(relationship).trim().substring(0, 50) : 'Tamu Undangan';
  const now = new Date().toISOString();
  const wishId = `wish_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

  await dbAdapter.insertGuestMessage({
    id: wishId,
    wedding_id: wedding.id,
    sender_name: cleanName,
    relationship: cleanRel,
    message: cleanMessage,
    is_approved: true,
    created_at: now,
  });

  return res.status(201).json({
    message: 'Terima kasih, doa restu Anda telah tersimpan!',
    wish: {
      id: wishId,
      wedding_id: wedding.id,
      sender_name: cleanName,
      relationship: cleanRel,
      message: cleanMessage,
      is_approved: true,
      created_at: now,
    },
  });
});

app.post('/api/public/weddings/:slug/rsvp', async (req: Request, res: Response): Promise<any> => {
  const dbAdapter = getDatabaseAdapter();
  const slug = (req.params.slug || '').trim().replace(/^\/+|\/+$/g, '').toLowerCase();
  const wedding = await dbAdapter.getPublishedWeddingBySlug(slug);

  if (!wedding) {
    return res.status(404).json({ error: 'Undangan tidak ditemukan.' });
  }

  // Rate Limiter per client IP (3 seconds throttle)
  const clientIp = req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress || 'unknown';
  const nowMs = Date.now();
  const lastTime = rsvpRateLimitMap.get(clientIp) || 0;
  if (nowMs - lastTime < 3000) {
    return res.status(429).json({ error: 'Mohon tunggu beberapa detik sebelum mengirim konfirmasi lagi.' });
  }
  rsvpRateLimitMap.set(clientIp, nowMs);

  const { guest_name, attendance, pax_count, message, relationship } = req.body;

  if (!guest_name || typeof guest_name !== 'string' || guest_name.trim().length === 0) {
    return res.status(400).json({ error: 'Nama tamu wajib diisi.' });
  }
  if (!['hadir', 'tidak_hadir', 'ragu'].includes(attendance)) {
    return res.status(400).json({ error: 'Status kehadiran tidak valid.' });
  }

  const cleanName = guest_name.trim().substring(0, 100);
  const cleanPax = Math.min(Math.max(Number(pax_count) || 1, 1), 10);
  const cleanMessage = message ? String(message).trim().substring(0, 500) : '';
  const now = new Date().toISOString();
  const rsvpId = `rsvp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const ipHash = crypto.createHash('md5').update(clientIp).digest('hex').substring(0, 8);

  await dbAdapter.insertRsvp({
    id: rsvpId,
    wedding_id: wedding.id,
    guest_name: cleanName,
    attendance,
    pax_count: cleanPax,
    message: cleanMessage,
    ip_hash: ipHash,
    created_at: now,
  });

  if (cleanMessage) {
    const wishId = `wish_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    await dbAdapter.insertGuestMessage({
      id: wishId,
      wedding_id: wedding.id,
      sender_name: cleanName,
      relationship: relationship ? String(relationship).trim().substring(0, 50) : 'Tamu Undangan',
      message: cleanMessage,
      is_approved: true,
      created_at: now,
    });
  }

  return res.status(201).json({
    message: 'Terima kasih, konfirmasi kehadiran Anda telah tersimpan!',
    rsvp: {
      id: rsvpId,
      wedding_id: wedding.id,
      guest_name: cleanName,
      attendance,
      pax_count: cleanPax,
      message: cleanMessage,
      ip_hash: ipHash,
      created_at: now,
    },
  });
});

// -------------------------------------------------------------
// 6. PLAN LIMITS CONFIG
// -------------------------------------------------------------
app.get('/api/plan-limits', (_req: Request, res: Response) => {
  return res.json({
    free: {
      maxActivePublished: 1,
      maxPhotos: 12,
      brandingBadge: true,
      customSlugAllowed: true,
      rsvpEnabled: true,
      digitalGiftEnabled: true,
      audioBgEnabled: true,
      allThemesUnlocked: true,
      fileUploadLimitMb: 5,
    },
    premium: {
      maxActivePublished: 10,
      maxPhotos: 50,
      brandingBadge: false,
      customSlugAllowed: true,
      rsvpEnabled: true,
      digitalGiftEnabled: true,
      audioBgEnabled: true,
      allThemesUnlocked: true,
      fileUploadLimitMb: 25,
    },
  });
});

// Explicit JSON 404 Handler for unmatched API routes (prevents Vite SPA fallback from returning HTML on API requests)
app.all(['/api', '/api/*'], (req: Request, res: Response) => {
  return res.status(404).json({ error: `Endpoint API ${req.method} ${req.path} tidak ditemukan.` });
});

// Global Express error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Unhandled Server Error]', err?.message || err);
  if (res.headersSent) return;
  return res.status(500).json({ error: 'Terjadi kesalahan pada server saat memproses permintaan.' });
});

// -------------------------------------------------------------
// 7. DEV SERVER & PRODUCTION SERVER STARTUP
// -------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    const indexHtml = path.join(distPath, 'index.html');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(503).send('Aplikasi sedang dalam proses build atau folder dist belum tersedia. Silakan jalankan npm run build.');
      }
    });
  }

  const portNumber = Number(PORT) || 3000;
  app.listen(portNumber, '0.0.0.0', () => {
    console.log(`Wedding Studio Server running on port ${portNumber} (host: 0.0.0.0, mode: ${isProd ? 'production' : 'development'})`);
  });
}

startServer();
