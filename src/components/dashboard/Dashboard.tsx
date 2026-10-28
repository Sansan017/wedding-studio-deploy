import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  ExternalLink,
  Edit3,
  Copy,
  Trash2,
  Users,
  Share2,
  Globe,
  Lock,
  Sparkles,
  Shield,
  LogOut,
  Settings,
  Heart,
  Calendar,
} from 'lucide-react';
import { WeddingData, UserProfile, THEME_PRESETS } from '../../types/wedding';
import { ApiClient } from '../../lib/api';
import { RsvpManagerModal } from './RsvpManagerModal';
import { WhatsAppShareModal } from './WhatsAppShareModal';
import { AccountModal } from './AccountModal';

interface DashboardProps {
  user: UserProfile;
  onSelectWedding: (weddingId: string) => void;
  onLogout: () => void;
  onViewPublic: (slug: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  user,
  onSelectWedding,
  onLogout,
  onViewPublic,
}) => {
  const [weddings, setWeddings] = useState<WeddingData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeRsvpWedding, setActiveRsvpWedding] = useState<WeddingData | null>(null);
  const [activeShareWedding, setActiveShareWedding] = useState<WeddingData | null>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile>(user);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchWeddings = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await ApiClient.getWeddings();
      setWeddings(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat daftar undangan.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWeddings();
  }, []);

  const handleCreateWedding = async () => {
    try {
      const newWed = await ApiClient.createWedding();
      onSelectWedding(newWed.id);
    } catch (err: any) {
      alert(err.message || 'Gagal membuat undangan.');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await ApiClient.duplicateWedding(id);
      fetchWeddings();
    } catch (err: any) {
      alert(err.message || 'Gagal menduplikasi undangan.');
    }
  };

  const handleDelete = async (wedding: WeddingData) => {
    if (!window.confirm(`Hapus undangan "${wedding.title}"? Semua data RSVP dan buku tamu juga akan terhapus permanen.`)) {
      return;
    }

    try {
      await ApiClient.deleteWedding(wedding.id);
      fetchWeddings();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus undangan.');
    }
  };

  const handleTogglePublish = async (wedding: WeddingData) => {
    try {
      const nextState = !wedding.is_published;
      await ApiClient.updateWedding(wedding.id, { is_published: nextState });
      fetchWeddings();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status publikasi.');
    }
  };

  const publishedCount = weddings.filter((w) => w.is_published).length;
  const filteredWeddings = weddings.filter(
    (w) =>
      w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.groom.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.bride.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans flex flex-col">
      {/* ------------------------------------------------------------- */}
      {/* TOP BAR CONTRACT */}
      {/* ------------------------------------------------------------- */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between gap-8 sticky top-0 z-30">
        {/* Zone 1: Single text wordmark */}
        <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
          <Heart size={20} className="fill-amber-600 text-amber-600" />
          <span className="font-bold text-lg tracking-tight text-neutral-900">
            Wedding Studio Free
          </span>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-600">
          <span className="text-neutral-900 font-semibold cursor-default">Dashboard</span>
          <span className="cursor-default text-neutral-400">·</span>
          <span className="text-neutral-500">6 Tema Mewah</span>
          <span className="cursor-default text-neutral-400">·</span>
          <span className="text-neutral-500">RSVP & WhatsApp</span>
        </nav>

        {/* Zone 3: Primary Action / User Account */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowAccountModal(true)}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-xs font-medium text-neutral-700 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Settings size={13} />
            <span className="hidden sm:inline">{currentUser.full_name || currentUser.email}</span>
            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-semibold">
              FREE
            </span>
          </button>

          <button
            onClick={onLogout}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 cursor-pointer"
            title="Keluar"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6 flex-1">
        {/* Banner with Free Plan Limits */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-neutral-900 to-neutral-800 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-amber-400 font-semibold">
                Paket Free Selamanya
              </span>
              <span className="text-neutral-400">·</span>
              <span className="text-xs text-neutral-300">
                {publishedCount} / 1 Undangan Aktif Terpublikasi
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Selamat datang, {currentUser.full_name}!
            </h1>
            <p className="text-xs text-neutral-300 max-w-xl leading-relaxed">
              Buat undangan pernikahan digital yang elegan, pilih dari 6 tema mewah, kelola respon tamu, dan bagikan tautan via WhatsApp secara instan.
            </p>
          </div>

          <button
            onClick={handleCreateWedding}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-900 font-semibold text-xs flex items-center gap-2 shadow-sm transition-transform hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus size={16} />
            <span>Buat Undangan Baru</span>
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-2.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Cari berdasarkan nama pasangan atau judul..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-neutral-300 bg-white focus:outline-none focus:border-neutral-900"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span>Total:</span>
            <span className="font-semibold text-neutral-900 tabular-nums">{weddings.length} Proyek</span>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
            {errorMessage}
          </div>
        )}

        {/* Projects List */}
        {isLoading ? (
          <div className="py-20 text-center text-xs text-neutral-400">
            <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin mx-auto mb-3" />
            <span>Memuat daftar undangan pernikahan...</span>
          </div>
        ) : filteredWeddings.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border-2 border-dashed border-neutral-300 bg-white space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-700 mx-auto flex items-center justify-center">
              <Heart size={24} />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 text-sm">Belum Ada Proyek Undangan</h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1">
                {searchQuery
                  ? 'Tidak ada undangan yang cocok dengan pencarian Anda.'
                  : 'Mulai buat website undangan pernikahan pertama Anda dengan mudah sekarang.'}
              </p>
            </div>
            <button
              onClick={handleCreateWedding}
              className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Mulai Buat Undangan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredWeddings.map((wedding) => {
              const theme = THEME_PRESETS[wedding.theme_id] || THEME_PRESETS['minimalist-ivory'];
              return (
                <div
                  key={wedding.id}
                  className="bg-white rounded-2xl border border-neutral-200/90 shadow-xs overflow-hidden flex flex-col hover:shadow-md transition-all group"
                >
                  {/* Thumbnail / Header Preview */}
                  <div className="relative h-44 overflow-hidden bg-neutral-100 border-b border-neutral-200">
                    <img
                      src={wedding.cover_image || wedding.gallery_photos?.[0]?.url || ''}
                      alt={wedding.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                    {/* Status Badge */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1 ${
                          wedding.is_published
                            ? 'bg-emerald-500/90 text-white backdrop-blur-sm'
                            : 'bg-neutral-900/80 text-white backdrop-blur-sm'
                        }`}
                      >
                        {wedding.is_published ? <Globe size={11} /> : <Lock size={11} />}
                        <span>{wedding.is_published ? 'Terpublikasi' : 'Draf'}</span>
                      </span>
                    </div>

                    {/* Theme Tag */}
                    <div className="absolute top-3 right-3">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-white/90 text-neutral-800 backdrop-blur-sm">
                        {theme.name}
                      </span>
                    </div>

                    {/* Couple Names on bottom */}
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <h3 className="font-bold text-sm tracking-tight truncate drop-shadow">
                        {wedding.groom.nickname} & {wedding.bride.nickname}
                      </h3>
                      <p className="text-[11px] text-white/80 truncate">
                        {wedding.events?.[0]?.date
                          ? new Date(wedding.events[0].date).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })
                          : 'Belum diatur'}
                      </p>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between text-xs">
                    <div>
                      <h4 className="font-semibold text-neutral-900 truncate mb-1">
                        {wedding.title}
                      </h4>

                      <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                        <span className="font-mono text-neutral-600 truncate">/u/{wedding.slug}</span>
                      </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="space-y-2 pt-2 border-t border-neutral-100">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => onSelectWedding(wedding.id)}
                          className="py-1.5 px-3 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Edit3 size={12} />
                          <span>Edit Desain</span>
                        </button>

                        <button
                          onClick={() => setActiveRsvpWedding(wedding)}
                          className="py-1.5 px-3 rounded-lg border border-neutral-300 hover:bg-neutral-50 text-neutral-700 font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Users size={12} />
                          <span>Data RSVP</span>
                        </button>
                      </div>

                      {/* Secondary row */}
                      <div className="flex items-center justify-between text-neutral-500 pt-1">
                        <div className="flex items-center gap-2">
                          {wedding.is_published && (
                            <button
                              onClick={() => onViewPublic(wedding.slug)}
                              className="text-neutral-600 hover:text-neutral-900 flex items-center gap-1 cursor-pointer"
                              title="Buka Website Undangan"
                            >
                              <ExternalLink size={13} />
                              <span className="text-[11px]">Buka Web</span>
                            </button>
                          )}

                          <button
                            onClick={() => setActiveShareWedding(wedding)}
                            className="text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                            title="Bagikan via WhatsApp"
                          >
                            <Share2 size={13} />
                            <span className="text-[11px]">WhatsApp</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleTogglePublish(wedding)}
                            className="p-1.5 text-neutral-400 hover:text-neutral-700"
                            title={wedding.is_published ? 'Ubah ke Draf' : 'Publikasikan'}
                          >
                            <Globe size={13} className={wedding.is_published ? 'text-emerald-600' : ''} />
                          </button>

                          <button
                            onClick={() => handleDuplicate(wedding.id)}
                            className="p-1.5 text-neutral-400 hover:text-neutral-700"
                            title="Duplikasi Proyek"
                          >
                            <Copy size={13} />
                          </button>

                          <button
                            onClick={() => handleDelete(wedding)}
                            className="p-1.5 text-neutral-400 hover:text-rose-600"
                            title="Hapus Proyek"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* RSVP Modal */}
      {activeRsvpWedding && (
        <RsvpManagerModal
          wedding={activeRsvpWedding}
          onClose={() => {
            setActiveRsvpWedding(null);
            fetchWeddings();
          }}
        />
      )}

      {/* WhatsApp Modal */}
      {activeShareWedding && (
        <WhatsAppShareModal
          wedding={activeShareWedding}
          onClose={() => setActiveShareWedding(null)}
        />
      )}

      {/* Account Modal */}
      {showAccountModal && (
        <AccountModal
          user={currentUser}
          onClose={() => setShowAccountModal(false)}
          onUpdate={(u) => setCurrentUser(u)}
        />
      )}
    </div>
  );
};
