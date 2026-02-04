import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppItem } from '../types';

interface EmbeddedAppSidebarProps {
    apps: AppItem[];
    selectedAppId?: string;
    onSelectApp: (app: AppItem) => void;
    onGoToDashboard: () => void;
    onVisibilityChange?: (isVisible: boolean) => void;
}

const EmbeddedAppSidebar: React.FC<EmbeddedAppSidebarProps> = ({
    apps,
    selectedAppId,
    onSelectApp,
    onGoToDashboard,
    onVisibilityChange
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [hoveredAppId, setHoveredAppId] = useState<string | null>(null);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Filter to only show embedded apps that are currently online
    const embeddedApps = apps.filter(app => app.isEmbedded && app.isOnline);

    useEffect(() => {
        onVisibilityChange?.(isExpanded);
    }, [isExpanded, onVisibilityChange]);

    // Handle mouse enter/leave with debounced hide
    const handleMouseEnter = useCallback(() => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }
        setIsExpanded(true);
    }, []);

    const handleMouseLeave = useCallback(() => {
        hideTimeoutRef.current = setTimeout(() => {
            setIsExpanded(false);
        }, 300);
    }, []);

    // Handle mouse movement near left edge
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const triggerDistance = 8;
            if (e.clientX <= triggerDistance && embeddedApps.length > 0) {
                handleMouseEnter();
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [embeddedApps.length, handleMouseEnter]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }
        };
    }, []);

    return (
        <>
            {/* Invisible trigger zone - completely transparent, only for mouse detection */}
            <div
                className={`fixed left-0 top-0 h-full z-[996] w-[8px]
                    ${isExpanded ? 'pointer-events-none' : 'pointer-events-auto'}`}
                onMouseEnter={handleMouseEnter}
            />

            {/* Main Sidebar - slides in from left */}
            <div
                ref={sidebarRef}
                className={`fixed left-0 top-0 h-full z-[999] flex items-center justify-center
                    transition-all duration-400 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]
                    ${isExpanded ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {/* Glass background - minimal width */}
                <div className="absolute inset-y-0 left-0 w-14 overflow-hidden backdrop-blur-xl border-r border-white/[0.04] shadow-[2px_0_16px_rgba(0,0,0,0.4)]">
                    {/* Animated gradient background - matches AppWindow's trigger zone */}
                    <div
                        className="absolute inset-0 opacity-80"
                        style={{
                            background: `linear-gradient(180deg, 
                                var(--aura-1, #1a0a2e) 0%, 
                                var(--aura-2, #16213e) 25%, 
                                var(--aura-3, #0f3460) 50%, 
                                var(--aura-4, #533483) 75%,
                                var(--aura-1, #1a0a2e) 100%)`,
                            backgroundSize: '100% 200%',
                            animation: 'gradientFlow 8s ease-in-out infinite alternate'
                        }}
                    />
                    {/* Subtle glow overlay */}
                    <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent" />
                </div>

                {/* Sidebar content - only app icons */}
                <div className="relative w-14 h-full flex flex-col items-center justify-center py-6">
                    {/* App icons - centered vertically */}
                    <div className="flex flex-col items-center gap-3">
                        {embeddedApps.map((app, index) => (
                            <AppIcon
                                key={app.id}
                                app={app}
                                index={index}
                                isSelected={selectedAppId === app.id}
                                isHovered={hoveredAppId === app.id}
                                onHover={() => setHoveredAppId(app.id)}
                                onLeave={() => setHoveredAppId(null)}
                                onClick={() => onSelectApp(app)}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Hover tooltip */}
            {hoveredAppId && isExpanded && (
                <AppTooltip
                    app={embeddedApps.find(a => a.id === hoveredAppId)!}
                    index={embeddedApps.findIndex(a => a.id === hoveredAppId)}
                />
            )}
        </>
    );
};

// Individual app icon component
interface AppIconProps {
    app: AppItem;
    index: number;
    isSelected: boolean;
    isHovered: boolean;
    onHover: () => void;
    onLeave: () => void;
    onClick: () => void;
}

const AppIcon: React.FC<AppIconProps> = ({
    app,
    index,
    isSelected,
    isHovered,
    onHover,
    onLeave,
    onClick
}) => {
    return (
        <button
            onClick={onClick}
            onMouseEnter={onHover}
            onMouseLeave={onLeave}
            className={`group relative w-10 h-10 rounded-xl flex items-center justify-center
                transition-all duration-200 ease-out
                ${isSelected
                    ? 'bg-white/15 ring-1 ring-white/30 scale-105'
                    : isHovered
                        ? 'bg-white/10 scale-105'
                        : 'bg-white/[0.04] hover:bg-white/[0.08]'
                }`}
            title={`${app.name} (Ctrl+${index + 1})`}
        >
            {/* App icon */}
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm
                overflow-hidden ${app.colorClass}`}>
                {app.icon.startsWith('data')
                    ? <img src={app.icon} className="w-full h-full object-cover" alt={app.name} />
                    : app.icon}
            </div>

            {/* Online indicator */}
            {app.isOnline && (
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full
                    bg-neonGreen border-2 border-black
                    shadow-[0_0_6px_rgba(0,255,170,0.6)]" />
            )}

            {/* Selection indicator bar */}
            {isSelected && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1
                    w-[3px] h-5 rounded-r-full bg-white/80" />
            )}

            {/* Keyboard shortcut badge on hover */}
            <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full
                bg-white/10 border border-white/20
                flex items-center justify-center
                transition-all duration-200
                ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
                <span className="text-[8px] font-mono font-bold text-white/60">
                    {index + 1}
                </span>
            </div>
        </button>
    );
};

// Tooltip component for hovered apps
interface AppTooltipProps {
    app: AppItem;
    index: number;
}

const AppTooltip: React.FC<AppTooltipProps> = ({ app, index }) => {
    if (!app) return null;

    return (
        <div
            className="fixed left-16 top-1/2 -translate-y-1/2 z-[1000]
                animate-in fade-in slide-in-from-left-2 duration-200"
        >
            <div className="relative bg-black/90 backdrop-blur-xl border border-white/10
                rounded-xl px-4 py-3 shadow-2xl min-w-[160px]">

                {/* Arrow */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full
                    w-0 h-0 border-t-4 border-b-4 border-r-4
                    border-transparent border-r-white/10" />

                {/* Content */}
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base
                        ${app.colorClass}`}>
                        {app.icon.startsWith('data')
                            ? <img src={app.icon} className="w-full h-full object-cover rounded-lg" alt={app.name} />
                            : app.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-white/90 truncate">{app.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[8px] font-bold uppercase tracking-wide
                                ${app.isOnline ? 'text-neonGreen' : 'text-white/30'}`}>
                                {app.isOnline ? 'Online' : 'Offline'}
                            </span>
                            <span className="text-[8px] text-white/20">•</span>
                            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[8px] font-mono text-white/50
                                border border-white/5">
                                Ctrl+{index + 1}
                            </kbd>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmbeddedAppSidebar;
