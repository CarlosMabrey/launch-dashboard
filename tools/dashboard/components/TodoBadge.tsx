import React from 'react';
import { TodoData, TodoMetadata } from '../types';
import { getStatusColor, getPriorityColor } from '../services/todoService';

interface TodoBadgeProps {
    todoData: TodoData;
    size?: 'sm' | 'md' | 'lg';
    showProgress?: boolean;
    onClick?: () => void;
}

/**
 * A circular progress badge that shows todo status
 */
const TodoBadge: React.FC<TodoBadgeProps> = ({
    todoData,
    size = 'md',
    showProgress = true,
    onClick
}) => {
    const { metadata, progressPercent, totalTasks, blocked, inProgress } = todoData;

    // Size configurations
    const sizes = {
        sm: { outer: 24, inner: 18, stroke: 3, text: '8px' },
        md: { outer: 32, inner: 24, stroke: 4, text: '9px' },
        lg: { outer: 40, inner: 30, stroke: 5, text: '10px' }
    };

    const config = sizes[size];
    const radius = (config.outer - config.stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

    const statusColor = getStatusColor(metadata);
    const priorityColor = getPriorityColor(metadata.priority);
    const hasBlocked = blocked.length > 0;
    const hasInProgress = inProgress.length > 0;

    return (
        <div
            className={`relative cursor-pointer group transition-transform hover:scale-110 ${onClick ? 'cursor-pointer' : ''}`}
            onClick={onClick}
            title={`${progressPercent}% complete • ${totalTasks} tasks • ${blocked.length} blocked`}
        >
            {/* SVG Progress Ring */}
            <svg
                width={config.outer}
                height={config.outer}
                className="transform -rotate-90"
            >
                {/* Background circle */}
                <circle
                    cx={config.outer / 2}
                    cy={config.outer / 2}
                    r={radius}
                    fill="transparent"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth={config.stroke}
                />

                {/* Progress arc */}
                {showProgress && (
                    <circle
                        cx={config.outer / 2}
                        cy={config.outer / 2}
                        r={radius}
                        fill="transparent"
                        stroke={statusColor}
                        strokeWidth={config.stroke}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-500"
                        style={{
                            filter: `drop-shadow(0 0 4px ${statusColor})`
                        }}
                    />
                )}
            </svg>

            {/* Center content */}
            <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ fontSize: config.text }}
            >
                {hasBlocked ? (
                    <span className="text-red-400 font-bold">!</span>
                ) : hasInProgress ? (
                    <span className="text-white/60 font-medium">{inProgress.length}</span>
                ) : (
                    <span className="text-white/40 font-medium">{progressPercent}%</span>
                )}
            </div>

            {/* Priority indicator dot */}
            {(metadata.priority === 'critical' || metadata.priority === 'high') && (
                <div
                    className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse"
                    style={{
                        backgroundColor: priorityColor,
                        boxShadow: `0 0 6px ${priorityColor}`
                    }}
                />
            )}

            {/* Tooltip on hover */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 
        bg-black/90 border border-white/10 rounded-lg opacity-0 group-hover:opacity-100 
        transition-opacity whitespace-nowrap text-[9px] text-white/70 pointer-events-none z-50">
                <div className="flex flex-col gap-0.5">
                    <span>{progressPercent}% complete</span>
                    {hasBlocked && <span className="text-red-400">{blocked.length} blocked</span>}
                    {hasInProgress && <span className="text-blue-400">{inProgress.length} in progress</span>}
                </div>
            </div>
        </div>
    );
};

export default TodoBadge;
