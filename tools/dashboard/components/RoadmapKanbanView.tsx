import React, { useState, useRef } from 'react';
import { RoadmapItem, RoadmapStatus } from '../types/roadmap';
import RoadmapItemCard from './RoadmapItemCard';
import { GLASS } from '../App';

interface RoadmapKanbanViewProps {
    items: RoadmapItem[];
    onStatusChange: (item: RoadmapItem, newStatus: RoadmapStatus) => void;
}

const columnConfig: { id: RoadmapStatus; title: string; description: string; color: string }[] = [
    { id: 'todo', title: 'Backlog', description: 'Ideas and pending work', color: 'bg-gray-500/20 border-gray-500/30' },
    { id: 'in-progress', title: 'In Progress', description: 'Active work', color: 'bg-sky-500/20 border-sky-500/30' },
    { id: 'blocked', title: 'Blocked', description: 'Waiting on external factors', color: 'bg-rose-500/20 border-rose-500/30' },
    { id: 'done', title: 'Done', description: 'Completed work', color: 'bg-emerald-500/20 border-emerald-500/30' }
];

const RoadmapKanbanView: React.FC<RoadmapKanbanViewProps> = ({ items, onStatusChange }) => {
    const [draggedItem, setDraggedItem] = useState<RoadmapItem | null>(null);
    const dragCounter = useRef(0);

    const getItemsForColumn = (status: RoadmapStatus) => {
        return items.filter(item => item.status === status);
    };

    const handleDragStart = (e: React.DragEvent, item: RoadmapItem) => {
        setDraggedItem(item);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.id);
        dragCounter.current++;
        // Add visual feedback
        e.currentTarget.classList.add('opacity-50');
    };

    const handleDragEnd = (e: React.DragEvent) => {
        e.currentTarget.classList.remove('opacity-50');
        setDraggedItem(null);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDragEnter = (e: React.DragEvent, columnId: RoadmapStatus) => {
        e.preventDefault();
        dragCounter.current++;
        const column = e.currentTarget as HTMLElement;
        column.classList.add('bg-white/10');
    };

    const handleDragLeave = (e: React.DragEvent) => {
        dragCounter.current--;
        if (dragCounter.current === 0) {
            const column = e.currentTarget as HTMLElement;
            column.classList.remove('bg-white/10');
        }
    };

    const handleDrop = (e: React.DragEvent, targetStatus: RoadmapStatus) => {
        e.preventDefault();
        dragCounter.current = 0;
        const column = e.currentTarget as HTMLElement;
        column.classList.remove('bg-white/10');

        if (draggedItem && draggedItem.status !== targetStatus) {
            onStatusChange(draggedItem, targetStatus);
        }
        setDraggedItem(null);
    };

    return (
        <div className="flex gap-6 overflow-x-auto pb-8 custom-scrollbar">
            {columnConfig.map(column => {
                const columnItems = getItemsForColumn(column.id);
                return (
                    <div
                        key={column.id}
                        className={`flex-shrink-0 w-80 flex flex-col gap-4 rounded-2xl p-4 border transition-colors ${column.color} ${draggedItem && draggedItem.status !== column.id ? 'min-h-[500px]' : ''}`}
                        onDragOver={handleDragOver}
                        onDragEnter={(e) => handleDragEnter(e, column.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, column.id)}
                    >
                        <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl bg-white/5 border ${column.color}`}>
                                    <span className="text-lg">
                                        {column.id === 'todo' ? '📋' : column.id === 'in-progress' ? '⚡' : column.id === 'blocked' ? '🚫' : '✅'}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white/90 uppercase tracking-[0.15em]">{column.title}</h3>
                                    <p className="text-[10px] text-white/30 uppercase tracking-wider">{column.description}</p>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold bg-white/5 text-white/40 px-2 py-0.5 rounded-lg border border-white/5">
                                {columnItems.length}
                            </span>
                        </div>

                        <div className="flex-1 min-h-[500px] bg-white/[0.02] rounded-[2rem] p-3 border border-white/[0.03] backdrop-blur-sm">
                            <div className="space-y-1">
                                {columnItems.map(item => (
                                    <div
                                        key={item.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, item)}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <RoadmapItemCard item={item} compact />
                                    </div>
                                ))}
                                {columnItems.length === 0 && (
                                    <div className="h-40 flex flex-col items-center justify-center text-center p-6 bg-white/[0.01] rounded-2xl border border-dashed border-white/5">
                                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-2 text-white/10">
                                            {column.id === 'todo' ? '📥' : column.id === 'in-progress' ? '🔨' : column.id === 'blocked' ? '⛔' : '🏁'}
                                        </div>
                                        <p className="text-[10px] text-white/20 uppercase font-bold tracking-widest">Drop items here</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default RoadmapKanbanView;
