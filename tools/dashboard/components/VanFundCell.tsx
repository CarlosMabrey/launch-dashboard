
import React, { useEffect, useState } from 'react';
import { getVanFundData, VanFundData } from '../services/piService';
import { Truck } from 'lucide-react';

const VanFundCell: React.FC = () => {
    const [data, setData] = useState<VanFundData | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            const result = await getVanFundData();
            setData(result);
        };
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    if (!data) return null;

    const progress = (data.current / data.target) * 100;

    return (
        <div className="group relative flex flex-col items-center transition-all duration-500 hover:-translate-y-3">
            <div className="relative w-32 h-32 mb-4">
                <div className="absolute inset-[-12px] rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-2xl bg-amber-500/20" />
                
                <div className="relative w-full h-full rounded-[2rem] flex flex-col items-center justify-center overflow-hidden
                    backdrop-blur-2xl transition-all duration-500 bg-white/[0.04] border border-white/[0.08]
                    shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]">
                    
                    <Truck className="w-8 h-8 text-amber-400/80 mb-2" />
                    
                    <div className="flex flex-col items-center">
                        <span className="text-lg font-bold text-white/90">${data.current.toLocaleString()}</span>
                        <div className="w-16 h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                            <div 
                                className="h-full bg-amber-400 transition-all duration-1000" 
                                style={{ width: `${progress}%` }} 
                            />
                        </div>
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent opacity-60 pointer-events-none" />
                </div>
            </div>
            
            <span className="text-[11px] font-medium tracking-wide text-white/50 group-hover:text-white/80 transition-all uppercase">
                Van Fund
            </span>
            <span className="text-[9px] mt-1 tracking-wider text-amber-500/40 uppercase">
                {progress.toFixed(1)}% Freedom
            </span>
        </div>
    );
};

export default VanFundCell;
