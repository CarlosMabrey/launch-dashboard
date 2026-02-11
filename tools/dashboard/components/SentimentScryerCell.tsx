import React from 'react';
import { MarketWeather } from '../services/piService';

interface SentimentScryerProps {
  weather: MarketWeather;
}

export function SentimentScryerCell({ weather }: SentimentScryerProps) {
  const trendEmoji: Record<string, string> = {
    bullish: '📈',
    bearish: '📉',
    neutral: '➖',
    chaotic: '🌀'
  };
  const trendColor: Record<string, string> = {
    bullish: 'text-emerald-400',
    bearish: 'text-rose-400',
    neutral: 'text-white/60',
    chaotic: 'text-amber-400'
  };

  const timeAgo = Math.floor((Date.now() - weather.lastUpdated) / 60000);

  return (
    <div className="premium-card p-6 group h-full">
      <div className="glow-orb bg-purple-500 top-0 left-0"></div>

      <div className="flex flex-col md:flex-row gap-6 items-center relative z-10">
        <div className="flex-1">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="status-badge text-purple-400">Atmospheric Link</span>
              <h3 className="text-xl font-semibold mt-2 text-white">Sentiment Scryer</h3>
            </div>
            <div className="text-2xl filter drop-shadow-[0_0_8px_rgba(139,92,246,0.6)] group-hover:scale-110 transition-transform md:hidden">
              {trendEmoji[weather.trend] || '🔮'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/5 group-hover:border-purple-500/30 transition-colors">
            <p className="text-white/40 text-[10px] uppercase tracking-widest mb-1">Current Vibe</p>
            <p className="text-sm font-medium text-purple-200 leading-relaxed capitalize">
              {weather.vibe || 'Celestial Synchrony'}
            </p>
          </div>
        </div>

        <div className="hidden md:flex flex-col items-center justify-center p-6 rounded-2xl bg-white/5 border border-white/5 min-w-[120px]">
          <div className="text-4xl mb-2 filter drop-shadow-[0_0_12px_rgba(139,92,246,0.4)]">
            {trendEmoji[weather.trend] || '🔮'}
          </div>
          <span className="font-mono text-[10px] text-white/40">
            {timeAgo < 60 ? `${timeAgo}M AGO` : 'STALE'}
          </span>
        </div>
      </div>
    </div>
  );
}
