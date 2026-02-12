import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { AppItem } from '../types';
import { ChatMessage, AgentType } from '../services/piService';

interface EmbeddedAppSidebarProps {
    apps: AppItem[];
    selectedAppId?: string;
    onSelectApp: (app: AppItem) => void;
    onGoToDashboard: () => void;
    onVisibilityChange?: (width: number) => void;
    // Chat props
    chatHistory: ChatMessage[];
    isChatLoading: boolean;
    selectedAgent: string;
    availableAgents: AgentType[];
    onSendMessage: (text: string) => void;
    onClearChat: () => void;
    onAgentChange: (agentId: string) => void;
}

const SIDEBAR_ICON_W = 56;
const SIDEBAR_CHAT_W = 340;

// ─── App Icon Sub-component ────────────────────────────────────────────────────
const AppIcon: React.FC<{
    app: AppItem;
    index: number;
    isSelected: boolean;
    isHovered: boolean;
    onHover: () => void;
    onLeave: () => void;
    onClick: () => void;
}> = ({ app, index, isSelected, isHovered, onHover, onLeave, onClick }) => (
    <button
        className={`relative w-10 h-10 rounded-xl flex items-center justify-center
            transition-all duration-300 group
            ${isSelected
                ? 'bg-white/15 ring-1 ring-white/20 scale-105'
                : 'bg-white/[0.04] hover:bg-white/[0.12] hover:scale-105'}`}
        onClick={onClick}
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
        style={{ animationDelay: `${index * 50}ms` }}
        title={app.name}
    >
        {/* Keyboard shortcut indicator */}
        {index < 9 && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-black/60 border border-white/10
                text-[7px] font-mono text-white/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {index + 1}
            </span>
        )}

        {/* Icon */}
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm overflow-hidden
            ${app.colorClass || 'bg-gradient-to-br from-white/10 to-white/5'}`}>
            {app.icon?.startsWith('data')
                ? <img src={app.icon} className="w-full h-full object-cover rounded-lg" alt={app.name} />
                : <span className="text-[16px]">{app.icon || '🔮'}</span>
            }
        </div>

        {/* Online indicator */}
        {app.isOnline && (
            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-black/80
                ${isSelected ? 'bg-cyan-400 shadow-[0_0_6px_#22d3ee]' : 'bg-emerald-400 shadow-[0_0_4px_#34d399]'}`} />
        )}
    </button>
);

// ─── Main Sidebar Component ────────────────────────────────────────────────────
const EmbeddedAppSidebar: React.FC<EmbeddedAppSidebarProps> = ({
    apps,
    selectedAppId,
    onSelectApp,
    onGoToDashboard,
    onVisibilityChange,
    chatHistory,
    isChatLoading,
    selectedAgent,
    availableAgents,
    onSendMessage,
    onClearChat,
    onAgentChange,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isChatMode, setIsChatMode] = useState(false);
    const [hoveredAppId, setHoveredAppId] = useState<string | null>(null);
    const [chatInput, setChatInput] = useState('');
    const sidebarRef = useRef<HTMLDivElement>(null);
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<HTMLInputElement>(null);

    // Filter to only show running embedded apps (reflect what is live)
    const embeddedApps = apps.filter(app => app.isEmbedded && app.isOnline);

    // Report effective width to parent (for BrowserView bounds)
    const effectiveWidth = isChatMode ? SIDEBAR_CHAT_W : (isExpanded ? SIDEBAR_ICON_W : 0);
    useEffect(() => {
        onVisibilityChange?.(effectiveWidth);
    }, [effectiveWidth, onVisibilityChange]);

    // Handle mouse enter/leave with debounced hide
    const handleMouseEnter = useCallback(() => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }
        setIsExpanded(true);
    }, []);

    const handleMouseLeave = useCallback(() => {
        // Don't auto-hide when chat is open
        if (isChatMode) return;
        hideTimeoutRef.current = setTimeout(() => {
            setIsExpanded(false);
        }, 300);
    }, [isChatMode]);

    // Toggle chat mode
    const toggleChatMode = useCallback(() => {
        setIsChatMode(prev => {
            const next = !prev;
            if (next) {
                setIsExpanded(true); // Ensure sidebar is visible
                setTimeout(() => chatInputRef.current?.focus(), 200);
            }
            return next;
        });
    }, []);

    // Auto-scroll chat to latest message
    useEffect(() => {
        if (isChatMode) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatHistory, isChatMode]);

    // Send chat message
    const handleSend = useCallback(() => {
        if (!chatInput.trim() || isChatLoading) return;
        onSendMessage(chatInput.trim());
        setChatInput('');
    }, [chatInput, isChatLoading, onSendMessage]);

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

    const currentAgentName = availableAgents.find(a => a.id === selectedAgent)?.name || selectedAgent;

    return (
        <>
            {/* Invisible trigger zone - completely transparent, only for mouse detection */}
            <div
                className={`fixed left-0 top-0 h-full z-[996] w-2
                    ${isExpanded ? 'pointer-events-none' : 'pointer-events-auto'}
                    bg-gradient-to-r from-violet-500/60 via-violet-500/30 to-transparent
                    hover:from-violet-500/80 hover:via-violet-500/50 transition-all duration-300
                    cursor-pointer
                    ${isExpanded ? 'opacity-0' : 'opacity-100'}`}
                onMouseEnter={handleMouseEnter}
                title="Open app menu (or press ESC to close fullscreen)"
            />

            {/* Main Sidebar - slides in from left */}
            <div
                ref={sidebarRef}
                className={`fixed left-0 top-0 h-full z-[999] flex
                    transition-all duration-400 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]
                    ${isExpanded || isChatMode ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}`}
                style={{ width: isChatMode ? SIDEBAR_CHAT_W : SIDEBAR_ICON_W }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {/* Glass background - full sidebar width */}
                <div className="absolute inset-y-0 left-0 right-0 overflow-hidden backdrop-blur-xl border-r border-white/[0.04] shadow-[2px_0_16px_rgba(0,0,0,0.4)]">
                    {/* Animated gradient background */}
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

                {/* ─── Icon strip (always 56px wide, left-aligned) ─────────── */}
                <div className="relative w-14 h-full flex flex-col items-center justify-between py-6 flex-shrink-0">
                    {/* App icons - centered vertically */}
                    <div className="flex-1 flex flex-col items-center justify-center gap-3">
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

                    {/* Pi chat trigger */}
                    <button
                        onClick={toggleChatMode}
                        className={`group relative w-10 h-10 rounded-xl flex items-center justify-center
                            transition-all duration-300 mt-4
                            ${isChatMode
                                ? 'bg-violet-500/25 ring-1 ring-violet-400/40 scale-105'
                                : 'bg-white/[0.04] hover:bg-white/[0.12] hover:scale-105'
                            }`}
                        title="Toggle Pi Chat"
                    >
                        <span className={`text-lg font-bold transition-colors duration-300
                            ${isChatMode ? 'text-violet-300' : 'text-white/50 group-hover:text-white/90'}`}
                        >
                            π
                        </span>
                        {isChatMode && (
                            <span className="absolute inset-0 rounded-xl border border-violet-400/30 animate-ping opacity-30" />
                        )}
                    </button>

                    {/* Dashboard/Close fullscreen button */}
                    <button
                        onClick={onGoToDashboard}
                        className="group relative w-10 h-10 rounded-xl flex items-center justify-center
                            transition-all duration-300 mt-2
                            bg-white/[0.04] hover:bg-rose-500/20 hover:scale-105
                            border border-white/10 hover:border-rose-500/30"
                        title="Return to Dashboard (or press ESC)"
                    >
                        <span className="text-lg text-white/50 group-hover:text-rose-300 transition-colors">
                            <i className="fa fa-door-open" />
                        </span>
                    </button>
                </div>

                {/* ─── Chat panel (only when chat mode is active) ──────────── */}
                {isChatMode && (
                    <div className="relative flex-1 h-full flex flex-col border-l border-white/[0.06] overflow-hidden">
                        {/* Chat header */}
                        <div className="flex items-center justify-between px-3 h-12 flex-shrink-0 border-b border-white/[0.06]"
                            style={{ background: 'linear-gradient(90deg, rgba(139,92,246,0.1) 0%, rgba(99,102,241,0.06) 100%)' }}
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-violet-500/20 border border-violet-400/30 flex items-center justify-center">
                                    <span className="text-violet-300 text-xs font-bold">π</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-semibold text-white/80 tracking-wide">Pi Whisper</span>
                                    <span className="text-[8px] text-white/30 uppercase tracking-widest">{currentAgentName}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${isChatLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                                <button
                                    onClick={toggleChatMode}
                                    className="w-6 h-6 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/10 transition-all ml-1"
                                    title="Close chat"
                                >
                                    <i className="fa fa-times text-[9px]" />
                                </button>
                            </div>
                        </div>

                        {/* Agent selector */}
                        {availableAgents.length > 1 && (
                            <div className="px-3 py-1.5 border-b border-white/[0.04] flex items-center gap-2">
                                <span className="text-[8px] uppercase tracking-widest text-white/25">Agent</span>
                                <select
                                    value={selectedAgent}
                                    onChange={(e) => onAgentChange(e.target.value)}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none focus:border-violet-500/40 capitalize"
                                >
                                    {availableAgents.map(agent => (
                                        <option key={agent.id} value={agent.id} className="bg-slate-900">
                                            {agent.name}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    onClick={onClearChat}
                                    className="text-[8px] text-white/20 hover:text-white/50 transition-colors uppercase tracking-wide px-1.5 py-0.5 rounded hover:bg-white/5"
                                    title="Clear chat"
                                >
                                    Clear
                                </button>
                            </div>
                        )}

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            {chatHistory.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full text-center">
                                    <span className="text-3xl mb-2 opacity-20">π</span>
                                    <p className="text-[10px] text-white/20 max-w-[180px]">
                                        Whisper to Pi from anywhere...
                                    </p>
                                </div>
                            )}

                            {chatHistory.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[90%] rounded-xl px-3 py-1.5 text-[12px] leading-relaxed ${msg.role === 'user'
                                            ? 'bg-violet-600/30 border border-violet-500/25 text-white'
                                            : msg.isError
                                                ? 'bg-rose-900/25 border border-rose-500/25 text-rose-200'
                                                : 'bg-white/[0.04] border border-white/[0.08] text-white/80'
                                            }`}
                                    >
                                        <ReactMarkdown
                                            components={{
                                                p: ({ node, ...props }) => <p className="mb-1 last:mb-0" {...props} />,
                                                code: ({ node, inline, ...props }: any) =>
                                                    inline
                                                        ? <code className="bg-white/10 px-1 py-0.5 rounded text-violet-200 text-[11px]" {...props} />
                                                        : <pre className="bg-black/40 p-2 rounded-lg overflow-x-auto border border-white/10 my-1.5 text-[11px]"><code {...props} /></pre>,
                                                ul: ({ node, ...props }) => <ul className="list-disc ml-4 mb-1 text-[11px]" {...props} />,
                                                ol: ({ node, ...props }) => <ol className="list-decimal ml-4 mb-1 text-[11px]" {...props} />,
                                                li: ({ node, ...props }) => <li className="mb-0.5" {...props} />,
                                                h1: ({ node, ...props }) => <h1 className="text-sm font-bold mb-1" {...props} />,
                                                h2: ({ node, ...props }) => <h2 className="text-xs font-bold mb-1" {...props} />,
                                                h3: ({ node, ...props }) => <h3 className="text-[11px] font-bold mb-0.5" {...props} />,
                                                strong: ({ node, ...props }) => <strong className="font-bold text-white" {...props} />,
                                                em: ({ node, ...props }) => <em className="italic text-white/90" {...props} />,
                                            }}
                                        >
                                            {msg.text}
                                        </ReactMarkdown>

                                        <span className={`text-[7px] mt-0.5 block ${msg.role === 'user' ? 'text-violet-300/40' : 'text-white/15'}`}>
                                            {new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            ))}

                            {/* Loading indicator */}
                            {isChatLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2">
                                        <div className="flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 bg-violet-400/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-1.5 h-1.5 bg-violet-400/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <span className="w-1.5 h-1.5 bg-violet-400/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input bar */}
                        <div className="px-2.5 pb-3 pt-1.5 border-t border-white/[0.04] flex-shrink-0">
                            <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-xl px-2.5 py-1.5">
                                <input
                                    ref={chatInputRef}
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                                    placeholder={isChatLoading ? 'Thinking...' : `Whisper to ${currentAgentName}...`}
                                    disabled={isChatLoading}
                                    className="flex-1 bg-transparent border-none outline-none text-[12px] text-white placeholder-white/15 disabled:opacity-40 min-w-0"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={isChatLoading || !chatInput.trim()}
                                    className="p-1 text-white/25 hover:text-violet-300 disabled:text-white/10 transition-colors disabled:cursor-not-allowed flex-shrink-0"
                                >
                                    {isChatLoading
                                        ? <i className="fa fa-spinner animate-spin text-[10px]" />
                                        : <i className="fa fa-paper-plane text-[10px]" />
                                    }
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Hover tooltip */}
            {hoveredAppId && isExpanded && !isChatMode && (
                (() => {
                    const app = embeddedApps.find(a => a.id === hoveredAppId);
                    if (!app) return null;
                    const iconEl = document.querySelector(`[title="${app.name}"]`);
                    const rect = iconEl?.getBoundingClientRect();
                    if (!rect) return null;

                    return (
                        <div
                            className="fixed z-[1000] pointer-events-none animate-in fade-in slide-in-from-left-2 duration-200"
                            style={{ left: SIDEBAR_ICON_W + 8, top: rect.top + rect.height / 2 - 16 }}
                        >
                            <div className="bg-black/90 backdrop-blur-lg border border-white/10 rounded-xl px-3 py-2 shadow-xl">
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-semibold text-white/90 whitespace-nowrap">{app.name}</span>
                                    <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded-full
                                        ${app.isOnline
                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                            : 'bg-white/5 text-white/30 border border-white/10'}`}>
                                        {app.isOnline ? 'Online' : 'Offline'}
                                    </span>
                                </div>
                                {app.badge && (
                                    <div className="text-[9px] text-white/30 font-mono mt-0.5">:{app.badge}</div>
                                )}
                            </div>
                        </div>
                    );
                })()
            )}
        </>
    );
};

export default EmbeddedAppSidebar;
