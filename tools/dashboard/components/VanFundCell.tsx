import React from 'react';
import { VanFundData } from '../services/piService';

interface VanFundProps {
  data: VanFundData;
}

export function VanFundCell({ data }: VanFundProps) {
  const percent = Math.min((data.current / data.target) * 100, 100);
  const circumference = 2 * Math.PI * 44;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className="premium-card p-4 group h-full">
      <div className="glow-orb bg-amber-500 -bottom-10 -right-10"></div>

      <div className="flex justify-between items-start mb-4 relative z-10">
        <div>
          <span className="status-badge text-amber-400">Fund</span>
          <h3 className="text-lg font-semibold mt-1 text-white">Van Quest</h3>
        </div>
        <div className="text-xl filter drop-shadow-[0_0_8px_rgba(245,158,11,0.6)] group-hover:rotate-12 transition-transform">🚐</div>
      </div>

      <div className="flex items-center justify-center py-1 relative z-10">
        <div className="relative">
          <svg className="w-24 h-24 transform -rotate-90">
            <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/5" />
            <circle
              cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="text-amber-500 transition-all duration-1000 group-hover:stroke-amber-400"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold font-mono text-white">
              {Math.floor(percent)}<span className="text-[10px] opacity-50">%</span>
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 text-center relative z-10">
        <p className="text-white/40 text-[9px] font-mono tracking-tighter uppercase whitespace-nowrap">
          ${data.current.toLocaleString()} / ${(data.target / 1000)}K
        </p>
      </div>
    </div>
  );
}
