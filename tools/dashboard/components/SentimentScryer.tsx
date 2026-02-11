import React, { useEffect, useState } from 'react';
import { getMarketWeather, MarketWeather } from '../services/piService';
import { Cloud, Sun, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const SentimentScryer: React.FC = () => {
    const [weather, setWeather] = useState<MarketWeather | null>(null);

    useEffect(() => {
        const fetchWeather = async () => {
            const data = await getMarketWeather();
            setWeather(data);
        };

        fetchWeather();
        const interval = setInterval(fetchWeather, 60000); // Check every minute
        return () => clearInterval(interval);
    }, []);

    if (!weather) return null;

    const getIcon = () => {
        switch (weather.trend) {
            case 'bullish': return <TrendingUp className="w-4 h-4 text-green-400" />;
            case 'bearish': return <TrendingDown className="w-4 h-4 text-red-400" />;
            case 'chaotic': return <Zap className="w-4 h-4 text-yellow-400 animate-pulse" />;
            default: return <Minus className="w-4 h-4 text-blue-400" />;
        }
    };

    return (
        <div className="absolute top-8 right-8 flex items-center gap-4 px-5 py-3 bg-[#0a0a1a]/60 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-right-4 duration-1000 group">
            <div className="flex flex-col items-end">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-purple-400 mb-1">Market Weather</span>
                <span className="text-[12px] font-medium text-white/90 max-w-[220px] text-right leading-relaxed italic">
                    "{weather.vibe}"
                </span>
            </div>
            <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 group-hover:border-purple-500/50 transition-colors shadow-inner">
                {getIcon()}
            </div>
        </div>
    );
};


export default SentimentScryer;
