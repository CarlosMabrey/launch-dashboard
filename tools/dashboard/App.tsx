import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { AppItem, TodoData, Status } from './types';
import { INITIAL_APPS } from './constants';
import { startService, stopService, openInAntigravity } from './services/processService';
import { getAllTodos } from './services/todoService';
import {
  getPiMessages, sendPiMessage, getMarketWeather, getVanFundData, getGithubActivity,
  getChatHistory, sendChatMessage, clearChatHistory, getCalendarData,
  createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, getGrimoire,
  PiMessage, ChatMessage, MarketWeather, VanFundData, GithubActivity, CalendarEvent
} from './services/piService';
import AppWindow from './components/AppWindow';
import EmbeddedAppSidebar from './components/EmbeddedAppSidebar';
import AuraSettings from './components/AuraSettings';
import LiquidBackground from './components/LiquidBackground';

// ════════════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ════════════════════════════════════════════════════════════════════════════════
const GLASS = 'bg-white/5 backdrop-blur-xl border border-white/10';
const GLASS_HOVER = 'hover:bg-white/10 hover:border-white/20';
const ACCENT = {
  emerald: 'from-emerald-500/20 to-emerald-600/5',
  blue: 'from-sky-500/20 to-sky-600/5',
  red: 'from-rose-500/20 to-rose-600/5',
  purple: 'from-violet-500/20 to-violet-600/5',
  amber: 'from-amber-500/20 to-amber-600/5',
};

// ════════════════════════════════════════════════════════════════════════════════
// UTILITY HOOKS
// ════════════════════════════════════════════════════════════════════════════════
function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);
  useEffect(() => { savedCallback.current = callback; }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : initial;
    } catch { return initial; }
  });
  const setStored = useCallback((v: T | ((prev: T) => T)) => {
    setValue(prev => {
      const next = typeof v === 'function' ? (v as (prev: T) => T)(prev) : v;
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }, [key]);
  return [value, setStored];
}

// ────────────────────────────────────────────────────────────────────────────────
// Background Mode (CSS Aura ↔ Liquid)
// Reads localStorage + listens for AuraSettings change events
// ────────────────────────────────────────────────────────────────────────────────
function BackgroundMode() {
  const [mode, setMode] = useState<'css' | 'liquid'>(() => {
    const stored = localStorage.getItem('launch_bg_mode_v1');
    return stored === 'liquid' ? 'liquid' : 'css';
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      const next = ce.detail === 'liquid' ? 'liquid' : 'css';
      setMode(next);
    };
    window.addEventListener('launch:bgMode', handler as EventListener);
    return () => window.removeEventListener('launch:bgMode', handler as EventListener);
  }, []);

  if (mode === 'liquid') {
    return (
      <>
        <div className="aura-container" style={{ opacity: 0 }}>
          <div className="aura-layer animate-subtle-drift" />
          <div className="aura-layer-secondary" />
          <div className="aura-noise" />
          <div className="aura-vignette" />
        </div>
        <LiquidBackground enabled={true} />
      </>
    );
  }

  return (
    <>
      <LiquidBackground enabled={false} />
      <div className="aura-container">
        <div className="aura-layer animate-subtle-drift" />
        <div className="aura-layer-secondary" />
        <div className="aura-noise" />
        <div className="aura-vignette" />
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// CELL COMPONENTS (INLINE)
// ════════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// App Grimoire Cell (Agentic Discovery)
// ─────────────────────────────────────────────────────────────────────────────────
interface AppGrimoireProps {
  apps: AppItem[];
  onLaunch: (app: AppItem) => void;
  onContextMenu: (app: AppItem, e: React.MouseEvent) => void;
}
function AppGrimoireCell({ apps, onLaunch, onContextMenu }: AppGrimoireProps) {
  return (
    <div className={`${GLASS} rounded-2xl p-6 bg-gradient-to-br from-indigo-500/10 to-purple-600/5`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50">App Grimoire</h3>
          <p className="text-[10px] text-white/30 mt-1">Manifested from the D:\Pi aether</p>
        </div>
        <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
          <span className="text-[10px] font-mono text-indigo-300">{apps.length} ARTIFACTS</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {apps.map((app) => (
          <AppCard
            key={app.id}
            app={app}
            onLaunch={() => onLaunch(app)}
            onContext={(e) => onContextMenu(app, e)}
          />
        ))}
        
        {/* Magic Add Slot */}
        <div className="border-2 border-dashed border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center hover:border-white/20 hover:bg-white/[0.02] transition-all cursor-pointer group">
          <div className="text-2xl text-white/20 group-hover:text-white/40 group-hover:scale-110 transition-all">+</div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-white/10 group-hover:text-white/30 mt-2">New Ritual</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// Pi Whisperer Cell (Full Chat Interface)
// ─────────────────────────────────────────────────────────────────────────────────
interface PiWhispererProps {
  chatHistory: ChatMessage[];
  onSend: (text: string) => Promise<void>;
  onClear: () => void;
  isLoading: boolean;
}
function PiWhispererCell({ chatHistory, onSend, onClear, isLoading }: PiWhispererProps) {
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
              
              {/* Astral Preview (Aetheric Mockups) */}
              {msg.previewUrl && (
                <div className="mt-3 rounded-xl overflow-hidden border border-white/10 bg-black/40 h-48 relative group/preview">
                  <iframe 
                    src={msg.previewUrl} 
                    className="w-full h-full pointer-events-none" 
                    title="Code Preview"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-end p-2">
                    <button 
                      onClick={() => window.open(msg.previewUrl, '_blank')}
                      className="bg-violet-500/80 hover:bg-violet-500 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg text-white backdrop-blur-sm pointer-events-auto"
                    >
                      Summon Full View
                    </button>
                  </div>
                </div>
              )}

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

// ─────────────────────────────────────────────────────────────────────────────────
// Temporal Flux Cell (Calendar)
// ─────────────────────────────────────────────────────────────────────────────────
interface TemporalFluxProps {
  events: CalendarEvent[];
  onRefresh: () => Promise<void>;
}
function TemporalFluxCell({ events, onRefresh }: TemporalFluxProps) {
  const now = new Date();
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [summary, setSummary] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  const firstDay = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), 1).getDay();
  const daysInMonth = new Date(selectedDay.getFullYear(), selectedDay.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: 42 }, (_, i) => {
    const day = i - firstDay + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });

  const filteredEvents = useMemo(() => {
    const dayStr = selectedDay.toISOString().split('T')[0];
    return events.filter(event => {
      const eventDate = (event.start.dateTime || event.start.date)?.split('T')[0];
      return eventDate === dayStr;
    });
  }, [events, selectedDay]);

  const formatEventTime = (event: CalendarEvent) => {
    if (event.start.date) return 'All Day';
    if (event.start.dateTime) {
      const start = new Date(event.start.dateTime);
      const end = event.end?.dateTime ? new Date(event.end.dateTime) : null;
      const timeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (end) {
        const endTimeStr = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${timeStr} — ${endTimeStr}`;
      }
      return timeStr;
    }
    return '';
  };

  const resetForm = () => {
    setSummary('');
    const dateStr = selectedDay.toISOString().split('T')[0];
    setStartDate(dateStr);
    setStartTime('09:00');
    setEndDate(dateStr);
    setEndTime('10:00');
    setLocation('');
    setDescription('');
  };

  const handleEdit = (event: CalendarEvent) => {
    setSummary(event.summary);
    if (event.start.dateTime || event.start.date) {
      const start = new Date(event.start.dateTime || event.start.date!);
      setStartDate(start.toISOString().split('T')[0]);
      if (event.start.dateTime) setStartTime(start.toTimeString().split(' ')[0].substring(0, 5));
    }
    if (event.end?.dateTime || event.end?.date) {
      const end = new Date(event.end.dateTime || event.end.date!);
      setEndDate(end.toISOString().split('T')[0]);
      if (event.end.dateTime) setEndTime(end.toTimeString().split(' ')[0].substring(0, 5));
    }
    setLocation(event.location || '');
    setDescription(event.description || '');
    setIsEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Construct ISO strings. Handle all-day if needed later, but for now assuming time.
    const startDateTime = new Date(`${startDate}T${startTime}:00`).toISOString();
    const endDateTime = new Date(`${endDate}T${endTime}:00`).toISOString();
    
    const eventBody = {
      summary,
      start: { dateTime: startDateTime },
      end: { dateTime: endDateTime },
      location,
      description
    };

    let success = false;
    if (isEditing && selectedEvent) {
      success = await updateCalendarEvent(selectedEvent.id, eventBody);
    } else {
      success = await createCalendarEvent(eventBody);
    }

    if (success) {
      await onRefresh();
      setIsEditing(false);
      setIsAdding(false);
      setSelectedEvent(null);
      resetForm();
    }
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;
    if (!window.confirm('Vanish this disturbance from the timeline?')) return;
    
    setIsSubmitting(true);
    const success = await deleteCalendarEvent(selectedEvent.id);
    if (success) {
      await onRefresh();
      setSelectedEvent(null);
    }
    setIsSubmitting(false);
  };

  const handleOpenCalendar = () => {
    window.open('https://calendar.google.com', '_blank');
  };

  const handleDayClick = (day: number) => {
    const next = new Date(selectedDay);
    next.setDate(day);
    setSelectedDay(next);
  };

  const isToday = (day: number) => {
    return day === now.getDate() && selectedDay.getMonth() === now.getMonth() && selectedDay.getFullYear() === now.getFullYear();
  };

  const isSelected = (day: number) => {
    return day === selectedDay.getDate();
  };

  return (
    <div className={`${GLASS} rounded-2xl p-5 bg-gradient-to-br ${ACCENT.red} flex flex-col gap-4 overflow-hidden relative group/cal`}>
      {/* Event Details/Edit Overlay */}
      {selectedEvent && !isEditing && (
        <div className="absolute inset-0 z-40 bg-[#0c0c0c]/95 backdrop-blur-md p-5 animate-in fade-in zoom-in duration-300 flex flex-col">
          <button 
            onClick={() => setSelectedEvent(null)}
            className="absolute top-3 right-4 text-white/30 hover:text-white transition-colors"
          >
            ✕
          </button>
          <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-rose-400 mb-2">Event Scrying</div>
          <h4 className="text-sm font-bold text-white mb-1">{selectedEvent.summary}</h4>
          <p className="text-[10px] text-white/50 mb-4">{formatEventTime(selectedEvent)}</p>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-white/10">
            {selectedEvent.location && (
              <div className="space-y-1">
                <div className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Location</div>
                <div className="text-[10px] text-white/70">{selectedEvent.location}</div>
              </div>
            )}
            {selectedEvent.description && (
              <div className="space-y-1">
                <div className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Description</div>
                <div className="text-[10px] text-white/60 italic leading-relaxed">{selectedEvent.description}</div>
              </div>
            )}
          </div>
          
          <div className="flex gap-2 mt-4">
            <button 
              onClick={() => handleEdit(selectedEvent)}
              className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[9px] font-bold uppercase tracking-widest text-white/60 transition-all"
            >
              Modify
            </button>
            <button 
              onClick={handleDelete}
              disabled={isSubmitting}
              className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg text-[9px] font-bold uppercase tracking-widest text-rose-400 transition-all disabled:opacity-30"
            >
              Vanish
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Form Overlay */}
      {(isAdding || isEditing) && (
        <form onSubmit={handleSubmit} className="absolute inset-0 z-[100] bg-[#0c0c0c] p-5 animate-in slide-in-from-bottom-2 duration-300 flex flex-col gap-4">
          <div className="flex items-center justify-between shrink-0">
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-rose-400">
              {isEditing ? 'Temporal Revision' : 'Timeline Manifestation'}
            </div>
            <button 
              type="button"
              onClick={() => { setIsAdding(false); setIsEditing(false); }}
              className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-white/20 hover:text-white hover:bg-white/10 transition-all"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
            <div className="space-y-1">
              <label className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Summary</label>
              <input 
                required
                value={summary}
                onChange={e => setSummary(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-rose-500/50 focus:bg-white/[0.08] transition-all"
                placeholder="What occurs?"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Start Date</label>
                <input 
                  type="date"
                  required
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white outline-none focus:border-rose-500/30"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Start Time</label>
                <input 
                  type="time"
                  required
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white outline-none focus:border-rose-500/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[8px] font-bold text-white/30 uppercase tracking-widest">End Date</label>
                <input 
                  type="date"
                  required
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white outline-none focus:border-rose-500/30"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-bold text-white/30 uppercase tracking-widest">End Time</label>
                <input 
                  type="time"
                  required
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white outline-none focus:border-rose-500/30"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Location</label>
              <input 
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white outline-none focus:border-rose-500/30"
                placeholder="Where?"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Description</label>
              <textarea 
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white outline-none h-20 resize-none focus:border-rose-500/30"
                placeholder="Details..."
              />
            </div>
          </div>

          <div className="pt-2 shrink-0">
            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-rose-600/40 hover:bg-rose-600/60 border border-rose-500/30 rounded-xl text-xs font-bold uppercase tracking-widest text-rose-100 shadow-lg shadow-rose-900/20 transition-all disabled:opacity-30 active:scale-[0.98]"
            >
              {isSubmitting ? 'Manifesting...' : (isEditing ? 'Seal Revision' : 'Manifest Event')}
            </button>
          </div>
        </form>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50">Temporal Flux</h3>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => { resetForm(); setIsAdding(true); }}
            className="text-rose-400 hover:text-white transition-colors"
            title="Add Event"
          >
            <span className="text-lg">+</span>
          </button>
          <button 
            onClick={handleOpenCalendar}
            className="text-rose-400 text-xs font-mono hover:text-white transition-colors"
          >
            {selectedDay.toLocaleDateString()}
          </button>
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-5xl font-bold text-white tracking-tight">{selectedDay.getDate()}</span>
        <div className="flex flex-col">
          <span className="text-lg font-medium text-rose-400">{dayNames[selectedDay.getDay()]}</span>
          <span className="text-xs text-white/40">{monthNames[selectedDay.getMonth()]} {selectedDay.getFullYear()}</span>
        </div>
      </div>

      {/* Mini Calendar Grid */}
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {dayNames.map(d => (
          <div key={d} className="text-[9px] text-white/30 py-1">{d[0]}</div>
        ))}
        {days.map((day, i) => (
          <div
            key={i}
            onClick={() => day && handleDayClick(day)}
            className={`text-[10px] py-1 rounded transition-all cursor-pointer ${
              day 
                ? isSelected(day)
                  ? 'bg-rose-500 text-white font-bold shadow-[0_0_10px_rgba(244,63,94,0.4)]'
                  : isToday(day)
                    ? 'bg-rose-500/20 text-rose-300 font-bold'
                    : 'text-white/50 hover:bg-white/5'
                : ''
            }`}
          >
            {day || ''}
          </div>
        ))}
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto space-y-2 mt-2 scrollbar-none">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-[9px] font-bold uppercase tracking-widest text-white/30">Upcoming Disturbances</h4>
          <button onClick={onRefresh} className="text-[8px] text-white/20 hover:text-white">Refresh</button>
        </div>
        {filteredEvents.length === 0 ? (
          <div className="text-[10px] text-white/20 italic">No aetheric disturbances detected.</div>
        ) : (
          filteredEvents.slice(0, 4).map(event => (
            <div 
              key={event.id} 
              onClick={() => setSelectedEvent(event)}
              className="bg-white/5 rounded-lg p-2 border border-white/5 hover:bg-white/10 hover:border-rose-500/20 transition-all cursor-pointer group/item"
            >
              <div className="text-[10px] font-medium text-white/80 group-hover/item:text-rose-300 truncate transition-colors">{event.summary}</div>
              <div className="text-[8px] text-white/30 mt-0.5">{formatEventTime(event)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// Sentiment Scryer Cell (Market Weather)
// ─────────────────────────────────────────────────────────────────────────────────
interface SentimentScryerProps {
  weather: MarketWeather;
}
function SentimentScryerCell({ weather }: SentimentScryerProps) {
  const trendEmoji: Record<string, string> = {
    bullish: '📈', bearish: '📉', neutral: '➖', chaotic: '🌀'
  };
  const trendColor: Record<string, string> = {
    bullish: 'text-emerald-400', bearish: 'text-rose-400', neutral: 'text-white/60', chaotic: 'text-amber-400'
  };

  const lastUpdated = new Date(weather.lastUpdated);
  const timeAgo = Math.floor((Date.now() - weather.lastUpdated) / 60000);

  return (
    <div className={`${GLASS} rounded-2xl p-5 bg-gradient-to-br ${ACCENT.amber}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50">Sentiment Scryer</h3>
        <span className="text-[10px] text-white/30">{timeAgo < 60 ? `${timeAgo}m ago` : 'Stale'}</span>
      </div>
      
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{trendEmoji[weather.trend] || '🔮'}</span>
        <span className={`text-lg font-semibold uppercase tracking-wide ${trendColor[weather.trend]}`}>
          {weather.trend}
        </span>
      </div>
      
      <p className="text-sm text-white/60 leading-relaxed">{weather.vibe}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// Van Fund Cell
// ─────────────────────────────────────────────────────────────────────────────────
interface VanFundProps {
  data: VanFundData;
}
function VanFundCell({ data }: VanFundProps) {
  const percent = Math.min((data.current / data.target) * 100, 100);
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className={`${GLASS} rounded-2xl p-5 bg-gradient-to-br ${ACCENT.emerald}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50">Van Fund</h3>
        <span className="text-emerald-400 text-xs font-mono">${data.target.toLocaleString()}</span>
      </div>
      
      <div className="flex items-center gap-5">
        <div className="relative w-24 h-24">
          <svg className="w-full h-full -rotate-90">
            <circle cx="48" cy="48" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
            <circle
              cx="48" cy="48" r="45" fill="none"
              stroke="url(#vanGradient)" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000"
            />
            <defs>
              <linearGradient id="vanGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-white">{percent.toFixed(1)}%</span>
            <span className="text-[9px] text-white/40 uppercase tracking-wide">Goal</span>
          </div>
        </div>
        
        <div className="flex-1">
          <div className="text-2xl font-bold text-emerald-400">${data.current.toLocaleString()}</div>
          <div className="text-xs text-white/40 mt-1">
            ${(data.target - data.current).toLocaleString()} remaining
          </div>
          <div className="text-[10px] text-white/30 mt-2">🚐 The Dream Awaits</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// Active Pulse Cell (GitHub Heatmap)
// ─────────────────────────────────────────────────────────────────────────────────
interface ActivePulseProps {
  activity: GithubActivity;
}
function ActivePulseCell({ activity }: ActivePulseProps) {
  // Generate last 7 weeks of data
  const weeks = useMemo(() => {
    const result: number[][] = [];
    const today = new Date();
    for (let w = 6; w >= 0; w--) {
      const week: number[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() - (w * 7 + (6 - d)));
        const key = date.toISOString().split('T')[0];
        week.push(activity.dailyHistory[key] || 0);
      }
      result.push(week);
    }
    return result;
  }, [activity.dailyHistory]);

  const getColor = (count: number) => {
    if (count === 0) return 'bg-white/5';
    if (count <= 2) return 'bg-emerald-900/60';
    if (count <= 4) return 'bg-emerald-700/70';
    if (count <= 6) return 'bg-emerald-500/80';
    return 'bg-emerald-400';
  };

  return (
    <div className={`${GLASS} rounded-2xl p-5 bg-gradient-to-br ${ACCENT.blue}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50">Active Pulse</h3>
        <span className="text-sky-400 text-sm font-bold">{activity.totalContributions}</span>
      </div>
      
      <div className="flex gap-1 justify-center">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((count, di) => (
              <div
                key={di}
                className={`w-3 h-3 rounded-sm ${getColor(count)} transition-colors`}
                title={`${count} contributions`}
              />
            ))}
          </div>
        ))}
      </div>
      
      <div className="flex items-center justify-center gap-2 mt-3 text-[10px] text-white/30">
        <span>Less</span>
        {[0, 2, 4, 6, 8].map(n => (
          <div key={n} className={`w-2.5 h-2.5 rounded-sm ${getColor(n)}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// App Card (for Grimoire)
// ─────────────────────────────────────────────────────────────────────────────────
interface AppCardProps {
  app: AppItem;
  onLaunch: () => void;
  onContext: (e: React.MouseEvent) => void;
}
function AppCard({ app, onLaunch, onContext }: AppCardProps) {
  const progress = app.todoData?.progressPercent || 0;

  return (
    <div
      onClick={onLaunch}
      onContextMenu={onContext}
      className={`
        ${GLASS} ${GLASS_HOVER} rounded-2xl p-4 cursor-pointer
        transition-all duration-300 group relative overflow-hidden
        hover:scale-[1.02] hover:shadow-lg hover:shadow-white/5
      `}
    >
      {/* Status indicator */}
      <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${app.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'}`} />
      
      {/* Icon */}
      <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">{app.icon}</div>
      
      {/* Name & Badge */}
      <h4 className="text-sm font-semibold text-white truncate">{app.name}</h4>
      <p className="text-[10px] text-white/40 uppercase tracking-wide truncate">{app.badge}</p>
      
      {/* Todo Progress Bar */}
      {app.hasTodo && (
        <div className="mt-3">
          <div className="flex justify-between text-[9px] text-white/40 mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// Global Search (Command Palette)
// ─────────────────────────────────────────────────────────────────────────────────
interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  apps: AppItem[];
  onSelectApp: (app: AppItem) => void;
}
function CommandPalette({ isOpen, onClose, apps, onSelectApp }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!query.trim()) return apps.slice(0, 8);
    const q = query.toLowerCase();
    return apps.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.badge?.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [apps, query]);

  const handleSelect = (app: AppItem) => {
    onSelectApp(app);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className={`${GLASS} rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
          <span className="text-white/40">⌘</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search apps, commands..."
            className="flex-1 bg-transparent text-white placeholder-white/30 focus:outline-none text-lg"
          />
          <kbd className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded">ESC</kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-white/30 text-sm">No results found</div>
          ) : (
            filtered.map((app, i) => (
              <button
                key={app.id}
                onClick={() => handleSelect(app)}
                className="w-full flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors text-left"
              >
                <span className="text-2xl">{app.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{app.name}</div>
                  <div className="text-xs text-white/40 truncate">{app.badge}</div>
                </div>
                <div className="flex items-center gap-2">
                  {app.isOnline && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
                  <kbd className="text-[10px] text-white/20 bg-white/5 px-1.5 py-0.5 rounded">{i + 1}</kbd>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// Context Menu
// ─────────────────────────────────────────────────────────────────────────────────
interface ContextMenuProps {
  x: number;
  y: number;
  app: AppItem;
  onClose: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAntigravity: () => void;
}
function ContextMenu({ x, y, app, onClose, onToggle, onEdit, onDelete, onAntigravity }: ContextMenuProps) {
  useEffect(() => {
    const handleClick = () => onClose();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [onClose]);

  return (
    <div
      className={`${GLASS} fixed z-[100] rounded-xl py-2 min-w-[180px] shadow-2xl`}
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-4 py-2 border-b border-white/5 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">{app.name}</span>
      </div>
      
      <button onClick={onToggle} className="w-full px-4 py-2.5 text-left text-sm text-white/80 hover:bg-white/10 flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full ${app.isOnline ? 'bg-rose-400' : 'bg-emerald-400'}`} />
        {app.isOnline ? 'Stop Service' : 'Start Service'}
      </button>
      
      {app.directory && (
        <button onClick={onAntigravity} className="w-full px-4 py-2.5 text-left text-sm text-white/80 hover:bg-white/10 flex items-center gap-3">
          <span className="text-white/40">🌌</span>
          Open in Antigravity
        </button>
      )}
      
      <button onClick={onEdit} className="w-full px-4 py-2.5 text-left text-sm text-white/80 hover:bg-white/10 flex items-center gap-3">
        <span className="text-white/40">✏️</span>
        Edit Configuration
      </button>
      
      <div className="border-t border-white/5 mt-1 pt-1">
        <button onClick={onDelete} className="w-full px-4 py-2.5 text-left text-sm text-rose-400/80 hover:bg-rose-500/10 flex items-center gap-3">
          <span>🗑️</span>
          Delete App
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// Title Bar (Electron)
// ─────────────────────────────────────────────────────────────────────────────────
function TitleBar() {
  const electronAPI = (window as any).electronAPI;
  if (!electronAPI) return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-8 flex items-center justify-between px-4 z-50 select-none" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <span className="text-[10px] text-white/30 font-medium tracking-widest">LAUNCH</span>
      <div className="flex gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button onClick={() => electronAPI.minimizeWindow?.()} className="w-6 h-6 rounded hover:bg-white/10 text-white/40 hover:text-white text-xs">─</button>
        <button onClick={() => electronAPI.maximizeWindow?.()} className="w-6 h-6 rounded hover:bg-white/10 text-white/40 hover:text-white text-xs">□</button>
        <button onClick={() => electronAPI.closeWindow?.()} className="w-6 h-6 rounded hover:bg-rose-500/20 text-white/40 hover:text-rose-400 text-xs">✕</button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════════════════════
const App: React.FC = () => {
  // ─── State ─────────────────────────────────────────────────────────────────────
  const [apps, setApps] = useLocalStorage<AppItem[]>('jellylaunch_apps', INITIAL_APPS);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; app: AppItem } | null>(null);
  
  // App Window State (for fullscreen preview)
  const [selectedApp, setSelectedApp] = useState<AppItem | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [startInFullscreen, setStartInFullscreen] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [activeView, setActiveView] = useState<'discover' | 'agents' | 'logs'>('discover');
  const [chatInputValue, setChatInputValue] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('dashboard');
  
  // Cell data
  const [piMessages, setPiMessages] = useState<PiMessage[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [weather, setWeather] = useState<MarketWeather>({ vibe: 'Initializing...', trend: 'neutral', lastUpdated: Date.now() });
  const [vanFund, setVanFund] = useState<VanFundData>({ current: 0, target: 50000, contributions: [] });
  const [githubActivity, setGithubActivity] = useState<GithubActivity>({ totalContributions: 0, dailyHistory: {} });
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  // ─── Data Fetching ─────────────────────────────────────────────────────────────
  const fetchAllData = useCallback(async () => {
    const [msgs, chat, wthr, fund, github, cal, grimoire] = await Promise.all([
      getPiMessages(),
      getChatHistory(),
      getMarketWeather(),
      getVanFundData(),
      getGithubActivity(),
      getCalendarData(),
      getGrimoire()
    ]);
    setPiMessages(msgs);
    setChatHistory(chat);
    setWeather(wthr);
    setVanFund(fund);
    setGithubActivity(github);
    if (cal.success) setCalendarEvents(cal.events);
    
    // Update apps list from grimoire
    if (grimoire && grimoire.length > 0) {
      setApps(prev => {
        // Merge grimoire with existing apps to preserve online status if possible
        return grimoire.map(gApp => {
          const existing = prev.find(p => p.id === gApp.id);
          return existing ? { ...gApp, isOnline: existing.isOnline, status: existing.status } : gApp;
        });
      });
    }
  }, []);

  const fetchTodos = useCallback(async () => {
    const appsWithDirs = apps.filter(a => a.directory).map(a => ({ id: a.id, directory: a.directory! }));
    if (appsWithDirs.length === 0) return;
    
    const todoMap = await getAllTodos(appsWithDirs);
    setApps(prev => prev.map(app => {
      const todoData = todoMap.get(app.id);
      if (todoData && JSON.stringify(app.todoData) !== JSON.stringify(todoData)) {
        return { ...app, todoData, hasTodo: true };
      }
      return app;
    }));
  }, [apps.length]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);
  useInterval(fetchAllData, 10000);
  useInterval(fetchTodos, 5000);

  // ─── Keyboard Shortcuts ────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K / Cmd+K - Open command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }
      // Escape - Close command palette or selected app
      if (e.key === 'Escape') {
        if (commandPaletteOpen) setCommandPaletteOpen(false);
        else if (contextMenu) setContextMenu(null);
        else if (selectedApp) {
          setSelectedApp(null);
          setIsEditMode(false);
          setStartInFullscreen(false);
        }
        return;
      }
      // Number keys 1-8 when palette is open
      if (commandPaletteOpen && e.key >= '1' && e.key <= '8') {
        const index = parseInt(e.key) - 1;
        if (index < apps.length) {
          handleLaunchApp(apps[index]);
          setCommandPaletteOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, apps, contextMenu, selectedApp]);

  // ─── App Actions ───────────────────────────────────────────────────────────────
  const handleLaunchApp = useCallback(async (app: AppItem) => {
    // URL-type apps are always online and just need to open
    if (app.appType === 'url') {
      setSelectedApp(app);
      setIsEditMode(false);
      setStartInFullscreen(true);
      return;
    }

    const willBeOnline = !app.isOnline;
    if (willBeOnline && app.command) {
      const success = await startService(app.id, app.command, app.directory, app.badge);
      if (success) {
        const updatedApp = { ...app, isOnline: true, status: 'active' as Status };
        setApps(prev => prev.map(a => a.id === app.id ? updatedApp : a));
        
        // If embedded, open in fullscreen
        if (app.isEmbedded) {
          setSelectedApp(updatedApp);
          setIsEditMode(false);
          setStartInFullscreen(true);
        }
      }
    } else if (app.isOnline) {
      await stopService(app.id);
      setApps(prev => prev.map(a => a.id === app.id ? { ...a, isOnline: false, status: 'idle' as Status } : a));
    }
  }, [setApps]);

  const handleDeleteApp = useCallback((id: string) => {
    setApps(prev => prev.filter(a => a.id !== id));
    setContextMenu(null);
    setSelectedApp(null);
  }, [setApps]);

  // Chat handlers for Pi Whisperer
  const handleSendChatMessage = useCallback(async (text: string) => {
    setIsChatLoading(true);
    
    // Optimistically add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      time: Date.now()
    };
    setChatHistory(prev => [...prev, userMsg]);

    try {
      const result = await sendChatMessage(text, selectedAgent);
      if (result.success && result.piResponse) {
        setChatHistory(prev => [...prev.slice(0, -1), userMsg, result.piResponse!]);
      } else if (result.piResponse) {
        // Error case but we still have a response
        setChatHistory(prev => [...prev.slice(0, -1), userMsg, result.piResponse!]);
      }
    } catch (error) {
      // Add error message
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        text: 'The connection to the aether was lost...',
        time: Date.now(),
        isError: true
      };
      setChatHistory(prev => [...prev, errorMsg]);
    } finally {
      setIsChatLoading(false);
    }
  }, []);

  const handleClearChat = useCallback(async () => {
    const history = await clearChatHistory();
    setChatHistory(history);
  }, []);

  const handleCloseWindow = useCallback(() => {
    setSelectedApp(null);
    setIsEditMode(false);
    setStartInFullscreen(false);
  }, []);

  const handleCreateApp = useCallback((newApp: AppItem) => {
    const appWithId: AppItem = { ...newApp, id: `app-${Date.now()}`, isOnline: false };
    setApps(prev => [...prev, appWithId]);
    setSelectedApp(null);
  }, [setApps]);

  const handleUpdateApp = useCallback((updatedApp: AppItem, closeWindow = true) => {
    setApps(prev => prev.map(app => app.id === updatedApp.id ? updatedApp : app));
    if (closeWindow) {
      setSelectedApp(null);
      setIsEditMode(false);
    } else {
      setSelectedApp(updatedApp);
    }
  }, [setApps]);

  const handleToggleService = useCallback(async (id: string) => {
    const app = apps.find(a => a.id === id);
    if (!app) return;
    await handleLaunchApp(app);
    const target = apps.find(a => a.id === id);
    if (target) setSelectedApp({ ...target, isOnline: !app.isOnline, status: (!app.isOnline ? 'active' : 'idle') as Status });
  }, [apps, handleLaunchApp]);

  // ─── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-slate-950">
      <TitleBar />

      {/* Background Mode */}
      <BackgroundMode />

      {/* Aura Scheme + Color Adjuster */}
      <AuraSettings />

      {/* MAIN CONTENT - floating high in the upper atmosphere */}
      <main className={`relative z-10 grid grid-cols-[11%_89%] w-[90%] mx-auto mt-6 mb-2 ultra-glass overflow-hidden transition-all duration-700 h-[55vh] ${selectedApp ? 'blur-xl scale-95 opacity-30 grayscale pointer-events-none' : 'opacity-100 scale-100'}`}>
        
        {/* SIDEBAR */}
        <nav className="main-menu-glass border-r border-white/20 h-full flex flex-col justify-between">
          <div>
            <div className="flex flex-col items-center py-8">
              <div className="w-16 h-16 rounded-full border-2 border-white/20 p-1 mb-4 flex items-center justify-center overflow-hidden bg-white/5">
                <span className="text-3xl">🧙‍♂️</span>
              </div>
              <p className="text-white text-xs font-bold tracking-widest uppercase">Pi</p>
            </div>
            
            <ul className="px-2">
              <li className={`nav-item-glass mb-2 ${activeView === 'discover' ? 'active' : 'opacity-40 hover:opacity-100'}`} onClick={() => setActiveView('discover')}>
                <a href="#" className="flex flex-col items-center gap-1">
                  <i className="fa fa-map text-lg"></i>
                  <span className="text-[10px] uppercase tracking-tighter">Discover</span>
                </a>
              </li>
              <li className={`nav-item-glass mb-2 ${activeView === 'agents' ? 'active' : 'opacity-40 hover:opacity-100'}`} onClick={() => setActiveView('agents')}>
                <a href="#" className="flex flex-col items-center gap-1">
                  <i className="fa fa-user-astronaut text-lg"></i>
                  <span className="text-[10px] uppercase tracking-tighter">Agents</span>
                </a>
              </li>
              <li className={`nav-item-glass mb-2 ${activeView === 'logs' ? 'active' : 'opacity-40 hover:opacity-100'}`} onClick={() => setActiveView('logs')}>
                <a href="#" className="flex flex-col items-center gap-1">
                  <i className="fa fa-compact-disc text-lg"></i>
                  <span className="text-[10px] uppercase tracking-tighter">Logs</span>
                </a>
              </li>
              <li className="nav-item-glass mb-2 opacity-40 hover:opacity-100">
                <a href="#" className="flex flex-col items-center gap-1">
                  <i className="fa fa-gear text-lg"></i>
                  <span className="text-[10px] uppercase tracking-tighter">Settings</span>
                </a>
              </li>
            </ul>
          </div>
          
          <ul className="px-2 pb-6">
            <li className="nav-item-glass opacity-40 hover:opacity-100">
              <a href="#" className="flex flex-col items-center gap-1">
                <i className="fa fa-right-from-bracket text-lg"></i>
                <span className="text-[10px] uppercase tracking-tighter">Exit</span>
              </a>
            </li>
          </ul>
        </nav>

        {/* CONTENT */}
        <section className="grid grid-cols-[73%_27%]">
          
          {/* LEFT CONTENT */}
          <div className="p-8 overflow-y-auto max-h-[90vh] custom-scrollbar">
            
            {/* VIEW: DISCOVER */}
            {activeView === 'discover' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Header / Search */}
                <div className="flex items-center justify-between mb-8">
                  <h1 className="text-2xl font-bold text-white uppercase tracking-widest">Discover Missions</h1>
                  <button
                    onClick={() => setCommandPaletteOpen(true)}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-2 flex items-center gap-3 transition-all"
                  >
                    <span className="text-white/40">🔍</span>
                    <span className="text-xs text-white/40">Search grimoire...</span>
                    <kbd className="text-[9px] text-white/30 bg-white/5 px-2 py-0.5 rounded border border-white/10">⌘K</kbd>
                  </button>
                </div>

                {/* Primary Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                   <SentimentScryerCell weather={weather} />
                   <VanFundCell data={vanFund} />
                   <ActivePulseCell activity={githubActivity} />
                </div>

                {/* Main Calendar View */}
                <div className="mb-12">
                   <TemporalFluxCell events={calendarEvents} onRefresh={fetchAllData} />
                </div>

                {/* App Grimoire Section */}
                <div className="mb-12">
                   <AppGrimoireCell 
                     apps={apps} 
                     onLaunch={handleLaunchApp} 
                     onContextMenu={(app, e) => {
                       e.preventDefault();
                       setContextMenu({ x: e.clientX, y: e.clientY, app });
                     }} 
                   />
                </div>

                {/* Popular / Active Missions (Slider Area) */}
                <div className="mb-12">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold uppercase tracking-widest text-white/50">Active Missions</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative h-48 rounded-2xl overflow-hidden border border-white/10 group">
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/40 to-purple-600/40 opacity-60"></div>
                      <div className="absolute inset-0 p-6 flex flex-col justify-end">
                        <h3 className="text-xl font-bold text-white mb-2">The Van Quest</h3>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-400" style={{ width: `${(vanFund.current / vanFund.target) * 100}%` }}></div>
                          </div>
                          <span className="text-[10px] font-mono text-white/60">{((vanFund.current / vanFund.target) * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="relative h-48 rounded-2xl overflow-hidden border border-white/10">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/40 to-emerald-600/40 opacity-60"></div>
                      <div className="absolute inset-0 p-6 flex flex-col justify-end">
                          <h3 className="text-xl font-bold text-white mb-2">Sentiment Scryer</h3>
                          <p className="text-xs text-white/60 line-clamp-2">{weather.vibe}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW: AGENTS */}
            {activeView === 'agents' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <header className="mb-12">
                   <h1 className="text-2xl font-bold text-white uppercase tracking-widest">Agent Roster</h1>
                   <p className="text-xs text-white/40 uppercase tracking-[0.3em]">Summon your fleet of sub-entities</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {['dashboard', 'clawddoc', 'code-architect'].map(agent => (
                    <div 
                      key={agent} 
                      onClick={() => {
                        setSelectedAgent(agent);
                        setActiveView('discover'); // Switch back to see chat
                      }}
                      className={`ultra-glass border ${selectedAgent === agent ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10'} p-6 hover:border-white/30 transition-all group cursor-pointer relative overflow-hidden`}
                    >
                       <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-3xl rounded-full"></div>
                       <div className="flex items-center gap-4 mb-4">
                          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center text-xl ${selectedAgent === agent ? 'bg-indigo-500/20 border-indigo-500/40' : 'bg-white/5 border-white/10'}`}>
                             {agent === 'dashboard' ? '🔮' : '🤖'}
                          </div>
                          <div>
                             <h3 className="text-white font-bold capitalize">{agent}</h3>
                             <p className="text-[10px] text-emerald-400 uppercase font-mono">Status: Ready</p>
                          </div>
                       </div>
                       <p className="text-[11px] text-white/50 mb-6 line-clamp-2">
                          {agent === 'dashboard' ? 'The primary intelligence governing this workspace.' : 'A specialized entity trained for project architecture and construction.'}
                       </p>
                       <button className={`w-full py-2 rounded-lg text-[10px] uppercase font-bold transition-all ${selectedAgent === agent ? 'bg-indigo-500 text-white' : 'bg-white/5 border border-white/10 text-white/40 group-hover:text-white'}`}>
                          {selectedAgent === agent ? 'Connected' : 'Commune'}
                       </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT CONTENT */}
          <div className="border-l border-white/20 p-8 flex flex-col">
            
            {/* Recent Heartbeats (Recommended Songs Area) */}
            <div className="flex-1">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-white/50 mb-6">Aether Feedback</h2>
              <div className="space-y-4">
                {chatHistory.slice(-6).map((msg, idx) => (
                  <div key={msg.id} className="flex items-center gap-4 group">
                    <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-sm">
                      {msg.role === 'user' ? '👤' : '🧙‍♂️'}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-xs text-white font-medium truncate">{msg.text}</p>
                      <p className="text-[10px] text-white/30 uppercase">{new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Heartbeat (Music Player Area) */}
            <div className="music-player-glass border border-white/20 ritual-pulse">
              <div className="relative mb-6">
                <div className="w-32 h-32 rounded-full border-4 border-white/10 p-1 flex items-center justify-center bg-white/5 group relative">
                   <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping"></div>
                   <div className="w-full h-full rounded-full border-2 border-white/40 flex items-center justify-center relative z-10 overflow-hidden">
                      <span className="text-5xl">🔮</span>
                   </div>
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-[#11063a]/70 border-2 border-white rounded-full z-20"></div>
              </div>

              <h2 className="text-lg font-bold text-white mb-1">Pi Status</h2>
              <p className="text-xs text-white/40 uppercase tracking-[0.2em] mb-6">Linked: {selectedAgent}</p>

              <div className="w-full px-4 mb-4">
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-400 animate-[loading_2s_ease-in-out_infinite]" style={{ width: '40%' }}></div>
                </div>
              </div>

              <div className="flex gap-4">
                <button className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center hover:scale-95 transition-all">
                  <i className="fa fa-backward text-xs"></i>
                </button>
                <button className="w-12 h-12 rounded-full bg-white/20 border border-white/20 flex items-center justify-center hover:scale-95 transition-all text-white">
                  <i className={`fa ${isChatLoading ? 'fa-spinner animate-spin' : 'fa-play'} text-lg`}></i>
                </button>
                <button className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center hover:scale-95 transition-all">
                  <i className="fa fa-forward text-xs"></i>
                </button>
              </div>
            </div>

          </div>

        </section>
      </main>

      {/* SUBTERRANEAN CHAT TRAY - Maximum Abyssal Expansion */}
      <div className={`fixed bottom-0 left-0 right-0 z-40 px-8 pb-12 pt-4 bg-gradient-to-t from-slate-950/95 via-transparent to-transparent transition-all duration-500 h-[42vh] flex flex-col justify-end ${selectedApp ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'}`}>
         
         {/* Aether Echoes - Rising high into the created negative space */}
         <div className="max-w-6xl mx-auto mb-8 space-y-6 flex-1 flex flex-col overflow-y-auto scrollbar-none pointer-events-auto">
            <div className="flex-1" /> {/* Spacer to push content to bottom when history is small */}
            {chatHistory.map((msg, idx) => (
               <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-5 duration-1000 last:mb-2`} style={{ opacity: msg.role === 'assistant' ? (0.4 + (idx / chatHistory.length) * 0.6) : 1 }}>
                  <div className={`max-w-[92%] px-8 py-4 rounded-[2rem] text-[15px] border backdrop-blur-2xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] ${msg.role === 'user' ? 'bg-indigo-500/15 border-indigo-400/30 text-indigo-50 text-shadow-sm' : 'bg-white/5 border-white/10 text-white shadow-inner'}`}>
                     <ReactMarkdown 
                        components={{
                           p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                           code: ({node, inline, ...props}: any) => 
                              inline 
                                 ? <code className="bg-white/10 px-1.5 py-0.5 rounded text-indigo-200" {...props} />
                                 : <pre className="bg-black/40 p-4 rounded-xl overflow-x-auto border border-white/10 my-3"><code {...props} /></pre>,
                           ul: ({node, ...props}) => <ul className="list-disc ml-6 mb-2" {...props} />,
                           ol: ({node, ...props}) => <ol className="list-decimal ml-6 mb-2" {...props} />,
                           li: ({node, ...props}) => <li className="mb-1" {...props} />,
                           h1: ({node, ...props}) => <h1 className="text-xl font-bold mb-2" {...props} />,
                           h2: ({node, ...props}) => <h2 className="text-lg font-bold mb-2" {...props} />,
                           h3: ({node, ...props}) => <h3 className="text-base font-bold mb-2" {...props} />,
                           blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-white/20 pl-4 italic my-2" {...props} />,
                           strong: ({node, ...props}) => <strong className="font-bold text-white" {...props} />,
                           em: ({node, ...props}) => <em className="italic text-white/90" {...props} />,
                        }}
                     >
                        {msg.text}
                     </ReactMarkdown>

                     {/* Astral Preview (Aetheric Mockups) */}
                     {msg.previewUrl && (
                        <div className="mt-6 rounded-3xl overflow-hidden border border-white/10 bg-black/40 h-80 relative group/preview">
                           <iframe 
                              src={msg.previewUrl} 
                              className="w-full h-full pointer-events-none" 
                              title="Code Preview"
                           />
                           <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-end p-4">
                              <button 
                                 onClick={() => window.open(msg.previewUrl, '_blank')}
                                 className="bg-violet-500/80 hover:bg-violet-500 text-xs font-bold uppercase tracking-widest px-6 py-3 rounded-xl text-white backdrop-blur-sm pointer-events-auto transition-all"
                              >
                                 Summon Full View
                              </button>
                           </div>
                        </div>
                     )}
                  </div>
               </div>
            ))}
         </div>

         <div className="max-w-4xl mx-auto relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/30 to-purple-600/30 rounded-[2.5rem] blur-xl opacity-20 group-hover:opacity-50 transition-opacity duration-1000"></div>
            <div className="relative flex items-center bg-[#0a0a1a]/80 backdrop-blur-3xl border border-white/20 rounded-[2rem] p-3 shadow-2xl">
               <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mr-4">
                  <span className={`text-xl ${isChatLoading ? "animate-spin" : "animate-pulse"}`}>
                     {isChatLoading ? "⏳" : selectedAgent === 'dashboard' ? "🔮" : "🤖"}
                  </span>
               </div>
               <input 
                 type="text"
                 value={chatInputValue}
                 onChange={(e) => setChatInputValue(e.target.value)}
                 onKeyDown={(e) => {
                    if (e.key === 'Enter' && chatInputValue.trim()) {
                       handleSendChatMessage(chatInputValue);
                       setChatInputValue('');
                    }
                 }}
                 placeholder={`Whisper to ${selectedAgent}...`}
                 className="flex-1 bg-transparent border-none outline-none text-white text-base placeholder:text-white/20 px-3 tracking-wide"
               />
               <button 
                 onClick={() => {
                   if (chatInputValue.trim()) {
                     handleSendChatMessage(chatInputValue);
                     setChatInputValue('');
                   }
                 }}
                 className="p-3 text-white/40 hover:text-white transition-colors"
               >
                 {isChatLoading ? <i className="fa fa-spinner animate-spin"></i> : <i className="fa fa-paper-plane"></i>}
               </button>
            </div>
         </div>
      </div>

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        apps={apps}
        onSelectApp={handleLaunchApp}
      />

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          app={contextMenu.app}
          onClose={() => setContextMenu(null)}
          onToggle={() => { handleLaunchApp(contextMenu.app); setContextMenu(null); }}
          onEdit={() => { 
            setSelectedApp(contextMenu.app);
            setIsEditMode(true);
            setContextMenu(null);
          }}
          onDelete={() => handleDeleteApp(contextMenu.app.id)}
          onAntigravity={async () => {
            if (contextMenu.app.directory) await openInAntigravity(contextMenu.app.directory);
            setContextMenu(null);
          }}
        />
      )}

      {/* App Window (fullscreen preview / edit modal) */}
      {selectedApp && (
        <AppWindow
          app={selectedApp}
          isNew={selectedApp.id === 'new'}
          isEdit={isEditMode}
          startInFullscreen={startInFullscreen}
          isSidebarVisible={isSidebarVisible}
          onClose={handleCloseWindow}
          onCreate={handleCreateApp}
          onUpdate={handleUpdateApp}
          onDelete={handleDeleteApp}
          onToggleService={() => handleToggleService(selectedApp.id)}
          onEdit={() => setIsEditMode(true)}
        />
      )}

      {/* Embedded App Sidebar */}
      <EmbeddedAppSidebar
        apps={apps}
        selectedAppId={selectedApp?.id}
        onSelectApp={(app) => {
          setSelectedApp(app);
          setIsEditMode(false);
          setStartInFullscreen(true);
        }}
        onGoToDashboard={handleCloseWindow}
        onVisibilityChange={setIsSidebarVisible}
      />
    </div>
  );
};

export default App;
