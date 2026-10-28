-- ==============================================================================
-- Wedding Studio Free — Standalone PostgreSQL Production Migration Schema
-- Compatible with: Supabase, Neon, Cloud SQL, AWS RDS, Railway, Self-Hosted PG
-- File: supabase/migrations/002_standalone_postgres_schema.sql
-- ==============================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. USERS TABLE (Self-contained authentication, no external auth dependency)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  plan_tier TEXT NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free', 'pro_monthly', 'pro_yearly')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- 2. SESSIONS TABLE (Cryptographically Random 256-bit Token Hashes)
CREATE TABLE IF NOT EXISTS public.sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at BIGINT NOT NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions(expires_at);

-- 3. WEDDINGS TABLE (Complete Rich Configuration)
CREATE TABLE IF NOT EXISTS public.weddings (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  theme_id TEXT NOT NULL DEFAULT 'minimalist-ivory',
  font_pair TEXT NOT NULL DEFAULT 'cormorant-jakarta',
  color_palette JSONB NOT NULL DEFAULT '{"primary": "#8C7355", "secondary": "#C5A880", "accent": "#B89758", "background": "#FAF8F5", "surface": "#FFFFFF", "text": "#2C2623"}'::jsonb,
  hero_layout TEXT DEFAULT 'classic_centered',
  cover_image TEXT,
  groom JSONB NOT NULL DEFAULT '{"name": "Raden Febrian", "nickname": "Raden", "father": "Bpk. Hendra", "mother": "Ibu Ratna", "bio": "", "instagram": "@raden"}'::jsonb,
  bride JSONB NOT NULL DEFAULT '{"name": "Annisa Putri", "nickname": "Annisa", "father": "Bpk. Joko", "mother": "Ibu Sri", "bio": "", "instagram": "@annisa"}'::jsonb,
  events JSONB NOT NULL DEFAULT '[]'::jsonb,
  love_stories JSONB NOT NULL DEFAULT '[]'::jsonb,
  gallery_photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  bank_accounts JSONB NOT NULL DEFAULT '[]'::jsonb,
  gift_address JSONB DEFAULT '{"recipient_name": "", "phone": "", "address": ""}'::jsonb,
  dress_code JSONB DEFAULT '{"title": "Dress Code Tamu", "description": "Earth Tone / Pastel / Batik", "colors": ["#FAF8F5", "#C5A880", "#536B54"]}'::jsonb,
  quote JSONB DEFAULT '{"text": "Dan di antara tanda-tanda kebesaran-Nya...", "source": "QS. Ar-Rum: 21"}'::jsonb,
  sections_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  audio_bg JSONB DEFAULT '{"enabled": true, "title": "Canon in D", "artist": "Wedding Studio", "url": "", "auto_play": false}'::jsonb,
  free_plan_badge BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_weddings_owner_id ON public.weddings(owner_id);
CREATE INDEX IF NOT EXISTS idx_weddings_slug ON public.weddings(slug);

-- 4. RSVPS TABLE
CREATE TABLE IF NOT EXISTS public.rsvps (
  id TEXT PRIMARY KEY,
  wedding_id TEXT NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  attendance TEXT NOT NULL CHECK (attendance IN ('hadir', 'tidak_hadir', 'ragu')),
  pax_count INTEGER NOT NULL DEFAULT 1 CHECK (pax_count >= 1 AND pax_count <= 10),
  message TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rsvps_wedding_id ON public.rsvps(wedding_id);

-- 5. GUEST_MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.guest_messages (
  id TEXT PRIMARY KEY,
  wedding_id TEXT NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'Tamu Undangan',
  message TEXT NOT NULL,
  is_approved BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_guest_messages_wedding_id ON public.guest_messages(wedding_id);

-- 6. MEDIA_FILES TABLE (Uploaded Physical & Cloud Photos)
CREATE TABLE IF NOT EXISTS public.media_files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  stored_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_media_files_user_id ON public.media_files(user_id);
