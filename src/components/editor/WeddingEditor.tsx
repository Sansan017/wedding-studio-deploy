import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Save,
  Eye,
  Share2,
  Globe,
  Palette,
  Users,
  Calendar,
  Heart,
  Image as ImageIcon,
  Gift,
  Music,
  ListOrdered,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Smartphone,
  Monitor,
  Check,
  AlertCircle,
  Copy,
  Upload,
  Loader2,
  Sparkles,
  RefreshCw,
  X,
  Edit3,
} from 'lucide-react';
import {
  WeddingData,
  ThemeId,
  FontPairId,
  THEME_PRESETS,
  WeddingEvent,
  LoveStoryItem,
  GalleryPhoto,
  BankAccount,
} from '../../types/wedding';
import { ApiClient } from '../../lib/api';
import { PublicInvitation } from '../public/PublicInvitation';
import { WhatsAppShareModal } from '../dashboard/WhatsAppShareModal';
import { ImageUploadInput } from '../common/ImageUploadInput';

interface WeddingEditorProps {
  weddingId: string;
  onBack: () => void;
}

export const WeddingEditor: React.FC<WeddingEditorProps> = ({ weddingId, onBack }) => {
  const [wedding, setWedding] = useState<WeddingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Editor Tabs
  const [activeTab, setActiveTab] = useState<
    'theme' | 'couple' | 'events' | 'story' | 'gallery' | 'gifts' | 'extra' | 'sections'
  >('theme');

  // Preview Mode on Mobile: 'form' | 'preview'
  const [mobileView, setMobileView] = useState<'form' | 'preview'>('form');
  const [previewDevice, setPreviewDevice] = useState<'phone' | 'full'>('phone');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showFullPreviewModal, setShowFullPreviewModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);

  // Slug Editor state
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [slugDraft, setSlugDraft] = useState('');
  const [slugError, setSlugError] = useState<string | null>(null);
  const [isSavingSlug, setIsSavingSlug] = useState(false);

  // Love Story Upload state
  const [uploadingStoryIndex, setUploadingStoryIndex] = useState<number | null>(null);
  const [storyUploadErrors, setStoryUploadErrors] = useState<Record<number, string>>({});

  const generateSlugFromCouple = (groomName: string, brideName: string) => {
    const g = (groomName || 'mempelai').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const b = (brideName || 'mempelai').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const suffix = Math.random().toString(36).substring(2, 6);
    return `${g || 'groom'}-dan-${b || 'bride'}-${suffix}`;
  };

  useEffect(() => {
    setIsLoading(true);
    ApiClient.getWedding(weddingId)
      .then((data) => setWedding(data))
      .catch((err) => setErrorMessage(err.message || 'Gagal memuat proyek undangan.'))
      .finally(() => setIsLoading(false));
  }, [weddingId]);

  if (isLoading || !wedding) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="text-center text-xs text-neutral-500">
          <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin mx-auto mb-3" />
          <span>Memuat editor undangan...</span>
        </div>
      </div>
    );
  }

  // Save changes to database
  const handleSave = async (customUpdates?: Partial<WeddingData>) => {
    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      const payload = customUpdates ? { ...wedding, ...customUpdates } : wedding;
      const updated = await ApiClient.updateWedding(wedding.id, payload);
      setWedding(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan data.');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle publish
  const handleTogglePublish = async () => {
    const nextState = !wedding.is_published;
    await handleSave({ is_published: nextState });
  };

  // Theme change
  const handleSelectTheme = (themeId: ThemeId) => {
    const preset = THEME_PRESETS[themeId];
    if (!preset) return;
    setWedding({
      ...wedding,
      theme_id: themeId,
      font_pair: preset.defaultFontPair,
      color_palette: { ...preset.colors },
    });
  };

  // Reorder sections
  const moveSection = (index: number, direction: 'up' | 'down') => {
    const sections = [...wedding.sections_order];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const temp = sections[index];
    sections[index] = sections[targetIndex];
    sections[targetIndex] = temp;

    setWedding({ ...wedding, sections_order: sections });
  };

  const toggleSection = (id: string) => {
    const sections = wedding.sections_order.map((sec) =>
      sec.id === id ? { ...sec, is_enabled: !sec.is_enabled } : sec
    );
    setWedding({ ...wedding, sections_order: sections });
  };

  // Copy Public Link (Clean canonical path without hash for full WhatsApp & mobile browser compatibility)
  const handleCopyLink = () => {
    const url = `${window.location.origin}/u/${wedding.slug}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Render Slug section helper (adapts between mobile sub-row and desktop inline layout)
  const renderSlugSection = (isMobile: boolean) => {
    if (isEditingSlug) {
      return (
        <div className="flex flex-col gap-1 min-w-0 max-w-full">
          <div className="flex items-center gap-1 flex-wrap min-w-0">
            <span className="text-[10px] text-neutral-400 font-mono shrink-0">/u/</span>
            <input
              type="text"
              value={slugDraft}
              onChange={(e) => {
                setSlugDraft(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                setSlugError(null);
              }}
              placeholder="nama-pasangan"
              className={`text-xs font-mono px-1.5 py-0.5 border border-neutral-300 rounded bg-white min-w-0 focus:outline-none focus:border-neutral-900 ${
                isMobile ? 'w-24 xs:w-32' : 'w-36 sm:w-44'
              }`}
            />
            <button
              type="button"
              onClick={() => {
                const autoSlug = generateSlugFromCouple(
                  wedding.groom?.nickname || wedding.groom?.name,
                  wedding.bride?.nickname || wedding.bride?.name
                );
                setSlugDraft(autoSlug);
                setSlugError(null);
              }}
              className="px-1.5 py-0.5 text-[10px] bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded flex items-center gap-0.5 cursor-pointer transition-colors shrink-0"
              title="Generate slug dari nama panggilan mempelai"
            >
              <Sparkles size={9} className="text-amber-500" />
              <span className={isMobile ? 'hidden xs:inline' : 'inline'}>Auto</span>
            </button>
            <button
              type="button"
              disabled={isSavingSlug || !slugDraft.trim()}
              onClick={async () => {
                const sanitized = slugDraft
                  .trim()
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, '-')
                  .replace(/-+/g, '-')
                  .replace(/^-|-$/g, '');
                if (sanitized.length < 3) {
                  setSlugError('Slug minimal 3 karakter.');
                  return;
                }
                setIsSavingSlug(true);
                setSlugError(null);
                try {
                  const updated = await ApiClient.updateWedding(wedding.id, { ...wedding, slug: sanitized });
                  setWedding(updated);
                  setIsEditingSlug(false);
                } catch (err: any) {
                  setSlugError(err.message || 'Gagal mengubah slug.');
                } finally {
                  setIsSavingSlug(false);
                }
              }}
              className="px-2 py-0.5 text-[10px] bg-neutral-900 text-white rounded font-medium hover:bg-neutral-800 disabled:opacity-50 cursor-pointer flex items-center gap-0.5 transition-colors shrink-0"
            >
              {isSavingSlug ? <Loader2 size={9} className="animate-spin" /> : <Check size={9} />}
              <span>Simpan</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditingSlug(false);
                setSlugError(null);
              }}
              className="px-1 py-0.5 text-[10px] text-neutral-500 hover:text-neutral-800 rounded cursor-pointer shrink-0"
            >
              Batal
            </button>
          </div>
          {slugError && (
            <span className="text-[10px] text-rose-600 flex items-center gap-1">
              <AlertCircle size={10} />
              <span className="truncate">{slugError}</span>
            </span>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1 sm:gap-2 text-[11px] text-neutral-500 min-w-0 max-w-full">
        <span className="hidden sm:inline shrink-0">Slug URL:</span>
        <span
          className={`font-mono text-neutral-800 font-medium truncate ${
            isMobile ? 'max-w-[110px] xs:max-w-[160px]' : 'max-w-[200px]'
          }`}
          title={`/u/${wedding.slug}`}
        >
          /u/{wedding.slug}
        </span>
        <button
          onClick={handleCopyLink}
          className="text-neutral-400 hover:text-neutral-700 cursor-pointer p-0.5 rounded hover:bg-neutral-100 shrink-0"
          title="Salin Tautan Publik"
        >
          {copiedLink ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
        </button>
        <button
          type="button"
          onClick={() => {
            setSlugDraft(wedding.slug);
            setIsEditingSlug(true);
          }}
          className="text-[10px] text-neutral-600 hover:text-neutral-900 border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 px-1.5 py-0.5 rounded flex items-center gap-0.5 cursor-pointer transition-colors shrink-0"
          title="Ubah tautan slug undangan"
        >
          <Edit3 size={10} />
          <span>Ubah</span>
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col font-sans text-neutral-900 max-w-full">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP BAR (Responsive: 2 rows on mobile, 1 unified bar on desktop) */}
      {/* ------------------------------------------------------------- */}
      <header className="bg-white border-b border-neutral-200 px-3 sm:px-4 py-2 sm:py-3 sticky top-0 z-40 max-w-full">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-4 max-w-full">
          {/* Row 1 on Mobile / Left Section on Desktop */}
          <div className="flex items-center justify-between gap-2 min-w-0 w-full lg:w-auto">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                onClick={onBack}
                className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer shrink-0"
                title="Kembali ke Dashboard"
              >
                <ArrowLeft size={18} />
              </button>

              <div className="min-w-0 flex-1">
                <input
                  type="text"
                  value={wedding.title}
                  onChange={(e) => setWedding({ ...wedding, title: e.target.value })}
                  className="font-bold text-sm text-neutral-900 bg-transparent hover:bg-neutral-50 focus:bg-white px-1 py-0.5 rounded border border-transparent focus:border-neutral-300 focus:outline-none w-full max-w-[170px] sm:max-w-xs md:max-w-sm truncate"
                  placeholder="Judul Undangan"
                />

                {/* Desktop-only slug line under title */}
                <div className="hidden lg:block mt-0.5">
                  {renderSlugSection(false)}
                </div>
              </div>
            </div>

            {/* Mobile-only primary action buttons in Row 1: Publikasi & Simpan */}
            <div className="flex lg:hidden items-center gap-1.5 shrink-0">
              {/* Publish Toggle Button */}
              <button
                onClick={handleTogglePublish}
                disabled={isSaving}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
                  wedding.is_published
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                    : 'bg-neutral-100 text-neutral-700 border border-neutral-300 hover:bg-neutral-200'
                }`}
                title={wedding.is_published ? 'Undangan Terpublikasi (Klik untuk jadikan Draf)' : 'Undangan Draf (Klik untuk Publikasikan)'}
              >
                <Globe size={13} />
                <span>{wedding.is_published ? 'Publik' : 'Draf'}</span>
              </button>

              {/* Save Button */}
              <button
                onClick={() => handleSave()}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-neutral-900 hover:bg-neutral-800 text-white shadow-xs flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50 shrink-0"
              >
                <Save size={13} />
                <span>{isSaving ? '...' : saveSuccess ? 'Disimpan' : 'Simpan'}</span>
              </button>
            </div>
          </div>

          {/* Center: Device Switcher (Desktop only) */}
          <div className="hidden lg:flex items-center bg-neutral-100 p-1 rounded-xl text-xs shrink-0">
            <button
              onClick={() => setPreviewDevice('phone')}
              className={`px-3 py-1 rounded-lg flex items-center gap-1.5 font-medium transition-colors cursor-pointer ${
                previewDevice === 'phone' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-600'
              }`}
            >
              <Smartphone size={13} />
              <span>Mobile Phone</span>
            </button>
            <button
              onClick={() => setPreviewDevice('full')}
              className={`px-3 py-1 rounded-lg flex items-center gap-1.5 font-medium transition-colors cursor-pointer ${
                previewDevice === 'full' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-600'
              }`}
            >
              <Monitor size={13} />
              <span>Tablet / Luas</span>
            </button>
          </div>

          {/* Row 2 on Mobile: Slug & Edit/Preview Mode Switcher */}
          <div className="flex lg:hidden items-center justify-between gap-2 pt-1.5 border-t border-neutral-100 w-full min-w-0">
            {/* Slug Info in Row 2 */}
            <div className="min-w-0 flex-1">
              {renderSlugSection(true)}
            </div>

            {/* Mobile View Switcher (Edit Data vs Pratinjau) */}
            <div className="flex bg-neutral-100 p-0.5 rounded-lg text-xs shrink-0 ml-1">
              <button
                onClick={() => setMobileView('form')}
                className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-colors cursor-pointer ${
                  mobileView === 'form' ? 'bg-white shadow-xs text-neutral-900 font-semibold' : 'text-neutral-500'
                }`}
              >
                Edit
              </button>
              <button
                onClick={() => setMobileView('preview')}
                className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-colors cursor-pointer ${
                  mobileView === 'preview' ? 'bg-white shadow-xs text-neutral-900 font-semibold' : 'text-neutral-500'
                }`}
              >
                Preview
              </button>
            </div>
          </div>

          {/* Desktop-only Right Actions */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            {/* Publish Toggle Button */}
            <button
              onClick={handleTogglePublish}
              disabled={isSaving}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                wedding.is_published
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                  : 'bg-neutral-100 text-neutral-700 border border-neutral-300 hover:bg-neutral-200'
              }`}
            >
              <Globe size={13} />
              <span>{wedding.is_published ? 'Terpublikasi' : 'Draf (Privat)'}</span>
            </button>

            {/* Share WhatsApp */}
            <button
              onClick={() => setShowShareModal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium border border-neutral-300 text-neutral-700 hover:bg-neutral-50 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Share2 size={13} />
              <span>Bagikan</span>
            </button>

            {/* Full Preview Modal Button */}
            <button
              onClick={() => setShowFullPreviewModal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium border border-neutral-300 text-neutral-700 hover:bg-neutral-50 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Eye size={13} />
              <span>Lihat Penuh</span>
            </button>

            {/* Save Button */}
            <button
              onClick={() => handleSave()}
              disabled={isSaving}
              className="px-4 py-1.5 rounded-xl text-xs font-medium bg-neutral-900 hover:bg-neutral-800 text-white shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save size={13} />
              <span>{isSaving ? 'Menyimpan...' : saveSuccess ? 'Tersimpan!' : 'Simpan'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Error alert if any */}
      {errorMessage && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle size={14} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. SPLIT LAYOUT: LEFT CONTROLS, RIGHT PREVIEW */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL: NAVIGATION & FORMS */}
        <div
          className={`w-full min-w-0 max-w-full lg:w-[480px] xl:w-[520px] bg-white border-r border-neutral-200 flex flex-col shrink-0 overflow-y-auto ${
            mobileView === 'preview' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Editor Category Tabs */}
          <div className="flex border-b border-neutral-200 overflow-x-auto bg-neutral-50/50 p-1.5 gap-1 text-xs shrink-0 no-scrollbar">
            {[
              { id: 'theme', label: 'Tema', icon: Palette },
              { id: 'couple', label: 'Mempelai', icon: Users },
              { id: 'events', label: 'Acara', icon: Calendar },
              { id: 'story', label: 'Love Story', icon: Heart },
              { id: 'gallery', label: 'Galeri', icon: ImageIcon },
              { id: 'gifts', label: 'Amplop', icon: Gift },
              { id: 'extra', label: 'Kutipan & Musik', icon: Music },
              { id: 'sections', label: 'Urutan Bagian', icon: ListOrdered },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-2 rounded-lg flex items-center gap-1.5 whitespace-nowrap font-medium transition-colors cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-white text-neutral-900 shadow-xs border border-neutral-200/80 font-semibold'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  <Icon size={13} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB FORM CONTENT */}
          <div className="p-5 space-y-6 text-xs flex-1">
            {/* ---------------- TAB 1: THEMES & STYLING ---------------- */}
            {activeTab === 'theme' && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-sm text-neutral-900 mb-1">Pilihan Tema Visual</h3>
                  <p className="text-neutral-500">
                    Pilih dari 6 tema pernikahan berkelas yang dirancang oleh desainer profesional.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {(Object.keys(THEME_PRESETS) as ThemeId[]).map((tId) => {
                    const preset = THEME_PRESETS[tId];
                    const isSelected = wedding.theme_id === tId;
                    return (
                      <div
                        key={tId}
                        onClick={() => handleSelectTheme(tId)}
                        className={`p-3.5 rounded-xl border-2 text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'border-neutral-900 bg-neutral-50 shadow-sm'
                            : 'border-neutral-200 hover:border-neutral-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-xs text-neutral-900">{preset.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-700">
                            {preset.badge}
                          </span>
                        </div>

                        {/* Swatches preview */}
                        <div className="flex items-center gap-1.5 mb-2">
                          <div
                            className="w-4 h-4 rounded-full border border-neutral-300"
                            style={{ backgroundColor: preset.colors.background }}
                          />
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: preset.colors.primary }}
                          />
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: preset.colors.secondary }}
                          />
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: preset.colors.accent }}
                          />
                        </div>

                        <p className="text-[11px] text-neutral-500 line-clamp-2 leading-relaxed">
                          {preset.description}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Custom Color Overrides */}
                <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-3">
                  <h4 className="font-semibold text-neutral-800">Kustomisasi Warna</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-neutral-600 mb-1">Warna Utama (Aksen Teks & Tombol)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={wedding.color_palette.primary}
                          onChange={(e) =>
                            setWedding({
                              ...wedding,
                              color_palette: { ...wedding.color_palette, primary: e.target.value },
                            })
                          }
                          className="w-8 h-8 rounded border border-neutral-300 cursor-pointer"
                        />
                        <span className="font-mono text-neutral-700">{wedding.color_palette.primary}</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-neutral-600 mb-1">Warna Latar Belakang (Background)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={wedding.color_palette.background}
                          onChange={(e) =>
                            setWedding({
                              ...wedding,
                              color_palette: { ...wedding.color_palette, background: e.target.value },
                            })
                          }
                          className="w-8 h-8 rounded border border-neutral-300 cursor-pointer"
                        />
                        <span className="font-mono text-neutral-700">{wedding.color_palette.background}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Font Selection */}
                <div>
                  <label className="block font-semibold text-neutral-800 mb-1.5">
                    Kombinasi Tipografi (Font Pairing)
                  </label>
                  <select
                    value={wedding.font_pair}
                    onChange={(e) => setWedding({ ...wedding, font_pair: e.target.value as FontPairId })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white"
                  >
                    <option value="cormorant-jakarta">Cormorant Garamond + Plus Jakarta Sans (Klasik Anggun)</option>
                    <option value="playfair-dmsans">Playfair Display + DM Sans (Elegan Modern)</option>
                    <option value="cinzel-jakarta">Cinzel + Plus Jakarta Sans (Mewah & Megah)</option>
                    <option value="cormorant-dmsans">Cormorant + DM Sans (Romantis Lembut)</option>
                  </select>
                </div>
              </div>
            )}

            {/* ---------------- TAB 2: COUPLE DATA ---------------- */}
            {activeTab === 'couple' && (
              <div className="space-y-6">
                {/* Groom */}
                <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-3">
                  <h4 className="font-bold text-neutral-900">Data Mempelai Pria (Groom)</h4>

                  <div>
                    <label className="block font-medium text-neutral-700 mb-1">Nama Lengkap & Gelar</label>
                    <input
                      type="text"
                      value={wedding.groom.name}
                      onChange={(e) =>
                        setWedding({
                          ...wedding,
                          groom: { ...wedding.groom, name: e.target.value },
                        })
                      }
                      className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">Nama Panggilan</label>
                      <input
                        type="text"
                        value={wedding.groom.nickname}
                        onChange={(e) =>
                          setWedding({
                            ...wedding,
                            groom: { ...wedding.groom, nickname: e.target.value },
                          })
                        }
                        className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">Instagram (@handle)</label>
                      <input
                        type="text"
                        value={wedding.groom.instagram || ''}
                        onChange={(e) =>
                          setWedding({
                            ...wedding,
                            groom: { ...wedding.groom, instagram: e.target.value },
                          })
                        }
                        placeholder="@username"
                        className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">Nama Ayah</label>
                      <input
                        type="text"
                        value={wedding.groom.father}
                        onChange={(e) =>
                          setWedding({
                            ...wedding,
                            groom: { ...wedding.groom, father: e.target.value },
                          })
                        }
                        className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">Nama Ibu</label>
                      <input
                        type="text"
                        value={wedding.groom.mother}
                        onChange={(e) =>
                          setWedding({
                            ...wedding,
                            groom: { ...wedding.groom, mother: e.target.value },
                          })
                        }
                        className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-neutral-700 mb-1">Keterangan / Bio Singkat</label>
                    <input
                      type="text"
                      value={wedding.groom.bio || ''}
                      onChange={(e) =>
                        setWedding({
                          ...wedding,
                          groom: { ...wedding.groom, bio: e.target.value },
                        })
                      }
                      placeholder="Contoh: Putra pertama dari dua bersaudara..."
                      className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white"
                    />
                  </div>

                  <ImageUploadInput
                    label="Foto Mempelai Pria"
                    value={wedding.groom.photo_url || ''}
                    onChange={(url) =>
                      setWedding({
                        ...wedding,
                        groom: { ...wedding.groom, photo_url: url },
                      })
                    }
                    placeholder="Unggah foto atau masukkan URL..."
                  />
                </div>

                {/* Bride */}
                <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-3">
                  <h4 className="font-bold text-neutral-900">Data Mempelai Wanita (Bride)</h4>

                  <div>
                    <label className="block font-medium text-neutral-700 mb-1">Nama Lengkap & Gelar</label>
                    <input
                      type="text"
                      value={wedding.bride.name}
                      onChange={(e) =>
                        setWedding({
                          ...wedding,
                          bride: { ...wedding.bride, name: e.target.value },
                        })
                      }
                      className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">Nama Panggilan</label>
                      <input
                        type="text"
                        value={wedding.bride.nickname}
                        onChange={(e) =>
                          setWedding({
                            ...wedding,
                            bride: { ...wedding.bride, nickname: e.target.value },
                          })
                        }
                        className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">Instagram (@handle)</label>
                      <input
                        type="text"
                        value={wedding.bride.instagram || ''}
                        onChange={(e) =>
                          setWedding({
                            ...wedding,
                            bride: { ...wedding.bride, instagram: e.target.value },
                          })
                        }
                        placeholder="@username"
                        className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">Nama Ayah</label>
                      <input
                        type="text"
                        value={wedding.bride.father}
                        onChange={(e) =>
                          setWedding({
                            ...wedding,
                            bride: { ...wedding.bride, father: e.target.value },
                          })
                        }
                        className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">Nama Ibu</label>
                      <input
                        type="text"
                        value={wedding.bride.mother}
                        onChange={(e) =>
                          setWedding({
                            ...wedding,
                            bride: { ...wedding.bride, mother: e.target.value },
                          })
                        }
                        className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-neutral-700 mb-1">Keterangan / Bio Singkat</label>
                    <input
                      type="text"
                      value={wedding.bride.bio || ''}
                      onChange={(e) =>
                        setWedding({
                          ...wedding,
                          bride: { ...wedding.bride, bio: e.target.value },
                        })
                      }
                      placeholder="Contoh: Putri kedua dari tiga bersaudara..."
                      className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white"
                    />
                  </div>

                  <ImageUploadInput
                    label="Foto Mempelai Wanita"
                    value={wedding.bride.photo_url || ''}
                    onChange={(url) =>
                      setWedding({
                        ...wedding,
                        bride: { ...wedding.bride, photo_url: url },
                      })
                    }
                    placeholder="Unggah foto atau masukkan URL..."
                  />
                </div>

                {/* Cover Couple Photo */}
                <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-2">
                  <ImageUploadInput
                    label="Foto Bersama / Cover Utama"
                    value={wedding.cover_image || ''}
                    onChange={(url) => setWedding({ ...wedding, cover_image: url })}
                    placeholder="Unggah foto sampul atau masukkan URL..."
                  />
                </div>
              </div>
            )}

            {/* ---------------- TAB 3: EVENTS SCHEDULE ---------------- */}
            {activeTab === 'events' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-neutral-900">Rangkaian Acara Pernikahan</h3>
                  <button
                    onClick={() => {
                      const newEvent: WeddingEvent = {
                        id: `ev_${Date.now()}`,
                        title: 'Acara Tambahan / Syukuran',
                        date: '2026-12-12',
                        start_time: '18:30',
                        end_time: '21:00',
                        timezone: 'WIB',
                        location_name: 'Nama Tempat / Venue',
                        address: 'Alamat lengkap tempat acara',
                        maps_url: 'https://maps.google.com',
                        is_active: true,
                      };
                      setWedding({ ...wedding, events: [...wedding.events, newEvent] });
                    }}
                    className="px-2.5 py-1 text-xs bg-neutral-900 text-white rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>Tambah Acara</span>
                  </button>
                </div>

                {wedding.events.map((ev, index) => (
                  <div key={ev.id} className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={ev.title}
                        onChange={(e) => {
                          const evs = [...wedding.events];
                          evs[index].title = e.target.value;
                          setWedding({ ...wedding, events: evs });
                        }}
                        className="font-bold text-neutral-900 bg-transparent border-b border-neutral-300 focus:outline-none"
                      />
                      <button
                        onClick={() => {
                          const evs = wedding.events.filter((_, i) => i !== index);
                          setWedding({ ...wedding, events: evs });
                        }}
                        className="text-neutral-400 hover:text-rose-600 p-1"
                        title="Hapus Acara"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-neutral-600 mb-1">Tanggal Acara</label>
                        <input
                          type="date"
                          value={ev.date}
                          onChange={(e) => {
                            const evs = [...wedding.events];
                            evs[index].date = e.target.value;
                            setWedding({ ...wedding, events: evs });
                          }}
                          className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-neutral-600 mb-1">Zona Waktu</label>
                        <select
                          value={ev.timezone}
                          onChange={(e) => {
                            const evs = [...wedding.events];
                            evs[index].timezone = e.target.value;
                            setWedding({ ...wedding, events: evs });
                          }}
                          className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white"
                        >
                          <option value="WIB">WIB</option>
                          <option value="WITA">WITA</option>
                          <option value="WIT">WIT</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-neutral-600 mb-1">Waktu Mulai</label>
                        <input
                          type="time"
                          value={ev.start_time}
                          onChange={(e) => {
                            const evs = [...wedding.events];
                            evs[index].start_time = e.target.value;
                            setWedding({ ...wedding, events: evs });
                          }}
                          className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-neutral-600 mb-1">Waktu Selesai</label>
                        <input
                          type="text"
                          value={ev.end_time}
                          onChange={(e) => {
                            const evs = [...wedding.events];
                            evs[index].end_time = e.target.value;
                            setWedding({ ...wedding, events: evs });
                          }}
                          placeholder="Contoh: 14:00 / Selesai"
                          className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-neutral-600 mb-1">Nama Lokasi / Gedung</label>
                      <input
                        type="text"
                        value={ev.location_name}
                        onChange={(e) => {
                          const evs = [...wedding.events];
                          evs[index].location_name = e.target.value;
                          setWedding({ ...wedding, events: evs });
                        }}
                        className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-neutral-600 mb-1">Alamat Lengkap</label>
                      <textarea
                        rows={2}
                        value={ev.address}
                        onChange={(e) => {
                          const evs = [...wedding.events];
                          evs[index].address = e.target.value;
                          setWedding({ ...wedding, events: evs });
                        }}
                        className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-neutral-600 mb-1">Tautan Google Maps</label>
                      <input
                        type="text"
                        value={ev.maps_url}
                        onChange={(e) => {
                          const evs = [...wedding.events];
                          evs[index].maps_url = e.target.value;
                          setWedding({ ...wedding, events: evs });
                        }}
                        placeholder="https://maps.app.goo.gl/..."
                        className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ---------------- TAB 4: LOVE STORY ---------------- */}
            {activeTab === 'story' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-neutral-900">Perjalanan Cinta (Love Story)</h3>
                  <button
                    onClick={() => {
                      const newStory: LoveStoryItem = {
                        id: `ls_${Date.now()}`,
                        year: '2025',
                        title: 'Momen Istimewa Baru',
                        description: 'Ceritakan momen tak terlupakan dalam perjalanan kalian...',
                      };
                      setWedding({ ...wedding, love_stories: [...(wedding.love_stories || []), newStory] });
                    }}
                    className="px-2.5 py-1 text-xs bg-neutral-900 text-white rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>Tambah Momen</span>
                  </button>
                </div>

                {(wedding.love_stories || []).map((story, i) => (
                  <div key={story.id} className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={story.year}
                        onChange={(e) => {
                          const stories = [...wedding.love_stories];
                          stories[i].year = e.target.value;
                          setWedding({ ...wedding, love_stories: stories });
                        }}
                        className="w-20 font-bold text-neutral-900 border-b border-neutral-300 bg-transparent"
                        placeholder="Tahun"
                      />
                      <button
                        onClick={() => {
                          const stories = wedding.love_stories.filter((_, idx) => idx !== i);
                          setWedding({ ...wedding, love_stories: stories });
                        }}
                        className="text-neutral-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <input
                      type="text"
                      value={story.title}
                      onChange={(e) => {
                        const stories = [...wedding.love_stories];
                        stories[i].title = e.target.value;
                        setWedding({ ...wedding, love_stories: stories });
                      }}
                      className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white font-medium"
                      placeholder="Judul momen"
                    />

                    <textarea
                      rows={2}
                      value={story.description}
                      onChange={(e) => {
                        const stories = [...wedding.love_stories];
                        stories[i].description = e.target.value;
                        setWedding({ ...wedding, love_stories: stories });
                      }}
                      className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white resize-none"
                      placeholder="Deskripsi cerita romantis..."
                    />

                    {/* Foto Momen: Upload Langsung & Preview */}
                    <div className="space-y-2 pt-1 border-t border-neutral-200/60">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-neutral-700 flex items-center gap-1.5">
                          <ImageIcon size={13} className="text-neutral-500" />
                          <span>Foto Momen</span>
                        </span>
                        {story.photo_url && (
                          <button
                            type="button"
                            onClick={() => {
                              const stories = [...wedding.love_stories];
                              stories[i].photo_url = '';
                              setWedding({ ...wedding, love_stories: stories });
                            }}
                            className="text-rose-600 hover:text-rose-700 text-[11px] flex items-center gap-0.5 cursor-pointer"
                          >
                            <Trash2 size={11} />
                            <span>Hapus Foto</span>
                          </button>
                        )}
                      </div>

                      {story.photo_url && (
                        <div className="relative group w-full h-36 rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100">
                          <img
                            src={story.photo_url}
                            alt={story.title || 'Foto Momen'}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <label
                          className={`flex-1 px-3 py-2 border border-dashed border-neutral-300 hover:border-neutral-400 bg-white hover:bg-neutral-50 rounded-lg text-xs font-medium text-neutral-700 flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                            uploadingStoryIndex === i ? 'opacity-50 pointer-events-none' : ''
                          }`}
                        >
                          {uploadingStoryIndex === i ? (
                            <>
                              <Loader2 size={13} className="animate-spin text-neutral-600" />
                              <span>Mengunggah foto momen...</span>
                            </>
                          ) : (
                            <>
                              <Upload size={13} className="text-neutral-600" />
                              <span>{story.photo_url ? 'Ganti Foto dari Perangkat' : 'Unggah Foto dari Perangkat'}</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            disabled={uploadingStoryIndex === i}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;

                              if (file.size > 5 * 1024 * 1024) {
                                setStoryUploadErrors((prev) => ({
                                  ...prev,
                                  [i]: 'Ukuran file foto melebihi batas 5MB.',
                                }));
                                e.target.value = '';
                                return;
                              }

                              const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
                              if (!validMimes.includes(file.type)) {
                                setStoryUploadErrors((prev) => ({
                                  ...prev,
                                  [i]: 'Format file harus berupa gambar JPEG, PNG, atau WebP.',
                                }));
                                e.target.value = '';
                                return;
                              }

                              setUploadingStoryIndex(i);
                              setStoryUploadErrors((prev) => {
                                const next = { ...prev };
                                delete next[i];
                                return next;
                              });

                              try {
                                const res = await ApiClient.uploadMedia(file);
                                if (!res.url || typeof res.url !== 'string' || res.url.trim().length === 0) {
                                  throw new Error('Server tidak mengembalikan URL publik yang valid.');
                                }
                                const uploadedUrl = res.url.trim();
                                const stories = [...wedding.love_stories];
                                stories[i].photo_url = uploadedUrl;
                                setWedding({ ...wedding, love_stories: stories });
                              } catch (err: any) {
                                setStoryUploadErrors((prev) => ({
                                  ...prev,
                                  [i]: err.message || 'Gagal mengunggah foto momen.',
                                }));
                              } finally {
                                setUploadingStoryIndex(null);
                                e.target.value = '';
                              }
                            }}
                          />
                        </label>
                      </div>

                      {storyUploadErrors[i] && (
                        <div className="text-[11px] text-rose-600 flex items-center gap-1">
                          <AlertCircle size={12} />
                          <span>{storyUploadErrors[i]}</span>
                        </div>
                      )}

                      <div className="pt-1">
                        <input
                          type="text"
                          value={story.photo_url || ''}
                          onChange={(e) => {
                            const stories = [...wedding.love_stories];
                            stories[i].photo_url = e.target.value;
                            setWedding({ ...wedding, love_stories: stories });
                          }}
                          className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded-lg bg-white"
                          placeholder="Atau masukkan tautan URL foto eksternal..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ---------------- TAB 5: PHOTO GALLERY ---------------- */}
            {activeTab === 'gallery' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-neutral-900">Galeri Foto Mempelai</h3>
                    <p className="text-neutral-500 text-[11px]">
                      {wedding.gallery_photos?.length || 0} / 12 foto (Batas paket Free).
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if ((wedding.gallery_photos?.length || 0) >= 12) {
                          setGalleryError('Batas paket Free tercapai: Maksimal 12 foto dalam galeri.');
                          return;
                        }
                        const newPhoto: GalleryPhoto = {
                          id: `g_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                          url: '',
                          caption: '',
                        };
                        setWedding((prev) =>
                          prev ? { ...prev, gallery_photos: [...(prev.gallery_photos || []), newPhoto] } : prev
                        );
                      }}
                      disabled={(wedding.gallery_photos?.length || 0) >= 12}
                      className="px-2.5 py-1 text-xs border border-neutral-300 hover:bg-neutral-100 text-neutral-700 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-40"
                      title="Tambah baris foto secara manual"
                    >
                      <Plus size={12} />
                      <span>Tambah Manual</span>
                    </button>

                    <label
                      className={`px-2.5 py-1 text-xs bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors ${
                        galleryUploading || (wedding.gallery_photos?.length || 0) >= 12
                          ? 'opacity-50 pointer-events-none'
                          : ''
                      }`}
                    >
                      {galleryUploading ? (
                        <>
                          <Loader2 size={12} className="animate-spin text-white" />
                          <span>Mengunggah...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={12} />
                          <span>Unggah Foto</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={galleryUploading || (wedding.gallery_photos?.length || 0) >= 12}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          if ((wedding.gallery_photos?.length || 0) >= 12) {
                            setGalleryError('Batas paket Free tercapai: Maksimal 12 foto dalam galeri.');
                            e.target.value = '';
                            return;
                          }

                          if (file.size > 5 * 1024 * 1024) {
                            setGalleryError('Ukuran file foto melebihi batas 5MB.');
                            e.target.value = '';
                            return;
                          }

                          const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
                          if (!validMimes.includes(file.type)) {
                            setGalleryError('Format file harus berupa gambar JPEG, PNG, atau WebP.');
                            e.target.value = '';
                            return;
                          }

                          setGalleryUploading(true);
                          setGalleryError(null);

                          try {
                            const res = await ApiClient.uploadMedia(file);
                            if (!res.url || typeof res.url !== 'string' || res.url.trim().length === 0) {
                              throw new Error('Server tidak mengembalikan URL publik yang valid.');
                            }

                            // (1) URL publik dari respons /api/media/upload diisi ke field url
                            // (2) nama file hanya mengisi field keterangan/caption
                            const publicPhotoUrl = res.url.trim();
                            const fileNameCaption = file.name.replace(/\.[^/.]+$/, '').trim();

                            const newPhoto: GalleryPhoto = {
                              id: `g_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                              url: publicPhotoUrl,
                              caption: fileNameCaption,
                            };

                            setWedding((prev) => {
                              if (!prev) return prev;
                              return {
                                ...prev,
                                gallery_photos: [...(prev.gallery_photos || []), newPhoto],
                              };
                            });
                          } catch (err: any) {
                            setGalleryError(err.message || 'Gagal mengunggah foto.');
                          } finally {
                            setGalleryUploading(false);
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* (5) Pesan error yang jelas bila upload gagal */}
                {galleryError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={14} className="shrink-0 text-rose-600" />
                      <span>{galleryError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGalleryError(null)}
                      className="text-rose-500 hover:text-rose-800 text-xs font-bold px-1.5 py-0.5 ml-2"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div className="space-y-3">
                  {(!wedding.gallery_photos || wedding.gallery_photos.length === 0) && (
                    <div className="p-6 text-center border border-dashed border-neutral-300 rounded-xl bg-neutral-50/50">
                      <p className="text-xs text-neutral-500">Belum ada foto di galeri.</p>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        Klik tombol "Unggah Foto" di atas untuk menambahkan momen bahagia mempelai.
                      </p>
                    </div>
                  )}

                  {wedding.gallery_photos?.map((photo, i) => (
                    <div
                      key={photo.id || i}
                      className="p-3 rounded-xl border border-neutral-200 bg-neutral-50/50 flex items-start gap-3"
                    >
                      {/* (3) Preview tampil dari URL itu */}
                      <div className="w-16 h-16 rounded-lg bg-neutral-200 overflow-hidden shrink-0 border border-neutral-300 relative flex items-center justify-center">
                        {photo.url ? (
                          <img
                            src={photo.url}
                            alt={photo.caption || `Foto ${i + 1}`}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.opacity = '0.3';
                            }}
                          />
                        ) : (
                          <span className="text-[10px] text-neutral-400 text-center px-1">Tanpa Foto</span>
                        )}
                        {replacingIndex === i && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Loader2 size={16} className="text-white animate-spin" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 space-y-2">
                        {/* Field (1): URL Foto */}
                        <div>
                          <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                            URL Foto
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={photo.url || ''}
                              onChange={(e) => {
                                const photos = [...wedding.gallery_photos];
                                photos[i] = { ...photos[i], url: e.target.value };
                                setWedding({ ...wedding, gallery_photos: photos });
                              }}
                              className="flex-1 px-2.5 py-1.5 border border-neutral-300 rounded-lg bg-white text-xs font-mono focus:outline-none focus:border-neutral-900"
                              placeholder="https://... URL Foto publik"
                            />
                            <label
                              className="px-2 py-1.5 border border-neutral-300 rounded-lg bg-white hover:bg-neutral-100 text-neutral-700 text-[11px] font-medium flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                              title="Unggah file untuk foto ini"
                            >
                              <Upload size={12} />
                              <span>Ganti</span>
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                disabled={replacingIndex === i}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;

                                  if (file.size > 5 * 1024 * 1024) {
                                    setGalleryError('Ukuran file foto melebihi batas 5MB.');
                                    e.target.value = '';
                                    return;
                                  }

                                  const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
                                  if (!validMimes.includes(file.type)) {
                                    setGalleryError('Format file harus berupa gambar JPEG, PNG, atau WebP.');
                                    e.target.value = '';
                                    return;
                                  }

                                  setReplacingIndex(i);
                                  setGalleryError(null);

                                  try {
                                    const res = await ApiClient.uploadMedia(file);
                                    if (!res.url) throw new Error('Gagal mendapatkan URL publik dari server.');
                                    const publicPhotoUrl = res.url.trim();
                                    const fileNameCaption = file.name.replace(/\.[^/.]+$/, '').trim();

                                    setWedding((prev) => {
                                      if (!prev) return prev;
                                      const updated = [...(prev.gallery_photos || [])];
                                      if (updated[i]) {
                                        updated[i] = {
                                          ...updated[i],
                                          url: publicPhotoUrl, // (1) URL publik
                                          caption: updated[i].caption || fileNameCaption, // (2) nama file ke keterangan jika kosong
                                        };
                                      }
                                      return { ...prev, gallery_photos: updated };
                                    });
                                  } catch (err: any) {
                                    setGalleryError(err.message || 'Gagal mengunggah foto.');
                                  } finally {
                                    setReplacingIndex(null);
                                    e.target.value = '';
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>

                        {/* Field (2): Keterangan / Caption */}
                        <div>
                          <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                            Keterangan Foto (Caption)
                          </label>
                          <input
                            type="text"
                            value={photo.caption || ''}
                            onChange={(e) => {
                              const photos = [...wedding.gallery_photos];
                              photos[i] = { ...photos[i], caption: e.target.value };
                              setWedding({ ...wedding, gallery_photos: photos });
                            }}
                            className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-lg bg-white text-xs focus:outline-none focus:border-neutral-900"
                            placeholder="Keterangan foto (opsional)..."
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const photos = wedding.gallery_photos.filter((_, idx) => idx !== i);
                          setWedding({ ...wedding, gallery_photos: photos });
                        }}
                        className="text-neutral-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors shrink-0"
                        title="Hapus foto ini"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ---------------- TAB 6: GIFTS & AMPLOP DIGITAL ---------------- */}
            {activeTab === 'gifts' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-neutral-900">Rekening Amplop Digital</h3>
                  <button
                    onClick={() => {
                      const newBank: BankAccount = {
                        id: `bank_${Date.now()}`,
                        bank_name: 'BCA',
                        account_number: '1234567890',
                        account_holder: 'Nama Pemilik Rekening',
                      };
                      setWedding({ ...wedding, bank_accounts: [...wedding.bank_accounts, newBank] });
                    }}
                    className="px-2.5 py-1 text-xs bg-neutral-900 text-white rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>Tambah Rekening</span>
                  </button>
                </div>

                {wedding.bank_accounts.map((bank, i) => (
                  <div key={bank.id} className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={bank.bank_name}
                        onChange={(e) => {
                          const banks = [...wedding.bank_accounts];
                          banks[i].bank_name = e.target.value;
                          setWedding({ ...wedding, bank_accounts: banks });
                        }}
                        className="font-bold text-neutral-900 border-b border-neutral-300 bg-transparent"
                        placeholder="Nama Bank (BCA / Mandiri / BSI)"
                      />
                      <button
                        onClick={() => {
                          const banks = wedding.bank_accounts.filter((_, idx) => idx !== i);
                          setWedding({ ...wedding, bank_accounts: banks });
                        }}
                        className="text-neutral-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-neutral-600 mb-1">Nomor Rekening</label>
                        <input
                          type="text"
                          value={bank.account_number}
                          onChange={(e) => {
                            const banks = [...wedding.bank_accounts];
                            banks[i].account_number = e.target.value;
                            setWedding({ ...wedding, bank_accounts: banks });
                          }}
                          className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-neutral-600 mb-1">Atas Nama</label>
                        <input
                          type="text"
                          value={bank.account_holder}
                          onChange={(e) => {
                            const banks = [...wedding.bank_accounts];
                            banks[i].account_holder = e.target.value;
                            setWedding({ ...wedding, bank_accounts: banks });
                          }}
                          className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {/* Mailing address */}
                <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-2">
                  <h4 className="font-bold text-neutral-900">Alamat Pengiriman Kado Fisik</h4>
                  <div>
                    <label className="block text-neutral-600 mb-1">Nama Penerima & No. HP</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={wedding.gift_address?.recipient_name || ''}
                        onChange={(e) =>
                          setWedding({
                            ...wedding,
                            gift_address: { ...wedding.gift_address, recipient_name: e.target.value },
                          })
                        }
                        placeholder="Nama Penerima"
                        className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white"
                      />
                      <input
                        type="text"
                        value={wedding.gift_address?.phone || ''}
                        onChange={(e) =>
                          setWedding({
                            ...wedding,
                            gift_address: { ...wedding.gift_address, phone: e.target.value },
                          })
                        }
                        placeholder="No. WhatsApp / HP"
                        className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-neutral-600 mb-1">Alamat Lengkap</label>
                    <textarea
                      rows={2}
                      value={wedding.gift_address?.address || ''}
                      onChange={(e) =>
                        setWedding({
                          ...wedding,
                          gift_address: { ...wedding.gift_address, address: e.target.value },
                        })
                      }
                      placeholder="Alamat domisili untuk pengiriman kado..."
                      className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ---------------- TAB 7: QUOTES, DRESS CODE & MUSIC ---------------- */}
            {activeTab === 'extra' && (
              <div className="space-y-5">
                {/* Quote */}
                <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-2">
                  <h4 className="font-bold text-neutral-900">Kutipan / Ayat Suci</h4>
                  <textarea
                    rows={3}
                    value={wedding.quote?.text || ''}
                    onChange={(e) =>
                      setWedding({ ...wedding, quote: { ...wedding.quote, text: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white resize-none"
                  />
                  <input
                    type="text"
                    value={wedding.quote?.source || ''}
                    onChange={(e) =>
                      setWedding({ ...wedding, quote: { ...wedding.quote, source: e.target.value } })
                    }
                    placeholder="Sumber (Contoh: QS. Ar-Rum: 21)"
                    className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white"
                  />
                </div>

                {/* Dress Code */}
                <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-2">
                  <h4 className="font-bold text-neutral-900">Dress Code Tamu</h4>
                  <input
                    type="text"
                    value={wedding.dress_code?.title || ''}
                    onChange={(e) =>
                      setWedding({
                        ...wedding,
                        dress_code: { ...wedding.dress_code, title: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white"
                    placeholder="Judul Dress Code"
                  />
                  <input
                    type="text"
                    value={wedding.dress_code?.description || ''}
                    onChange={(e) =>
                      setWedding({
                        ...wedding,
                        dress_code: { ...wedding.dress_code, description: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white"
                    placeholder="Deskripsi (contoh: Formal, Earth Tone)"
                  />
                </div>

                {/* Background Music */}
                <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-neutral-900">Musik Latar Romantis</h4>
                      <p className="text-neutral-500 text-[11px]">
                        Menggunakan instrumen piano akustik lembut bawaan (bebas hak cipta & tanpa putus).
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={wedding.audio_bg?.enabled ?? true}
                      onChange={(e) =>
                        setWedding({
                          ...wedding,
                          audio_bg: { ...wedding.audio_bg, enabled: e.target.checked },
                        })
                      }
                      className="w-4 h-4 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-600 mb-1">Judul Lagu yang Ditampilkan</label>
                    <input
                      type="text"
                      value={wedding.audio_bg?.title || ''}
                      onChange={(e) =>
                        setWedding({
                          ...wedding,
                          audio_bg: { ...wedding.audio_bg, title: e.target.value },
                        })
                      }
                      className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ---------------- TAB 8: SECTIONS ORDER & VISIBILITY ---------------- */}
            {activeTab === 'sections' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-sm text-neutral-900 mb-1">Urutan & Visibilitas Bagian</h3>
                  <p className="text-neutral-500 text-[11px]">
                    Atur susunan bagian undangan atau sembunyikan bagian yang tidak ingin ditampilkan.
                  </p>
                </div>

                <div className="space-y-2">
                  {wedding.sections_order.map((sec, i) => (
                    <div
                      key={sec.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                        sec.is_enabled ? 'bg-white border-neutral-200' : 'bg-neutral-100 border-neutral-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={sec.is_enabled}
                          onChange={() => toggleSection(sec.id)}
                          className="w-4 h-4 cursor-pointer"
                        />
                        <span className="font-medium text-xs text-neutral-800">{sec.label}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveSection(i, 'up')}
                          disabled={i === 0}
                          className="p-1 rounded text-neutral-400 hover:text-neutral-700 disabled:opacity-20 cursor-pointer"
                        >
                          <ChevronUp size={15} />
                        </button>
                        <button
                          onClick={() => moveSection(i, 'down')}
                          disabled={i === wedding.sections_order.length - 1}
                          className="p-1 rounded text-neutral-400 hover:text-neutral-700 disabled:opacity-20 cursor-pointer"
                        >
                          <ChevronDown size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: LIVE INTERACTIVE PREVIEW */}
        <div
          className={`flex-1 min-w-0 max-w-full bg-neutral-200/70 p-2 sm:p-4 lg:p-8 flex items-center justify-center overflow-y-auto ${
            mobileView === 'form' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div
            className={`transition-all duration-300 w-full ${
              previewDevice === 'phone'
                ? 'max-w-[420px] rounded-2xl sm:rounded-[44px] border-2 sm:border-[10px] border-neutral-900 shadow-2xl overflow-hidden bg-white max-h-[880px]'
                : 'max-w-[800px] rounded-2xl border border-neutral-300 shadow-xl overflow-hidden bg-white max-h-[920px]'
            } flex flex-col`}
          >
            {/* Phone Speaker Notch Bar if phone */}
            {previewDevice === 'phone' && (
              <div className="h-6 bg-neutral-900 flex items-center justify-center shrink-0">
                <div className="w-20 h-3.5 bg-black rounded-full" />
              </div>
            )}

            {/* Scrollable Live Invitation Body */}
            <div className="flex-1 overflow-y-auto no-scrollbar relative">
              <PublicInvitation wedding={wedding} isEditorPreview={true} />
            </div>

            {/* Home Bar indicator if phone */}
            {previewDevice === 'phone' && (
              <div className="h-4 bg-neutral-900 flex items-center justify-center shrink-0">
                <div className="w-28 h-1 bg-white/40 rounded-full" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Share WhatsApp Modal */}
      {showShareModal && (
        <WhatsAppShareModal wedding={wedding} onClose={() => setShowShareModal(false)} />
      )}

      {/* Full Preview Modal */}
      {showFullPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6">
          <div className="bg-white w-full max-w-2xl h-[95vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-neutral-900 text-white flex items-center justify-between text-xs">
              <span className="font-semibold">Pratinjau Undangan Penuh</span>
              <button
                onClick={() => setShowFullPreviewModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                Tutup
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <PublicInvitation wedding={wedding} isEditorPreview={false} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
