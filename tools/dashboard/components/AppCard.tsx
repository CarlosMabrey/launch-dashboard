
import React, { useState } from 'react';
import { AppItem } from '../types';
import { getStatusColor, getPriorityColor } from '../services/todoService';

interface AppCardProps {
  app: AppItem;
  isNew?: boolean;
  onClick?: (app: AppItem) => void;
  onLaunch?: (app: AppItem) => void;
  onContextMenu?: (app: AppItem, e: React.MouseEvent) => void;
  onTodoClick?: (app: AppItem) => void;
}

// Premium monochrome accent colors
const ACCENT_COLORS = [
  { bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.25)', glow: 'rgba(99, 102, 241, 0.4)', text: '#818cf8' },  // Indigo
  { bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.22)', glow: 'rgba(236, 72, 153, 0.35)', text: '#f472b6' }, // Pink
  { bg: 'rgba(34, 211, 238, 0.12)', border: 'rgba(34, 211, 238, 0.22)', glow: 'rgba(34, 211, 238, 0.35)', text: '#22d3ee' }, // Cyan
  { bg: 'rgba(251, 146, 60, 0.12)', border: 'rgba(251, 146, 60, 0.22)', glow: 'rgba(251, 146, 60, 0.35)', text: '#fb923c' },  // Orange
  { bg: 'rgba(74, 222, 128, 0.12)', border: 'rgba(74, 222, 128, 0.22)', glow: 'rgba(74, 222, 128, 0.35)', text: '#4ade80' }, // Green
  { bg: 'rgba(167, 139, 250, 0.12)', border: 'rgba(167, 139, 250, 0.22)', glow: 'rgba(167, 139, 250, 0.35)', text: '#a78bfa' }, // Violet
];

// Get consistent accent based on app id
const getAccent = (id: string) => {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return ACCENT_COLORS[hash % ACCENT_COLORS.length];
};

const AppCard: React.FC<AppCardProps> = ({ app, isNew = false, onClick, onLaunch, onContextMenu, onTodoClick }) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  const accent = getAccent(app.id);
  const isImageIcon = app.icon.startsWith('data:image');
  const isOnline = app.isOnline;
  const hasCommand = !!app.command;
  const hasTodo = app.hasTodo && app.todoData;

  // Progress ring calculations for todo
  const progressPercent = app.todoData?.progressPercent || 0;
  const todoColor = app.todoData ? getStatusColor(app.todoData.metadata) : '#22c55e';
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();

    if (isNew) {
      if (onClick) onClick(app);
      return;
    }

    if (hasCommand && onLaunch) {
      setIsLaunching(true);
      setTimeout(() => setIsLaunching(false), 800);
      onLaunch(app);
    } else if (onClick) {
      onClick(app);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onContextMenu) {
      onContextMenu(app, e);
    } else if (onClick) {
      onClick(app);
    }
  };

  const handleTodoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTodoClick) {
      onTodoClick(app);
    }
  };

  if (isNew) {
    return (
      <button
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className="group relative flex flex-col items-center cursor-pointer transition-all duration-500 hover:-translate-y-2"
      >
        {/* Premium glass container */}
        <div className="relative w-32 h-32 mb-4 rounded-[2rem] flex items-center justify-center
          bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] border-dashed
          transition-all duration-500 group-hover:border-white/20 group-hover:bg-white/[0.06]
          shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]">
          <span className="text-4xl text-white/30 group-hover:text-white/60 transition-all font-extralight">+</span>
        </div>
        <span className="text-[11px] font-medium text-white/30 group-hover:text-white/50 uppercase tracking-[0.2em] transition-colors">
          Add
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      className={`group relative flex flex-col items-center cursor-pointer transition-all duration-500 
        hover:-translate-y-3 
        ${isPressed ? 'scale-95 duration-100' : ''}
        ${isLaunching ? '' : ''}`}
    >
      {/* Icon Container - Premium Glass */}
      <div className="relative w-32 h-32 mb-4">
        {/* Todo Progress Ring - SVG overlay */}
        {hasTodo && (
          <svg
            className="absolute inset-[-4px] w-[calc(100%+8px)] h-[calc(100%+8px)] pointer-events-none z-10"
            viewBox="0 0 144 144"
          >
            {/* Background ring */}
            <circle
              cx="72"
              cy="72"
              r={radius}
              fill="transparent"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="4"
              className="transform -rotate-90 origin-center"
            />
            {/* Progress arc */}
            <circle
              cx="72"
              cy="72"
              r={radius}
              fill="transparent"
              stroke={todoColor}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transform -rotate-90 origin-center transition-all duration-700"
              style={{ filter: `drop-shadow(0 0 4px ${todoColor})` }}
            />
          </svg>
        )}

        {/* Todo badge indicator - clickable */}
        {hasTodo && (
          <div
            onClick={handleTodoClick}
            className="absolute -bottom-1 -right-1 z-20 w-7 h-7 rounded-full 
              bg-black/80 backdrop-blur-sm border border-white/10 
              flex items-center justify-center cursor-pointer
              hover:scale-110 hover:border-white/30 transition-all
              shadow-lg"
            title={`${progressPercent}% complete • Click for details`}
          >
            {app.todoData!.blocked.length > 0 ? (
              <span className="text-[10px] text-red-400 font-bold">!</span>
            ) : app.todoData!.inProgress.length > 0 ? (
              <span className="text-[10px] text-blue-400 font-medium">{app.todoData!.inProgress.length}</span>
            ) : (
              <span className="text-[9px] text-white/50 font-medium">{progressPercent}%</span>
            )}
          </div>
        )}

        {/* Ambient glow on hover */}
        <div
          className="absolute inset-[-12px] rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-2xl"
          style={{ background: accent.glow }}
        />

        {/* Active glow when running */}
        {isOnline && (
          <div
            className="absolute inset-[-8px] rounded-3xl opacity-50 blur-xl animate-pulse"
            style={{ background: accent.glow }}
          />
        )}

        {/* Glass card */}
        <div
          className={`relative w-full h-full rounded-[2rem] flex items-center justify-center overflow-hidden
            backdrop-blur-2xl transition-all duration-500
            shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]
            group-hover:shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)]
            ${isOnline && !isImageIcon ? 'ring-1' : ''}`}
          style={{
            background: isImageIcon ? 'transparent' : (isOnline ? accent.bg : 'rgba(255, 255, 255, 0.04)'),
            border: isImageIcon ? 'none' : `1px solid ${isOnline ? accent.border : 'rgba(255, 255, 255, 0.08)'}`
          }}
        >
          {/* Inner highlight (Glass shine) - Only for emojis/default cards */}
          {!isImageIcon && <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent opacity-60" />}

          {/* Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            {isImageIcon ? (
              <img
                src={app.icon}
                alt={app.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-6xl opacity-90 drop-shadow-sm">{app.icon}</span>
            )}
          </div>

          {/* Launch ripple */}
          {isLaunching && (
            <div className="absolute inset-0 rounded-[2rem] animate-ping opacity-30" style={{ background: accent.glow }} />
          )}
        </div>

        {/* Status indicator */}
        {isOnline && (
          <div
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full shadow-lg animate-pulse"
            style={{
              background: accent.text,
              boxShadow: `0 0 12px ${accent.glow}`
            }}
          />
        )}
      </div>

      {/* Label */}
      <span className={`text-[11px] font-medium tracking-wide transition-all duration-300
        ${isOnline ? 'text-white/90' : 'text-white/50 group-hover:text-white/80'}`}>
        {app.name}
      </span>

      {/* Subtle badge - show todo status or port */}
      <span className={`text-[9px] mt-1 tracking-wider transition-all duration-300
        ${isOnline ? '' : 'text-white/20 group-hover:text-white/30'}`}
        style={{ color: isOnline ? accent.text : (hasTodo ? todoColor : undefined) }}>
        {isOnline ? 'ACTIVE' : (hasTodo ? `${app.todoData!.metadata.status.toUpperCase()}` : (app.badge?.split(':').pop() || ''))}
      </span>
    </button>
  );
};

export default AppCard;

