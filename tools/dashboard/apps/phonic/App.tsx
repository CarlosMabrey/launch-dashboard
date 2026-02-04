
import React, { useState, useEffect, useRef } from 'react';
import { MusicDemo } from './types';
import DemoCard from './components/DemoCard';
import DemoDetails from './components/DemoDetails';
import UploadModal from './components/UploadModal';
import { Plus, Loader2 } from 'lucide-react';
import { loadDemosFromDB, saveDemos } from './db';

const STORAGE_KEY = 'phonic_vault_demos_v1';

const INITIAL_DEMOS: MusicDemo[] = [
  {
    id: '1',
    name: 'NEON_DRIFT',
    description: 'High-velocity synthesis with fragmented vocal chains and heavy sidechain compression.',
    tags: ['Techno', 'Experimental', '24-Bit'],
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=800',
    mp3Url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    lyrics: '[V1]\nStatic in the wiring\nPulse against the floor\nNeon lights are firing\nWe don’t need the door\n\n[Chorus]\nDrifting in the grid\nEverything we hid\nBurning bright and low\nWhere did the data go?',
    duration: '03:42',
    hash: '0x921A_B2',
    createdAt: Date.now(),
  },
  {
    id: '2',
    name: 'SILICA_DREAM',
    description: 'Ambient textures recorded through vintage glass resonators. Organic decay and spectral shifting.',
    tags: ['Ambient', 'Modular'],
    coverUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=800',
    mp3Url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    lyrics: '[Instrumental]\nLayer 1: Glass Resonator\nLayer 2: Granular Clouds\nLayer 3: Sub-harmonics',
    duration: '05:12',
    hash: '0x442C_E9',
    createdAt: Date.now() - 86400000,
  }
];

export default function App() {
  const [demos, setDemos] = useState<MusicDemo[]>(INITIAL_DEMOS);
  const [isLoaded, setIsLoaded] = useState(false);

  const [selectedDemo, setSelectedDemo] = useState<MusicDemo | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Singleton Global Audio Engine - initialized once
  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (!audioRef.current) {
    audioRef.current = new Audio();
  }

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);

  // Async Initial Load and Migration
  useEffect(() => {
    async function initializeVault() {
      try {
        let vaultDemos = await loadDemosFromDB();

        // Check for legacy localStorage data to migrate
        if (vaultDemos.length === 0) {
          const legacy = localStorage.getItem(STORAGE_KEY);
          if (legacy) {
            try {
              const parsed = JSON.parse(legacy);
              if (Array.isArray(parsed) && parsed.length > 0) {
                vaultDemos = parsed;
                await saveDemos(vaultDemos);
                // We keep localStorage for one reload as safety, 
                // but effectively we are transitioning.
                console.log("Migrated data from legacy storage to Spectral Vault");
              }
            } catch (e) {
              console.error("Migration failed:", e);
            }
          }
        }

        if (vaultDemos.length > 0) {
          setDemos(vaultDemos);
        }
      } catch (err) {
        console.error("Vault initialization failure:", err);
      } finally {
        setIsLoaded(true);
      }
    }
    initializeVault();
  }, []);

  // Sync to Storage with error handling to prevent "Black Screen" crashes
  useEffect(() => {
    if (!isLoaded) return;

    const syncVault = async () => {
      try {
        await saveDemos(demos);
      } catch (e) {
        console.warn("Vault storage capacity reached or write failed.", e);
      }
    };
    syncVault();
  }, [demos, isLoaded]);

  // Audio Event Listener Setup
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (audio.duration) {
        setAudioProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const onEnded = () => {
      setPlayingId(null);
      setIsPlaying(false);
      setAudioProgress(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  // Playback Control Logic
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!playingId) {
      audio.pause();
      return;
    }

    const currentDemo = demos.find(d => d.id === playingId);
    if (!currentDemo) return;

    // Source change logic
    if (audio.src !== currentDemo.mp3Url) {
      audio.src = currentDemo.mp3Url;
      audio.load();
    }

    if (isPlaying) {
      audio.play().catch(err => {
        console.warn("Playback interrupted:", err);
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [playingId, isPlaying, demos]);

  const handleTogglePlay = (id: string) => {
    if (playingId === id) {
      setIsPlaying(!isPlaying);
    } else {
      setPlayingId(id);
      setIsPlaying(true);
      setAudioProgress(0);
    }
  };

  const handleSeek = (percentage: number) => {
    const audio = audioRef.current;
    if (audio && audio.duration && !isNaN(audio.duration)) {
      audio.currentTime = (percentage / 100) * audio.duration;
      setAudioProgress(percentage);
      if (!isPlaying) setIsPlaying(true);
    }
  };

  const handleAddDemo = (newDemo: MusicDemo) => {
    setDemos(prev => [newDemo, ...prev]);
    setIsUploadOpen(false);
  };

  const handleUpdateDemo = (updatedDemo: MusicDemo) => {
    setDemos(prev => prev.map(d => d.id === updatedDemo.id ? updatedDemo : d));
    if (selectedDemo?.id === updatedDemo.id) {
      setSelectedDemo(updatedDemo);
    }
  };

  const handleDeleteDemo = (id: string) => {
    if (playingId === id) {
      setPlayingId(null);
      setIsPlaying(false);
    }
    setDemos(prev => prev.filter(d => d.id !== id));
    setSelectedDemo(null);
  };

  return (
    <div className="min-h-screen font-sans selection:bg-cyan-500/30">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[10%] right-[-5%] w-[300px] h-[2px] bg-spectral rotate-[-45deg] blur-md opacity-20" />
        <div className="absolute bottom-[20%] left-[-10%] w-[400px] h-[2px] bg-spectral rotate-[30deg] blur-lg opacity-10" />
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-12 md:px-10 md:py-16">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-8">
          <div className="space-y-4">
            <div className="font-mono text-[10px] tracking-[0.8em] text-white/40 uppercase">Audio Protocol // 2025</div>
            <h1 className="text-6xl md:text-8xl font-extrabold leading-[0.85] tracking-tighter bg-gradient-to-b from-white to-white/20 bg-clip-text text-transparent">
              DEMO<br />VAULT
            </h1>
          </div>
          <div className="flex flex-col items-end gap-4 w-full md:w-auto">
            <div className="font-mono text-[11px] text-right text-white/40 leading-relaxed hidden md:block uppercase">
              RECORDS_ENCRYPTED: {demos.length}<br />
              VAULT_MODE: INDEXED_DB<br />
              AUTH: SPECTRAL_V9
            </div>
            <button
              onClick={() => setIsUploadOpen(true)}
              disabled={!isLoaded}
              className="group flex items-center gap-3 px-6 py-3 bg-white text-black font-bold text-sm tracking-tight hover:bg-cyan-400 disabled:opacity-50 transition-all duration-300 shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-cyan-400/30 active:scale-95"
            >
              <Plus size={18} className="group-hover:rotate-90 transition-transform" />
              UPLOAD_DEMO
            </button>
          </div>
        </header>

        {!isLoaded ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
            <Loader2 className="animate-spin text-cyan-400" size={32} />
            <div className="font-mono text-xs text-white/40 animate-pulse">INITIALIZING_SECURE_VAULT...</div>
          </div>
        ) : selectedDemo ? (
          <DemoDetails
            demo={selectedDemo}
            onBack={() => setSelectedDemo(null)}
            onUpdate={handleUpdateDemo}
            onDelete={handleDeleteDemo}
            isCurrentlyPlaying={playingId === selectedDemo.id}
            isPlaying={isPlaying && playingId === selectedDemo.id}
            onPlayToggle={() => handleTogglePlay(selectedDemo.id)}
            progress={playingId === selectedDemo.id ? audioProgress : 0}
            onSeek={handleSeek}
          />
        ) : (
          <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {demos.map((demo, idx) => (
              <DemoCard
                key={demo.id}
                demo={demo}
                onClick={() => setSelectedDemo(demo)}
                index={idx}
                isCurrentlyPlaying={playingId === demo.id}
                isPlaying={isPlaying && playingId === demo.id}
                onPlayToggle={() => handleTogglePlay(demo.id)}
                progress={playingId === demo.id ? audioProgress : 0}
                onSeek={handleSeek}
              />
            ))}
          </main>
        )}
      </div>

      {isUploadOpen && (
        <UploadModal
          onClose={() => setIsUploadOpen(false)}
          onSubmit={handleAddDemo}
        />
      )}
    </div>
  );
}
