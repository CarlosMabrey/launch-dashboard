import React, { useState, useEffect, useRef } from 'react';
import { AppItem } from '../types';
import { Zap, Cpu } from 'lucide-react';

interface ResourceMonitorProps {
    apps: AppItem[];
    className?: string;
    totalVram?: number; // Total VRAM in GB, default to 24
}

interface ResourceStats {
    cpu: number; // percentage
    ram: number; // percentage
    vram: number; // GB
}

const ResourceMonitor: React.FC<ResourceMonitorProps> = ({ apps, className = '', totalVram = 24 }) => {
    // Filter for AI services
    const aiApps = apps.filter(app => {
        const name = app.name.toLowerCase();
        return name.includes('ollama') ||
            name.includes('comfy') ||
            name.includes('webui') ||
            name.includes('forge') ||
            name.includes('lumina');
    });

    // Mock resources state
    const [resources, setResources] = useState<Record<string, ResourceStats>>({});
    const [totalUsedVram, setTotalUsedVram] = useState(0);
    const [vramHistory, setVramHistory] = useState<number[]>(new Array(40).fill(0));

    // App colors for the stacked bar
    const getAppColor = (name: string, opacity: number = 1) => {
        const n = name.toLowerCase();
        if (n.includes('ollama')) return `rgba(249, 115, 22, ${opacity})`; // Orange
        if (n.includes('comfy')) return `rgba(168, 85, 247, ${opacity})`;  // Purple
        if (n.includes('webui') || n.includes('forge')) return `rgba(59, 130, 246, ${opacity})`; // Blue
        if (n.includes('lumina')) return `rgba(236, 72, 153, ${opacity})`; // Pink
        return `rgba(16, 185, 129, ${opacity})`; // Emerald default
    };

    // Simulate resource fluctuations
    useEffect(() => {
        const interval = setInterval(() => {
            const newResources: Record<string, ResourceStats> = {};
            let calculatedTotalVram = 0;

            // Base system overhead (always some VRAM used)
            let systemOverhead = 0.8 + (Math.random() * 0.4);

            aiApps.forEach(app => {
                if (app.isOnline) {
                    // Generate somewhat realistic-looking fluctuation
                    const name = app.name.toLowerCase();
                    let baseVram = 0;

                    // Heuristic base loads
                    if (name.includes('ollama')) baseVram = 6 + (Math.random() * 2); // LLMs are heavy
                    else if (name.includes('comfy')) baseVram = 4 + (Math.random() * 3); // SDXL etc
                    else if (name.includes('webui') || name.includes('forge')) baseVram = 5 + (Math.random() * 1.5);
                    else baseVram = 2;

                    const cpu = Math.max(1, Math.min(100, (baseVram * 5) + (Math.random() * 10)));
                    const ram = Math.max(5, Math.min(100, 20 + (Math.random() * 5)));

                    newResources[app.id] = {
                        cpu,
                        ram,
                        vram: baseVram
                    };

                    calculatedTotalVram += baseVram;
                } else {
                    newResources[app.id] = { cpu: 0, ram: 0, vram: 0 };
                }
            });

            // Add system overhead
            calculatedTotalVram += systemOverhead;

            // Clamp to total
            if (calculatedTotalVram > totalVram) calculatedTotalVram = totalVram;

            setResources(newResources);
            setTotalUsedVram(calculatedTotalVram);
            setVramHistory(prev => [...prev.slice(1), calculatedTotalVram]);

        }, 1000); // Updated to 1s for smoother graph

        return () => clearInterval(interval);
    }, [apps, totalVram]);

    // Render VRAM Graph
    const renderGraph = () => {
        // Dynamic Scaling: Scale based on max usage in history, but clamped to totalVram
        const maxInHistory = Math.max(...vramHistory, 1);
        const dynamicMax = Math.min(Math.max(maxInHistory * 1.2, 4), totalVram); // Minimum 4GB scale, add 20% headroom, cap at total

        // Create path data
        const points = vramHistory.map((val, i) => {
            const x = (i / (vramHistory.length - 1)) * 100;
            const y = 100 - ((val / dynamicMax) * 100);
            return `${x},${y}`;
        }).join(' ');

        return (
            <div className="h-40 w-full relative mt-auto opacity-90 overflow-hidden rounded-md border border-white/10 bg-black/20 group shrink-0">
                <svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                >
                    {/* Gradient Area */}
                    <defs>
                        <linearGradient id="vramGradient" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.6" />
                            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="lineSafe" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#34d399" />
                            <stop offset="50%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#a855f7" />
                        </linearGradient>
                    </defs>

                    {/* Grid lines (Dynamic) */}
                    <line x1="0" y1="0" x2="100" y2="0" stroke="white" strokeOpacity="0.05" strokeWidth="0.5" />
                    <line x1="0" y1="25" x2="100" y2="25" stroke="white" strokeOpacity="0.05" strokeWidth="0.5" strokeDasharray="2,2" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="white" strokeOpacity="0.05" strokeWidth="0.5" strokeDasharray="2,2" />
                    <line x1="0" y1="75" x2="100" y2="75" stroke="white" strokeOpacity="0.05" strokeWidth="0.5" strokeDasharray="2,2" />

                    {/* Area Fill */}
                    <path
                        d={`M0,100 ${points} L100,100 Z`}
                        fill="url(#vramGradient)"
                    />

                    {/* Line */}
                    <polyline
                        points={points}
                        fill="none"
                        stroke="url(#lineSafe)"
                        strokeWidth="1.5"
                        vectorEffect="non-scaling-stroke"
                    />
                </svg>

                {/* Labels */}
                <div className="absolute top-1 right-2 text-[10px] text-white/40 font-mono bg-black/40 px-1 rounded backdrop-blur-sm">
                    SCALE: {dynamicMax.toFixed(1)}GB
                </div>
                <div className="absolute bottom-1 right-2 text-[9px] text-white/20 font-mono">
                    LIVE USAGE
                </div>
            </div>
        );
    };

    return (
        <div className={`resource-monitor-glass border border-white/20 p-5 flex flex-col gap-5 overflow-hidden ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-purple-300" />
                    </div>
                    <div>
                        <h2 className="text-xs font-bold text-white uppercase tracking-widest leading-none mb-1">Neural Memory</h2>
                        <div className="text-[10px] text-white/40 font-mono flex items-center gap-1.5">
                            <span>{totalUsedVram.toFixed(1)}GB</span>
                            <span className="text-white/20">/</span>
                            <span>{totalVram}GB</span>
                        </div>
                    </div>
                </div>

                {/* Simple percentage badge */}
                <div className={`px-2 py-1 rounded-lg text-xs font-bold border ${(totalUsedVram / totalVram) > 0.9 ? 'bg-red-500/20 border-red-500/30 text-red-300' :
                    (totalUsedVram / totalVram) > 0.7 ? 'bg-amber-500/20 border-amber-500/30 text-amber-300' :
                        'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                    }`}>
                    {((totalUsedVram / totalVram) * 100).toFixed(0)}%
                </div>
            </div>

            {/* Main Stacked Bar Visualizer */}
            <div className="relative h-8 bg-black/40 rounded-full border border-white/10 overflow-hidden flex shadow-inner shrink-0">
                {/* System Overhead Segment (Always first) */}
                <div
                    className="h-full bg-white/10 border-r border-black/20 transition-all duration-1000 ease-out flex items-center justify-center group"
                    style={{ width: `${(1 / totalVram) * 100}%` }}
                    title="System Overhead"
                >
                    <span className="text-[8px] text-white/30 opacity-0 group-hover:opacity-100">Sys</span>
                </div>

                {/* App Segments */}
                {aiApps.filter(a => a.isOnline).map(app => {
                    const stats = resources[app.id];
                    if (!stats || stats.vram <= 0.1) return null;
                    const widthPercent = (stats.vram / totalVram) * 100;

                    return (
                        <div
                            key={app.id}
                            className="h-full transition-all duration-1000 ease-out border-r border-black/10 relative group"
                            style={{
                                width: `${widthPercent}%`,
                                backgroundColor: getAppColor(app.name, 0.6)
                            }}
                        >
                            {/* Pattern Overlay */}
                            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNCIgaGVpZ2h0PSI0IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0xIDFoMnYySDF6IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz48L3N2Zz4=')] opacity-50" />

                            {/* Animated particles for active apps */}
                            <div className="absolute inset-0 overflow-hidden">
                                <div className="absolute top-0 bottom-0 w-[200%] -left-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_3s_infinite]" />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* VRAM Breakdown List */}
            <div className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar min-h-0">
                {aiApps.length === 0 ? (
                    <div className="text-center py-4 text-white/20 text-xs">
                        No local AI services detected
                    </div>
                ) : (
                    aiApps.map(app => {
                        const stats = resources[app.id] || { cpu: 0, ram: 0, vram: 0 };
                        const isOnline = app.isOnline;
                        const color = getAppColor(app.name);

                        return (
                            <div key={app.id} className="group flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5 shrink-0">
                                <div className="flex items-center gap-3">
                                    {/* Status Ring & Icon */}
                                    <div className="relative">
                                        <div
                                            className={`w-2.5 h-2.5 rounded-full border-2 border-black/50 ${isOnline ? 'animate-pulse' : 'opacity-50'}`}
                                            style={{ backgroundColor: isOnline ? color : '#555' }}
                                        />
                                    </div>

                                    {/* App Name */}
                                    <div className="flex flex-col">
                                        <span className={`text-xs font-medium ${isOnline ? 'text-white/90' : 'text-white/30'}`}>
                                            {app.name}
                                        </span>
                                        {/* Tiny CPU Bar indicator just to show activity */}
                                        {isOnline && (
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <Cpu className="w-2.5 h-2.5 text-white/20" />
                                                <div className="w-12 h-0.5 bg-white/10 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-white/40 transition-all duration-1000"
                                                        style={{ width: `${stats.cpu}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Specific VRAM Metric */}
                                <div className="text-right">
                                    {isOnline ? (
                                        <>
                                            <div className="text-xs font-mono font-bold text-white/90">
                                                {stats.vram.toFixed(1)} <span className="text-[9px] text-white/40 font-sans">GB</span>
                                            </div>
                                            <div className="text-[9px] text-white/30">
                                                {((stats.vram / totalVram) * 100).toFixed(0)}%
                                            </div>
                                        </>
                                    ) : (
                                        <span className="text-[9px] text-white/20 uppercase tracking-wide">Offline</span>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* VRAM Timeline Graph */}
            {renderGraph()}

            <style>{`
        .resource-monitor-glass {
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.6) 0%, rgba(15, 23, 42, 0.4) 100%);
          backdrop-filter: blur(16px);
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }
        @keyframes shimmer {
          100% { left: 100%; }
        }
      `}</style>
        </div>
    );
};

export default ResourceMonitor;
