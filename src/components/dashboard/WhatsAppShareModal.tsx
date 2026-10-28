import React, { useState } from 'react';
import { X, Send, Copy, Check, Sparkles, MessageCircle, AlertTriangle, Globe } from 'lucide-react';
import { WeddingData } from '../../types/wedding';

interface WhatsAppShareModalProps {
  wedding: WeddingData;
  onClose: () => void;
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({ wedding, onClose }) => {
  const [guestName, setGuestName] = useState('Bpk. Hendra & Keluarga');
  const [templateType, setTemplateType] = useState<'formal' | 'warm' | 'islami'>('formal');
  const [copied, setCopied] = useState(false);

  const defaultDomain = (
    ((import.meta as any).env?.VITE_PUBLIC_APP_URL as string) ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://weddingstudio.app')
  ).replace(/\/+$/, '');

  const [customDomain, setCustomDomain] = useState(defaultDomain);
  const [showDomainConfig, setShowDomainConfig] = useState(false);

  // Generate public invitation URL using clean canonical path (/u/:slug)
  // Clean paths prevent WhatsApp, Facebook, and mobile in-app browsers from stripping '#' or fragment anchors
  const activeBaseUrl = customDomain.trim() ? customDomain.trim().replace(/\/+$/, '') : defaultDomain;
  const cleanGuestParam = guestName.trim() ? encodeURIComponent(guestName.trim()) : '';
  const invitationUrl = `${activeBaseUrl}/u/${wedding.slug}${cleanGuestParam ? `?to=${cleanGuestParam}` : ''}`;

  const eventDate = wedding.events?.[0]
    ? new Date(wedding.events[0].date).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Sabtu, 12 Desember 2026';

  const getMessageText = () => {
    switch (templateType) {
      case 'islami':
        return `*Assalamu’alaikum Warahmatullahi Wabarakatuh*

Kepada Yth.
*${guestName}*

Tanpa mengurangi rasa hormat, perkenankan kami mengundang Bapak/Ibu/Saudara/i untuk hadir dan memberikan doa restu pada pernikahan kami:

*${wedding.groom.name}*
&
*${wedding.bride.name}*

🗓 Hari/Tanggal: ${eventDate}
📍 Lokasi: ${wedding.events?.[0]?.location_name || 'Gedung Pernikahan'}

Detail informasi acara serta konfirmasi kehadiran (RSVP) dapat dilihat melalui tautan undangan digital kami:
👉 ${invitationUrl}

Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan untuk hadir dan mendoakan kami.

*Wassalamu’alaikum Warahmatullahi Wabarakatuh*
Kami yang berbahagia,
*${wedding.groom.nickname} & ${wedding.bride.nickname}*`;

      case 'warm':
        return `Halo *${guestName}*! ✨

Kabar bahagia! Kami ingin membagikan momen istimewa kami dan mengundangmu untuk hadir merayakan hari pernikahan kami:

💍 *${wedding.groom.nickname} & ${wedding.bride.nickname}*
🗓 ${eventDate}
📍 ${wedding.events?.[0]?.location_name || 'Lokasi Acara'}

Buka undangan digital kami di sini untuk jadwal lengkap, panduan peta, dan RSVP:
👉 ${invitationUrl}

Kehadiran dan doa restumu akan sangat berarti bagi perjalanan baru kami! Sampai jumpa di hari bahagia! 💖`;

      case 'formal':
      default:
        return `Kepada Yth.
*${guestName}*

Tanpa mengurangi rasa hormat, perkenankan kami mengundang Bapak/Ibu/Saudara/i untuk menghadiri acara pernikahan kami:

*${wedding.groom.name}*
&
*${wedding.bride.name}*

Yang Insya Allah akan diselenggarakan pada:
🗓 ${eventDate}
📍 ${wedding.events?.[0]?.location_name || 'Tempat Acara'}

Untuk informasi lengkap mengenai detail rangkaian acara, denah lokasi, serta konfirmasi kehadiran (RSVP), silakan kunjungi tautan berikut:
👉 ${invitationUrl}

Atas kehadiran dan doa restu Bapak/Ibu/Saudara/i, kami ucapkan terima kasih.

Hormat kami,
*${wedding.groom.nickname} & ${wedding.bride.nickname}*`;
    }
  };

  const fullText = getMessageText();

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendWa = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullText)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <MessageCircle size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">Bagikan via WhatsApp</h3>
              <p className="text-xs text-neutral-500">Kirim undangan personal ke tamu dengan 1 klik</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {/* Publication Status Notice */}
          {!wedding.is_published ? (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-[11px]">Status Undangan: DRAF (Belum Dipublikasikan)</p>
                <p className="text-[10px] text-amber-700 leading-relaxed">
                  Tamu tidak akan dapat membuka tautan ini sebelum status diubah ke <strong>Terpublikasi</strong>. Silakan klik tombol <em>"Publikasikan"</em> di editor.
                </p>
              </div>
            </div>
          ) : (
            <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2">
              <Check size={14} className="text-emerald-600 shrink-0" />
              <span className="text-[11px] font-medium">Status Terpublikasi: Tautan dapat dibuka langsung oleh tamu tanpa perlu akun/login.</span>
            </div>
          )}

          {/* Public Link & AI Studio Sandbox Note */}
          <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-800 text-[11px] flex items-center gap-1.5">
                <Globe size={13} className="text-neutral-600" />
                <span>Domain Tautan Publik</span>
              </span>
              <button
                type="button"
                onClick={() => setShowDomainConfig(!showDomainConfig)}
                className="text-[10px] text-neutral-500 hover:text-neutral-800 underline cursor-pointer"
              >
                {showDomainConfig ? 'Tutup Konfigurasi' : 'Ubah Domain'}
              </button>
            </div>
            <div className="text-[10px] font-mono text-neutral-700 truncate bg-white px-2.5 py-1.5 rounded border border-neutral-200 select-all">
              {invitationUrl}
            </div>

            {showDomainConfig && (
              <div className="space-y-1.5 pt-1.5 border-t border-neutral-200">
                <label className="text-[10px] text-neutral-600 block">
                  Domain Publik Kustom (misal: https://undangan-saya.com):
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="https://domain-anda.com"
                    className="flex-1 px-2.5 py-1 text-xs border border-neutral-300 rounded bg-white font-mono focus:outline-none focus:border-neutral-900"
                  />
                  <button
                    type="button"
                    onClick={() => setCustomDomain(defaultDomain)}
                    className="px-2 py-1 text-[10px] text-neutral-600 border border-neutral-300 rounded hover:bg-neutral-100 cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}

            <div className="text-[10px] text-neutral-500 leading-relaxed">
              💡 <em>Catatan:</em> Domain preview lingkungan Google AI Studio (<code>*.run.app</code>) dilindungi perimeter keamanan Google internal (memerlukan akun Google). Ketika dideploy ke domain publik atau production, tamu dapat langsung membuka tautan tanpa akun atau login.
            </div>
          </div>

          <div>
            <label className="block font-medium text-neutral-700 mb-1">
              Nama Tamu / Keluarga yang Dituju:
            </label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Contoh: Bpk. Hendra & Rekan Kantor"
              className="w-full px-3.5 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-700 mb-1.5">Pilihan Gaya Pesan:</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'formal', label: 'Formal / Umum' },
                { id: 'islami', label: 'Islami' },
                { id: 'warm', label: 'Hangat & Santai' },
              ].map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => setTemplateType(tmpl.id as any)}
                  className={`py-2 px-1 text-center rounded-lg border transition-all cursor-pointer ${
                    templateType === tmpl.id
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold'
                      : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  {tmpl.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-medium text-neutral-700 mb-1.5 flex items-center justify-between">
              <span>Pratinjau Pesan WhatsApp:</span>
              <span className="text-[11px] text-neutral-400">Siap kirim</span>
            </label>
            <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl font-mono text-[11px] text-neutral-800 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
              {fullText}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between gap-3">
          <button
            onClick={handleCopy}
            className="px-4 py-2 border border-neutral-300 rounded-xl text-neutral-700 hover:bg-neutral-100 flex items-center gap-1.5 font-medium transition-colors cursor-pointer text-xs"
          >
            {copied ? (
              <>
                <Check size={14} className="text-emerald-600" />
                <span className="text-emerald-600">Teks Tersalin!</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Salin Teks</span>
              </>
            )}
          </button>

          <button
            onClick={handleSendWa}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-2 shadow-sm transition-transform hover:scale-105 active:scale-95 cursor-pointer text-xs"
          >
            <Send size={14} />
            <span>Kirim ke WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
