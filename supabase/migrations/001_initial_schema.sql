-- ==============================================================================
-- Wedding Studio Production — Supabase PostgreSQL Schema & RLS Policies
-- Migration: 001_initial_schema.sql
-- ==============================================================================

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  plan_tier TEXT DEFAULT 'free' CHECK (plan_tier IN ('free', 'pro_monthly', 'pro_yearly')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 2. SESSIONS TABLE (For standalone API server / session validation)
CREATE TABLE IF NOT EXISTS public.sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  expires_at BIGINT NOT NULL,
  is_revoked BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions(expires_at);

-- 3. WEDDINGS TABLE
CREATE TABLE IF NOT EXISTS public.weddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_published BOOLEAN DEFAULT FALSE,
  theme_id TEXT NOT NULL DEFAULT 'minimalist-ivory',
  font_pair TEXT DEFAULT 'cormorant-jakarta',
  color_palette JSONB DEFAULT '{"primary": "#8C7355", "secondary": "#C5A880", "accent": "#B89758", "background": "#FAF8F5", "surface": "#FFFFFF", "text": "#2C2623"}'::jsonb,
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
  free_plan_badge BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);
CREATE INDEX IF NOT EXISTS idx_weddings_owner_id ON public.weddings(owner_id);
CREATE INDEX IF NOT EXISTS idx_weddings_slug ON public.weddings(slug);

-- 4. RSVPS TABLE
CREATE TABLE IF NOT EXISTS public.rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id UUID NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  attendance TEXT NOT NULL CHECK (attendance IN ('hadir', 'tidak_hadir', 'ragu')),
  pax_count INTEGER NOT NULL DEFAULT 1 CHECK (pax_count >= 1 AND pax_count <= 10),
  message TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);
CREATE INDEX IF NOT EXISTS idx_rsvps_wedding_id ON public.rsvps(wedding_id);

-- 5. GUEST_MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.guest_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id UUID NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  relationship TEXT DEFAULT 'Tamu Undangan',
  message TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);
CREATE INDEX IF NOT EXISTS idx_guest_messages_wedding_id ON public.guest_messages(wedding_id);

-- 6. MEDIA_FILES TABLE
CREATE TABLE IF NOT EXISTS public.media_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  stored_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);
CREATE INDEX IF NOT EXISTS idx_media_files_user_id ON public.media_files(user_id);

-- 7. SUBSCRIPTIONS TABLE (For upcoming Pro tier)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_tier TEXT NOT NULL CHECK (plan_tier IN ('pro_monthly', 'pro_yearly')),
  status TEXT NOT NULL CHECK (status IN ('active', 'pending', 'cancelled', 'expired')),
  payment_provider TEXT NOT NULL,
  external_subscription_id TEXT,
  amount_paid NUMERIC(12, 2) NOT NULL,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only read and update their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Sessions: Users can only read or revoke their own sessions
CREATE POLICY "Users can access own sessions"
  ON public.sessions FOR ALL
  USING (auth.uid() = user_id);

-- Weddings:
CREATE POLICY "Owners can CRUD own weddings"
  ON public.weddings FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Public can view published weddings"
  ON public.weddings FOR SELECT
  USING (is_published = TRUE);

-- RSVPs:
CREATE POLICY "Public can insert RSVP"
  ON public.rsvps FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.weddings
      WHERE weddings.id = rsvps.wedding_id AND weddings.is_published = TRUE
    )
  );

CREATE POLICY "Owners can view their wedding RSVPs"
  ON public.rsvps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.weddings
      WHERE weddings.id = rsvps.wedding_id AND weddings.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can delete their wedding RSVPs"
  ON public.rsvps FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.weddings
      WHERE weddings.id = rsvps.wedding_id AND weddings.owner_id = auth.uid()
    )
  );

-- Guest Messages:
CREATE POLICY "Public can view guest messages"
  ON public.guest_messages FOR SELECT
  USING (
    is_approved = TRUE AND
    EXISTS (
      SELECT 1 FROM public.weddings
      WHERE weddings.id = guest_messages.wedding_id AND weddings.is_published = TRUE
    )
  );

CREATE POLICY "Public can insert guest message"
  ON public.guest_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.weddings
      WHERE weddings.id = guest_messages.wedding_id AND weddings.is_published = TRUE
    )
  );

CREATE POLICY "Owners can manage guest messages"
  ON public.guest_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.weddings
      WHERE weddings.id = guest_messages.wedding_id AND weddings.owner_id = auth.uid()
    )
  );

-- Media Files:
CREATE POLICY "Users can manage own media files"
  ON public.media_files FOR ALL
  USING (auth.uid() = user_id);

-- Subscriptions:
CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);
