import React, { useState, useMemo } from 'react';
import { RoadmapItem, RoadmapStatus } from '../types/roadmap';
import RoadmapItemCard from './RoadmapItemCard';
import { GLASS } from '../App';

interface RoadmapListViewProps {
    items: RoadmapItem[];
    onStatusChange: (item: RoadmapItem, newStatus: RoadmapStatus) => void;
    onItemClick?: (item: RoadmapItem) => void;
}

type SortField = 'priority' | 'title' | 'project' | 'status' | 'estimateHours' | 'dependencies';
type SortDirection = 'asc' | 'desc';

const RoadmapListView: React.FC<RoadmapListViewProps> = ({
    items,
    onStatusChange,
    onItemClick
}) => {
    const [sortField, setSortField] = useState<SortField>('priority');
    const [sortDir, setSortDir] = useState<SortDirection>('asc');

    const sortedItems = useMemo(() => {
        const sorted = [...items].sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'priority':
                    comparison = a.priority - b.priority;
                    break;
                case 'title':
                    comparison = a.title.localeCompare(b.title);
                    break;
                case 'project':
                    comparison = a.project.localeCompare(b.project);
                    break;
                case 'status':
                    comparison = a.status.localeCompare(b.status);
                    break;
                case 'estimateHours':
                    comparison = (a.estimateHours || 0) - (b.estimateHours || 0);
                    break;
                case 'dependencies':
                    comparison = (a.dependencies?.length || 0) - (b.dependencies?.length || 0);
                    break;
            }
            return sortDir === 'asc' ? comparison : -comparison;
        });
        return sorted;
    }, [items, sortField, sortDir]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const getSortIndicator = (field: SortField) => {
        if (sortField !== field) return '↕';
        return sortDir === 'asc' ? '↑' : '↓';
    };

    const priorityColors: Record<number, string> = {
        1: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        2: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        3: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
        4: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };

    const statusColors: Record<string, string> = {
        todo: 'bg-gray-500/20 text-gray-400',
        'in-progress': 'bg-sky-500/20 text-sky-400',
        blocked: 'bg-rose-500/20 text-rose-400',
        done: 'bg-emerald-500/20 text-emerald-400'
    };

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-white/40">
                <div className="text-6xl mb-4">📋</div>
                <p className="text-lg">No roadmap items found</p>
                <p className="text-sm">Adjust your filters or add tasks to get started</p>
            </div>
        );
    }

    return (
        <div className={`${GLASS} rounded-2xl overflow-hidden`}>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/10 text-left">
                            <th className="p-4">
                                <button
                                    onClick={() => handleSort('priority')}
                                    className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-white/60 hover:text-white transition-colors"
                                >
                                    Priority {getSortIndicator('priority')}
                                </button>
                            </th>
                            <th className="p-4">
                                <button
                                    onClick={() => handleSort('title')}
                                    className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-white/60 hover:text-white transition-colors"
                                >
                                    Title {getSortIndicator('title')}
                                </button>
                            </th>
                            <th className="p-4">
                                <button
                                    onClick={() => handleSort('project')}
                                    className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-white/60 hover:text-white transition-colors"
                                >
                                    Project {getSortIndicator('project')}
                                </button>
                            </th>
                            <th className="p-4">
                                <button
                                    onClick={() => handleSort('status')}
                                    className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-white/60 hover:text-white transition-colors"
                                >
                                    Status {getSortIndicator('status')}
                                </button>
                            </th>
                            <th className="p-4">
                                <button
                                    onClick={() => handleSort('estimateHours')}
                                    className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-white/60 hover:text-white transition-colors"
                                >
                                    Estimate {getSortIndicator('estimateHours')}
                                </button>
                            </th>
                            <th className="p-4">
                                <button
                                    onClick={() => handleSort('dependencies')}
                                    className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-white/60 hover:text-white transition-colors"
                                >
                                    Dependencies {getSortIndicator('dependencies')}
                                </button>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedItems.map((item) => (
                            <tr
                                key={item.id}
                                className="group hover:bg-white/5 transition-colors border-b border-white/5 cursor-pointer"
                                onClick={() => onStatusChange(item, (['todo', 'in-progress', 'blocked', 'done'] as RoadmapStatus[])[(['todo', 'in-progress', 'blocked', 'done'].indexOf(item.status) + 1) % 4])}
                            >
                                <td className="p-4">
                                    <span className={`inline-block px-2 py-1 rounded-md text-xs font-bold border ${priorityColors[item.priority]}`}>
                                        P{item.priority}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-white/90 group-hover:text-white transition-colors">
                                            {item.title}
                                        </span>
                                        {item.dependencies && item.dependencies.length > 0 && (
                                            <span className="text-xs text-white/30" title={`${item.dependencies.length} dependencies`}>
                                                🔗 {item.dependencies.length}
                                            </span>
                                        )}
                                    </div>
                                    {item.description && (
                                        <p className="text-xs text-white/40 mt-1 line-clamp-1">{item.description}</p>
                                    )}
                                </td>
                                <td className="p-4">
                                    <span className="text-sm text-white/60">{item.project}</span>
                                </td>
                                <td className="p-4">
                                    <span className={`inline-block px-2 py-1 rounded-md text-xs font-bold ${statusColors[item.status]}`}>
                                        {item.status === 'in-progress' ? 'In Progress' : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                                    </span>
                                </td>
                                <td className="p-4">
                                    {item.estimateHours ? (
                                        <span className="text-sm text-white/60">{Math.round(item.estimateHours)}h</span>
                                    ) : (
                                        <span className="text-white/30">—</span>
                                    )}
                                </td>
                                <td className="p-4">
                                    {item.dependencies && item.dependencies.length > 0 ? (
                                        <span className="text-sm text-white/60">{item.dependencies.length}</span>
                                    ) : (
                                        <span className="text-white/30">—</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RoadmapListView;
