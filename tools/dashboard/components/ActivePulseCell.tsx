import React, { useMemo } from 'react';
import { GithubActivity } from '../services/piService';

const GLASS = 'bg-white/5 backdrop-blur-xl border border-white/10';
const ACCENT = {
  emerald: 'from-emerald-500/20 to-emerald-600/5',
  blue: 'from-sky-500/20 to-sky-600/5',
  red: 'from-rose-500/20 to-rose-600/5',
  purple: 'from-violet-500/20 to-violet-600/5',
  amber: 'from-amber-500/20 to-amber-600/5',
};

interface ActivePulseProps {
  activity: GithubActivity;
}

export default function ActivePulseCell({ activity }: ActivePulseProps) {
  // Generate last 7 weeks of data
  const weeks = useMemo(() => {
    const result: number[][] = [];
    const today = new Date();
    for (let w = 6; w >= 0; w--) {
      const week: number[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() - (w * 7 + (6 - d)));
        const key = date.toISOString().split('T')[0];
        week.push(activity.dailyHistory[key] || 0);
      }
      result.push(week);
    }
    return result;
  }, [activity.dailyHistory]);

  const getColor = (count: number) => {
    if (count === 0) return 'bg-white/5';
    if (count <= 2) return 'bg-emerald-900/60';
    if (count <= 4) return 'bg-emerald-700/70';
    if (count <= 6) return 'bg-emerald-500/80';
    return 'bg-emerald-400';
  };

  return (
    <div className={`${GLASS} rounded-2xl p-5 bg-gradient-to-br ${ACCENT.blue}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50">Active Pulse</h3>
        <span className="text-sky-400 text-sm font-bold">{activity.totalContributions}</span>
      </div>

      <div className="flex gap-1 justify-center">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((count, di) => (
              <div
                key={di}
                className={`w-3 h-3 rounded-sm ${getColor(count)} transition-colors`}
                title={`${count} contributions`}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 mt-3 text-[10px] text-white/30">
        <span>Less</span>
        {[0, 2, 4, 6, 8].map(n => (
          <div key={n} className={`w-2.5 h-2.5 rounded-sm ${getColor(n)}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
