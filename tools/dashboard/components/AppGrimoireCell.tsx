import React from 'react';
import { AppItem } from '../types';

const GLASS = 'bg-white/5 backdrop-blur-xl border border-white/10';
const GLASS_HOVER = 'hover:bg-white/10 hover:border-white/20';

interface AppGrimoireProps {
  apps: AppItem[];
  onLaunch: (app: AppItem) => void;
  onContextMenu: (app: AppItem, e: React.MouseEvent) => void;
  onCreate?: () => void;
}

interface AppCardProps {
  app: AppItem;
  onLaunch: () => void;
  onContext: (e: React.MouseEvent) => void;
}


function AppCard({ app, onLaunch, onContext }: AppCardProps) {
  const progress = app.todoData?.progressPercent || 0;
  const isImage = app.icon?.startsWith('data:image');

  // Icon effect: vibrant when online (saturate + emerald glow)
  const iconGlowStyle = app.isOnline ? {
    filter: 'saturate(1.4) drop-shadow(0 0 16px rgba(16, 185, 129, 0.55))',
    textShadow: '0 0 12px rgba(16, 185, 129, 0.5)'
  } : {};

  return (
    <div
      onClick={onLaunch}
      onContextMenu={onContext}
      className={`carousel-item premium-card p-0 flex flex-col items-center justify-center group shadow-2xl relative ${app.isOnline ? 'online' : ''}`}
    >
      <div className="magical-glow" />

      {/* The Main Icon - Dominates the square */}
      <div className="w-full h-full flex items-center justify-center p-8 relative z-10">
        <div className="relative w-full h-full flex items-center justify-center transition-transform duration-700 group-hover:scale-110">
          {isImage ? (
            <img src={app.icon} className="artifact-img w-full h-full object-contain" style={iconGlowStyle} alt={app.name} />
          ) : (
            <span className="artifact-img text-7xl select-none" style={iconGlowStyle}>{app.icon}</span>
          )}
        </div>
      </div>

      {/* Floating Info Overlay - Appear on hover or keep minimal */}
      <div className="absolute inset-0 z-20 flex flex-col justify-end p-6 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[48px]">
        <h4 className="text-[15px] font-bold text-white tracking-tight truncate leading-tight mb-0.5">{app.name}</h4>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[8px] text-white/50 uppercase tracking-[0.2em] font-mono font-bold">{app.badge}</span>
          <div className={`w-1.5 h-1.5 rounded-full ${app.isOnline ? 'bg-emerald-400 shadow-[0_0_10px_#10b981]' : 'bg-white/20'}`} />
        </div>

        {app.hasTodo && (
          <div className="space-y-1">
            <div className="h-[3px] w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-400 to-indigo-500 rounded-full transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Static Label (Optional, shown when not hovered for context) */}
      <div className="absolute bottom-4 left-0 right-0 text-center z-10 group-hover:opacity-0 transition-opacity duration-300">
        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest truncate px-4 block">{app.name}</span>
      </div>

      <div className="card-reflection" />
    </div>
  );
}


export default function AppGrimoireCell({ apps, onLaunch, onContextMenu, onCreate }: AppGrimoireProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Optional: Handle horizontal scrolling with mouse wheel
  const handleWheel = (e: React.WheelEvent) => {
    if (containerRef.current) {
      containerRef.current.scrollLeft += e.deltaY;
    }
  };


  return (
    <div className="relative overflow-hidden pt-4">
      <div className="px-6 flex items-center justify-between mb-2">
        <div>
          <h3 className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/30 mb-0.5">App Grimoire</h3>
          <p className="text-lg font-bold text-white italic tracking-tighter">Artifacts</p>
        </div>
        <div className="px-3 py-1 rounded-full bg-white/5 border border-white/5 backdrop-blur-md">
          <span className="text-[9px] font-mono text-white/40 font-bold uppercase tracking-widest">{apps.length} FOUND</span>
        </div>
      </div>

      <div className="carousel-viewport py-8">
        <div
          className="carousel-track scrollbar-none pb-8"
          ref={containerRef}
          onWheel={handleWheel}
        >
          {apps.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              onLaunch={() => onLaunch(app)}
              onContext={(e) => onContextMenu(app, e)}
            />
          ))}


          <div
            className="carousel-item premium-card flex flex-col items-center justify-center group border border-dashed border-white/10 hover:border-white/30 hover:bg-white/[0.02] shadow-2xl"
            onClick={onCreate}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCreate?.(); } }}
          >
            <div className="magical-glow" />
            <div className="w-12 h-12 rounded-full border border-white/5 flex items-center justify-center bg-white/5 group-hover:scale-105 group-hover:bg-white/10 transition-all duration-500 mb-2">
              <span className="text-2xl text-white/10 group-hover:text-white/40 transition-colors">+</span>
            </div>
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/10 group-hover:text-white/40 transition-colors">Manifest</div>
            <div className="card-reflection" />
          </div>

        </div>
      </div>
    </div>
  );
}
