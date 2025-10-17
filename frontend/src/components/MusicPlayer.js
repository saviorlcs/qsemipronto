import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Input } from "./ui/input";
import { Music, Pause, Play, Minus, X } from "lucide-react";

/** Presets (vídeo ou playlist) */
const MUSIC_PRESETS = [
  { id: "jfKfPfyJRdk", name: "Lofi Hip Hop", type: "video" },
  { id: "9A6vm03JeyQ", name: "Piano Relaxante", type: "video" },
  { id: "Dx5qFachd3A", name: "Jazz Suave", type: "video" },
  { id: "5qap5aO4i9A", name: "Study Music", type: "video" },
  { id: "PLzCxunOM5WFI4SgkC3Jq0rYbHnUqH1JwN", name: "Ambient Nature (playlist)", type: "playlist" },
];

/* -------- helpers -------- */
function parseYouTube(urlOrId) {
  // playlist?
  try {
    const u = new URL(urlOrId);
    const list = u.searchParams.get("list");
    if (list) return { type: "playlist", id: list };
    const v = u.searchParams.get("v");
    if (v && v.length === 11) return { type: "video", id: v };
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id && id.length === 11) return { type: "video", id };
    }
  } catch {
    // se não é URL, pode ser ID simples de vídeo
    if (urlOrId && urlOrId.length === 11) return { type: "video", id: urlOrId };
  }
  return null;
}

function makeEmbedSrc(sel) {
  if (!sel) return "";
  const common = "autoplay=1&mute=0&modestbranding=1&rel=0&playsinline=1&enablejsapi=1";
  return sel.type === "playlist"
    ? `https://www.youtube.com/embed/videoseries?list=${sel.id}&${common}`
    : `https://www.youtube.com/embed/${sel.id}?${common}`;
}

export default function MusicPlayer({ isOpen, onClose }) {
  const [customUrl, setCustomUrl] = useState("");
  const [source, setSource] = useState(null); // {type,id}
  const [title, setTitle] = useState("");     // nome que mostra no mini-player
  const [minimized, setMinimized] = useState(false);
  const [playing, setPlaying] = useState(false);
  const iframeRef = useRef(null);

  const postYT = (func) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*");
  };

  const handlePreset = (p) => {
    setSource({ type: p.type, id: p.id });
    setTitle(p.name);
    setPlaying(true);
    // fecha o modal para o usuário voltar a usar o site
    onClose?.();
  };

  const handleCustom = () => {
    const parsed = parseYouTube(customUrl.trim());
    if (!parsed) return;
    setSource(parsed);
    setTitle("YouTube");
    setPlaying(true);
    onClose?.();
  };

  const togglePlay = () => {
    if (!source) return;
    if (playing) {
      postYT("pauseVideo");
      setPlaying(false);
    } else {
      postYT("playVideo");
      setPlaying(true);
    }
  };

  const stopAll = () => {
    // parar e remover a fonte
    setPlaying(false);
    setSource(null);
  };

  return (
    <>
      {/* Modal: somente seleção da música */}
      <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose?.() : null)}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Music className="w-5 h-5 text-purple-400" />
              <DialogTitle className="text-xl">Player de Música</DialogTitle>
            </div>
            <DialogDescription className="text-gray-400 mt-2">
              Escolha uma playlist para estudar — a música toca aqui no site, mesmo com o modal fechado.
            </DialogDescription>
          </DialogHeader>

          {/* Presets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {MUSIC_PRESETS.map((p) => (
              <Button
                key={`${p.type}:${p.id}`}
                onClick={() => handlePreset(p)}
                className="bg-slate-700 hover:bg-slate-600 text-white justify-center py-6"
                data-testid={`music-preset-${p.id}`}
              >
                {p.name}
              </Button>
            ))}
          </div>

          {/* URL personalizada */}
          <div className="border-t border-slate-600 pt-4 mt-4">
            <p className="text-sm text-gray-400 mb-3">Ou cole uma URL/ID do YouTube:</p>
            <div className="flex gap-2">
              <Input
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=...  ou  playlist?list=..."
                className="bg-slate-700 border-slate-600 text-white flex-1"
                data-testid="youtube-url-input"
              />
              <Button
                onClick={handleCustom}
                className="bg-purple-600 hover:bg-purple-500 px-6"
                disabled={!customUrl.trim()}
                data-testid="play-custom-button"
              >
                Tocar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mini-player fixo (sempre montado) */}
      {source && (
        <div className="fixed right-6 bottom-24 z-40 w-[320px]">
          {/* barra de controle */}
          <div className="rounded-xl bg-slate-900/90 border border-slate-700 shadow-lg backdrop-blur p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-300 truncate pr-2">
                🎵 {title || "Reprodução"}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-gray-300 hover:text-white"
                  onClick={togglePlay}
                  title={playing ? "Pausar" : "Reproduzir"}
                >
                  {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-gray-300 hover:text-white"
                  onClick={() => setMinimized((m) => !m)}
                  title={minimized ? "Expandir" : "Minimizar"}
                >
                  <Minus className="w-5 h-5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-red-400 hover:text-red-300"
                  onClick={stopAll}
                  title="Parar"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* iframe: fica sempre montado; quando minimizado, esconde visualmente mas continua tocando */}
            <div className={minimized ? "h-0 overflow-hidden" : "mt-2 aspect-video rounded-md overflow-hidden border border-slate-700"}>
              <iframe
                ref={iframeRef}
                key={`${source.type}:${source.id}`}
                src={makeEmbedSrc(source)}
                title="Player de música"
                allow="autoplay; encrypted-media; picture-in-picture"
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
