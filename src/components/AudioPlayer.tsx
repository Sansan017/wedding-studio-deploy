import React, { useState, useEffect } from 'react';
import { Disc3, VolumeX } from 'lucide-react';
import { romanticSynth } from '../lib/romanticMusic';

interface AudioPlayerProps {
  autoPlay?: boolean;
  songTitle?: string;
  artist?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  autoPlay = false,
  songTitle = 'Canon in D (Romantic Piano)',
  artist = 'Wedding Studio Collection',
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (autoPlay) {
      romanticSynth.play();
      setIsPlaying(true);
    }
    return () => {
      romanticSynth.pause();
    };
  }, [autoPlay]);

  const handleToggle = () => {
    const newState = romanticSynth.toggle();
    setIsPlaying(newState);
    setShowTooltip(true);
    setTimeout(() => setShowTooltip(false), 3000);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
      {/* Track Title Toast */}
      {showTooltip && (
        <div className="bg-neutral-900/90 text-white backdrop-blur-md px-3 py-1.5 rounded-full text-xs shadow-lg animate-fade-in border border-white/10 hidden sm:flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          <span className="font-medium truncate max-w-[150px]">{songTitle}</span>
          <span className="text-neutral-400 text-[10px]">— {artist}</span>
        </div>
      )}

      {/* Vinyl Disc Button */}
      <button
        onClick={handleToggle}
        title={isPlaying ? 'Jeda Musik' : 'Putar Musik'}
        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 border-2 cursor-pointer ${
          isPlaying
            ? 'bg-neutral-900 text-amber-400 border-amber-400/40 rotate-[360deg] shadow-amber-400/20'
            : 'bg-white/90 text-neutral-600 border-neutral-300 hover:text-neutral-900'
        }`}
        style={{
          animation: isPlaying ? 'spin 5s linear infinite' : 'none',
        }}
      >
        {isPlaying ? <Disc3 size={24} /> : <VolumeX size={20} />}
      </button>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
