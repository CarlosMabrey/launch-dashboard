import React, { useEffect } from 'react';
import { AppItem } from '../types';

const GLASS = 'bg-white/5 backdrop-blur-xl border border-white/10';

interface ContextMenuProps {
  x: number;
  y: number;
  app: AppItem;
  onClose: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAntigravity: () => void;
}

export default function ContextMenu({ x, y, app, onClose, onToggle, onEdit, onDelete, onAntigravity }: ContextMenuProps) {
  useEffect(() => {
    const handleClick = () => onClose();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [onClose]);

  return (
    <div
      className={`${GLASS} fixed z-[100] rounded-xl py-2 min-w-[180px] shadow-2xl`}
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-4 py-2 border-b border-white/5 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">{app.name}</span>
      </div>

      <button onClick={onToggle} className="w-full px-4 py-2.5 text-left text-sm text-white/80 hover:bg-white/10 flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full ${app.isOnline ? 'bg-rose-400' : 'bg-emerald-400'}`} />
        {app.isOnline ? 'Stop Service' : 'Start Service'}
      </button>

      {app.directory && (
        <button onClick={onAntigravity} className="w-full px-4 py-2.5 text-left text-sm text-white/80 hover:bg-white/10 flex items-center gap-3">
          <span className="text-white/40">🌌</span>
          Open in Antigravity
        </button>
      )}

      <button onClick={onEdit} className="w-full px-4 py-2.5 text-left text-sm text-white/80 hover:bg-white/10 flex items-center gap-3">
        <span className="text-white/40">✏️</span>
        Edit Configuration
      </button>

      <div className="border-t border-white/5 mt-1 pt-1">
        <button onClick={onDelete} className="w-full px-4 py-2.5 text-left text-sm text-rose-400/80 hover:bg-rose-500/10 flex items-center gap-3">
          <span>🗑️</span>
          Delete App
        </button>
      </div>
    </div>
  );
}
