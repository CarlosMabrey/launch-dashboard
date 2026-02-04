
import React, { useEffect, useState } from 'react';
import { getAllTodos } from '../services/todoService';
import { AppItem, TodoData } from '../types';
import { Shield } from 'lucide-react';

interface OmniscienceCellProps {
    apps: AppItem[];
}

const OmniscienceCell: React.FC<OmniscienceCellProps> = ({ apps }) => {
    const [totalProgress, setTotalProgress] = useState(0);
    const [activeProjects, setActiveProjects] = useState(0);

    useEffect(() => {
        const fetchAllData = async () => {
            const appsWithDirs = apps.filter(a => a.directory).map(a => ({ id: a.id, directory: a.directory }));
            if (appsWithDirs.length === 0) return;

            const todoMap = await getAllTodos(appsWithDirs);
            
            let totalTasks = 0;
            let totalCompleted = 0;
            let projectCount = 0;

            todoMap.forEach((data) => {
                totalTasks += data.totalTasks;
                totalCompleted += data.completedCount;
                projectCount++;
            });

            const progress = totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 0;
            setTotalProgress(progress);
            setActiveProjects(projectCount);
        };

        fetchAllData();
        const interval = setInterval(fetchAllData, 10000);
        return () => clearInterval(interval);
    }, [apps]);

    return (
        <div className="group relative flex flex-col items-center transition-all duration-500 hover:-translate-y-3">
            <div className="relative w-32 h-32 mb-4">
                <div className="absolute inset-[-12px] rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-2xl bg-cyan-500/10" />
                
                <div className="relative w-full h-full rounded-[2rem] flex flex-col items-center justify-center overflow-hidden
                    backdrop-blur-2xl transition-all duration-500 bg-white/[0.04] border border-white/[0.08]
                    shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]">
                    
                    <Shield className="w-8 h-8 text-cyan-400/80 mb-2" />
                    
                    <div className="flex flex-col items-center">
                        <span className="text-xl font-bold text-white/90">{Math.round(totalProgress)}%</span>
                        <span className="text-[8px] font-medium tracking-widest text-white/30 uppercase mt-1">Completion</span>
                    </div>

                    <div className="absolute bottom-3 flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div 
                                key={i} 
                                className={`w-1.5 h-1 rounded-full transition-all duration-500 ${
                                    (totalProgress / 20) >= i ? 'bg-cyan-400' : 'bg-white/10'
                                }`} 
                            />
                        ))}
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-b from-white/[0.05] to-transparent opacity-60 pointer-events-none" />
                </div>
            </div>
            
            <span className="text-[11px] font-medium tracking-wide text-white/50 group-hover:text-white/80 transition-all uppercase">
                Omniscience
            </span>
            <span className="text-[9px] mt-1 tracking-wider text-cyan-500/40 uppercase">
                {activeProjects} Projects
            </span>
        </div>
    );
};

export default OmniscienceCell;
