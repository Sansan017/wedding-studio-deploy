import React, { useState } from 'react';
import { X, Shield, User, Lock, Database, Check } from 'lucide-react';
import { UserProfile } from '../../types/wedding';
import { ApiClient } from '../../lib/api';
import { isSupabaseConfigured } from '../../lib/supabase';

interface AccountModalProps {
  user: UserProfile;
  onClose: () => void;
  onUpdate: (user: UserProfile) => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({ user, onClose, onUpdate }) => {
  const [fullName, setFullName] = useState(user.full_name || '');
  const [newPassword, setNewPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const updated = await ApiClient.updateProfile(fullName, newPassword || undefined);
      onUpdate(updated);
      setSuccessMsg('Profil berhasil diperbarui.');
      setNewPassword('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan profil.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User size={18} className="text-neutral-700" />
            <h3 className="text-base font-bold text-neutral-900">Pengaturan Akun & Paket</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
          {successMsg && (
            <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg flex items-center gap-2">
              <Check size={14} />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg">
              {errorMsg}
            </div>
          )}

          {/* Plan Quota Card */}
          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <Shield size={14} className="text-amber-700" />
                <span>Paket: Free (Gratis Selamanya)</span>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                Aktif
              </span>
            </div>
            <p className="text-[11px] text-amber-900/80 leading-relaxed">
              Maksimal 1 undangan yang dipublikasikan secara aktif, 6 tema mewah gratis, RSVP & Buku Tamu tanpa batas, serta bagikan via WhatsApp.
            </p>
          </div>

          {/* Database / Supabase Connection status */}
          <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database size={15} className="text-neutral-500" />
              <div>
                <div className="font-semibold text-neutral-800">Penyimpanan & Keamanan</div>
                <div className="text-[11px] text-neutral-500">
                  {isSupabaseConfigured ? 'Terhubung ke Supabase PostgreSQL' : 'Database Persisten Internal Aktif'}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Online
            </span>
          </div>

          <div>
            <label className="block font-medium text-neutral-700 mb-1">Email Terdaftar</label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full px-3.5 py-2 border border-neutral-200 bg-neutral-100 rounded-lg text-neutral-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-700 mb-1">Nama Lengkap</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full px-3.5 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900"
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-700 mb-1">
              Ubah Kata Sandi (Kosongkan jika tidak ingin mengubah)
            </label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-2.5 text-neutral-400" />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full pl-9 pr-3.5 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-neutral-300 rounded-xl text-neutral-700 hover:bg-neutral-50 font-medium cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-medium shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
