
import React, { useState, useEffect } from 'react';

interface TitleBarProps {
    onNewApp?: () => void;
}

const TitleBar: React.FC<TitleBarProps> = () => {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        // Check initial maximized state
        const electronAPI = (window as any).electronAPI;
        if (electronAPI?.windowIsMaximized) {
            electronAPI.windowIsMaximized().then(setIsMaximized);
        }

        // Listen for maximize/restore events (optional enhancement)
        // For now, we'll poll or update on button click
    }, []);

    const handleMinimize = () => {
        const electronAPI = (window as any).electronAPI;
        electronAPI?.windowMinimize?.();
    };

    const handleMaximize = async () => {
        const electronAPI = (window as any).electronAPI;
        if (electronAPI?.windowMaximize) {
            const newState = await electronAPI.windowMaximize();
            setIsMaximized(newState);
        }
    };

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
                {/* Minimize Button */}
                <button
                    onClick={handleMinimize}
                    className="group relative w-12 h-9 flex items-center justify-center transition-all duration-300"
                    title="Minimize"
                >
                    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all duration-300" />
                    <svg
                        className="w-3.5 h-3.5 relative z-10 text-white/60 group-hover:text-white transition-colors duration-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                    </svg>
                </button>

                {/* Maximize/Restore Button */}
                <button
                    onClick={handleMaximize}
                    className="group relative w-12 h-9 flex items-center justify-center transition-all duration-300"
                    title={isMaximized ? "Restore" : "Maximize"}
                >
                    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all duration-300" />
                    {isMaximized ? (
                        <svg
                            className="w-3.5 h-3.5 relative z-10 text-white/60 group-hover:text-white transition-colors duration-300"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v3a2 2 0 0 1-2 2H3m3 4-3 3 3 3M5 7h12M5 11h12M5 15h12M17 7h-2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z" />
                        </svg>
                    ) : (
                        <svg
                            className="w-3.5 h-3.5 relative z-10 text-white/60 group-hover:text-white transition-colors duration-300"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5-5-5m5 5v-4m0 4h-4" />
                        </svg>
                    )}
                </button>

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
