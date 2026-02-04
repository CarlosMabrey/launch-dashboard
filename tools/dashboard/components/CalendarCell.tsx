
import React from 'react';

const CalendarCell: React.FC = () => {
    const now = new Date();
    const dayName = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    const dayNumber = now.getDate();
    const monthName = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();

    const handleClick = () => {
        window.open('https://calendar.google.com', '_blank');
    };

    return (
        <button 
            onClick={handleClick}
            className="group relative flex flex-col items-center transition-all duration-500 hover:-translate-y-3 cursor-pointer outline-none border-none bg-transparent p-0"
        >
            <div className="relative w-32 h-32 mb-4">
                {/* Ambient glow */}
                <div className="absolute inset-[-12px] rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-2xl bg-indigo-500/20" />

                {/* Glass card */}
                <div className="relative w-full h-full rounded-[2rem] flex flex-col items-center justify-center overflow-hidden
                    backdrop-blur-2xl transition-all duration-500 bg-white/[0.04] border border-white/[0.08]
                    shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]
                    group-hover:shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)]">
                    
                    {/* Header of the calendar leaf */}
                    <div className="absolute top-0 inset-x-0 h-8 bg-red-500/80 flex items-center justify-center">
                        <span className="text-[10px] font-bold tracking-[0.2em] text-white/90">{monthName}</span>
                    </div>

                    <div className="mt-4 flex flex-col items-center">
                        <span className="text-4xl font-light text-white/90 leading-none">{dayNumber}</span>
                        <span className="text-[10px] font-medium tracking-[0.2em] text-white/40 mt-1">{dayName}</span>
                    </div>

                    {/* Inner highlight */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent opacity-60 pointer-events-none" />
                </div>
            </div>
            
            <span className="text-[11px] font-medium tracking-wide text-white/50 group-hover:text-white/80 transition-all">
                CALENDAR
            </span>
            <span className="text-[9px] mt-1 tracking-wider text-white/20 uppercase">
                Temporal Flux
            </span>
        </button>
    );
};

export default CalendarCell;
