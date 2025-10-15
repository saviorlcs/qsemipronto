import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Music, X } from 'lucide-react';

const MUSIC_PRESETS = [
  {
    id: 'lofi',
    name: 'Lofi Hip Hop',
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk'
  },
  {
    id: 'piano',
    name: 'Piano Relaxante',
    url: 'https://www.youtube.com/watch?v=9A6vm03JeyQ'
  },
  {
    id: 'jazz',
    name: 'Jazz Suave',
    url: 'https://www.youtube.com/watch?v=Dx5qFachd3A'
  },
  {
    id: 'study',
    name: 'Study Music',
    url: 'https://www.youtube.com/watch?v=5qap5aO4i9A'
  },
  {
    id: 'nature',
    name: 'Ambient Nature',
    url: 'https://www.youtube.com/watch?v=eKFTSSKCzWA'
  }
];

export default function MusicPlayer({ isOpen, onClose }) {
  const [customUrl, setCustomUrl] = useState('');

  const extractYoutubeId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const playMusic = (url) => {
    const videoId = extractYoutubeId(url);
    if (videoId) {
      window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
    }
  };

  const handlePresetClick = (preset) => {
    playMusic(preset.url);
  };

  const handleCustomPlay = () => {
    if (customUrl) {
      playMusic(customUrl);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Music className="w-5 h-5 text-purple-400" />
              <DialogTitle className="text-xl">Player de Música</DialogTitle>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          <DialogDescription className="text-gray-400 mt-2">
            Escolha uma playlist para estudar
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div>
            <p className="text-sm text-gray-400 mb-3">Escolha um preset:</p>
            <div className="space-y-2">
              {MUSIC_PRESETS.map(preset => (
                <Button
                  key={preset.id}
                  onClick={() => handlePresetClick(preset)}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white justify-center py-6 text-base"
                  data-testid={`music-preset-${preset.id}`}
                >
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-600 pt-4">
            <p className="text-sm text-gray-400 mb-3">Ou cole URL do YouTube:</p>
            <div className="flex gap-2">
              <Input
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://youtube.com/..."
                className="bg-slate-700 border-slate-600 text-white flex-1"
                data-testid="youtube-url-input"
              />
              <Button
                onClick={handleCustomPlay}
                className="bg-purple-600 hover:bg-purple-500 px-6"
                disabled={!customUrl}
                data-testid="play-custom-button"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
