import React, { useRef, useState } from 'react';
import { Upload, Check, AlertCircle, Loader2 } from 'lucide-react';
import { ApiClient } from '../../lib/api';

interface ImageUploadInputProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
}

export const ImageUploadInput: React.FC<ImageUploadInputProps> = ({
  label,
  value,
  onChange,
  placeholder = 'URL foto atau unggah langsung...',
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadedSuccess, setUploadedSuccess] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Ukuran file maksimal 5MB.');
      return;
    }

    // Validate type
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validMimes.includes(file.type)) {
      setErrorMsg('Tipe file harus JPG, PNG, atau WebP.');
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);
    setUploadedSuccess(false);

    try {
      const res = await ApiClient.uploadMedia(file);
      onChange(res.url);
      setUploadedSuccess(true);
      setTimeout(() => setUploadedSuccess(false), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengunggah foto.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex items-center justify-between">
        <label className="font-medium text-neutral-700">{label}</label>
        {uploadedSuccess && (
          <span className="text-emerald-600 flex items-center gap-1 text-[11px] font-medium">
            <Check size={12} />
            <span>Foto Terunggah</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-3 py-1.5 border border-neutral-300 rounded-lg bg-white focus:outline-none focus:border-neutral-900"
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="px-3 py-1.5 border border-neutral-300 rounded-lg bg-neutral-50 hover:bg-neutral-100 text-neutral-700 flex items-center gap-1.5 font-medium transition-colors shrink-0 cursor-pointer disabled:opacity-50"
          title="Unggah dari komputer atau HP"
        >
          {isUploading ? (
            <>
              <Loader2 size={13} className="animate-spin text-neutral-500" />
              <span>Unggah...</span>
            </>
          ) : (
            <>
              <Upload size={13} />
              <span>Unggah</span>
            </>
          )}
        </button>
      </div>

      {errorMsg && (
        <div className="text-[11px] text-rose-600 flex items-center gap-1">
          <AlertCircle size={12} />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
