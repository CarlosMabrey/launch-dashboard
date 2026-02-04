
import React from 'react';

interface TitleBarProps {
    onNewApp?: () => void;
}

const TitleBar: React.FC<TitleBarProps> = () => {
    const handleClose = () => {
        const electronAPI = (window as any).electronAPI;
        electronAPI?.windowClose?.();
    };

    return (
        <div
            className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-between h-9 px-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent backdrop-blur-md select-none border-b border-white/[0.03]"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            {/* Left side - App branding (subtle) */}
            <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-neonBlue/50 to-neonPink/50 shadow-[0_0_12px_rgba(0,180,255,0.4)] animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] bg-gradient-to-r from-white/40 to-white/10 bg-clip-text text-transparent hidden md:block">
                    JellyLaunch
                </span>
            </div>

            {/* Center - Drag area (invisible) */}
            <div className="flex-1" />

            {/* Right side - Window controls */}
            <div
                className="flex items-center"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
                {/* Close Button - Clean & Precise */}
                <button
                    onClick={handleClose}
                    className="group relative w-12 h-9 flex items-center justify-center transition-all duration-300"
                    title="Close Application"
                >
                    <div className="absolute inset-0 bg-red-500/0 group-hover:bg-red-500/90 transition-all duration-300" />
                    <svg
                        className="w-3 h-3 relative z-10 text-white/30 group-hover:text-white transition-colors duration-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default TitleBar;
