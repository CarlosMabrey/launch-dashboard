import React, { useState } from 'react';
import { TodoData, TodoTask } from '../types';
import { getStatusColor, getPriorityColor, formatLastUpdated } from '../services/todoService';

interface TodoModalProps {
    todoData: TodoData;
    appName: string;
    onClose: () => void;
}

const StatusIcon: React.FC<{ status: TodoTask['status'] }> = ({ status }) => {
    switch (status) {
        case 'done':
            return <span className="text-green-400">✓</span>;
        case 'in-progress':
            return <span className="text-blue-400 animate-pulse">◐</span>;
        case 'blocked':
            return <span className="text-red-400">!</span>;
        default:
            return <span className="text-white/30">○</span>;
    }
};

const TaskItem: React.FC<{ task: TodoTask }> = ({ task }) => (
    <div className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
        <StatusIcon status={task.status} />
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
                {task.id && (
                    <span className="text-[9px] text-white/30 font-mono">#{task.id}</span>
                )}
                <span className="text-[11px] text-white/80 truncate">{task.text}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
                {task.assignee && (
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${task.assignee === 'agent' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                        @{task.assignee}
                    </span>
                )}
                {task.estimate && (
                    <span className="text-[8px] text-white/30">~{task.estimate}</span>
                )}
                {task.tags?.map((tag, i) => (
                    <span key={i} className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">
                        {tag}
                    </span>
                ))}
                {task.completedAt && (
                    <span className="text-[8px] text-green-400/60">✓{task.completedAt}</span>
                )}
            </div>
        </div>
    </div>
);

const TodoModal: React.FC<TodoModalProps> = ({ todoData, appName, onClose }) => {
    const [activeTab, setActiveTab] = useState<'current' | 'completed' | 'backlog'>('current');
    const { metadata, inProgress, blocked, completed, backlog, progressPercent, totalTasks } = todoData;

    const statusColor = getStatusColor(metadata);
    const priorityColor = getPriorityColor(metadata.priority);

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" />

            {/* Modal */}
            <div
                className="relative w-full max-w-2xl max-h-[80vh] bg-[#0c0c0c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-4">
                        {/* Progress Ring */}
                        <div className="relative w-12 h-12">
                            <svg width="48" height="48" className="transform -rotate-90">
                                <circle cx="24" cy="24" r="20" fill="transparent" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                                <circle
                                    cx="24" cy="24" r="20"
                                    fill="transparent"
                                    stroke={statusColor}
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeDasharray={125.6}
                                    strokeDashoffset={125.6 - (progressPercent / 100) * 125.6}
                                    style={{ filter: `drop-shadow(0 0 6px ${statusColor})` }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white/80">
                                {progressPercent}%
                            </div>
                        </div>

                        <div>
                            <h2 className="text-lg font-bold tracking-tight">{metadata.project || appName}</h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span
                                    className="text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold"
                                    style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
                                >
                                    {metadata.status}
                                </span>
                                <span
                                    className="text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider"
                                    style={{ backgroundColor: `${priorityColor}20`, color: priorityColor }}
                                >
                                    {metadata.priority}
                                </span>
                                {metadata.version && (
                                    <span className="text-[9px] text-white/30">v{metadata.version}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className="text-[9px] text-white/30 uppercase tracking-wider">Last Updated</div>
                            <div className="text-[11px] text-white/60">{formatLastUpdated(metadata.lastUpdated)}</div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                        >
                            ×
                        </button>
                    </div>
                </div>

                {/* Stats Bar */}
                <div className="flex items-center gap-6 px-6 py-3 border-b border-white/5 bg-white/[0.01]">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                        <span className="text-[10px] text-white/50">{inProgress.length} In Progress</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-400" />
                        <span className="text-[10px] text-white/50">{blocked.length} Blocked</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                        <span className="text-[10px] text-white/50">{completed.length} Done</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-white/20" />
                        <span className="text-[10px] text-white/50">{backlog.length} Backlog</span>
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                        <span className="text-[10px] text-white/30">Health:</span>
                        <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all"
                                style={{
                                    width: `${metadata.health}%`,
                                    backgroundColor: metadata.health >= 70 ? '#22c55e' : metadata.health >= 40 ? '#f59e0b' : '#ef4444'
                                }}
                            />
                        </div>
                        <span className="text-[10px] text-white/50">{metadata.health}%</span>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/5">
                    {(['current', 'completed', 'backlog'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-3 text-[10px] uppercase tracking-wider font-bold transition-colors
                ${activeTab === tab ? 'text-white border-b-2 border-white/40' : 'text-white/30 hover:text-white/60'}`}
                        >
                            {tab === 'current' ? `Current (${inProgress.length + blocked.length})` :
                                tab === 'completed' ? `Completed (${completed.length})` :
                                    `Backlog (${backlog.length})`}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4">
                    {activeTab === 'current' && (
                        <div className="space-y-4">
                            {blocked.length > 0 && (
                                <div>
                                    <div className="text-[9px] uppercase tracking-wider text-red-400/60 font-bold mb-2 px-3">
                                        Blocked
                                    </div>
                                    <div className="space-y-1">
                                        {blocked.map((task, i) => <TaskItem key={i} task={task} />)}
                                    </div>
                                </div>
                            )}
                            {inProgress.length > 0 && (
                                <div>
                                    <div className="text-[9px] uppercase tracking-wider text-blue-400/60 font-bold mb-2 px-3">
                                        In Progress
                                    </div>
                                    <div className="space-y-1">
                                        {inProgress.map((task, i) => <TaskItem key={i} task={task} />)}
                                    </div>
                                </div>
                            )}
                            {blocked.length === 0 && inProgress.length === 0 && (
                                <div className="text-center text-white/20 py-8 text-[11px]">
                                    No active tasks
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'completed' && (
                        <div className="space-y-1">
                            {completed.length > 0 ? (
                                completed.map((task, i) => <TaskItem key={i} task={task} />)
                            ) : (
                                <div className="text-center text-white/20 py-8 text-[11px]">
                                    No completed tasks yet
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'backlog' && (
                        <div className="space-y-1">
                            {backlog.length > 0 ? (
                                backlog.map((task, i) => <TaskItem key={i} task={task} />)
                            ) : (
                                <div className="text-center text-white/20 py-8 text-[11px]">
                                    Backlog is empty
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {metadata.agentSession && (
                    <div className="px-6 py-3 border-t border-white/5 bg-white/[0.01]">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                            <span className="text-[9px] text-purple-400/60">Agent Active</span>
                            <span className="text-[9px] text-white/20 font-mono">{metadata.agentSession}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TodoModal;
