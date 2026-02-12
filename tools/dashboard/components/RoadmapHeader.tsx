import React from 'react';
import { ProjectInfo, RoadmapStats } from '../types/roadmap';
import { GLASS } from '../App';

interface RoadmapHeaderProps {
    projects: ProjectInfo[];
    projectFilter: string;
    onProjectChange: (project: string) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    stats: RoadmapStats;
    onRefresh: () => void;
    loading: boolean;
}

const RoadmapHeader: React.FC<RoadmapHeaderProps> = ({
    projects,
    projectFilter,
    onProjectChange,
    searchQuery,
    onSearchChange,
    stats,
    onRefresh,
    loading
}) => {
    const allProjects = [{ name: 'All Projects', path: '', hasTodo: false } as ProjectInfo, ...projects];

    return (
        <div className={`${GLASS} rounded-2xl p-6 mb-8`}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left: Title & Project Dropdown */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-wider">🗺️ Roadmap</h1>
                        <p className="text-sm text-white/40 mt-1">Visual execution order for agents</p>
                    </div>
                    <div className="relative">
                        <select
                            value={projectFilter}
                            onChange={(e) => onProjectChange(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-sky-500/50 appearance-none cursor-pointer pr-8"
                        >
                            {allProjects.map(p => (
                                <option key={p.path || 'all'} value={p.path || 'all'} className="bg-slate-900">
                                    {p.name} {p.hasTodo ? '(📋)' : ''}
                                </option>
                            ))}
                        </select>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/30">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M6 9l6 6 6-6" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Center: Search */}
                <div className="relative flex-1 max-w-md">
                    <input
                        type="text"
                        placeholder="Search roadmap..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-sky-500/50 transition-all"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => onSearchChange('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Right: Stats & Refresh */}
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-white">{stats.total}</div>
                            <div className="text-[10px] uppercase tracking-wider text-white/40">Total</div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-xs">
                                <span className="w-3 h-3 rounded-full bg-gray-500/50" />
                                <span className="text-white/60">{stats.byStatus.todo || 0}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                <span className="w-3 h-3 rounded-full bg-sky-500/50" />
                                <span className="text-white/60">{stats.byStatus['in-progress'] || 0}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                <span className="w-3 h-3 rounded-full bg-rose-500/50" />
                                <span className="text-white/60">{stats.byStatus.blocked || 0}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                <span className="w-3 h-3 rounded-full bg-emerald-500/50" />
                                <span className="text-white/60">{stats.byStatus.done || 0}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {stats.urgentCount > 0 && (
                            <div className="px-3 py-1 bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-400 text-sm font-bold animate-pulse">
                                {stats.urgentCount} Urgent
                            </div>
                        )}
                        <button
                            onClick={onRefresh}
                            disabled={loading}
                            className={`p-2 ${GLASS} rounded-lg hover:bg-white/10 transition-colors ${loading ? 'animate-spin' : ''}`}
                            title="Refresh roadmap"
                        >
                            🔄
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoadmapHeader;
