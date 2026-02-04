
import React, { useRef } from 'react';
import { MusicDemo } from '../types';
import { Play, Pause, Volume2 } from 'lucide-react';

interface DemoCardProps {
  demo: MusicDemo;
  onClick: () => void;
  index: number;
  isCurrentlyPlaying: boolean;
  isPlaying: boolean;
  onPlayToggle: () => void;
  progress: number;
  onSeek: (percentage: number) => void;
}

const DemoCard: React.FC<DemoCardProps> = ({ 
  demo, 
  onClick, 
  index, 
  isCurrentlyPlaying, 
  isPlaying, 
  onPlayToggle, 
  progress, 
  onSeek 
}) => {
  const cardRef = useRef<HTMLElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = (y - centerY) / 25;
    const rotateY = (x - centerX) / -25;

    cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-5px)`;
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)`;
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPlayToggle();
  };

  const handleSeek = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newProgress = (x / rect.width) * 100;
    onSeek(newProgress);
  };

  return (
    <article 
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className="group relative glass-card p-6 cursor-pointer transition-all duration-500 ease-out will-change-transform"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className="absolute top-0 right-0 w-32 h-[1px] bg-spectral rotate-45 translate-x-12 -translate-y-8 blur-sm opacity-30 pointer-events-none" />
      
      <div className="relative aspect-square overflow-hidden mb-6 bg-neutral-900 group/cover">
        <img 
          src={demo.coverUrl} 
          alt={demo.name}
          className={`w-full h-full object-cover transition-all duration-1000 scale-100 group-hover:scale-110 ${isCurrentlyPlaying && isPlaying ? 'grayscale-0 opacity-100' : 'grayscale group-hover:grayscale-0 opacity-70 group-hover:opacity-100'}`}
        />
        
        {/* Play Overlay */}
        <div className={`absolute inset-0 flex items-end p-4 transition-all duration-500 ${isCurrentlyPlaying ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0'}`}>
          <div className="w-full glass-card p-3 flex items-center gap-4 bg-black/80 backdrop-blur-xl border border-white/20 shadow-2xl">
            <button 
              onClick={togglePlay}
              className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-black hover:bg-cyan-400 transition-colors shrink-0 shadow-lg active:scale-90"
            >
              {isCurrentlyPlaying && isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
            </button>
            <div 
              className="flex-1 flex items-center gap-1 h-8 cursor-pointer group/wave"
              onClick={handleSeek}
            >
              {[...Array(20)].map((_, i) => {
                const barProgress = (i / 20) * 100;
                const isPlayed = progress > barProgress;
                return (
                  <div 
                    key={i} 
                    className={`w-1 rounded-full transition-all duration-500 ${isPlayed ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'bg-white/20'} ${isPlaying && isPlayed ? 'wave-bar' : ''}`}
                    style={{ 
                      height: isPlaying && isPlayed ? undefined : `${30 + Math.sin(i * 0.5) * 40 + 30}%`,
                      animationDelay: `${i * 0.05}s`
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className={`text-xl font-bold tracking-tight transition-colors ${isCurrentlyPlaying && isPlaying ? 'text-cyan-400' : 'text-white group-hover:text-cyan-400'}`}>{demo.name}</h3>
          <p className="font-mono text-[10px] text-white/40 uppercase tracking-wider">ID: {demo.hash}</p>
        </div>
        <div className="flex flex-col items-end">
          <span className="font-mono text-xs text-white/40">{demo.duration}</span>
          {isCurrentlyPlaying && isPlaying && <Volume2 size={12} className="text-cyan-400 animate-pulse mt-1" />}
        </div>
      </div>

      <p className="text-sm text-white/60 line-clamp-2 leading-relaxed mb-6 font-light">
        {demo.description}
      </p>

      <div className="flex flex-wrap gap-2">
        {demo.tags.map(tag => (
          <span key={tag} className="font-mono text-[9px] uppercase tracking-widest border border-white/10 px-2 py-1 text-white/40 group-hover:text-white group-hover:border-white/30 transition-all">
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
};

export default DemoCard;
