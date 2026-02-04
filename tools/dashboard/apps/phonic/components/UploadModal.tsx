
import React, { useState } from 'react';
import { MusicDemo } from '../types';
import { X, Plus, FileAudio, Image as ImageIcon, Type, Clock, AlignLeft } from 'lucide-react';

interface UploadModalProps {
  onClose: () => void;
  onSubmit: (demo: MusicDemo) => void;
}

const UploadModal: React.FC<UploadModalProps> = ({ onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('03:30');
  const [lyrics, setLyrics] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [coverUrl, setCoverUrl] = useState('');
  const [mp3Url, setMp3Url] = useState('');
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [isDraggingAudio, setIsDraggingAudio] = useState(false);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const processFile = (file: File, type: 'image' | 'audio') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (type === 'image') {
        setCoverUrl(result);
      } else {
        setMp3Url(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    let foundFile = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          processFile(file, 'image');
          foundFile = true;
        }
      }
    }

    if (!foundFile) {
      const text = e.clipboardData.getData('text');
      if (text.match(/\.(jpeg|jpg|gif|png|webp)/i) || text.startsWith('data:image')) {
        setCoverUrl(text);
      } else if (text.match(/\.(mp3|wav|ogg)/i) || text.startsWith('data:audio')) {
        setMp3Url(text);
      }
    }
  };

  const handleDrop = (e: React.DragEvent, type: 'image' | 'audio') => {
    e.preventDefault();
    setIsDraggingCover(false);
    setIsDraggingAudio(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      if (type === 'image' && file.type.startsWith('image/')) {
        processFile(file, 'image');
      } else if (type === 'audio' && file.type.startsWith('audio/')) {
        processFile(file, 'audio');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent, type: 'image' | 'audio') => {
    e.preventDefault();
    if (type === 'image') setIsDraggingCover(true);
    else setIsDraggingAudio(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !coverUrl) return;

    const newDemo: MusicDemo = {
      id: Math.random().toString(36).substr(2, 9),
      name: name.toUpperCase(),
      description,
      tags,
      coverUrl,
      mp3Url: mp3Url || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      lyrics,
      duration: duration || '00:00',
      hash: '0x' + Math.random().toString(16).substr(2, 6).toUpperCase(),
      createdAt: Date.now(),
    };

    onSubmit(newDemo);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl" onClick={onClose} />
      
      <div className="relative glass-card max-w-5xl w-full max-h-[90vh] overflow-y-auto p-8 md:p-16 animate-in zoom-in-95 fade-in duration-500 shadow-2xl border border-white/10">
        <button onClick={onClose} className="absolute top-8 right-8 text-white/40 hover:text-white transition-colors">
          <X size={24} />
        </button>

        <form onSubmit={handleSubmit} onPaste={handlePaste} className="space-y-12">
          <div className="space-y-4">
            <h2 className="text-5xl font-extrabold tracking-tighter">REGISTER_DEMO</h2>
            <p className="font-mono text-xs text-white/40 uppercase tracking-widest">Entry into the spectral vault requires metadata verification</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div className="space-y-10">
              {/* Basic Metadata */}
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-6">
                  <div className="col-span-2 space-y-2">
                    <label className="font-mono text-[10px] uppercase opacity-40 flex items-center gap-2">
                      <Type size={12} /> Record Name
                    </label>
                    <input 
                      autoFocus
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full bg-transparent border-b border-white/20 focus:border-cyan-400 outline-none py-2 text-xl font-bold transition-all uppercase"
                      placeholder="VOID_RUNNER"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] uppercase opacity-40 flex items-center gap-2">
                      <Clock size={12} /> Duration
                    </label>
                    <input 
                      required
                      value={duration}
                      onChange={e => setDuration(e.target.value)}
                      className="w-full bg-transparent border-b border-white/20 focus:border-cyan-400 outline-none py-2 text-xl font-mono transition-all"
                      placeholder="03:45"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase opacity-40">Description</label>
                  <textarea 
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full bg-transparent border-b border-white/20 focus:border-cyan-400 outline-none py-2 text-sm leading-relaxed h-20 resize-none transition-all"
                    placeholder="Describe the spectral characteristics..."
                  />
                </div>
              </div>

              {/* Tags Section */}
              <div className="space-y-4">
                <label className="font-mono text-[10px] uppercase opacity-40">Keywords // Tags</label>
                <div className="flex gap-2">
                  <input 
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    className="flex-1 bg-transparent border-b border-white/20 focus:border-cyan-400 outline-none py-2 text-sm transition-all font-mono"
                    placeholder="Add tag..."
                  />
                  <button type="button" onClick={handleAddTag} className="p-2 border border-white/20 hover:border-white transition-all">
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[30px]">
                  {tags.map(t => (
                    <span key={t} className="font-mono text-[9px] bg-white/5 border border-white/10 px-2 py-1 flex items-center gap-2 group/tag uppercase">
                      {t}
                      <X size={10} className="cursor-pointer opacity-40 group-hover/tag:opacity-100" onClick={() => setTags(tags.filter(x => x !== t))} />
                    </span>
                  ))}
                </div>
              </div>

              {/* Audio Upload */}
              <div 
                className={`p-8 border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-4 text-center ${isDraggingAudio ? 'border-cyan-400 bg-cyan-400/10' : 'border-white/10 hover:border-white/30'}`}
                onDragOver={e => handleDragOver(e, 'audio')}
                onDragLeave={() => setIsDraggingAudio(false)}
                onDrop={e => handleDrop(e, 'audio')}
              >
                <div className={`p-4 rounded-full ${mp3Url ? 'bg-cyan-400 text-black' : 'bg-white/5 text-white/20'}`}>
                  <FileAudio size={32} />
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider">{mp3Url ? 'AUDIO_BUFFER_READY' : 'DROP_MP3_HERE'}</p>
                  <p className="text-[9px] opacity-40 mt-1 uppercase">Or paste source URL below</p>
                </div>
                <input 
                  value={mp3Url}
                  onChange={e => setMp3Url(e.target.value)}
                  className="w-full bg-transparent border-b border-white/10 focus:border-cyan-400 outline-none py-2 text-[10px] font-mono transition-all text-center"
                  placeholder="MP3_SOURCE_URL"
                />
              </div>
            </div>

            <div className="space-y-10">
              {/* Cover Art Upload */}
              <div className="space-y-4">
                <label className="font-mono text-[10px] uppercase opacity-40">Visual Manifestation</label>
                <div 
                  className={`relative aspect-square glass-card flex items-center justify-center overflow-hidden bg-neutral-900 border-2 transition-all duration-500 ${isDraggingCover ? 'border-cyan-400 scale-[1.02]' : 'border-white/5 hover:border-white/20'}`}
                  onDragOver={e => handleDragOver(e, 'image')}
                  onDragLeave={() => setIsDraggingCover(false)}
                  onDrop={e => handleDrop(e, 'image')}
                >
                  {coverUrl ? (
                    <div className="relative w-full h-full group">
                      <img src={coverUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Preview" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button 
                          type="button" 
                          onClick={() => setCoverUrl('')}
                          className="p-3 bg-white text-black rounded-full hover:bg-red-500 hover:text-white transition-colors"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-4 p-8">
                      <div className="w-16 h-16 mx-auto border border-white/10 flex items-center justify-center rounded-full opacity-40">
                        <ImageIcon size={28} />
                      </div>
                      <div className="space-y-2">
                        <p className="font-mono text-[10px] uppercase tracking-widest leading-relaxed">
                          DROP_COVER_ART_HERE
                        </p>
                        <p className="text-[9px] opacity-40 uppercase tracking-tight">OR PASTE IMAGE / URL</p>
                      </div>
                    </div>
                  )}
                </div>
                <input 
                  value={coverUrl}
                  onChange={e => setCoverUrl(e.target.value)}
                  className="w-full bg-transparent border-b border-white/10 focus:border-cyan-400 outline-none py-2 text-[10px] font-mono transition-all"
                  placeholder="COVER_ASSET_URL"
                />
              </div>

              {/* Lyrics Paste Area */}
              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase opacity-40 flex items-center gap-2">
                  <AlignLeft size={12} /> Source Lyrics // Transcripts
                </label>
                <textarea 
                  value={lyrics}
                  onChange={e => setLyrics(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-cyan-400 outline-none p-4 text-xs font-mono leading-relaxed h-44 resize-none transition-all placeholder:opacity-20"
                  placeholder="Paste lyrical data or transcripts here..."
                />
              </div>
            </div>
          </div>

          <button 
            type="submit"
            disabled={!name || !coverUrl}
            className={`w-full py-6 font-extrabold text-sm tracking-widest uppercase transition-all duration-500 relative group overflow-hidden ${(!name || !coverUrl) ? 'bg-white/10 text-white/20 cursor-not-allowed' : 'bg-white text-black hover:bg-cyan-400 shadow-[0_0_30px_rgba(255,255,255,0.05)] hover:shadow-cyan-400/20'}`}
          >
            <span className="relative z-10">INITIALIZE_VAULT_ENTRY</span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] pointer-events-none" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default UploadModal;
