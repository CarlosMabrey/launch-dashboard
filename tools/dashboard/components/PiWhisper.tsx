import React, { useEffect, useState } from 'react';
import { getPiMessages, PiMessage } from '../services/piService';
import { Sparkles } from 'lucide-react';

const PiWhisper: React.FC = () => {
    const [messages, setMessages] = useState<PiMessage[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        const fetchMessages = async () => {
            const msgs = await getPiMessages();
            if (msgs.length > 0) {
                setMessages(msgs);
            }
        };

        fetchMessages();
        const interval = setInterval(fetchMessages, 10000); // Poll every 10 seconds
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (messages.length <= 1) return;
        
        const cycleInterval = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % messages.length);
        }, 5000);
        
        return () => clearInterval(cycleInterval);
    }, [messages]);

    if (messages.length === 0) return null;

    const currentMsg = messages[currentIndex];

    return (
        <div className="flex flex-col items-center justify-center mt-6 animate-in fade-in slide-in-from-top-2 duration-1000">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-md rounded-full border border-white/10 shadow-lg">
                <Sparkles className="w-3 h-3 text-purple-400 animate-pulse" />
                <span className="text-[11px] font-medium text-white/60 tracking-wide italic">
                    "{currentMsg.text}"
                </span>
            </div>
            <div className="flex gap-1 mt-2">
                {messages.map((_, i) => (
                    <div 
                        key={i} 
                        className={`w-1 h-1 rounded-full transition-all duration-500 ${i === currentIndex ? 'bg-purple-400 w-3' : 'bg-white/10'}`} 
                    />
                ))}
            </div>
        </div>
    );
};

export default PiWhisper;
