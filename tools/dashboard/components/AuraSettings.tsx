import React, { useEffect, useMemo, useState } from 'react';

type AuraScheme = {
  id: string;
  name: string;
  colors: [string, string, string, string, string, string];
  updatedAt: number;
};

const STORAGE_KEY = 'launch_aura_schemes_v1';
const STORAGE_ACTIVE = 'launch_aura_active_scheme_v1';
const STORAGE_BG_MODE = 'launch_bg_mode_v1'; // 'css' | 'liquid'

const DEFAULT_SCHEMES: AuraScheme[] = [
  {
    id: 'scheme-1',
    name: 'Scheme 1 — Obsidian',
    colors: ['#1a0a2e', '#16213e', '#0f3460', '#533483', '#0b1220', '#2a0b3d'],
    updatedAt: Date.now(),
  },
  {
    id: 'scheme-2',
    name: 'Scheme 2 — Aurora',
    colors: ['#0a1a1a', '#102828', '#153838', '#1a4545', '#0b2a3a', '#103b2c'],
    updatedAt: Date.now(),
  },
  {
    id: 'scheme-3',
    name: 'Scheme 3 — Ember',
    colors: ['#1a0505', '#2d0a0a', '#3d1515', '#4a1a1a', '#2a0c15', '#5a1420'],
    updatedAt: Date.now(),
  },
  {
    id: 'scheme-4',
    name: 'Scheme 4 — Cosmic',
    colors: ['#0f0520', '#1a0a35', '#251045', '#301555', '#061a2e', '#0a2b3f'],
    updatedAt: Date.now(),
  },
  {
    id: 'scheme-5',
    name: 'Scheme 5 — Phantom',
    colors: ['#080812', '#0f0f1f', '#18182d', '#22223d', '#0b1020', '#12143a'],
    updatedAt: Date.now(),
  },
];

function applyAuraColors(colors: AuraScheme['colors']) {
  const root = document.documentElement;
  root.style.setProperty('--aura-1', colors[0]);
  root.style.setProperty('--aura-2', colors[1]);
  root.style.setProperty('--aura-3', colors[2]);
  root.style.setProperty('--aura-4', colors[3]);
  root.style.setProperty('--aura-5', colors[4]);
  root.style.setProperty('--aura-6', colors[5]);
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export default function AuraSettings() {
  const [open, setOpen] = useState(false);
  const [schemes, setSchemes] = useState<AuraScheme[]>(() => {
    const stored = safeParse<AuraScheme[]>(localStorage.getItem(STORAGE_KEY));
    return stored && stored.length ? stored : DEFAULT_SCHEMES;
  });

  const [activeId, setActiveId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_ACTIVE) || DEFAULT_SCHEMES[0].id;
  });

  const [bgMode, setBgMode] = useState<'css' | 'liquid'>(() => {
    const stored = localStorage.getItem(STORAGE_BG_MODE);
    return stored === 'liquid' ? 'liquid' : 'css';
  });

  const active = useMemo(() => schemes.find(s => s.id === activeId) || schemes[0], [schemes, activeId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schemes));
  }, [schemes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_ACTIVE, activeId);
    if (active) applyAuraColors(active.colors);
  }, [activeId, active]);

  useEffect(() => {
    localStorage.setItem(STORAGE_BG_MODE, bgMode);
    window.dispatchEvent(new CustomEvent('launch:bgMode', { detail: bgMode }));
  }, [bgMode]);

  const setActiveColor = (idx: number, value: string) => {
    setSchemes(prev => prev.map(s => {
      if (s.id !== activeId) return s;
      const nextColors = [...s.colors] as AuraScheme['colors'];
      nextColors[idx] = value;
      return { ...s, colors: nextColors, updatedAt: Date.now() };
    }));
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  const exportAll = async () => {
    if (!active) return;
    const payload = {
      name: active.name,
      colors: active.colors,
      cssVars: {
        '--aura-1': active.colors[0],
        '--aura-2': active.colors[1],
        '--aura-3': active.colors[2],
        '--aura-4': active.colors[3],
        '--aura-5': active.colors[4],
        '--aura-6': active.colors[5],
      },
    };
    await copy(JSON.stringify(payload, null, 2));
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[200] px-4 py-2 rounded-full bg-black/70 backdrop-blur-xl border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-black/80 transition-all"
        title="Adjust background"
      >
        Aura
      </button>

      {open && (
        <div className="fixed inset-0 z-[300]">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div className="absolute bottom-6 right-6 w-[380px] max-w-[92vw] rounded-3xl bg-[#0c0c0c]/90 border border-white/10 shadow-[0_30px_120px_rgba(0,0,0,0.75)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">Aura Adjuster</div>
              <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white text-xl leading-none" aria-label="Close">×</button>
            </div>

            <div className="px-5 py-4 border-b border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/35">Mode</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setBgMode('css')}
                    className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${bgMode === 'css'
                      ? 'bg-white/10 border-white/20 text-white'
                      : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70 hover:bg-white/10'
                      }`}
                  >
                    Aura
                  </button>
                  <button
                    onClick={() => setBgMode('liquid')}
                    className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${bgMode === 'liquid'
                      ? 'bg-white/10 border-white/20 text-white'
                      : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70 hover:bg-white/10'
                      }`}
                  >
                    Liquid
                  </button>
                </div>
              </div>

              <div>
                <div className="grid grid-cols-5 gap-2">
                  {schemes.slice(0, 5).map((s, i) => (
                    <button
                      key={s.id}
                      onClick={() => setActiveId(s.id)}
                      className={`px-2 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${s.id === activeId
                        ? 'bg-white/10 border-white/20 text-white'
                        : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70 hover:bg-white/10'
                        }`}
                      title={s.name}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <div className="mt-3 text-[10px] text-white/40 truncate" title={active?.name}>{active?.name}</div>
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">
              {active?.colors.map((c, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-14 text-[10px] text-white/40 uppercase tracking-widest">C{idx + 1}</div>
                  <input
                    type="color"
                    value={c}
                    onChange={(e) => setActiveColor(idx, e.target.value)}
                    className="w-10 h-10 rounded-xl bg-transparent border border-white/10 overflow-hidden"
                  />
                  <input
                    value={c}
                    readOnly
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-mono text-white/70"
                  />
                  <button
                    onClick={() => copy(c)}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white/70 hover:bg-white/10"
                  >
                    Copy
                  </button>
                </div>
              ))}

              <div className="pt-3 flex gap-2">
                <button
                  onClick={exportAll}
                  className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 hover:text-white/80 hover:bg-white/10 transition-all"
                  title="Copies JSON export to clipboard"
                >
                  Export All
                </button>
                <button
                  onClick={async () => {
                    if (!active) return;
                    await copy(active.colors.join(', '));
                  }}
                  className="py-3 px-4 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/50 hover:text-white/80 hover:bg-white/10 transition-all"
                  title="Copy as comma-separated list"
                >
                  List
                </button>
              </div>

              <div className="pb-1 text-[9px] text-white/25 leading-relaxed">
                Tip: colors drive <span className="font-mono">--aura-1..--aura-6</span>.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
