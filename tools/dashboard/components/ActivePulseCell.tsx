import React, { useMemo } from 'react';
import { GithubActivity } from '../services/piService';

interface ActivePulseProps {
  activity: GithubActivity;
}

export function ActivePulseCell({ activity }: ActivePulseProps) {
  // Generate last 7 weeks of data
  const weeks = useMemo(() => {
    const result: number[][] = [];
    const today = new Date();
    if (!activity || !activity.dailyHistory) return [];

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
  }, [activity]);

  const getColor = (count: number) => {
    if (count === 0) return 'bg-white/5';
    if (count <= 2) return 'bg-sky-900/60';
    if (count <= 4) return 'bg-sky-700/70';
    if (count <= 6) return 'bg-sky-500/80';
    return 'bg-sky-400';
  };

  if (!activity) return null;

  return (
    <div className="premium-card p-4 group h-full">
      <div className="glow-orb bg-sky-500 top-1/2 left-1/2"></div>

      <div className="flex justify-between items-start mb-4 relative z-10">
        <div>
          <span className="status-badge text-sky-400">Heartbeat</span>
          <h3 className="text-lg font-semibold mt-1 text-white">Active Pulse</h3>
        </div>
        <div className="text-xl filter drop-shadow-[0_0_8px_rgba(0,242,255,0.6)] animate-pulse">⚡</div>
      </div>

      <div className="flex gap-1 justify-center relative z-10">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((count, di) => (
              <div
                key={di}
                className={`w-2 h-2 rounded-sm ${getColor(count)} transition-all duration-300 hover:scale-125 hover:z-20`}
                title={`${count} contributions`}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-1 text-[9px] text-white/30 uppercase tracking-widest font-mono">
          <span>{activity.totalContributions} Hits</span>
        </div>
        <div className="flex gap-0.5">
          {[0, 8].map(n => (
            <div key={n} className={`w-1.5 h-1.5 rounded-full ${getColor(n)}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
