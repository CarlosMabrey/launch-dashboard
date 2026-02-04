
import React, { useEffect, useState } from 'react';
import { getGithubActivity, GithubActivity } from '../services/piService';

const GitHubHeatmapCell: React.FC = () => {
    const [activity, setActivity] = useState<GithubActivity | null>(null);

    useEffect(() => {
        const fetchActivity = async () => {
            const data = await getGithubActivity();
            setActivity(data);
        };
        fetchActivity();
        const interval = setInterval(fetchActivity, 10000);
        return () => clearInterval(interval);
    }, []);

    if (!activity) return null;

    // Generate last 14 days of dots
    const dots = [];
    for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        const count = activity.dailyHistory[key] || 0;
        
        // Map count to color intensity
        let opacity = 'bg-white/5';
        if (count > 0) opacity = 'bg-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.3)]';
        if (count > 5) opacity = 'bg-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.5)]';
        if (count > 10) opacity = 'bg-emerald-500/90 shadow-[0_0_15px_rgba(16,185,129,0.7)]';

        dots.push(
            <div 
                key={key} 
                className={`w-3 h-3 rounded-[3px] transition-all duration-500 ${opacity}`}
                title={`${key}: ${count} contributions`}
            />
        );
    }

    return (
        <div className="group relative flex flex-col items-center transition-all duration-500 hover:-translate-y-3">
            <div className="relative w-32 h-32 mb-4">
                <div className="absolute inset-[-12px] rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-2xl bg-emerald-500/10" />
                
                <div className="relative w-full h-full rounded-[2rem] flex flex-col items-center justify-center overflow-hidden
                    backdrop-blur-2xl transition-all duration-500 bg-white/[0.04] border border-white/[0.08]
                    shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]">
                    
                    <div className="grid grid-cols-7 gap-1.5 p-4">
                        {dots}
                    </div>

                    <div className="flex flex-col items-center mt-[-4px]">
                        <span className="text-[14px] font-bold text-white/80">{activity.totalContributions}</span>
                        <span className="text-[8px] font-medium tracking-tighter text-white/30 uppercase">Contributions</span>
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent opacity-60 pointer-events-none" />
                </div>
            </div>
            
            <span className="text-[11px] font-medium tracking-wide text-white/50 group-hover:text-white/80 transition-all uppercase">
                Pulse
            </span>
            <span className="text-[9px] mt-1 tracking-wider text-emerald-500/40 uppercase">
                GitHub Activity
            </span>
        </div>
    );
};

export default GitHubHeatmapCell;
