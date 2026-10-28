import React, { useState } from 'react';
import { X, Mail, Lock, User, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { ApiClient } from '../../lib/api';
import { UserProfile } from '../../types/wedding';

interface AuthModalProps {
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  initialMode = 'login',
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (mode === 'login') {
        const res = await ApiClient.login(email, password);
        onSuccess(res.user);
      } else if (mode === 'register') {
        const res = await ApiClient.register(email, password, fullName);
        onSuccess(res.user);
      } else {
        const res = await ApiClient.requestPasswordReset(email);
        setSuccessMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemo = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await ApiClient.login('demo@weddingstudio.id', 'demo12345');
      onSuccess(res.user);
    } catch {
      // If demo user not yet created, register it
      try {
        const res = await ApiClient.register('demo@weddingstudio.id', 'demo12345', 'Raden Febrian');
        onSuccess(res.user);
      } catch (err: any) {
        setErrorMsg(err.message || 'Gagal masuk akun demo.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto p-3 sm:p-4 flex min-h-full items-center justify-center">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden my-auto">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-neutral-200 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-neutral-900 break-words">
              {mode === 'login' && 'Masuk ke Wedding Studio'}
              {mode === 'register' && 'Daftar Akun Gratis'}
              {mode === 'forgot' && 'Pemulihan Kata Sandi'}
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5 break-words">
              {mode === 'login' && 'Kelola undangan pernikahan digital Anda'}
              {mode === 'register' && 'Mulai buat undangan pernikahan tanpa coding'}
              {mode === 'forgot' && 'Masukkan email yang terdaftar untuk mengatur ulang sandi'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switch */}
        {mode !== 'forgot' && (
          <div className="grid grid-cols-2 border-b border-neutral-200 text-xs font-medium w-full">
            <button
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
              }}
              className={`py-2.5 text-center transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'border-b-2 border-neutral-900 text-neutral-900 font-semibold'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Masuk
            </button>
            <button
              onClick={() => {
                setMode('register');
                setErrorMsg(null);
              }}
              className={`py-2.5 text-center transition-colors cursor-pointer ${
                mode === 'register'
                  ? 'border-b-2 border-neutral-900 text-neutral-900 font-semibold'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Daftar Baru
            </button>
          </div>
        )}

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 text-xs w-full">
          {errorMsg && (
            <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block font-medium text-neutral-700 mb-1">Nama Lengkap</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-2.5 text-neutral-400" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Contoh: Raden Febrian"
                  className="w-full pl-9 pr-3.5 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block font-medium text-neutral-700 mb-1">Alamat Email</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-2.5 text-neutral-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full pl-9 pr-3.5 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-medium text-neutral-700">Kata Sandi</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMsg(null);
                    }}
                    className="text-[11px] text-amber-800 hover:underline cursor-pointer"
                  >
                    Lupa sandi?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-2.5 text-neutral-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full pl-9 pr-3.5 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white font-medium rounded-xl shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            <span>
              {isLoading
                ? 'Memproses...'
                : mode === 'login'
                ? 'Masuk Sekarang'
                : mode === 'register'
                ? 'Daftar Gratis'
                : 'Kirim Instruksi Reset'}
            </span>
            <ArrowRight size={14} />
          </button>

          {/* Quick Demo Login Option */}
          {mode === 'login' && (
            <div className="pt-2 border-t border-neutral-200">
              <button
                type="button"
                onClick={handleQuickDemo}
                disabled={isLoading}
                className="w-full py-2 px-3 border border-amber-300 bg-amber-50/80 hover:bg-amber-100/80 text-amber-900 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer text-xs"
              >
                <Sparkles size={14} className="text-amber-600 shrink-0" />
                <span className="truncate">Masuk Cepat dengan Akun Demo</span>
              </button>
            </div>
          )}

          {mode === 'forgot' && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-neutral-500 hover:text-neutral-800 underline"
              >
                Kembali ke Login
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
