
import React, { useState, useEffect, useMemo } from 'react';
import { MusicDemo } from '../types';
import { ArrowLeft, Edit3, Save, Trash2, Share2, Music, CheckCircle, XCircle, Play, Pause, Volume2, CloudUpload, Lock, Globe, ExternalLink } from 'lucide-react';

interface DemoDetailsProps {
  demo: MusicDemo;
  onBack: () => void;
  onUpdate: (demo: MusicDemo) => void;
  onDelete: (id: string) => void;
  isCurrentlyPlaying: boolean;
  isPlaying: boolean;
  onPlayToggle: () => void;
  progress: number;
  onSeek: (percentage: number) => void;
}

// Access environment variables safely. 
const ENV_SC_TOKEN = (process.env as any).SOUNDCLOUD_ACCESS_TOKEN || '';

const DemoDetails: React.FC<DemoDetailsProps> = ({ 
  demo, 
  onBack, 
  onUpdate, 
  onDelete,
  isCurrentlyPlaying,
  isPlaying,
  onPlayToggle,
  progress,
  onSeek
}) => {
  const [isEditingLyrics, setIsEditingLyrics] = useState(false);
  const [lyrics, setLyrics] = useState(demo.lyrics);
  const [isSharing, setIsSharing] = useState(false);
  const [shareStep, setShareStep] = useState<'IDLE' | 'SOUNDCLOUD_CONFIG' | 'POSTING' | 'DONE'>('IDLE');
  
  // SoundCloud Specific State
  const [scToken, setScToken] = useState(() => ENV_SC_TOKEN || localStorage.getItem('sc_access_token') || '');
  const [scPrivacy, setScPrivacy] = useState<'public' | 'private'>('private');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [scTrackUrl, setScTrackUrl] = useState<string | null>(null);

  const isEnvTokenActive = useMemo(() => scToken === ENV_SC_TOKEN && ENV_SC_TOKEN !== '', [scToken]);

  useEffect(() => {
    setLyrics(demo.lyrics);
  }, [demo.id, demo.lyrics]);

  const handleSaveLyrics = () => {
    onUpdate({ ...demo, lyrics });
    setIsEditingLyrics(false);
  };

  const handleCancelLyrics = () => {
    setLyrics(demo.lyrics);
    setIsEditingLyrics(false);
  };

  const base64ToBlob = (base64: string, mime: string) => {
    try {
      const parts = base64.split(',');
      const byteString = atob(parts.length > 1 ? parts[1] : parts[0]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      return new Blob([ab], { type: mime });
    } catch (e) {
      console.error("Base64 to Blob conversion failed", e);
      return null;
    }
  };

  const performSoundCloudUpload = async () => {
    if (!scToken) {
      setUploadError("Access token required for SoundCloud Uplink.");
      setShareStep('IDLE');
      return;
    }

    setUploadError(null);
    setShareStep('POSTING');
    setUploadProgress(0);

    try {
      // Persist user token if it's not from the environment
      if (!isEnvTokenActive) {
        localStorage.setItem('sc_access_token', scToken);
      }
      
      const formData = new FormData();
      formData.append('track[title]', demo.name);
      formData.append('track[sharing]', scPrivacy);
      formData.append('track[description]', (demo.description || '') + "\n\nUploaded via Phonic Spectral Vault.");
      formData.append('track[tag_list]', (demo.tags || []).join(' '));
      
      // Handle local base64 or remote URL
      let audioBlob: Blob | null = null;
      if (demo.mp3Url.startsWith('data:')) {
        const mime = demo.mp3Url.match(/data:([^;]+);/)?.[1] || 'audio/mpeg';
        audioBlob = base64ToBlob(demo.mp3Url, mime);
      } else {
        const response = await fetch(demo.mp3Url);
        audioBlob = await response.blob();
      }

      if (!audioBlob) {
        throw new Error("Unable to retrieve audio binary for upload.");
      }
      
      formData.append('track[asset_data]', audioBlob, `${demo.name.toLowerCase()}.mp3`);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://api.soundcloud.com/tracks', true);
      xhr.setRequestHeader('Authorization', `OAuth ${scToken}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(Math.round(percentComplete));
        }
      };

      xhr.onload = () => {
        if (xhr.status === 201 || xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          setScTrackUrl(response.permalink_url);
          setShareStep('DONE');
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            setUploadError(`Uplink Failed: ${err.errors?.[0]?.error_message || xhr.statusText}`);
          } catch {
            setUploadError(`Uplink Failed: ${xhr.statusText} (${xhr.status})`);
          }
          setShareStep('SOUNDCLOUD_CONFIG');
        }
      };

      xhr.onerror = () => {
        setUploadError("Network connectivity interrupted during uplink.");
        setShareStep('SOUNDCLOUD_CONFIG');
      };

      xhr.send(formData);

    } catch (err: any) {
      setUploadError(err.message || "Internal Error: Failed to process audio buffer.");
      setShareStep('SOUNDCLOUD_CONFIG');
    }
  };

  const handleSeek = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newProgress = (x / rect.width) * 100;
    onSeek(newProgress);
  };

  const handleShareTrigger = () => {
    setIsSharing(true);
    if (scToken) {
      setShareStep('SOUNDCLOUD_CONFIG');
    } else {
      setShareStep('IDLE');
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <button 
          onClick={onBack}
          className="group flex items-center gap-2 text-white/40 hover:text-white transition-colors font-mono text-xs"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          BACK_TO_VAULT
        </button>
        
        <div className={`glass-card flex items-center gap-6 px-6 py-3 border transition-all duration-500 max-w-sm w-full ${isCurrentlyPlaying ? 'border-cyan-400/30 bg-cyan-400/5' : 'border-white/10 bg-white/5'}`}>
          <button 
            onClick={onPlayToggle}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black hover:bg-cyan-400 transition-all shrink-0 active:scale-90"
          >
            {isCurrentlyPlaying && isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
          </button>
          <div className="flex-1 space-y-2">
            <div className="flex justify-between font-mono text-[9px] uppercase tracking-widest">
              <span className={isCurrentlyPlaying ? 'text-cyan-400' : 'opacity-40'}>
                {isCurrentlyPlaying ? (isPlaying ? 'Streaming_Source' : 'Paused') : 'Idle_System'}
              </span>
              {isCurrentlyPlaying && isPlaying && <Volume2 size={10} className="text-cyan-400 animate-pulse" />}
            </div>
            <div 
              className="relative h-1 bg-white/10 cursor-pointer overflow-hidden rounded-full group/seek"
              onClick={handleSeek}
            >
              <div 
                className="absolute top-0 left-0 h-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.6)] transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
        <div className="lg:col-span-5 space-y-10">
          <div className="relative glass-card p-2 group overflow-hidden shadow-2xl">
            <img 
              src={demo.coverUrl} 
              alt={demo.name} 
              className={`w-full aspect-square object-cover transition-all duration-[4s] group-hover:scale-105 ${isCurrentlyPlaying && isPlaying ? 'grayscale-0 saturate-125' : 'grayscale'}`}
            />
            <div className="absolute top-0 right-0 p-4">
              <div className="font-mono text-[10px] bg-black/80 backdrop-blur-md px-3 py-1 border border-white/20 text-white/80">{demo.hash}</div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex gap-4">
              <button 
                onClick={handleShareTrigger}
                className="flex-1 flex items-center justify-center gap-3 py-4 border border-white/20 hover:border-orange-500 hover:text-orange-500 transition-all font-bold text-xs tracking-widest uppercase bg-white/5"
              >
                <Share2 size={16} />
                UP_LINK
              </button>
              <button 
                onClick={() => onDelete(demo.id)}
                className="flex-1 flex items-center justify-center gap-3 py-4 border border-white/20 hover:border-red-500 hover:text-red-500 transition-all font-bold text-xs tracking-widest uppercase bg-white/5"
              >
                <Trash2 size={16} />
                PURGE_RECORD
              </button>
            </div>
            <div className="flex flex-wrap gap-3 pt-4 border-t border-white/5">
              {demo.tags.map(tag => (
                <span key={tag} className="font-mono text-[10px] uppercase tracking-[0.2em] px-3 py-1.5 bg-white/5 border border-white/10 text-white/60">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-12">
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-5xl font-black tracking-tighter uppercase break-words">{demo.name}</h2>
              <div className="flex items-center gap-4 font-mono text-[10px] text-white/40 uppercase tracking-widest">
                <span>Created: {new Date(demo.createdAt).toLocaleDateString()}</span>
                <span>•</span>
                <span>Hash: {demo.hash}</span>
              </div>
            </div>
            <p className="text-lg text-white/70 leading-relaxed font-light italic">
              "{demo.description}"
            </p>
          </div>

          <div className="space-y-6 pt-10 border-t border-white/5">
            <div className="flex justify-between items-center">
              <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-white/40">TRANSCRIPT_DATA</h3>
              <div className="flex gap-2">
                {!isEditingLyrics ? (
                  <button 
                    onClick={() => setIsEditingLyrics(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 transition-colors font-mono text-[10px] uppercase"
                  >
                    <Edit3 size={12} /> Edit
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={handleSaveLyrics}
                      className="flex items-center gap-2 px-3 py-1.5 bg-cyan-400 text-black font-mono text-[10px] uppercase font-bold"
                    >
                      <Save size={12} /> Save
                    </button>
                    <button 
                      onClick={handleCancelLyrics}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 transition-colors font-mono text-[10px] uppercase"
                    >
                      <XCircle size={12} /> Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {isEditingLyrics ? (
              <textarea 
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                className="w-full h-96 bg-black/40 border border-white/10 focus:border-cyan-400 outline-none p-8 font-mono text-sm leading-relaxed text-white/80 resize-none transition-all"
              />
            ) : (
              <div className="glass-card p-8 bg-black/20 border border-white/5 min-h-[400px]">
                <pre className="font-mono text-sm leading-loose text-white/60 whitespace-pre-wrap break-words">
                  {demo.lyrics || 'NO_LYRICAL_DATA_DETECTED'}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Share / SoundCloud Modal */}
      {isSharing && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl" onClick={() => setIsSharing(false)} />
          <div className="relative glass-card max-w-lg w-full p-10 space-y-8 animate-in zoom-in-95 duration-300">
            <header className="space-y-2">
              <div className="flex items-center gap-3 text-orange-500">
                <Music size={24} />
                <h4 className="text-2xl font-black tracking-tighter uppercase">SC_UPLINK_PROTOCOL</h4>
              </div>
              <p className="font-mono text-[10px] text-white/40 uppercase tracking-widest">Spectral bridge to external networks</p>
            </header>

            {shareStep === 'IDLE' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase opacity-40">OAuth Access Token</label>
                  <input 
                    type="password"
                    value={scToken}
                    onChange={(e) => setScToken(e.target.value)}
                    placeholder="Enter SoundCloud API Token..."
                    className="w-full bg-white/5 border border-white/10 focus:border-orange-500 outline-none p-4 font-mono text-xs"
                  />
                  <p className="text-[9px] text-white/30 italic uppercase">Token required for authentication</p>
                </div>
                <button 
                  onClick={() => setShareStep('SOUNDCLOUD_CONFIG')}
                  className="w-full py-4 bg-orange-500 text-white font-bold text-xs uppercase tracking-widest hover:bg-orange-600 transition-colors"
                >
                  INITIALIZE_HANDSHAKE
                </button>
              </div>
            )}

            {shareStep === 'SOUNDCLOUD_CONFIG' && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="font-mono text-[10px] uppercase opacity-40">Visibility Mode</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setScPrivacy('public')}
                      className={`flex flex-col items-center gap-3 p-4 border transition-all ${scPrivacy === 'public' ? 'border-orange-500 bg-orange-500/10' : 'border-white/10 bg-white/5'}`}
                    >
                      <Globe size={20} className={scPrivacy === 'public' ? 'text-orange-500' : 'text-white/40'} />
                      <span className="font-mono text-[10px] uppercase">Public</span>
                    </button>
                    <button 
                      onClick={() => setScPrivacy('private')}
                      className={`flex flex-col items-center gap-3 p-4 border transition-all ${scPrivacy === 'private' ? 'border-orange-500 bg-orange-500/10' : 'border-white/10 bg-white/5'}`}
                    >
                      <Lock size={20} className={scPrivacy === 'private' ? 'text-orange-500' : 'text-white/40'} />
                      <span className="font-mono text-[10px] uppercase">Private</span>
                    </button>
                  </div>
                </div>

                {uploadError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 font-mono text-[10px] uppercase flex items-center gap-3">
                    <XCircle size={14} /> {uploadError}
                  </div>
                )}

                <button 
                  onClick={performSoundCloudUpload}
                  className="w-full py-4 bg-white text-black font-bold text-xs uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all flex items-center justify-center gap-3"
                >
                  <CloudUpload size={18} />
                  BEGIN_TRANSFERENCE
                </button>
              </div>
            )}

            {shareStep === 'POSTING' && (
              <div className="py-12 flex flex-col items-center gap-8">
                <div className="relative w-24 h-24">
                  <div className="absolute inset-0 border-4 border-white/10 rounded-full" />
                  <div 
                    className="absolute inset-0 border-4 border-orange-500 rounded-full transition-all duration-300" 
                    style={{ 
                      clipPath: `inset(${100 - uploadProgress}% 0 0 0)`,
                      borderColor: 'rgb(249, 115, 22)'
                    }} 
                  />
                  <div className="absolute inset-0 flex items-center justify-center font-mono text-xl font-bold">
                    {uploadProgress}%
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h5 className="font-bold text-lg uppercase animate-pulse">Uplink_In_Progress</h5>
                  <p className="font-mono text-[10px] text-white/40 uppercase">Pushing binary streams to cloud servers</p>
                </div>
              </div>
            )}

            {shareStep === 'DONE' && (
              <div className="py-8 flex flex-col items-center gap-8 text-center animate-in fade-in duration-500">
                <div className="w-20 h-20 bg-green-500/20 border border-green-500/40 rounded-full flex items-center justify-center text-green-500 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
                  <CheckCircle size={40} />
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h5 className="font-black text-2xl tracking-tighter uppercase">Transmission_Complete</h5>
                    <p className="font-mono text-[10px] text-white/40 uppercase tracking-[0.2em]">Record materialized successfully</p>
                  </div>
                  {scTrackUrl && (
                    <a 
                      href={scTrackUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-3 px-6 py-3 bg-white text-black font-bold text-[10px] uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all shadow-xl"
                    >
                      <ExternalLink size={14} /> View On SoundCloud
                    </a>
                  )}
                </div>
                <button 
                  onClick={() => setIsSharing(false)}
                  className="text-white/40 hover:text-white transition-colors font-mono text-[9px] uppercase tracking-[0.4em] pt-4"
                >
                  DISCONNECT_BRIDGE
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DemoDetails;
