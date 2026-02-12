import React from 'react';
import { RoadmapItem } from '../types/roadmap';
import { GLASS } from '../App';

const priorityColors: Record<number, string> = {
    1: 'text-rose-500 border-rose-500/30 shadow-[0_0_15px_-3px_rgba(244,63,94,0.4)]',
    2: 'text-amber-500 border-amber-500/30 shadow-[0_0_15px_-3px_rgba(245,158,11,0.3)]',
    3: 'text-sky-500 border-sky-500/30 shadow-[0_0_15px_-3px_rgba(14,165,233,0.2)]',
    4: 'text-gray-500 border-gray-500/30 shadow-[0_0_15px_-3px_rgba(107,114,128,0.1)]'
};

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    todo: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Todo' },
    'in-progress': { bg: 'bg-sky-500/20', text: 'text-sky-400', label: 'In Progress' },
    blocked: { bg: 'bg-rose-500/20', text: 'text-rose-400', label: 'Blocked' },
    done: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Done' }
};

interface RoadmapItemCardProps {
    item: RoadmapItem;
    onStatusChange?: (item: RoadmapItem, newStatus: RoadmapItem['status']) => void;
    onClick?: (item: RoadmapItem) => void;
    onContextMenu?: (item: RoadmapItem, e: React.MouseEvent) => void;
    compact?: boolean;
    showProject?: boolean;
}

const RoadmapItemCard: React.FC<RoadmapItemCardProps> = ({
    item,
    onStatusChange,
    onClick,
    onContextMenu,
    compact = false,
    showProject = false
}) => {
    const priorityClass = priorityColors[item.priority] || priorityColors[4];
    const status = statusConfig[item.status];

    const handleClick = (e: React.MouseEvent) => {
        if (!onStatusChange && onClick) {
            onClick(item);
        } else if (onStatusChange) {
            // Cycle through statuses: todo -> in-progress -> blocked -> done -> todo
            const statusOrder: RoadmapItem['status'][] = ['todo', 'in-progress', 'blocked', 'done'];
            const currentIndex = statusOrder.indexOf(item.status);
            const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
            onStatusChange(item, nextStatus);
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        if (onContextMenu) {
            e.preventDefault();
            onContextMenu(item, e);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (onStatusChange) {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const statusOrder: RoadmapItem['status'][] = ['todo', 'in-progress', 'blocked', 'done'];
                const currentIndex = statusOrder.indexOf(item.status);
                const direction = e.key === 'ArrowRight' ? 1 : -1;
                const nextStatus = statusOrder[(currentIndex + direction + 4) % 4];
                onStatusChange(item, nextStatus);
            } else if (e.key === 'e' || e.key === 'E') {
                // Open in VS Code (future)
                console.log('Open file:', item.path);
            } else if (e.key === 'a' || e.key === 'A') {
                // Assign to self (future)
                console.log('Assign to Pi');
            } else if (e.key === 'd' || e.key === 'D') {
                // Add dependency (future)
                console.log('Add dependency');
            }
        }
    };

    // Urgent pulse animation for priority 1
    const urgentPulse = item.priority === 1 && item.status !== 'done' ? 'animate-pulse' : '';

    if (compact) {
        return (
            <div
                className={`${GLASS} rounded-xl p-3 cursor-pointer transition-all hover:scale-[1.02] hover:border-white/20 ${urgentPulse}`}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                onKeyDown={handleKeyDown}
                tabIndex={0}
                role="button"
                aria-label={`Task: ${item.title}, status ${item.status}`}
            >
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[9px] font-bold uppercase tracking-wider ${priorityClass.split(' ')[0]}`}>
                                P{item.priority}
                            </span>
                            {showProject && (
                                <span className="text-[9px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
                                    {item.project}
                                </span>
                            )}
                        </div>
                        <h4 className="text-sm font-medium text-white/90 truncate">{item.title}</h4>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                        {status.label}
                    </span>
                </div>
                {item.estimateHours && (
                    <div className="mt-2 text-[10px] text-white/40 flex items-center gap-1">
                        <span>⏱️ {item.estimateHours}h</span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div
            className={`${GLASS} rounded-2xl p-4 transition-all hover:scale-[1.01] hover:border-white/20 cursor-pointer ${urgentPulse}`}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="button"
            aria-label={`Task: ${item.title}, status ${item.status}`}
        >
            <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${priorityClass.split(' ')[0].replace('text-', 'bg-')}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${priorityClass.split(' ')[0]}`}>
                        P{item.priority}
                    </span>
                    {item.dependencies && item.dependencies.length > 0 && (
                        <span className="text-[10px] text-white/30 flex items-center gap-1" title={`${item.dependencies.length} dependencies`}>
                            <span>🔗</span> {item.dependencies.length}
                        </span>
                    )}
                </div>
                {showProject && (
                    <span className="text-[10px] text-white/30 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                        {item.project}
                    </span>
                )}
            </div>

            <h3 className="text-base font-semibold text-white mb-2 leading-tight">{item.title}</h3>

            {item.description && (
                <p className="text-sm text-white/50 mb-3 line-clamp-2">{item.description}</p>
            )}

            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${status.bg} ${status.text}`}>
                        {status.label}
                    </span>
                    {item.assignee && (
                        <span className="text-[10px] text-white/40 bg-white/5 px-2 py-1 rounded-md">
                            👤 {item.assignee}
                        </span>
                    )}
                    {item.estimateHours && (
                        <span className="text-[10px] text-white/40 flex items-center gap-1">
                            ⏱️ {Math.round(item.estimateHours)}h
                        </span>
                    )}
                </div>
                {item.category && (
                    <span className="text-[10px] text-white/30 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                        {item.category}
                    </span>
                )}
            </div>
        </div>
    );
};

export default RoadmapItemCard;
