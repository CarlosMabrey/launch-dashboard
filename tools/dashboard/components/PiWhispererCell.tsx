import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage } from '../services/piService';

const GLASS = 'bg-white/5 backdrop-blur-xl border border-white/10';
const ACCENT = {
  emerald: 'from-emerald-500/20 to-emerald-600/5',
  blue: 'from-sky-500/20 to-sky-600/5',
  red: 'from-rose-500/20 to-rose-600/5',
  purple: 'from-violet-500/20 to-violet-600/5',
  amber: 'from-amber-500/20 to-amber-600/5',
};

interface PiWhispererProps {
  chatHistory: ChatMessage[];
  onSend: (text: string) => Promise<void>;
  onClear: () => void;
  isLoading: boolean;
}

export default function PiWhispererCell({ chatHistory, onSend, onClear, isLoading }: PiWhispererProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const message = input.trim();
    setInput('');
    await onSend(message);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`${GLASS} rounded-2xl p-5 flex flex-col bg-gradient-to-br ${ACCENT.purple} h-[400px]`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50">Pi Whisperer</h3>
        <div className="flex items-center gap-3">
          <button
            onClick={onClear}
            className="text-[10px] text-white/30 hover:text-white/60 transition-colors uppercase tracking-wide"
            title="Clear chat history"
          >
            Clear
          </button>
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-pulse'}`} />
            <span className={`text-[10px] uppercase tracking-wide ${isLoading ? 'text-amber-400/80' : 'text-emerald-400/80'}`}>
              {isLoading ? 'Thinking...' : 'Live'}
            </span>
          </span>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {chatHistory.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-violet-600/40 border border-violet-500/30 text-white'
                  : msg.isError
                  ? 'bg-rose-900/30 border border-rose-500/30 text-rose-200'
                  : 'bg-white/5 border border-white/10 text-white/80'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>

              {/* Render inline HTML previews (multiple supported) */}
              {(msg.previews && msg.previews.length > 0 ? msg.previews : (msg.previewUrl ? [{ url: msg.previewUrl, code: msg.previewCode }] : [])).map((preview, idx) => (
                <div key={idx} className="mt-3 rounded-xl overflow-hidden border border-white/10 bg-black/40 h-48 relative">
                  <iframe
                    src={preview.url}
                    className="w-full h-full"
                    title="Code Preview"
                    style={{ pointerEvents: 'auto' }}
                  />
                  <div className="absolute top-2 right-2">
                    <button
                      onClick={() => window.open(preview.url, '_blank')}
                      className="bg-violet-500/80 hover:bg-violet-500 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg text-white backdrop-blur-sm transition-colors"
                      title="Open in new tab"
                    >
                      Expand
                    </button>
                  </div>
                </div>
              ))}

              <span className={`text-[9px] mt-1 block ${msg.role === 'user' ? 'text-violet-300/50' : 'text-white/30'}`}>
                {formatTime(msg.time)}
              </span>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-violet-400/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-violet-400/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-violet-400/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2 mt-3 flex-shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isLoading ? 'Pi is thinking...' : 'Whisper to Pi...'}
          disabled={isLoading}
          className="flex-1 bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-5 py-2.5 bg-violet-600/30 hover:bg-violet-600/50 disabled:bg-white/5 disabled:text-white/20 border border-violet-500/30 disabled:border-white/10 rounded-lg text-xs font-medium uppercase tracking-wide text-violet-300 transition-all disabled:cursor-not-allowed"
        >
          {isLoading ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
