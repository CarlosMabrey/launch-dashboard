import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppItem } from '../types';

const GLASS = 'bg-white/5 backdrop-blur-xl border border-white/10';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  apps: AppItem[];
  onSelectApp: (app: AppItem) => void;
}

export default function CommandPalette({ isOpen, onClose, apps, onSelectApp }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!query.trim()) return apps.slice(0, 8);
    const q = query.toLowerCase();
    return apps.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.badge?.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [apps, query]);

  const handleSelect = (app: AppItem) => {
    onSelectApp(app);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className={`${GLASS} rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
          <span className="text-white/40">⌘</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search apps, commands..."
            className="flex-1 bg-transparent text-white placeholder-white/30 focus:outline-none text-lg"
          />
          <kbd className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded">ESC</kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-white/30 text-sm">No results found</div>
          ) : (
            filtered.map((app, i) => (
              <button
                key={app.id}
                onClick={() => handleSelect(app)}
                className="w-full flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors text-left"
              >
                <span className="text-2xl">{app.icon || '📱'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{app.name}</div>
                  <div className="text-xs text-white/40 truncate">{app.badge}</div>
                </div>
                <div className="flex items-center gap-2">
                  {app.isOnline && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
                  <kbd className="text-[10px] text-white/20 bg-white/5 px-1.5 py-0.5 rounded">{i + 1}</kbd>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
