import React, { useState, useEffect } from 'react';
import { X, Download, Trash2, Search, CheckCircle2, XCircle, HelpCircle, Users, MessageSquare } from 'lucide-react';
import { RsvpItem, GuestWish, WeddingData } from '../../types/wedding';
import { ApiClient } from '../../lib/api';

interface RsvpManagerModalProps {
  wedding: WeddingData;
  onClose: () => void;
}

export const RsvpManagerModal: React.FC<RsvpManagerModalProps> = ({ wedding, onClose }) => {
  const [activeTab, setActiveTab] = useState<'rsvp' | 'wishes'>('rsvp');
  const [rsvps, setRsvps] = useState<RsvpItem[]>([]);
  const [wishes, setWishes] = useState<GuestWish[]>([]);
  const [stats, setStats] = useState({
    totalResponses: 0,
    hadir: 0,
    tidakHadir: 0,
    ragu: 0,
    totalGuestsPax: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'hadir' | 'tidak_hadir' | 'ragu'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await ApiClient.getWeddingRsvps(wedding.id);
      setRsvps(data.rsvps || []);
      setWishes(data.wishes || []);
      setStats(data.stats || { totalResponses: 0, hadir: 0, tidakHadir: 0, ragu: 0, totalGuestsPax: 0 });
    } catch (err) {
      console.error('Failed to load RSVPs', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [wedding.id]);

  const handleDeleteRsvp = async (rsvpId: string) => {
    if (!window.confirm('Hapus respon RSVP ini?')) return;
    try {
      await ApiClient.deleteRsvp(wedding.id, rsvpId);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus');
    }
  };

  const handleDeleteWish = async (wishId: string) => {
    if (!window.confirm('Hapus ucapan doa ini?')) return;
    try {
      await ApiClient.deleteWish(wedding.id, wishId);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus');
    }
  };

  const handleExportCsv = () => {
    if (rsvps.length === 0) {
      alert('Belum ada data RSVP untuk diekspor.');
      return;
    }
    const headers = ['No', 'Nama Tamu', 'Status Kehadiran', 'Jumlah Pax', 'Pesan Doa', 'Tanggal'];
    const rows = rsvps.map((r, i) => [
      i + 1,
      `"${r.guest_name.replace(/"/g, '""')}"`,
      r.attendance,
      r.pax_count || 1,
      `"${(r.message || '').replace(/"/g, '""')}"`,
      new Date(r.created_at).toLocaleString('id-ID'),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rsvp-${wedding.slug}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRsvps = rsvps.filter((item) => {
    const matchesFilter = filterStatus === 'all' || item.attendance === filterStatus;
    const matchesSearch = item.guest_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Kelola RSVP & Buku Tamu</h2>
            <p className="text-xs text-neutral-500 mt-0.5">{wedding.title} ({wedding.slug})</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-6 py-4 bg-neutral-50/70 border-b border-neutral-200">
          <div className="p-3 bg-white rounded-xl border border-neutral-200/80">
            <div className="text-xs text-neutral-500 flex items-center gap-1.5 mb-1">
              <Users size={14} className="text-neutral-400" />
              <span>Total Respon</span>
            </div>
            <div className="text-xl font-bold text-neutral-900 tabular-nums">{stats.totalResponses}</div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-neutral-200/80">
            <div className="text-xs text-neutral-500 flex items-center gap-1.5 mb-1">
              <CheckCircle2 size={14} className="text-emerald-500" />
              <span>Pasti Hadir</span>
            </div>
            <div className="text-xl font-bold text-emerald-600 tabular-nums">
              {stats.hadir} <span className="text-xs font-normal text-neutral-500">({stats.totalGuestsPax} pax)</span>
            </div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-neutral-200/80">
            <div className="text-xs text-neutral-500 flex items-center gap-1.5 mb-1">
              <HelpCircle size={14} className="text-amber-500" />
              <span>Masih Ragu</span>
            </div>
            <div className="text-xl font-bold text-amber-600 tabular-nums">{stats.ragu}</div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-neutral-200/80">
            <div className="text-xs text-neutral-500 flex items-center gap-1.5 mb-1">
              <XCircle size={14} className="text-rose-500" />
              <span>Tidak Hadir</span>
            </div>
            <div className="text-xl font-bold text-rose-600 tabular-nums">{stats.tidakHadir}</div>
          </div>
        </div>

        {/* Sub-Tabs & Actions */}
        <div className="px-6 py-3 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('rsvp')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === 'rsvp'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Daftar RSVP ({rsvps.length})
            </button>
            <button
              onClick={() => setActiveTab('wishes')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === 'wishes'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Buku Tamu / Doa ({wishes.length})
            </button>
          </div>

          {activeTab === 'rsvp' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCsv}
                className="px-3 py-1.5 text-xs font-medium border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-50 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download size={13} />
                <span>Ekspor CSV</span>
              </button>
            </div>
          )}
        </div>

        {/* Search & Status Filters for RSVP */}
        {activeTab === 'rsvp' && (
          <div className="px-6 py-2.5 bg-white border-b border-neutral-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1">
              {(['all', 'hadir', 'ragu', 'tidak_hadir'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    filterStatus === st
                      ? 'bg-amber-100 text-amber-900 font-semibold'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  {st === 'all' && 'Semua'}
                  {st === 'hadir' && 'Hadir'}
                  {st === 'ragu' && 'Ragu'}
                  {st === 'tidak_hadir' && 'Tidak Hadir'}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2 text-neutral-400" />
              <input
                type="text"
                placeholder="Cari nama tamu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 pr-3 py-1 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-400 w-44"
              />
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-neutral-400">Memuat data...</div>
          ) : activeTab === 'rsvp' ? (
            filteredRsvps.length === 0 ? (
              <div className="py-16 text-center text-neutral-400 text-xs">
                {rsvps.length === 0
                  ? 'Belum ada tamu yang mengirimkan konfirmasi kehadiran.'
                  : 'Tidak ada RSVP yang cocok dengan filter pencarian.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200 text-neutral-500">
                      <th className="py-2.5 px-3 font-medium">Tamu</th>
                      <th className="py-2.5 px-3 font-medium">Status</th>
                      <th className="py-2.5 px-3 font-medium text-right">Jumlah Pax</th>
                      <th className="py-2.5 px-3 font-medium">Pesan / Ucapan</th>
                      <th className="py-2.5 px-3 font-medium">Waktu</th>
                      <th className="py-2.5 px-3 font-medium text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredRsvps.map((r) => (
                      <tr key={r.id} className="hover:bg-neutral-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-neutral-900">{r.guest_name}</td>
                        <td className="py-2.5 px-3">
                          {r.attendance === 'hadir' && (
                            <span className="text-emerald-700 font-medium">Hadir</span>
                          )}
                          {r.attendance === 'ragu' && (
                            <span className="text-amber-700 font-medium">Ragu</span>
                          )}
                          {r.attendance === 'tidak_hadir' && (
                            <span className="text-rose-700 font-medium">Tidak Hadir</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          {r.attendance === 'hadir' ? `${r.pax_count || 1} orang` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-600 max-w-xs truncate">
                          {r.message || <span className="text-neutral-400 italic">Tanpa pesan</span>}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-400 whitespace-nowrap">
                          {new Date(r.created_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => handleDeleteRsvp(r.id)}
                            className="p-1 text-neutral-400 hover:text-rose-600 transition-colors"
                            title="Hapus respon"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            // Wishes Tab
            wishes.length === 0 ? (
              <div className="py-16 text-center text-neutral-400 text-xs">
                Belum ada doa atau ucapan buku tamu.
              </div>
            ) : (
              <div className="space-y-3">
                {wishes.map((w) => (
                  <div
                    key={w.id}
                    className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-neutral-900">{w.sender_name}</span>
                        <span className="text-[10px] text-neutral-400">·</span>
                        <span className="text-[10px] text-neutral-500">{w.relationship}</span>
                        <span className="text-[10px] text-neutral-400">·</span>
                        <span className="text-[10px] text-neutral-400">
                          {new Date(w.created_at).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-700 leading-relaxed">{w.message}</p>
                    </div>

                    <button
                      onClick={() => handleDeleteWish(w.id)}
                      className="text-neutral-400 hover:text-rose-600 p-1"
                      title="Hapus ucapan"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
