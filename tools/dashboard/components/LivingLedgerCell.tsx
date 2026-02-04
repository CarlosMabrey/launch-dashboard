
import React, { useEffect, useState } from 'react';
import { getPiMessages, PiMessage } from '../services/piService';
import { ScrollText } from 'lucide-react';

const LivingLedgerCell: React.FC = () => {
    const [messages, setMessages] = useState<PiMessage[]>([]);

    useEffect(() => {
        const fetchMessages = async () => {
            const msgs = await getPiMessages();
            setMessages(msgs.slice(0, 5)); // Just the latest 5 for the small cell
        };

        fetchMessages();
        const interval = setInterval(fetchMessages, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="group relative flex flex-col items-center transition-all duration-500 hover:-translate-y-3">
            <div className="relative w-32 h-32 mb-4">
                <div className="absolute inset-[-12px] rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-2xl bg-indigo-500/10" />
                
                <div className="relative w-full h-full rounded-[2rem] flex flex-col items-center justify-center overflow-hidden
                    backdrop-blur-2xl transition-all duration-500 bg-white/[0.04] border border-white/[0.08]
                    shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]">
                    
                    <div className="flex flex-col w-full h-full p-3 overflow-hidden">
                        <div className="flex items-center gap-1.5 mb-2 opacity-40">
                            <ScrollText className="w-3 h-3" />
                            <span className="text-[8px] font-bold uppercase tracking-widest">Activity Log</span>
                        </div>
                        
                        <div className="flex flex-col gap-1.5">
                            {messages.length > 0 ? messages.map((msg) => (
                                <div key={msg.id} className="flex gap-2 items-start animate-in fade-in slide-in-from-left-1 duration-500">
                                    <div className={`mt-1 w-1 h-1 rounded-full flex-shrink-0 ${
                                        msg.type === 'success' ? 'bg-emerald-400' : 
                                        msg.type === 'quest' ? 'bg-amber-400' : 
                                        'bg-purple-400'
                                    }`} />
                                    <span className="text-[7px] leading-tight text-white/50 line-clamp-2 italic">
                                        {msg.text}
                                    </span>
                                </div>
                            )) : (
                                <span className="text-[7px] text-white/20 italic mt-4 text-center">Scanning the ether...</span>
                            )}
                        </div>
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-b from-white/[0.05] to-transparent opacity-60 pointer-events-none" />
                </div>
            </div>
            
            <span className="text-[11px] font-medium tracking-wide text-white/50 group-hover:text-white/80 transition-all uppercase">
                Living Ledger
            </span>
            <span className="text-[9px] mt-1 tracking-wider text-indigo-500/40 uppercase">
                Agentic Pulse
            </span>
        </div>
    );
};

export default LivingLedgerCell;
