import React, { useState, useEffect } from 'react';
import { ApiClient } from './lib/api';
import { UserProfile, WeddingData } from './types/wedding';
import { Dashboard } from './components/dashboard/Dashboard';
import { WeddingEditor } from './components/editor/WeddingEditor';
import { PublicInvitation } from './components/public/PublicInvitation';
import { LandingPage } from './components/landing/LandingPage';
import { AuthModal } from './components/auth/AuthModal';
import { Heart, ArrowLeft } from 'lucide-react';
import { createDefaultWedding } from './lib/defaultWedding';

// Helper to extract wedding slug from URL on initial load and route changes
// Supports clean canonical path (/u/:slug) and backward-compatible hash routes (#/u/:slug, #u/:slug)
function extractSlugFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const pathname = window.location.pathname || '';
  const hash = window.location.hash || '';

  // 1. Path-based route: /u/:slug (Primary canonical link)
  const pathMatch = pathname.match(/^\/u\/([^/?#]+)/i);
  if (pathMatch && pathMatch[1]) {
    const raw = decodeURIComponent(pathMatch[1]).trim().replace(/\/+$/, '');
    if (raw) return raw;
  }

  // 2. Hash-based route: #/u/:slug or #u/:slug
  const hashMatch = hash.match(/^#\/?u\/([^/?#]+)/i);
  if (hashMatch && hashMatch[1]) {
    const raw = decodeURIComponent(hashMatch[1]).trim().replace(/\/+$/, '');
    if (raw) return raw;
  }

  return null;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => ApiClient.getCurrentUser());
  const [activeWeddingId, setActiveWeddingId] = useState<string | null>(null);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | null>(null);

  // Synchronously determine initial public slug so guests never see an unauthenticated LandingPage flash
  const initialSlug = extractSlugFromUrl();
  const [publicSlug, setPublicSlug] = useState<string | null>(initialSlug);
  const [publicWedding, setPublicWedding] = useState<WeddingData | null>(null);
  const [publicLoading, setPublicLoading] = useState<boolean>(Boolean(initialSlug));
  const [publicError, setPublicError] = useState<string | null>(null);

  // Listen to popstate and hashchange events for client-side navigation
  useEffect(() => {
    const checkRoute = () => {
      const slug = extractSlugFromUrl();
      setPublicSlug(slug);
    };

    window.addEventListener('hashchange', checkRoute);
    window.addEventListener('popstate', checkRoute);
    return () => {
      window.removeEventListener('hashchange', checkRoute);
      window.removeEventListener('popstate', checkRoute);
    };
  }, []);

  // Fetch public wedding data whenever publicSlug changes
  useEffect(() => {
    if (!publicSlug) {
      setPublicWedding(null);
      setPublicError(null);
      setPublicLoading(false);
      return;
    }

    setPublicLoading(true);
    setPublicError(null);

    ApiClient.getPublicWedding(publicSlug)
      .then((wed) => {
        setPublicWedding(wed);
      })
      .catch((err) => {
        // Only load sample mockup when explicitly requested via "Lihat Contoh Undangan"
        if (publicSlug === 'contoh-preview-demo') {
          const fallback = createDefaultWedding('demo_user', 'contoh-preview-demo');
          setPublicWedding(fallback);
        } else {
          setPublicError(err.message || 'Undangan tidak ditemukan atau belum dipublikasikan.');
        }
      })
      .finally(() => setPublicLoading(false));
  }, [publicSlug]);

  const handleLogout = () => {
    ApiClient.clearAuth();
    setCurrentUser(null);
    setActiveWeddingId(null);
  };

  const handleViewPublicSlug = (slug: string) => {
    const cleanSlug = slug.trim().replace(/^\/+|\/+$/g, '');
    window.history.pushState(null, '', `/u/${cleanSlug}`);
    setPublicSlug(cleanSlug);
  };

  const handleExitPublic = () => {
    window.history.pushState(null, '', '/');
    window.location.hash = '';
    setPublicSlug(null);
    setPublicWedding(null);
    setPublicError(null);
  };

  const handleViewDemoSample = () => {
    handleViewPublicSlug('contoh-preview-demo');
  };

  // -------------------------------------------------------------
  // 1. PUBLIC INVITATION VIEW
  // -------------------------------------------------------------
  if (publicSlug) {
    if (publicLoading) {
      return (
        <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-4 text-center">
          <Heart size={32} className="text-amber-700 animate-pulse mb-3" />
          <p className="text-xs text-neutral-600">Membuka undangan pernikahan...</p>
        </div>
      );
    }

    if (publicError || !publicWedding) {
      const isDraft =
        publicError?.toLowerCase().includes('draf') ||
        publicError?.toLowerCase().includes('belum dipublikasikan');

      return (
        <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full p-8 rounded-2xl bg-white border border-stone-200 shadow-xl space-y-4">
            <div
              className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center ${
                isDraft ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
              }`}
            >
              <Heart size={24} />
            </div>
            <h2 className="text-xl font-bold font-serif text-neutral-900">
              {isDraft ? 'Undangan Belum Dipublikasikan' : 'Undangan Tidak Ditemukan'}
            </h2>
            <p className="text-xs text-neutral-600 leading-relaxed">
              {publicError ||
                (isDraft
                  ? 'Undangan pernikahan ini sedang disiapkan oleh pemiliknya (status draf privat) dan belum dipublikasikan untuk umum.'
                  : 'Tautan undangan tidak valid atau status undangan sudah tidak aktif.')}
            </p>
            <button
              onClick={handleExitPublic}
              className="px-5 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors inline-flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Kembali ke Beranda</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="relative">
        <PublicInvitation wedding={publicWedding} isEditorPreview={false} />
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. AUTHENTICATED: WEDDING EDITOR VIEW
  // -------------------------------------------------------------
  if (currentUser && activeWeddingId) {
    return (
      <WeddingEditor
        weddingId={activeWeddingId}
        onBack={() => setActiveWeddingId(null)}
      />
    );
  }

  // -------------------------------------------------------------
  // 3. AUTHENTICATED: USER DASHBOARD
  // -------------------------------------------------------------
  if (currentUser) {
    return (
      <Dashboard
        user={currentUser}
        onSelectWedding={(id) => setActiveWeddingId(id)}
        onLogout={handleLogout}
        onViewPublic={handleViewPublicSlug}
      />
    );
  }

  // -------------------------------------------------------------
  // 4. UNAUTHENTICATED: LANDING PAGE
  // -------------------------------------------------------------
  return (
    <>
      <LandingPage
        onGetStarted={() => setAuthModalMode('register')}
        onLogin={() => setAuthModalMode('login')}
        onViewDemo={handleViewDemoSample}
      />

      {/* Auth Modal */}
      {authModalMode && (
        <AuthModal
          initialMode={authModalMode}
          onClose={() => setAuthModalMode(null)}
          onSuccess={(user) => {
            setCurrentUser(user);
            setAuthModalMode(null);
          }}
        />
      )}
    </>
  );
}
