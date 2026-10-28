export type ThemeId =
  | 'minimalist-ivory'
  | 'elegant-floral'
  | 'sage-garden'
  | 'modern-terracotta'
  | 'romantic-blush'
  | 'midnight-gold';

export type FontPairId =
  | 'cormorant-jakarta'
  | 'playfair-dmsans'
  | 'cinzel-jakarta'
  | 'cormorant-dmsans';

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
}

export interface PersonInfo {
  name: string;
  nickname: string;
  father: string;
  mother: string;
  bio?: string;
  instagram?: string;
  photo_url?: string;
}

export interface WeddingEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm or "Selesai"
  timezone: string; // WIB, WITA, WIT
  location_name: string;
  address: string;
  maps_url: string;
  is_active: boolean;
}

export interface LoveStoryItem {
  id: string;
  year: string;
  title: string;
  description: string;
  photo_url?: string;
}

export interface GalleryPhoto {
  id: string;
  url: string;
  caption?: string;
}

export interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  qr_code_url?: string;
}

export interface GiftAddress {
  recipient_name: string;
  phone: string;
  address: string;
  note?: string;
}

export interface DressCode {
  title: string;
  description: string;
  colors: string[];
}

export interface Quote {
  text: string;
  source: string;
}

export interface AudioBg {
  enabled: boolean;
  title: string;
  artist: string;
  url?: string;
  auto_play: boolean;
}

export interface SectionConfig {
  id: string;
  label: string;
  is_enabled: boolean;
}

export interface WeddingData {
  id: string;
  owner_id: string;
  title: string;
  slug: string;
  is_published: boolean;
  theme_id: ThemeId;
  font_pair: FontPairId;
  color_palette: ColorPalette;
  hero_layout?: 'classic_centered' | 'split_portrait' | 'minimal_arch';
  cover_image?: string;
  groom: PersonInfo;
  bride: PersonInfo;
  events: WeddingEvent[];
  love_stories: LoveStoryItem[];
  gallery_photos: GalleryPhoto[];
  bank_accounts: BankAccount[];
  gift_address: GiftAddress;
  dress_code: DressCode;
  quote: Quote;
  audio_bg: AudioBg;
  sections_order: SectionConfig[];
  free_plan_badge: boolean;
  created_at: string;
  updated_at: string;
}

export interface ThemePreset {
  id: ThemeId;
  name: string;
  description: string;
  badge: string;
  defaultFontPair: FontPairId;
  colors: ColorPalette;
  decorStyle: 'minimal' | 'floral' | 'organic' | 'boho' | 'romantic' | 'celestial';
}

export interface RsvpItem {
  id: string;
  wedding_id: string;
  guest_name: string;
  attendance: 'hadir' | 'tidak_hadir' | 'ragu';
  pax_count: number;
  message?: string;
  created_at: string;
}

export interface GuestWish {
  id: string;
  wedding_id: string;
  sender_name: string;
  relationship: string;
  message: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  plan_tier: 'free' | 'premium';
  created_at: string;
}

export const THEME_PRESETS: Record<ThemeId, ThemePreset> = {
  'minimalist-ivory': {
    id: 'minimalist-ivory',
    name: 'Minimalist Ivory',
    description: 'Palet gading hangat dengan aksen emas sampanye & tipografi klasik anggun.',
    badge: 'Populer',
    defaultFontPair: 'cormorant-jakarta',
    colors: {
      primary: '#8C7355',
      secondary: '#C5A880',
      accent: '#B89758',
      background: '#FAF8F5',
      surface: '#FFFFFF',
      text: '#2C2623',
      textMuted: '#786F66',
    },
    decorStyle: 'minimal',
  },
  'elegant-floral': {
    id: 'elegant-floral',
    name: 'Elegant Floral',
    description: 'Nuansa bunga botani elegan dengan sentuhan rose gold dan kemewahan alami.',
    badge: 'Favorit',
    defaultFontPair: 'playfair-dmsans',
    colors: {
      primary: '#9D5C63',
      secondary: '#D4A3A7',
      accent: '#C78283',
      background: '#FDFBFB',
      surface: '#FFFFFF',
      text: '#342526',
      textMuted: '#7C6768',
    },
    decorStyle: 'floral',
  },
  'sage-garden': {
    id: 'sage-garden',
    name: 'Sage Garden',
    description: 'Segar dan damai dengan warna hijau eucalyptus sage & aksen daun zaitun alami.',
    badge: 'Natural',
    defaultFontPair: 'cormorant-jakarta',
    colors: {
      primary: '#49654C',
      secondary: '#8FA893',
      accent: '#5E7D62',
      background: '#F4F7F4',
      surface: '#FFFFFF',
      text: '#1C291E',
      textMuted: '#586A5A',
    },
    decorStyle: 'organic',
  },
  'modern-terracotta': {
    id: 'modern-terracotta',
    name: 'Modern Terracotta',
    description: 'Hangat bernuansa tanah liat terracotta Mediterania & sentuhan bohemian chic.',
    badge: 'Modern',
    defaultFontPair: 'playfair-dmsans',
    colors: {
      primary: '#B65A3D',
      secondary: '#DDA48B',
      accent: '#C86D51',
      background: '#FAF5F2',
      surface: '#FFFFFF',
      text: '#301F19',
      textMuted: '#765950',
    },
    decorStyle: 'boho',
  },
  'romantic-blush': {
    id: 'romantic-blush',
    name: 'Romantic Blush',
    description: 'Kelembutan kelopak mawar merah muda pastel dengan pesona manis abadi.',
    badge: 'Romantis',
    defaultFontPair: 'cormorant-dmsans',
    colors: {
      primary: '#B25068',
      secondary: '#E7ABBA',
      accent: '#C86B85',
      background: '#FCF7F8',
      surface: '#FFFFFF',
      text: '#2E191E',
      textMuted: '#74545C',
    },
    decorStyle: 'romantic',
  },
  'midnight-gold': {
    id: 'midnight-gold',
    name: 'Midnight Gold',
    description: 'Latar biru malam eksklusif dengan aksen gemerlap emas bintang malam.',
    badge: 'Mewah',
    defaultFontPair: 'cinzel-jakarta',
    colors: {
      primary: '#E5B869',
      secondary: '#C19847',
      accent: '#F3D28E',
      background: '#0D1424',
      surface: '#152038',
      text: '#F8F9FA',
      textMuted: '#9BA3B8',
    },
    decorStyle: 'celestial',
  },
};

export const DEFAULT_SECTIONS: SectionConfig[] = [
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
];
