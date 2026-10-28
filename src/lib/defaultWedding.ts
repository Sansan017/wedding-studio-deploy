import { WeddingData, DEFAULT_SECTIONS, THEME_PRESETS } from '../types/wedding';

export const COUPLE_PHOTO = '/src/assets/images/wedding_couple_portrait_1792819792980.jpg';
export const GROOM_PHOTO = '/src/assets/images/wedding_groom_photo_1792819793218.jpg';
export const BRIDE_PHOTO = '/src/assets/images/wedding_bride_photo_1792819793289.jpg';
export const BANNER_PHOTO = '/src/assets/images/wedding_banner_floral_1792819792887.jpg';

export function createDefaultWedding(ownerId: string, slug?: string): WeddingData {
  const generatedSlug = slug || `wedding-${Math.random().toString(36).substring(2, 8)}`;
  const now = new Date().toISOString();

  return {
    id: `wed_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    owner_id: ownerId,
    title: 'Undangan Pernikahan Kami',
    slug: generatedSlug,
    is_published: true,
    theme_id: 'minimalist-ivory',
    font_pair: 'cormorant-jakarta',
    color_palette: { ...THEME_PRESETS['minimalist-ivory'].colors },
    hero_layout: 'classic_centered',
    cover_image: COUPLE_PHOTO,
    groom: {
      name: 'Raden Febrian Pratama, S.Kom',
      nickname: 'Raden',
      father: 'Bpk. Hendra Febrian',
      mother: 'Ibu Ratna Dewi',
      bio: 'Putra pertama dari dua bersaudara yang berprofesi sebagai UI/UX Designer & Entrepreneur.',
      instagram: '@radenfebrian',
      photo_url: GROOM_PHOTO,
    },
    bride: {
      name: 'Annisa Putri Maharani, S.Ds',
      nickname: 'Annisa',
      father: 'Bpk. Joko Susanto',
      mother: 'Ibu Sri Rahayu',
      bio: 'Putri bungsu dari tiga bersaudara yang berprofesi sebagai Fashion Stylist & Florist.',
      instagram: '@annisaputri',
      photo_url: BRIDE_PHOTO,
    },
    events: [
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
    ],
    love_stories: [
      {
        id: 'ls-1',
        year: '2021',
        title: 'Pertemuan Pertama di Kafe Bandung',
        description: 'Bermula dari secangkir kopi hangat saat menghadiri seminar desain kreatif. Percakapan santai itu berlanjut menjadi diskusi penuh tawa hingga kafe tutup.',
        photo_url: BANNER_PHOTO,
      },
      {
        id: 'ls-2',
        year: '2023',
        title: 'Menjalin Komitmen Bersama',
        description: 'Setelah melewati banyak cerita dan saling mendampingi impian, kami memutuskan untuk melangkah bersama dengan komitmen yang lebih erat.',
        photo_url: COUPLE_PHOTO,
      },
      {
        id: 'ls-3',
        year: '2026',
        title: 'Momen Lamaran Menuju Pelaminan',
        description: 'Diiringi deburan ombak dan senja jingga di Labuan Bajo, sebuah cincin tersemat dengan janji suci untuk saling menyayangi selamanya.',
        photo_url: GROOM_PHOTO,
      },
    ],
    gallery_photos: [
      { id: 'g-1', url: COUPLE_PHOTO, caption: 'Momen penuh tawa bahagia' },
      { id: 'g-2', url: BANNER_PHOTO, caption: 'Suasana dekorasi penuh bunga' },
      { id: 'g-3', url: BRIDE_PHOTO, caption: 'Keanggunan dalam balutan putih' },
      { id: 'g-4', url: GROOM_PHOTO, caption: 'Senyum penuh syukur menatap masa depan' },
    ],
    bank_accounts: [
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
    ],
    gift_address: {
      recipient_name: 'Raden & Annisa',
      phone: '0812-3456-7890',
      address: 'Jl. Kemang Raya No. 45, Mampang Prapatan, Jakarta Selatan 12730',
      note: 'Titipkan paket di resepsionis / pos satpam atas nama Raden & Annisa',
    },
    dress_code: {
      title: 'Dress Code Tamu Undangan',
      description: 'Formal / Batik / Earth Tone & Champagne Nuance',
      colors: ['#FAF8F5', '#C5A880', '#536B54', '#8C7355', '#2C2623'],
    },
    quote: {
      text: 'Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan pasangan-pasangan untukmu dari jenismu sendiri, agar kamu cenderung dan merasa tenteram kepadanya, dan Dia menjadikan di antaramu rasa kasih dan sayang.',
      source: 'QS. Ar-Rum: 21',
    },
    audio_bg: {
      enabled: true,
      title: 'A Thousand Years (Acoustic Romantic Piano)',
      artist: 'Wedding Studio Collection',
      url: '',
      auto_play: false,
    },
    sections_order: [...DEFAULT_SECTIONS],
    free_plan_badge: true,
    created_at: now,
    updated_at: now,
  };
}
