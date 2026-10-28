import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Heart,
  Instagram,
  Copy,
  Check,
  Send,
  ExternalLink,
  Mail,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { WeddingData, THEME_PRESETS, GuestWish } from '../../types/wedding';
import { ApiClient } from '../../lib/api';
import { AudioPlayer } from '../AudioPlayer';
import { romanticSynth } from '../../lib/romanticMusic';

interface PublicInvitationProps {
  wedding: WeddingData;
  isEditorPreview?: boolean;
}

export const PublicInvitation: React.FC<PublicInvitationProps> = ({
  wedding,
  isEditorPreview = false,
}) => {
  // Query param guest name
  const [guestName, setGuestName] = useState<string>('Tamu Undangan');
  const [isOpened, setIsOpened] = useState(isEditorPreview); // auto open in small editor preview
  const [copiedBankId, setCopiedBankId] = useState<string | null>(null);

  // RSVP Form State
  const [rsvpName, setRsvpName] = useState('');
  const [rsvpAttendance, setRsvpAttendance] = useState<'hadir' | 'tidak_hadir' | 'ragu'>('hadir');
  const [rsvpPax, setRsvpPax] = useState<number>(1);
  const [rsvpMessage, setRsvpMessage] = useState('');
  const [rsvpRelationship, setRsvpRelationship] = useState('Teman / Sahabat');
  const [isSubmittingRsvp, setIsSubmittingRsvp] = useState(false);
  const [rsvpSuccess, setRsvpSuccess] = useState(false);
  const [rsvpError, setRsvpError] = useState<string | null>(null);

  // Guest wishes list
  const [wishes, setWishes] = useState<GuestWish[]>([]);
  const [isLoadingWishes, setIsLoadingWishes] = useState(false);

  // Dedicated Guestbook Wish Form State
  const [wishName, setWishName] = useState('');
  const [wishRel, setWishRel] = useState('Teman / Sahabat');
  const [wishMsg, setWishMsg] = useState('');
  const [isSubmittingWish, setIsSubmittingWish] = useState(false);
  const [wishSuccess, setWishSuccess] = useState(false);
  const [wishError, setWishError] = useState<string | null>(null);

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  const theme = THEME_PRESETS[wedding.theme_id] || THEME_PRESETS['minimalist-ivory'];
  const colors = wedding.color_palette || theme.colors;

  // Detect guest name from URL parameter ?to=Nama+Tamu (supports clean path search and hash query)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let toParam = new URLSearchParams(window.location.search).get('to');
      if (!toParam && window.location.hash.includes('?')) {
        const hashQuery = window.location.hash.split('?')[1];
        toParam = new URLSearchParams(hashQuery).get('to');
      }
      if (toParam) {
        setGuestName(toParam);
        setRsvpName(toParam);
        setWishName(toParam);
      }
    }
  }, []);

  const loadWishes = async () => {
    if (!wedding.slug) return;
    setIsLoadingWishes(true);
    try {
      const data = await ApiClient.getPublicWishes(wedding.slug);
      setWishes(data);
    } catch {
      // Graceful fallback if in local draft preview
    } finally {
      setIsLoadingWishes(false);
    }
  };

  // Fetch guest wishes on load and on slug change
  useEffect(() => {
    if (wedding.slug) {
      loadWishes();
    }
  }, [wedding.slug]);

  // Calculate target countdown date from first event
  const primaryEvent = wedding.events?.[0];
  const targetDateStr = primaryEvent ? `${primaryEvent.date}T${primaryEvent.start_time || '08:00'}:00` : '2026-12-12T08:00:00';

  useEffect(() => {
    const calculateTime = () => {
      const targetTime = new Date(targetDateStr).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, targetTime - now);

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / 1000 / 60) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [targetDateStr]);

  const handleOpenInvitation = () => {
    setIsOpened(true);
    if (wedding.audio_bg?.enabled) {
      romanticSynth.play();
    }
  };

  const handleCopyAccount = (bankId: string, accNumber: string) => {
    navigator.clipboard.writeText(accNumber);
    setCopiedBankId(bankId);
    setTimeout(() => setCopiedBankId(null), 2500);
  };

  const handleRsvpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rsvpName.trim()) {
      setRsvpError('Silakan masukkan nama Anda.');
      return;
    }

    setIsSubmittingRsvp(true);
    setRsvpError(null);

    try {
      if (isEditorPreview) {
        // Mock submission in preview
        setRsvpSuccess(true);
        if (rsvpMessage.trim()) {
          setWishes([
            {
              id: `wish_${Date.now()}`,
              wedding_id: wedding.id,
              sender_name: rsvpName,
              relationship: rsvpRelationship,
              message: rsvpMessage,
              created_at: new Date().toISOString(),
            },
            ...wishes,
          ]);
        }
      } else {
        await ApiClient.submitPublicRsvp(wedding.slug, {
          guest_name: rsvpName,
          attendance: rsvpAttendance,
          pax_count: rsvpPax,
          message: rsvpMessage,
          relationship: rsvpRelationship,
        });
        setRsvpSuccess(true);
        // Refresh wishes from database
        await loadWishes();
      }
    } catch (err: any) {
      setRsvpError(err.message || 'Gagal mengirim RSVP. Silakan coba lagi.');
    } finally {
      setIsSubmittingRsvp(false);
    }
  };

  const handleWishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wishName.trim()) {
      setWishError('Silakan masukkan nama Anda.');
      return;
    }
    if (!wishMsg.trim()) {
      setWishError('Silakan tuliskan ucapan atau doa restu.');
      return;
    }

    setIsSubmittingWish(true);
    setWishError(null);

    try {
      if (isEditorPreview) {
        setWishSuccess(true);
        setWishes((prev) => [
          {
            id: `wish_${Date.now()}`,
            wedding_id: wedding.id,
            sender_name: wishName.trim(),
            relationship: wishRel,
            message: wishMsg.trim(),
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
        setWishMsg('');
        setTimeout(() => setWishSuccess(false), 4000);
      } else {
        await ApiClient.submitPublicWish(wedding.slug, {
          sender_name: wishName.trim(),
          relationship: wishRel,
          message: wishMsg.trim(),
        });
        setWishSuccess(true);
        setWishMsg('');
        await loadWishes();
        setTimeout(() => setWishSuccess(false), 4000);
      }
    } catch (err: any) {
      setWishError(err.message || 'Gagal mengirim ucapan doa restu.');
    } finally {
      setIsSubmittingWish(false);
    }
  };

  // Google Calendar helper link
  const createGoogleCalendarUrl = (ev: any) => {
    const title = encodeURIComponent(`Pernikahan ${wedding.groom.nickname} & ${wedding.bride.nickname} - ${ev.title}`);
    const details = encodeURIComponent(`Menghadiri ${ev.title} ${wedding.groom.name} & ${wedding.bride.name}.\nLokasi: ${ev.location_name}, ${ev.address}`);
    const location = encodeURIComponent(`${ev.location_name}, ${ev.address}`);
    const dateFormatted = ev.date.replace(/-/g, '');
    const startTimeFormatted = (ev.start_time || '08:00').replace(':', '') + '00';
    const endTimeFormatted = (ev.end_time || '14:00').replace(':', '') + '00';

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateFormatted}T${startTimeFormatted}/${dateFormatted}T${endTimeFormatted}&details=${details}&location=${location}`;
  };

  const getFontFamilyClass = () => {
    switch (wedding.font_pair) {
      case 'playfair-dmsans':
        return 'font-playfair';
      case 'cinzel-jakarta':
        return 'font-cinzel';
      case 'cormorant-dmsans':
      case 'cormorant-jakarta':
      default:
        return 'font-cormorant';
    }
  };

  // Filter sections by order and enabled status
  const sectionsOrder = wedding.sections_order || [];

  return (
    <div
      className="min-h-screen text-slate-800 transition-colors duration-500 overflow-x-hidden selection:bg-amber-200 selection:text-slate-900"
      style={{
        backgroundColor: colors.background,
        color: colors.text,
      }}
    >
      {/* ------------------------------------------------------------- */}
      {/* 1. COVER / AMPLOP DIGITAL MODAL OVERLAY */}
      {/* ------------------------------------------------------------- */}
      {!isOpened && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-700 backdrop-blur-md"
          style={{
            backgroundColor: colors.background,
          }}
        >
          {/* Decorative ambient background */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none bg-cover bg-center"
            style={{ backgroundImage: `url(${wedding.cover_image || wedding.gallery_photos?.[0]?.url || ''})` }}
          />

          <div
            className="relative w-full max-w-md p-8 sm:p-10 rounded-2xl shadow-2xl text-center border overflow-hidden transition-transform duration-500"
            style={{
              backgroundColor: colors.surface,
              borderColor: `${colors.secondary}40`,
            }}
          >
            {/* Ornamental Arch Top */}
            <div className="w-16 h-1 mx-auto mb-6 rounded-full" style={{ backgroundColor: colors.primary }} />

            <span className="text-xs tracking-[0.25em] uppercase opacity-75 font-medium">
              Walimatul Ursy
            </span>

            <h1
              className={`text-3xl sm:text-4xl mt-3 mb-2 font-bold tracking-tight ${getFontFamilyClass()}`}
              style={{ color: colors.primary }}
            >
              {wedding.groom.nickname} & {wedding.bride.nickname}
            </h1>

            <p className="text-xs opacity-75 mb-8 italic">
              {primaryEvent ? new Date(primaryEvent.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Menuju Hari Bahagia'}
            </p>

            {/* Guest Invitation Tag */}
            <div
              className="p-4 rounded-xl mb-8 border text-center transition-all"
              style={{
                backgroundColor: `${colors.background}`,
                borderColor: `${colors.secondary}30`,
              }}
            >
              <div className="flex items-center justify-center gap-1.5 text-xs opacity-70 mb-1">
                <Mail size={13} style={{ color: colors.primary }} />
                <span>Kepada Yth. Bapak/Ibu/Saudara/i:</span>
              </div>
              <p
                className={`text-lg font-semibold capitalize ${getFontFamilyClass()}`}
                style={{ color: colors.text }}
              >
                {guestName}
              </p>
              <p className="text-[11px] opacity-60 mt-0.5">
                Tanpa mengurangi rasa hormat, kami mengundang Anda untuk hadir
              </p>
            </div>

            {/* Open Button */}
            <button
              onClick={handleOpenInvitation}
              className="w-full py-3.5 px-6 rounded-xl font-medium text-sm flex items-center justify-center gap-2 shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              style={{
                backgroundColor: colors.primary,
                color: '#FFFFFF',
              }}
            >
              <Mail size={16} />
              <span>Buka Undangan</span>
            </button>

            <p className="text-[10px] opacity-50 mt-4">
              *Tekan untuk membuka undangan & memutar musik
            </p>
          </div>
        </div>
      )}

      {/* Floating Audio Player when opened */}
      {isOpened && wedding.audio_bg?.enabled && (
        <AudioPlayer
          autoPlay={false}
          songTitle={wedding.audio_bg.title || 'Canon in D'}
          artist={wedding.audio_bg.artist || 'Wedding Studio'}
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* MAIN INVITATION CONTENT */}
      {/* ------------------------------------------------------------- */}
      <main className="max-w-xl mx-auto px-4 py-8 space-y-16 sm:space-y-24">
        {sectionsOrder
          .filter((sec) => sec.is_enabled)
          .map((sec) => {
            switch (sec.id) {
              // ---------------- HERO COVER SECTION ----------------
              case 'hero':
                return (
                  <section key={sec.id} className="text-center pt-8 pb-4 relative">
                    <span className="text-xs uppercase tracking-[0.3em] opacity-70 font-medium">
                      The Wedding Of
                    </span>

                    <h1
                      className={`text-4xl sm:text-5xl md:text-6xl my-4 font-semibold tracking-tight ${getFontFamilyClass()}`}
                      style={{ color: colors.primary }}
                    >
                      {wedding.groom.nickname} <span className="text-3xl opacity-60 font-normal">&</span> {wedding.bride.nickname}
                    </h1>

                    <p className="text-sm tracking-widest uppercase opacity-75 mb-6">
                      {primaryEvent
                        ? new Date(primaryEvent.date).toLocaleDateString('id-ID', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                        : 'Sabtu, 12 Desember 2026'}
                    </p>

                    {/* Romantic Couple Photo with soft frame */}
                    {wedding.cover_image && (
                      <div className="relative mx-auto my-6 max-w-sm overflow-hidden rounded-t-[140px] rounded-b-2xl shadow-xl border-4 border-white/60">
                        <img
                          src={wedding.cover_image}
                          alt={`${wedding.groom.nickname} & ${wedding.bride.nickname}`}
                          className="w-full h-96 sm:h-[450px] object-cover transition-transform duration-700 hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                        <div className="absolute bottom-4 left-0 right-0 text-white text-xs text-center drop-shadow">
                          {wedding.groom.name} & {wedding.bride.name}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-center gap-2 mt-4 text-xs opacity-60">
                      <ChevronDown size={16} className="animate-bounce" />
                      <span>Gulir ke bawah</span>
                    </div>
                  </section>
                );

              // ---------------- QUOTE SECTION ----------------
              case 'quote':
                return (
                  <section
                    key={sec.id}
                    className="p-8 rounded-2xl text-center relative border shadow-sm"
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: `${colors.secondary}30`,
                    }}
                  >
                    <div className="w-10 h-10 mx-auto mb-4 rounded-full flex items-center justify-center opacity-80"
                      style={{ backgroundColor: `${colors.secondary}20`, color: colors.primary }}>
                      <Heart size={18} />
                    </div>

                    <p className={`text-base sm:text-lg italic leading-relaxed mb-4 ${getFontFamilyClass()}`}>
                      "{wedding.quote?.text || 'Dan di antara tanda-tanda kebesaran-Nya...'}"
                    </p>

                    <span className="text-xs font-semibold tracking-wider uppercase opacity-75">
                      — {wedding.quote?.source || 'QS. Ar-Rum: 21'} —
                    </span>
                  </section>
                );

              // ---------------- COUPLE SECTION ----------------
              case 'couple':
                return (
                  <section key={sec.id} className="text-center space-y-10">
                    <div>
                      <span className="text-xs uppercase tracking-[0.25em] opacity-70 font-medium">
                        Assalamu’alaikum Wr. Wb.
                      </span>
                      <h2
                        className={`text-2xl sm:text-3xl mt-2 font-bold ${getFontFamilyClass()}`}
                        style={{ color: colors.primary }}
                      >
                        Pasangan Mempelai
                      </h2>
                      <p className="text-xs opacity-75 max-w-md mx-auto mt-2 leading-relaxed">
                        Dengan memohon rahmat dan ridho Allah SWT, kami bermaksud menyelenggarakan
                        syukuran pernikahan putra-putri kami:
                      </p>
                    </div>

                    {/* Groom Card */}
                    <div
                      className="p-6 sm:p-8 rounded-2xl border shadow-sm text-center transition-transform hover:-translate-y-1"
                      style={{
                        backgroundColor: colors.surface,
                        borderColor: `${colors.secondary}30`,
                      }}
                    >
                      {wedding.groom.photo_url && (
                        <div className="w-28 h-28 mx-auto mb-4 rounded-full overflow-hidden border-2 p-1" style={{ borderColor: colors.secondary }}>
                          <img
                            src={wedding.groom.photo_url}
                            alt={wedding.groom.name}
                            className="w-full h-full object-cover rounded-full"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}

                      <h3
                        className={`text-2xl font-bold ${getFontFamilyClass()}`}
                        style={{ color: colors.primary }}
                      >
                        {wedding.groom.name}
                      </h3>
                      <p className="text-xs font-medium opacity-70 mt-1">({wedding.groom.nickname})</p>

                      <div className="text-xs opacity-80 my-3 leading-relaxed">
                        <p>Putra dari Pasangan Tercinta:</p>
                        <p className="font-semibold text-slate-900 mt-0.5">
                          {wedding.groom.father} & {wedding.groom.mother}
                        </p>
                      </div>

                      {wedding.groom.bio && (
                        <p className="text-xs opacity-75 max-w-sm mx-auto italic mb-3">
                          {wedding.groom.bio}
                        </p>
                      )}

                      {wedding.groom.instagram && (
                        <a
                          href={`https://instagram.com/${wedding.groom.instagram.replace('@', '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border transition-colors hover:bg-slate-50"
                          style={{ borderColor: `${colors.secondary}40`, color: colors.primary }}
                        >
                          <Instagram size={13} />
                          <span>{wedding.groom.instagram}</span>
                        </a>
                      )}
                    </div>

                    {/* Romantic Ampersand Divider */}
                    <div className="flex items-center justify-center gap-3">
                      <div className="h-px w-16" style={{ backgroundColor: `${colors.secondary}50` }} />
                      <span className={`text-3xl font-serif italic ${getFontFamilyClass()}`} style={{ color: colors.primary }}>
                        &
                      </span>
                      <div className="h-px w-16" style={{ backgroundColor: `${colors.secondary}50` }} />
                    </div>

                    {/* Bride Card */}
                    <div
                      className="p-6 sm:p-8 rounded-2xl border shadow-sm text-center transition-transform hover:-translate-y-1"
                      style={{
                        backgroundColor: colors.surface,
                        borderColor: `${colors.secondary}30`,
                      }}
                    >
                      {wedding.bride.photo_url && (
                        <div className="w-28 h-28 mx-auto mb-4 rounded-full overflow-hidden border-2 p-1" style={{ borderColor: colors.secondary }}>
                          <img
                            src={wedding.bride.photo_url}
                            alt={wedding.bride.name}
                            className="w-full h-full object-cover rounded-full"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}

                      <h3
                        className={`text-2xl font-bold ${getFontFamilyClass()}`}
                        style={{ color: colors.primary }}
                      >
                        {wedding.bride.name}
                      </h3>
                      <p className="text-xs font-medium opacity-70 mt-1">({wedding.bride.nickname})</p>

                      <div className="text-xs opacity-80 my-3 leading-relaxed">
                        <p>Putri dari Pasangan Tercinta:</p>
                        <p className="font-semibold text-slate-900 mt-0.5">
                          {wedding.bride.father} & {wedding.bride.mother}
                        </p>
                      </div>

                      {wedding.bride.bio && (
                        <p className="text-xs opacity-75 max-w-sm mx-auto italic mb-3">
                          {wedding.bride.bio}
                        </p>
                      )}

                      {wedding.bride.instagram && (
                        <a
                          href={`https://instagram.com/${wedding.bride.instagram.replace('@', '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border transition-colors hover:bg-slate-50"
                          style={{ borderColor: `${colors.secondary}40`, color: colors.primary }}
                        >
                          <Instagram size={13} />
                          <span>{wedding.bride.instagram}</span>
                        </a>
                      )}
                    </div>
                  </section>
                );

              // ---------------- EVENTS SCHEDULE SECTION ----------------
              case 'events':
                return (
                  <section key={sec.id} className="text-center space-y-6">
                    <div>
                      <span className="text-xs uppercase tracking-[0.25em] opacity-70 font-medium">
                        Rangkaian Acara
                      </span>
                      <h2
                        className={`text-2xl sm:text-3xl mt-2 font-bold ${getFontFamilyClass()}`}
                        style={{ color: colors.primary }}
                      >
                        Waktu & Lokasi Bahagia
                      </h2>
                    </div>

                    <div className="space-y-6">
                      {wedding.events
                        ?.filter((ev) => ev.is_active)
                        .map((ev) => (
                          <div
                            key={ev.id}
                            className="p-6 sm:p-8 rounded-2xl border shadow-sm text-center relative overflow-hidden"
                            style={{
                              backgroundColor: colors.surface,
                              borderColor: `${colors.secondary}30`,
                            }}
                          >
                            <h3
                              className={`text-xl font-bold mb-3 ${getFontFamilyClass()}`}
                              style={{ color: colors.primary }}
                            >
                              {ev.title}
                            </h3>

                            {/* Date Badge */}
                            <div className="flex items-center justify-center gap-2 text-sm font-semibold mb-2">
                              <Calendar size={16} style={{ color: colors.primary }} />
                              <span>
                                {new Date(ev.date).toLocaleDateString('id-ID', {
                                  weekday: 'long',
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                })}
                              </span>
                            </div>

                            {/* Time Badge */}
                            <div className="flex items-center justify-center gap-2 text-xs opacity-75 mb-4">
                              <Clock size={14} style={{ color: colors.primary }} />
                              <span>
                                Pukul {ev.start_time} - {ev.end_time || 'Selesai'} {ev.timezone || 'WIB'}
                              </span>
                            </div>

                            {/* Venue Details */}
                            <div className="p-4 rounded-xl mb-6 bg-slate-50/60 border border-slate-100">
                              <div className="flex items-start justify-center gap-1.5 font-medium text-sm text-slate-900 mb-1">
                                <MapPin size={16} className="shrink-0 mt-0.5" style={{ color: colors.primary }} />
                                <span>{ev.location_name}</span>
                              </div>
                              <p className="text-xs opacity-75 max-w-sm mx-auto leading-relaxed">
                                {ev.address}
                              </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                              {ev.maps_url && (
                                <a
                                  href={ev.maps_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 text-white shadow-sm transition-transform hover:scale-105"
                                  style={{ backgroundColor: colors.primary }}
                                >
                                  <MapPin size={14} />
                                  <span>Buka Google Maps</span>
                                </a>
                              )}

                              <a
                                href={createGoogleCalendarUrl(ev)}
                                target="_blank"
                                rel="noreferrer"
                                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-2 border bg-white hover:bg-slate-50 transition-colors"
                                style={{ borderColor: `${colors.secondary}50`, color: colors.text }}
                              >
                                <Calendar size={14} />
                                <span>Simpan ke Kalender</span>
                              </a>
                            </div>
                          </div>
                        ))}
                    </div>
                  </section>
                );

              // ---------------- COUNTDOWN SECTION ----------------
              case 'countdown':
                return (
                  <section
                    key={sec.id}
                    className="p-8 rounded-2xl border text-center shadow-sm"
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: `${colors.secondary}30`,
                    }}
                  >
                    <span className="text-xs uppercase tracking-[0.25em] opacity-70 font-medium">
                      Hitung Mundur
                    </span>
                    <h3
                      className={`text-2xl font-bold mt-1 mb-6 ${getFontFamilyClass()}`}
                      style={{ color: colors.primary }}
                    >
                      Menuju Hari Bahagia
                    </h3>

                    <div className="grid grid-cols-4 gap-2 sm:gap-4 max-w-md mx-auto">
                      {[
                        { label: 'Hari', value: timeLeft.days },
                        { label: 'Jam', value: timeLeft.hours },
                        { label: 'Menit', value: timeLeft.minutes },
                        { label: 'Detik', value: timeLeft.seconds },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 sm:p-4 rounded-xl border flex flex-col items-center justify-center"
                          style={{
                            backgroundColor: colors.background,
                            borderColor: `${colors.secondary}30`,
                          }}
                        >
                          <span
                            className="text-2xl sm:text-3xl font-bold tabular-nums"
                            style={{ color: colors.primary }}
                          >
                            {String(item.value).padStart(2, '0')}
                          </span>
                          <span className="text-[10px] sm:text-xs uppercase tracking-wider opacity-60 mt-1">
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                );

              // ---------------- LOVE STORY SECTION ----------------
              case 'story':
                if (!wedding.love_stories || wedding.love_stories.length === 0) return null;
                return (
                  <section key={sec.id} className="text-center space-y-6">
                    <div>
                      <span className="text-xs uppercase tracking-[0.25em] opacity-70 font-medium">
                        Perjalanan Kami
                      </span>
                      <h2
                        className={`text-2xl sm:text-3xl mt-2 font-bold ${getFontFamilyClass()}`}
                        style={{ color: colors.primary }}
                      >
                        Kisah Kasih & Cinta
                      </h2>
                    </div>

                    <div className="relative border-l-2 border-dashed ml-4 sm:mx-auto max-w-md space-y-8 text-left pl-6" style={{ borderColor: `${colors.secondary}60` }}>
                      {wedding.love_stories.map((story) => (
                        <div key={story.id} className="relative">
                          {/* Dot marker */}
                          <div
                            className="absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm"
                            style={{ backgroundColor: colors.primary }}
                          />

                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full text-white inline-block mb-1.5"
                            style={{ backgroundColor: colors.primary }}
                          >
                            {story.year}
                          </span>

                          <h4 className={`text-lg font-bold ${getFontFamilyClass()}`} style={{ color: colors.text }}>
                            {story.title}
                          </h4>

                          <p className="text-xs opacity-75 mt-1 leading-relaxed">
                            {story.description}
                          </p>

                          {story.photo_url && (
                            <img
                              src={story.photo_url}
                              alt={story.title}
                              className="mt-3 rounded-xl h-36 w-full object-cover border"
                              style={{ borderColor: `${colors.secondary}30` }}
                              referrerPolicy="no-referrer"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                );

              // ---------------- GALLERY PHOTOS SECTION ----------------
              case 'gallery':
                if (!wedding.gallery_photos || wedding.gallery_photos.length === 0) return null;
                return (
                  <section key={sec.id} className="text-center space-y-6">
                    <div>
                      <span className="text-xs uppercase tracking-[0.25em] opacity-70 font-medium">
                        Momen Indah
                      </span>
                      <h2
                        className={`text-2xl sm:text-3xl mt-2 font-bold ${getFontFamilyClass()}`}
                        style={{ color: colors.primary }}
                      >
                        Galeri Foto Bahagia
                      </h2>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      {wedding.gallery_photos.map((photo, i) => (
                        <div
                          key={photo.id || i}
                          className="group relative overflow-hidden rounded-xl shadow-sm border aspect-square"
                          style={{ borderColor: `${colors.secondary}30` }}
                        >
                          <img
                            src={photo.url}
                            alt={photo.caption || `Foto Galeri ${i + 1}`}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            referrerPolicy="no-referrer"
                          />
                          {photo.caption && (
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3 text-left">
                              <span className="text-white text-xs drop-shadow">{photo.caption}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                );

              // ---------------- DRESS CODE SECTION ----------------
              case 'dresscode':
                if (!wedding.dress_code?.colors || wedding.dress_code.colors.length === 0) return null;
                return (
                  <section
                    key={sec.id}
                    className="p-6 sm:p-8 rounded-2xl border text-center shadow-sm"
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: `${colors.secondary}30`,
                    }}
                  >
                    <span className="text-xs uppercase tracking-[0.25em] opacity-70 font-medium">
                      Panduan Busana
                    </span>
                    <h3
                      className={`text-xl font-bold mt-1 mb-2 ${getFontFamilyClass()}`}
                      style={{ color: colors.primary }}
                    >
                      {wedding.dress_code.title || 'Dress Code Acara'}
                    </h3>

                    <p className="text-xs opacity-75 max-w-sm mx-auto mb-5 leading-relaxed">
                      {wedding.dress_code.description || 'Pakaian Formal / Batik / Nuansa Earth Tone'}
                    </p>

                    <div className="flex items-center justify-center gap-3">
                      {wedding.dress_code.colors.map((c, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-1">
                          <div
                            className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                            style={{ backgroundColor: c }}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                );

              // ---------------- RSVP FORM SECTION ----------------
              case 'rsvp':
                return (
                  <section key={sec.id} className="text-center space-y-6">
                    <div>
                      <span className="text-xs uppercase tracking-[0.25em] opacity-70 font-medium">
                        Kehadiran Anda
                      </span>
                      <h2
                        className={`text-2xl sm:text-3xl mt-2 font-bold ${getFontFamilyClass()}`}
                        style={{ color: colors.primary }}
                      >
                        Konfirmasi Kehadiran (RSVP)
                      </h2>
                      <p className="text-xs opacity-75 max-w-sm mx-auto mt-1">
                        Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Anda berkenan hadir
                        memberikan doa restu.
                      </p>
                    </div>

                    <div
                      className="p-6 sm:p-8 rounded-2xl border shadow-sm text-left max-w-md mx-auto"
                      style={{
                        backgroundColor: colors.surface,
                        borderColor: `${colors.secondary}30`,
                      }}
                    >
                      {rsvpSuccess ? (
                        <div className="text-center py-6 space-y-3">
                          <div
                            className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-white"
                            style={{ backgroundColor: colors.primary }}
                          >
                            <Check size={24} />
                          </div>
                          <h4 className={`text-xl font-bold ${getFontFamilyClass()}`} style={{ color: colors.primary }}>
                            Terima Kasih!
                          </h4>
                          <p className="text-xs opacity-80 leading-relaxed">
                            Konfirmasi kehadiran & doa restu Anda telah berhasil kami simpan. Sampai jumpa di hari bahagia kami!
                          </p>
                          <button
                            type="button"
                            onClick={() => setRsvpSuccess(false)}
                            className="text-xs font-semibold underline opacity-75 hover:opacity-100"
                          >
                            Kirim konfirmasi ulang
                          </button>
                        </div>
                      ) : (
                        <form onSubmit={handleRsvpSubmit} className="space-y-4">
                          {rsvpError && (
                            <div className="p-3 text-xs rounded-lg bg-red-50 text-red-700 border border-red-200">
                              {rsvpError}
                            </div>
                          )}

                          <div>
                            <label className="block text-xs font-medium mb-1 opacity-80">
                              Nama Lengkap Tamu *
                            </label>
                            <input
                              type="text"
                              value={rsvpName}
                              onChange={(e) => setRsvpName(e.target.value)}
                              placeholder="Contoh: Bpk. Hendra & Ibu"
                              required
                              className="w-full px-3.5 py-2 text-xs rounded-lg border focus:outline-none transition-colors"
                              style={{ borderColor: `${colors.secondary}40` }}
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium mb-1 opacity-80">
                              Konfirmasi Kehadiran *
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { val: 'hadir', label: 'Hadir' },
                                { val: 'ragu', label: 'Masih Ragu' },
                                { val: 'tidak_hadir', label: 'Tidak Hadir' },
                              ].map((opt) => (
                                <button
                                  key={opt.val}
                                  type="button"
                                  onClick={() => setRsvpAttendance(opt.val as any)}
                                  className={`py-2 px-1 text-xs font-medium rounded-lg border transition-all text-center cursor-pointer ${
                                    rsvpAttendance === opt.val
                                      ? 'text-white shadow-sm'
                                      : 'bg-white opacity-70 hover:opacity-100'
                                  }`}
                                  style={{
                                    backgroundColor: rsvpAttendance === opt.val ? colors.primary : '#FFFFFF',
                                    borderColor: `${colors.secondary}40`,
                                  }}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {rsvpAttendance === 'hadir' && (
                            <div>
                              <label className="block text-xs font-medium mb-1 opacity-80">
                                Jumlah Tamu yang Hadir
                              </label>
                              <select
                                value={rsvpPax}
                                onChange={(e) => setRsvpPax(Number(e.target.value))}
                                className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none bg-white"
                                style={{ borderColor: `${colors.secondary}40` }}
                              >
                                {[1, 2, 3, 4, 5].map((num) => (
                                  <option key={num} value={num}>
                                    {num} Orang
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <div>
                            <label className="block text-xs font-medium mb-1 opacity-80">
                              Hubungan / Kerabat
                            </label>
                            <select
                              value={rsvpRelationship}
                              onChange={(e) => setRsvpRelationship(e.target.value)}
                              className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none bg-white"
                              style={{ borderColor: `${colors.secondary}40` }}
                            >
                              <option value="Keluarga Besar">Keluarga Besar</option>
                              <option value="Teman / Sahabat">Teman / Sahabat</option>
                              <option value="Rekan Kerja">Rekan Kerja</option>
                              <option value="Tetangga">Tetangga</option>
                              <option value="Tamu Terhormat">Tamu Terhormat</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium mb-1 opacity-80">
                              Ucapan & Doa Restu (Opsional)
                            </label>
                            <textarea
                              rows={3}
                              value={rsvpMessage}
                              onChange={(e) => setRsvpMessage(e.target.value)}
                              placeholder="Tuliskan ucapan selamat atau doa restu untuk kedua mempelai..."
                              maxLength={400}
                              className="w-full px-3.5 py-2 text-xs rounded-lg border focus:outline-none resize-none"
                              style={{ borderColor: `${colors.secondary}40` }}
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={isSubmittingRsvp}
                            className="w-full py-3 rounded-xl text-xs font-semibold text-white shadow-md flex items-center justify-center gap-2 transition-transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                            style={{ backgroundColor: colors.primary }}
                          >
                            <Send size={14} />
                            <span>{isSubmittingRsvp ? 'Mengirim...' : 'Kirim Konfirmasi'}</span>
                          </button>
                        </form>
                      )}
                    </div>
                  </section>
                );

              // ---------------- WISHES & GUESTBOOK SECTION ----------------
              case 'wishes':
                return (
                  <section key={sec.id} className="text-center space-y-6 max-w-lg mx-auto px-4">
                    <div>
                      <span className="text-xs uppercase tracking-[0.25em] opacity-70 font-medium">
                        Untaian Doa
                      </span>
                      <h2
                        className={`text-2xl sm:text-3xl mt-2 font-bold ${getFontFamilyClass()}`}
                        style={{ color: colors.primary }}
                      >
                        Buku Tamu & Doa Restu
                      </h2>
                      <p className="text-xs opacity-75 max-w-sm mx-auto mt-1 leading-relaxed">
                        Tinggalkan ucapan selamat dan doa restu untuk perjalanan baru kedua mempelai.
                      </p>
                    </div>

                    {/* Dedicated Guestbook Submission Form */}
                    <div
                      className="p-5 sm:p-6 rounded-2xl border shadow-sm text-left space-y-3"
                      style={{
                        backgroundColor: colors.surface,
                        borderColor: `${colors.secondary}30`,
                      }}
                    >
                      <h3 className="font-semibold text-xs opacity-90">Kirim Doa Restu</h3>

                      {wishSuccess && (
                        <div className="p-3 text-xs rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2">
                          <Check size={14} className="text-emerald-600 shrink-0" />
                          <span>Terima kasih! Doa restu Anda telah tersimpan dan tampil di buku tamu.</span>
                        </div>
                      )}

                      {wishError && (
                        <div className="p-3 text-xs rounded-xl bg-rose-50 text-rose-700 border border-rose-200">
                          {wishError}
                        </div>
                      )}

                      <form onSubmit={handleWishSubmit} className="space-y-3">
                        <div>
                          <label className="block text-[11px] font-medium mb-1 opacity-80">
                            Nama Anda *
                          </label>
                          <input
                            type="text"
                            value={wishName}
                            onChange={(e) => setWishName(e.target.value)}
                            placeholder="Contoh: Bpk. Bambang & Keluarga"
                            required
                            className="w-full px-3 py-2 text-xs rounded-lg border bg-white focus:outline-none"
                            style={{ borderColor: `${colors.secondary}40` }}
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium mb-1 opacity-80">
                            Hubungan / Kerabat
                          </label>
                          <select
                            value={wishRel}
                            onChange={(e) => setWishRel(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-lg border bg-white focus:outline-none"
                            style={{ borderColor: `${colors.secondary}40` }}
                          >
                            <option value="Keluarga Besar">Keluarga Besar</option>
                            <option value="Teman / Sahabat">Teman / Sahabat</option>
                            <option value="Rekan Kerja">Rekan Kerja</option>
                            <option value="Tetangga">Tetangga</option>
                            <option value="Tamu Terhormat">Tamu Terhormat</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium mb-1 opacity-80">
                            Untaian Doa & Ucapan *
                          </label>
                          <textarea
                            rows={3}
                            value={wishMsg}
                            onChange={(e) => setWishMsg(e.target.value)}
                            placeholder="Tuliskan ucapan selamat atau doa restu..."
                            required
                            maxLength={400}
                            className="w-full px-3 py-2 text-xs rounded-lg border bg-white focus:outline-none resize-none"
                            style={{ borderColor: `${colors.secondary}40` }}
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmittingWish}
                          className="w-full py-2.5 rounded-xl text-xs font-semibold text-white shadow-md flex items-center justify-center gap-2 transition-transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
                          style={{ backgroundColor: colors.primary }}
                        >
                          <Send size={13} />
                          <span>{isSubmittingWish ? 'Menyimpan Doa...' : 'Kirim Doa Restu'}</span>
                        </button>
                      </form>
                    </div>

                    {/* Guest Wishes List Container */}
                    <div
                      className="p-5 sm:p-6 rounded-2xl border shadow-sm text-left space-y-4 max-h-96 overflow-y-auto"
                      style={{
                        backgroundColor: colors.surface,
                        borderColor: `${colors.secondary}30`,
                      }}
                    >
                      <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: `${colors.secondary}20` }}>
                        <span className="font-semibold text-xs opacity-90">
                          Daftar Doa ({wishes.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => loadWishes()}
                          disabled={isLoadingWishes}
                          className="text-[11px] opacity-75 hover:opacity-100 flex items-center gap-1 cursor-pointer transition-opacity"
                          title="Muat ulang pesan terbaru dari server"
                        >
                          <Sparkles size={11} className={isLoadingWishes ? 'animate-spin' : ''} />
                          <span>{isLoadingWishes ? 'Memuat...' : 'Segarkan'}</span>
                        </button>
                      </div>

                      {isLoadingWishes && wishes.length === 0 ? (
                        <div className="text-center py-6 opacity-60 text-xs">
                          Memuat pesan doa dari buku tamu...
                        </div>
                      ) : wishes.length === 0 ? (
                        <div className="text-center py-8 opacity-60 text-xs">
                          Belum ada ucapan doa. Jadilah orang pertama yang mengirimkan doa restu!
                        </div>
                      ) : (
                        wishes.map((w, idx) => (
                          <div
                            key={w.id || idx}
                            className="p-3.5 rounded-xl border bg-white/70 space-y-1 text-xs"
                            style={{ borderColor: `${colors.secondary}20` }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-900">{w.sender_name}</span>
                              <span className="text-[10px] opacity-60">
                                {new Date(w.created_at).toLocaleDateString('id-ID', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </span>
                            </div>
                            <span className="text-[10px] opacity-65 block">
                              {w.relationship || 'Tamu Undangan'}
                            </span>
                            <p className="text-xs text-slate-700 pt-1 leading-relaxed whitespace-pre-wrap">
                              {w.message}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                );

              // ---------------- DIGITAL GIFTS / AMPLOP SECTION ----------------
              case 'gifts':
                if (!wedding.bank_accounts || wedding.bank_accounts.length === 0) return null;
                return (
                  <section key={sec.id} className="text-center space-y-6">
                    <div>
                      <span className="text-xs uppercase tracking-[0.25em] opacity-70 font-medium">
                        Tanda Kasih
                      </span>
                      <h2
                        className={`text-2xl sm:text-3xl mt-2 font-bold ${getFontFamilyClass()}`}
                        style={{ color: colors.primary }}
                      >
                        Amplop Digital & Hadiah
                      </h2>
                      <p className="text-xs opacity-75 max-w-sm mx-auto mt-1 leading-relaxed">
                        Doa restu Anda merupakan karunia terindah bagi kami. Namun jika Anda ingin memberi
                        tanda kasih, Anda dapat mengirimkannya melalui:
                      </p>
                    </div>

                    {/* Bank Account Cards */}
                    <div className="space-y-4 max-w-sm mx-auto">
                      {wedding.bank_accounts.map((bank) => (
                        <div
                          key={bank.id}
                          className="p-5 rounded-2xl border shadow-sm text-left relative overflow-hidden"
                          style={{
                            backgroundColor: colors.surface,
                            borderColor: `${colors.secondary}30`,
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-sm tracking-wide" style={{ color: colors.primary }}>
                              {bank.bank_name}
                            </span>
                            <Sparkles size={16} className="opacity-40" />
                          </div>

                          <div className="text-xs opacity-75 mb-1">Nomor Rekening:</div>
                          <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-100 mb-2">
                            <span className="font-mono font-bold text-sm tracking-wider text-slate-800">
                              {bank.account_number}
                            </span>
                            <button
                              onClick={() => handleCopyAccount(bank.id, bank.account_number)}
                              className="px-2.5 py-1 text-[11px] font-medium rounded border bg-white flex items-center gap-1 hover:bg-slate-100 transition-colors cursor-pointer"
                              style={{ borderColor: `${colors.secondary}40`, color: colors.primary }}
                            >
                              {copiedBankId === bank.id ? (
                                <>
                                  <Check size={12} className="text-emerald-600" />
                                  <span className="text-emerald-600">Tersalin!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={12} />
                                  <span>Salin</span>
                                </>
                              )}
                            </button>
                          </div>

                          <div className="text-[11px] opacity-70">
                            Atas Nama: <span className="font-semibold">{bank.account_holder}</span>
                          </div>
                        </div>
                      ))}

                      {/* Gift Mailing Address if provided */}
                      {wedding.gift_address?.address && (
                        <div
                          className="p-5 rounded-2xl border shadow-sm text-left"
                          style={{
                            backgroundColor: colors.surface,
                            borderColor: `${colors.secondary}30`,
                          }}
                        >
                          <h4 className="font-semibold text-xs mb-1" style={{ color: colors.primary }}>
                            Kirim Kado Fisik
                          </h4>
                          <p className="text-xs opacity-80 leading-relaxed mb-2">
                            {wedding.gift_address.address}
                          </p>
                          <div className="text-[11px] opacity-70">
                            Penerima: <span className="font-medium">{wedding.gift_address.recipient_name}</span> ({wedding.gift_address.phone})
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                );

              default:
                return null;
            }
          })}

        {/* ---------------- CLOSING & BRANDING ---------------- */}
        <section className="text-center pt-8 pb-16 space-y-4 border-t" style={{ borderColor: `${colors.secondary}30` }}>
          <p className="text-xs opacity-75 italic max-w-sm mx-auto leading-relaxed">
            Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan
            hadir dan memberikan doa restu kepada kedua mempelai.
          </p>

          <p className={`text-xl font-bold ${getFontFamilyClass()}`} style={{ color: colors.primary }}>
            {wedding.groom.nickname} & {wedding.bride.nickname}
          </p>

          <p className="text-xs opacity-60">Beserta Keluarga Besar Kedua Mempelai</p>

          {/* Wedding Studio Free Branding Badge */}
          {wedding.free_plan_badge && (
            <div className="pt-8">
              <a
                href="/"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border bg-white/60 hover:bg-white transition-all shadow-sm opacity-80 hover:opacity-100"
                style={{ borderColor: `${colors.secondary}40`, color: colors.primary }}
              >
                <span>Dibuat dengan</span>
                <Heart size={12} className="fill-red-400 text-red-400" />
                <span className="font-semibold">Wedding Studio Free</span>
              </a>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
