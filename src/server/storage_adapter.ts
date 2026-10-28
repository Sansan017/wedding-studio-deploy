import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface UploadResult {
  id: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface StorageAdapter {
  readonly providerName: string;
  saveFile(file: Express.Multer.File, userId: string): Promise<UploadResult>;
  deleteFile(storedFilename: string): Promise<boolean>;
  isRemote(): boolean;
}

/**
 * Local Storage Adapter (Saves to filesystem /uploads)
 * Note: Subject to ephemeral container storage loss on Cloud Run without persistent disk.
 */
export class LocalStorageAdapter implements StorageAdapter {
  readonly providerName = 'local_filesystem';
  private uploadsDir: string;

  constructor(uploadsDir?: string) {
    this.uploadsDir = uploadsDir || path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async saveFile(file: Express.Multer.File, userId: string): Promise<UploadResult> {
    const fileId = `med_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const relativeUrl = `/uploads/${file.filename}`;

    return {
      id: fileId,
      url: relativeUrl,
      filename: file.filename,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  async deleteFile(storedFilename: string): Promise<boolean> {
    const filePath = path.join(this.uploadsDir, storedFilename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  isRemote(): boolean {
    return false;
  }
}

/**
 * Supabase Cloud Storage Adapter (Persistent Object Storage)
 * Persists files permanently in the single Supabase Storage bucket specified by SUPABASE_MEDIA_BUCKET ('wedding-photos').
 */
export class SupabaseStorageAdapter implements StorageAdapter {
  readonly providerName = 'supabase_storage';
  private client: SupabaseClient;
  private bucket: string;

  constructor(supabaseUrl: string, serviceRoleKey: string, bucket = 'wedding-photos') {
    this.client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    this.bucket = (bucket || 'wedding-photos').toLowerCase().trim();
  }

  async saveFile(file: Express.Multer.File, userId: string): Promise<UploadResult> {
    const fileId = `med_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const extension = path.extname(file.originalname).toLowerCase() || '.jpg';
    const remoteFilename = `${userId}/${crypto.randomUUID()}${extension}`;

    // Read the file buffer from disk
    const fileBuffer = fs.readFileSync(file.path);

    try {
      const uploadRes = await this.client.storage
        .from(this.bucket)
        .upload(remoteFilename, fileBuffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (uploadRes.error || !uploadRes.data) {
        const errMsg = uploadRes.error?.message || '';
        const errDetails = JSON.stringify(uploadRes.error || {});
        const isBucketNotFound =
          errMsg.toLowerCase().includes('bucket not found') ||
          errMsg.toLowerCase().includes('nosuchbucket') ||
          errDetails.toLowerCase().includes('bucket not found') ||
          errDetails.toLowerCase().includes('nosuchbucket') ||
          (uploadRes.error as any)?.statusCode === '404' ||
          (uploadRes.error as any)?.statusCode === 404 ||
          (uploadRes.error as any)?.code === 'NoSuchBucket' ||
          (errMsg.toLowerCase().includes('bucket') && errMsg.toLowerCase().includes('not found'));

        if (isBucketNotFound) {
          throw new Error(
            `Bucket "${this.bucket}" tidak ditemukan di Supabase Storage. Harap pastikan bucket "${this.bucket}" telah dibuat di dashboard Supabase.`
          );
        }

        throw new Error(`Gagal mengunggah file ke Supabase Storage: ${uploadRes.error?.message || 'Unknown error'}`);
      }

      // Get public URL directly from the single configured bucket
      const uploadedPath = uploadRes.data?.path || remoteFilename;
      const { data: publicUrlData } = this.client.storage
        .from(this.bucket)
        .getPublicUrl(uploadedPath);

      let finalUrl = publicUrlData?.publicUrl;
      if (!finalUrl || finalUrl.trim().length === 0) {
        const supabaseBase = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
        finalUrl = `${supabaseBase}/storage/v1/object/public/${this.bucket}/${uploadedPath}`;
      }

      if (!finalUrl || typeof finalUrl !== 'string' || !finalUrl.startsWith('http')) {
        throw new Error('Supabase Storage tidak menghasilkan URL publik yang valid.');
      }

      return {
        id: fileId,
        url: finalUrl,
        filename: remoteFilename,
        size: file.size,
        mimeType: file.mimetype,
      };
    } finally {
      // Ensure local temporary upload file is cleaned up safely
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch {}
    }
  }

  async deleteFile(storedFilename: string): Promise<boolean> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .remove([storedFilename]);

    return !error;
  }

  isRemote(): boolean {
    return true;
  }
}

/**
 * Factory function to retrieve current active storage adapter.
 * Uses Supabase Storage if configured server-side, else falls back to LocalStorage.
 */
let cachedStorageAdapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (cachedStorageAdapter) return cachedStorageAdapter;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const forceLocal = process.env.STORAGE_PROVIDER === 'local';

  if (!forceLocal && supabaseUrl && supabaseServiceKey) {
    const rawBucket = process.env.SUPABASE_MEDIA_BUCKET || 'wedding-photos';
    const bucket = rawBucket.toLowerCase().trim();
    console.log(`[Storage] Menggunakan Supabase Storage tunggal (Bucket: ${bucket})`);
    cachedStorageAdapter = new SupabaseStorageAdapter(supabaseUrl, supabaseServiceKey, bucket);
  } else {
    cachedStorageAdapter = new LocalStorageAdapter();
  }

  return cachedStorageAdapter;
}

export function resetStorageAdapterCache(): void {
  cachedStorageAdapter = null;
}

