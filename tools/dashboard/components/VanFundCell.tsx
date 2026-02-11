import React from 'react';
import { VanFundData } from '../services/piService';

const GLASS = 'bg-white/5 backdrop-blur-xl border border-white/10';
const ACCENT = {
  emerald: 'from-emerald-500/20 to-emerald-600/5',
  blue: 'from-sky-500/20 to-sky-600/5',
  red: 'from-rose-500/20 to-rose-600/5',
  purple: 'from-violet-500/20 to-violet-600/5',
  amber: 'from-amber-500/20 to-amber-600/5',
};

interface VanFundProps {
  data: VanFundData;
}

export default function VanFundCell({ data }: VanFundProps) {
  const percent = Math.min((data.current / data.target) * 100, 100);
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className={`${GLASS} rounded-2xl p-5 bg-gradient-to-br ${ACCENT.emerald}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50">Van Fund</h3>
        <span className="text-emerald-400 text-xs font-mono">${data.target.toLocaleString()}</span>
      </div>

      <div className="flex items-center gap-5">
        <div className="relative w-24 h-24">
          <svg className="w-full h-full -rotate-90">
            <circle cx="48" cy="48" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
            <circle
              cx="48" cy="48" r="45" fill="none"
              stroke="url(#vanGradient)" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000"
            />
            <defs>
              <linearGradient id="vanGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-white">{percent.toFixed(1)}%</span>
            <span className="text-[9px] text-white/40 uppercase tracking-wide">Goal</span>
          </div>
        </div>

        <div className="flex-1">
          <div className="text-2xl font-bold text-emerald-400">${data.current.toLocaleString()}</div>
          <div className="text-xs text-white/40 mt-1">
            ${(data.target - data.current).toLocaleString()} remaining
          </div>
          <div className="text-[10px] text-white/30 mt-2">🚐 The Dream Awaits</div>
        </div>
      </div>
    </div>
  );
}
