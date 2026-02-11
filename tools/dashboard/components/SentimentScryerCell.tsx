import React from 'react';
import { MarketWeather } from '../services/piService';

const GLASS = 'bg-white/5 backdrop-blur-xl border border-white/10';
const ACCENT = {
  emerald: 'from-emerald-500/20 to-emerald-600/5',
  blue: 'from-sky-500/20 to-sky-600/5',
  red: 'from-rose-500/20 to-rose-600/5',
  purple: 'from-violet-500/20 to-violet-600/5',
  amber: 'from-amber-500/20 to-amber-600/5',
};

interface SentimentScryerProps {
  weather: MarketWeather;
}

export default function SentimentScryerCell({ weather }: SentimentScryerProps) {
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

  const lastUpdated = new Date(weather.lastUpdated);
  const timeAgo = Math.floor((Date.now() - weather.lastUpdated) / 60000);

  return (
    <div className={`${GLASS} rounded-2xl p-5 bg-gradient-to-br ${ACCENT.amber}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50">Sentiment Scryer</h3>
        <span className="text-[10px] text-white/30">{timeAgo < 60 ? `${timeAgo}m ago` : 'Stale'}</span>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{trendEmoji[weather.trend] || '🔮'}</span>
        <span className={`text-lg font-semibold uppercase tracking-wide ${trendColor[weather.trend]}`}>
          {weather.trend}
        </span>
      </div>

      <p className="text-sm text-white/60 leading-relaxed">{weather.vibe}</p>
    </div>
  );
}
