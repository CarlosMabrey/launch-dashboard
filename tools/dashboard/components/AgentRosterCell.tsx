import React, { useState, useEffect, useRef } from 'react';
import * as PiService from '../services/piService';

const GLASS = 'bg-white/5 backdrop-blur-xl border border-white/10';
const GLASS_HOVER = 'hover:bg-white/10 hover:border-white/20';

interface AgentType {
  id: string;
  name: string;
  description?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  reasoning?: string | null;
  time: number;
  isError?: boolean;
  previewCode?: string;
  previewUrl?: string;
}

interface AgentRosterProps {
  onBack?: () => void;
}

export default function AgentRosterCell({ onBack }: AgentRosterProps) {
  const [agentTypes, setAgentTypes] = useState<AgentType[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('pi');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [docs, setDocs] = useState('');
  const [isSavingDocs, setIsSavingDocs] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch available agent types on mount
  useEffect(() => {
    console.log('[AgentRoster] Mounted, fetching agent types...');
    PiService.getAgentTypes()
      .then(data => {
        console.log('[AgentRoster] Agent types data:', data);
        setAgentTypes(data);
        if (data.length > 0 && !data.find(a => a.id === selectedAgentId)) {
          setSelectedAgentId(data[0].id);
        }
      })
      .catch(err => {
        console.error('[AgentRoster] Failed to fetch agent types:', err);
        // Fallback agents if endpoint fails
        const fallback = [
          { id: 'pi', name: 'Pi (Main Agent)', description: 'The primary assistant' },
          { id: 'coding', name: 'Coding Specialist', description: 'Dev tasks' },
          { id: 'research', name: 'Research Agent', description: 'Web search' }
        ];
        setAgentTypes(fallback);
        if (!fallback.find(a => a.id === selectedAgentId)) {
          setSelectedAgentId(fallback[0].id);
        }
      });
  }, []);

  // Load chat history when selected agent changes
  useEffect(() => {
    if (!selectedAgentId) return;
    PiService.getChatHistory(selectedAgentId)
      .then(data => setChatHistory(data))
      .catch(err => console.error('Failed to fetch chat history:', err));
  }, [selectedAgentId]);

  // Load docs from localStorage when agent changes
  useEffect(() => {
    const savedDocs = localStorage.getItem(`agent-docs-${selectedAgentId}`);
    setDocs(savedDocs || '');
  }, [selectedAgentId]);

  // Save docs to localStorage (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(`agent-docs-${selectedAgentId}`, docs);
    }, 500);
    return () => clearTimeout(timer);
  }, [docs, selectedAgentId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const message = input.trim();
    setInput('');

    // Optimistically add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: message,
      time: Date.now()
    };
    setChatHistory(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const data = await PiService.sendChatMessage(message, selectedAgentId);
      if (data.success) {
        setChatHistory(data.history || [...chatHistory, userMsg, data.piResponse!]);
      } else {
        // Show error message
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          text: data.error || 'Failed to get response',
          time: Date.now(),
          isError: true
        };
        setChatHistory(prev => [...prev, errorMsg]);
      }
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        text: 'Network error contacting agent.',
        time: Date.now(),
        isError: true
      };
      setChatHistory(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleClearChat = async () => {
    if (!confirm('Clear chat history for this agent?')) return;
    try {
      const data = await PiService.clearChatHistory(selectedAgentId);
      setChatHistory(data);
    } catch (err) {
      console.error('Failed to clear chat:', err);
    }
  };

  const currentAgent = agentTypes.find(a => a.id === selectedAgentId) || { id: selectedAgentId, name: selectedAgentId };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      {/* TOP PANE: Agent Selection & Docs */}
      <div className="flex-shrink-0 flex gap-4">
        {/* Agent Roster (Left) */}
        <div className={`${GLASS} rounded-xl p-4 w-80 flex flex-col`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50">Agent Roster</h3>
            {onBack && (
              <button onClick={onBack} className="text-[10px] text-white/30 hover:text-white uppercase tracking-wide">
                Back
              </button>
            )}
          </div>
          <div className="space-y-2 overflow-y-auto max-h-40 flex-1">
            {agentTypes.length === 0 ? (
              <div className="text-xs text-white/40 italic p-2">No agents available</div>
            ) : (
              agentTypes.map(agent => (
                <div
                  key={agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedAgentId === agent.id
                      ? 'bg-indigo-500/20 border-indigo-500/40'
                      : 'bg-white/5 border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="font-bold text-sm text-white capitalize">{agent.name}</div>
                  <div className="text-[10px] text-white/50 mt-0.5">{agent.description}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Agent Docs (Right) */}
        <div className={`${GLASS} rounded-xl p-4 flex-1 flex flex-col`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50">
              Agent Notes: {currentAgent.name}
            </h3>
            {isSavingDocs && <span className="text-[10px] text-amber-400">Saving...</span>}
          </div>
          <textarea
            value={docs}
            onChange={e => setDocs(e.target.value)}
            placeholder="Add notes, context, or persistent docs for this agent. These are local to your browser."
            className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 resize-none font-mono"
          />
        </div>
      </div>

      {/* BOTTOM PANE: Chat */}
      <div className={`${GLASS} rounded-xl flex-1 flex flex-col min-h-0`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {currentAgent.name} Chat
            </h3>
            <p className="text-[10px] text-white/40">Session isolated per agent</p>
          </div>
          <button
            onClick={handleClearChat}
            className="text-[10px] px-3 py-1.5 bg-white/5 border border-white/10 rounded text-white/40 hover:text-white transition-colors uppercase tracking-wide"
          >
            Clear Session
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {chatHistory.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  msg.role === 'user'
                    ? 'bg-indigo-600/40 border border-indigo-500/30 text-white'
                    : msg.isError
                    ? 'bg-rose-900/30 border border-rose-500/30 text-rose-200'
                    : 'bg-white/5 border border-white/10 text-white/80'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                {msg.previewUrl && (
                  <div className="mt-3 rounded-xl overflow-hidden border border-white/10 bg-black/40 h-40 relative">
                    <iframe src={msg.previewUrl} className="w-full h-full" title="Preview" />
                  </div>
                )}
                <span className={`text-[9px] mt-1 block ${msg.role === 'user' ? 'text-indigo-300/50' : 'text-white/30'}`}>
                  {formatTime(msg.time)}
                </span>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-indigo-400/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-indigo-400/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-indigo-400/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="flex gap-2 p-4 border-t border-white/10 flex-shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={isLoading ? 'Agent is thinking...' : `Message ${currentAgent.name}...`}
            disabled={isLoading}
            className="flex-1 bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-5 py-2.5 bg-indigo-600/30 hover:bg-indigo-600/50 disabled:bg-white/5 disabled:text-white/20 border border-indigo-500/30 disabled:border-white/10 rounded-lg text-xs font-medium uppercase tracking-wide text-indigo-300 transition-all"
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}
