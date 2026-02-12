import React from 'react';
import { RoadmapItem, ProjectInfo } from '../types/roadmap';
import DependencyGraph from './DependencyGraph';
import { GLASS } from '../App';

interface RoadmapProjectMapProps {
    items: RoadmapItem[];
    projects: ProjectInfo[];
    selectedProject: string;
    onProjectChange: (project: string) => void;
}

const RoadmapProjectMap: React.FC<RoadmapProjectMapProps> = ({
    items,
    projects,
    selectedProject,
    onProjectChange
}) => {
    const filteredItems = selectedProject && selectedProject !== 'all'
        ? items.filter(item => item.project === selectedProject)
        : items;

    // Sort by priority for display
    const sortedItems = [...filteredItems].sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.title.localeCompare(b.title);
    });

    // Build project list with "All Projects" option
    const allProjects = [{ name: 'All Projects', path: 'all', hasTodo: false } as ProjectInfo, ...projects];

    return (
        <div className="flex flex-col gap-6">
            {/* Project Selector */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white tracking-wider mb-1">Dependency Map</h2>
                    <p className="text-sm text-white/40">Visualize task dependencies across the roadmap</p>
                </div>
                <div className="relative">
                    <select
                        value={selectedProject}
                        onChange={(e) => onProjectChange(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-sky-500/50 appearance-none cursor-pointer pr-8"
                    >
                        {allProjects.map(p => (
                            <option key={p.path} value={p.path} className="bg-slate-900">
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

            {/* Graph */}
            {sortedItems.length > 0 ? (
                <DependencyGraph items={sortedItems} />
            ) : (
                <div className={`${GLASS} rounded-2xl h-[600px] flex flex-col items-center justify-center text-white/40`}>
                    <div className="text-6xl mb-4">🗺️</div>
                    <p className="text-lg">No dependencies to display</p>
                    <p className="text-sm">Select a project with tasks that have dependencies</p>
                </div>
            )}

            {/* Legend */}
            <div className={`${GLASS} rounded-xl p-4`}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-3">Legend</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-gray-500" />
                        <span className="text-white/60">Todo</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-sky-500" />
                        <span className="text-white/60">In Progress</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-rose-500" />
                        <span className="text-white/60">Blocked</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-white/60">Done</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoadmapProjectMap;
