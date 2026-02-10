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
  PiMessage, ChatMessage, MarketWeather, VanFundData, GithubActivity, CalendarEvent,
  getProjects, Project
} from './services/piService';
import AppWindow from './components/AppWindow';
import EmbeddedAppSidebar from './components/EmbeddedAppSidebar';
import AuraSettings from './components/AuraSettings';
import LiquidBackground from './components/LiquidBackground';
import TodoBoardCell from './components/TodoBoardCell';

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
  onCreate?: () => void;
}
function AppGrimoireCell({ apps, onLaunch, onContextMenu, onCreate }: AppGrimoireProps) {
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
        <div
          className="border-2 border-dashed border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center hover:border-white/20 hover:bg-white/[0.02] transition-all cursor-pointer group"
          onClick={onCreate}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCreate?.(); } }}
        >
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
              
              {/* Astral Preview (Aetheric Mockups) - Always visible */}
              {msg.previewUrl && (
                <div className="mt-3 rounded-xl overflow-hidden border border-white/10 bg-black/40 h-48 relative">
                  <iframe 
                    src={msg.previewUrl} 
                    className="w-full h-full" 
                    title="Code Preview"
                    style={{ pointerEvents: 'auto' }}
                  />
                  <div className="absolute top-2 right-2">
                    <button 
                      onClick={() => window.open(msg.previewUrl, '_blank')}
                      className="bg-violet-500/80 hover:bg-violet-500 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg text-white backdrop-blur-sm transition-colors"
                      title="Open in new tab"
                    >
                      Expand
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
// Temporal Flux Cell - Apple-Inspired Calendar
// ─────────────────────────────────────────────────────────────────────────────────
interface TemporalFluxProps {
  events: CalendarEvent[];
  onRefresh: () => Promise<void>;
}
function TemporalFluxCell({ events, onRefresh }: TemporalFluxProps) {
  const [view, setView] = useState<'month' | 'week' | 'day'>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [startDateTime, setStartDateTime] = useState('');
  const [endDateTime, setEndDateTime] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);

  // Refs for scroll management
  const timelineRef = useRef<HTMLDivElement>(null);

  // Dark theme design tokens (matching mockup)
  const COLORS = {
    bg: 'bg-white/5 backdrop-blur-2xl',
    border: 'border-white/10',
    hover: 'hover:bg-white/10',
    container: 'bg-white/5 backdrop-blur-2xl border border-white/10',
    headerBg: 'bg-purple-900/20 border-purple-500/20',
    dateText: 'bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent',
    button: 'bg-purple-500/20 border-purple-400/40 text-purple-300 hover:bg-purple-500/30 hover:border-purple-400/60',
    addButton: 'bg-gradient-to-r from-emerald-500/20 to-blue-500/20 border-emerald-400/40 text-emerald-300 hover:from-emerald-500/30 hover:to-blue-500/30',
    timeLabel: 'text-white/50 border-r border-white/10',
    hourLine: 'border-b border-white/5',
    eventDefault: 'bg-gradient-to-br from-purple-500/25 to-blue-500/15 border-l-2 border-purple-400/50',
    eventTeam: 'bg-gradient-to-br from-purple-500/25 to-indigo-500/15 border-l-2 border-purple-500/50',
    eventCall: 'bg-gradient-to-br from-sky-500/25 to-blue-500/15 border-l-2 border-sky-500/50',
    eventLunch: 'bg-gradient-to-br from-emerald-500/25 to-teal-500/15 border-l-2 border-emerald-500/50',
    eventReview: 'bg-gradient-to-br from-amber-500/25 to-orange-500/15 border-l-2 border-amber-500/50',
    eventVan: 'bg-gradient-to-br from-fuchsia-500/25 to-pink-500/15 border-l-2 border-fuchsia-500/50',
    nowMarker: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
  };

  const loading = false; // Events loaded via parent

  // Navigation (day-based)
  const navigatePrevious = () => {
    setIsAnimating(true);
    const next = new Date(currentDate);
    next.setDate(next.getDate() - 1);
    setCurrentDate(next);
    setSelectedDate(next);
    setTimeout(() => setIsAnimating(false), 250);
  };

  const navigateNext = () => {
    setIsAnimating(true);
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    setCurrentDate(next);
    setSelectedDate(next);
    setTimeout(() => setIsAnimating(false), 250);
  };

  const navigateToday = () => {
    setIsAnimating(true);
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
    setTimeout(() => setIsAnimating(false), 250);
  };

  // Event CRUD operations
  const openCreateModal = (date?: Date, time?: string) => {
    const baseDate = date || selectedDate;
    const dateStr = baseDate.toISOString().split('T')[0];
    const timeStr = time || '09:00';

    setStartDateTime(`${dateStr}T${timeStr}:00`);
    setEndDateTime(`${dateStr}T${timeStr}:00`);
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (event: CalendarEvent) => {
    setEditingEvent(event);
    setTitle(event.summary);
    setDescription(event.description || '');
    setLocation(event.location || '');

    if (event.start.date) {
      setIsAllDay(true);
      setStartDateTime(event.start.date);
      setEndDateTime(event.end?.date || event.start.date);
    } else if (event.start.dateTime) {
      setIsAllDay(false);
      const start = new Date(event.start.dateTime);
      const end = event.end?.dateTime ? new Date(event.end.dateTime) : start;
      setStartDateTime(start.toISOString());
      setEndDateTime(end.toISOString());
    }

    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const eventBody = isAllDay
      ? {
          summary: title,
          start: { date: startDateTime.split('T')[0] },
          end: { date: endDateTime.split('T')[0] },
          description,
          location
        }
      : {
          summary: title,
          start: { dateTime: startDateTime },
          end: { dateTime: endDateTime },
          description,
          location
        };

    const success = editingEvent
      ? await updateCalendarEvent(editingEvent.id, eventBody)
      : await createCalendarEvent(eventBody);

    if (success) {
      await onRefresh();
      setShowModal(false);
      resetForm();
    }
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    if (!editingEvent || !window.confirm('Delete this event?')) return;
    const success = await deleteCalendarEvent(editingEvent.id);
    if (success) {
      await onRefresh();
      setShowModal(false);
      resetForm();
    }
  };

  const resetForm = () => {
    setTitle('');
    setStartDateTime('');
    setEndDateTime('');
    setDescription('');
    setLocation('');
    setIsAllDay(false);
    setEditingEvent(null);
  };

  // Date utilities
  const getMonthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
  const getMonthEnd = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const getWeekRange = (date: Date) => {
    const day = date.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const start = new Date(date);
    start.setDate(start.getDate() - diff);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start, end };
  };

  const formatDateDisplay = () => {
    if (view === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (view === 'week') {
      const { start, end } = getWeekRange(currentDate);
      const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      if (start.getMonth() !== end.getMonth() || start.getFullYear() !== end.getFullYear()) {
        return `${start.toLocaleDateString('en-US', options)} — ${end.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`;
      }
      return `${start.toLocaleDateString('en-US', options)} — ${end.getDate()}`;
    } else {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
  };

  const getDaysForView = () => {
    if (view === 'month') {
      const start = getMonthStart(currentDate);
      const end = getMonthEnd(currentDate);
      const startDay = start.getDay();
      const daysInMonth = end.getDate();

      const days: (Date | null)[] = [];

      // Previous month padding
      const prevMonthEnd = new Date(start);
      prevMonthEnd.setDate(prevMonthEnd.getDate() - 1);
      for (let i = startDay - 1; i >= 0; i--) {
        const day = new Date(prevMonthEnd);
        day.setDate(prevMonthEnd.getDate() - i);
        days.push(day);
      }

      // Current month
      for (let i = 1; i <= daysInMonth; i++) {
        days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
      }

      // Next month padding
      const remaining = 42 - days.length;
      for (let i = 1; i <= remaining; i++) {
        days.push(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i));
      }

      return days;
    } else if (view === 'week') {
      const { start } = getWeekRange(currentDate);
      return Array.from({ length: 7 }, (_, i) => {
        const day = new Date(start);
        day.setDate(start.getDate() + i);
        return day;
      });
    } else {
      return [new Date(currentDate)];
    }
  };

  const getHourSlots = () => Array.from({ length: 24 }, (_, i) => i);

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events
      .filter(event => (event.start.dateTime || event.start.date)?.split('T')[0] === dateStr)
      .sort((a, b) => {
        const aTime = a.start.dateTime || a.start.date || '';
        const bTime = b.start.dateTime || b.start.date || '';
        return aTime.localeCompare(bTime);
      });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const isSelected = (date: Date) => {
    return date.getDate() === selectedDate.getDate() &&
           date.getMonth() === selectedDate.getMonth() &&
           date.getFullYear() === selectedDate.getFullYear();
  };

  const handleDateClick = (date: Date, time?: string) => {
    setSelectedDate(date);
    // If we're in month or week view, switch to day view for this date
    if (view !== 'day') {
      setView('day');
      setCurrentDate(new Date(date));
    }
    // If a specific time was provided (from week view click), open modal at that time
    if (time) {
      openCreateModal(date, time);
    }
    // If in day view already, clicking opens modal at default time (don't switch view)
  };

  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEvent(event);
    openEditModal(event);
  };

  const getEventPosition = (event: CalendarEvent) => {
    if (!event.start.dateTime) return { top: 0, height: 40 };
    const start = new Date(event.start.dateTime);
    const end = new Date(event.end?.dateTime || start);
    const startMinute = start.getHours() * 60 + start.getMinutes();
    const duration = (end.getTime() - start.getTime()) / (1000 * 60);
    return {
      top: startMinute,
      height: Math.max(duration, 30)
    };
  };

  const formatHour = (hour: number) => {
    return hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
  };

  // Compare two dates to see if they represent the same calendar day
  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getDate() === d2.getDate() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getFullYear() === d2.getFullYear();
  };

  // Check if current period is today
  const isCurrentPeriod = (() => {
    if (view === 'month') {
      return currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();
    } else if (view === 'week') {
      const { start, end } = getWeekRange(currentDate);
      const today = new Date();
      return today >= start && today <= end;
    } else {
      return isSameDay(currentDate, new Date());
    }
  })();

  // Auto-scroll to current time in day view
  useEffect(() => {
    if (view === 'day' && timelineRef.current) {
      const now = new Date();
      if (isSameDay(selectedDate, now)) {
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const pixelPerMinute = 80 / 60;
        const startOffset = 6 * 60; // 6 AM in minutes
        const nowPosition = Math.max(0, nowMinutes - startOffset) * pixelPerMinute;
        const container = timelineRef.current;
        const containerHeight = container.clientHeight;
        const maxScroll = container.scrollHeight - containerHeight;
        const scrollTarget = Math.min(Math.max(nowPosition - containerHeight * 0.3, 0), maxScroll);
        container.scrollTo({ top: scrollTarget, behavior: 'smooth' });
      }
    }
  }, [view, selectedDate]);

  // Render helpers
  const renderMonthView = () => {
    const days = getDaysForView();
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className={`grid grid-cols-7 ${COLORS.border} border-b`}>
          {weekDays.map(day => (
            <div key={day} className="text-center text-[11px] font-medium text-gray-400 py-3 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 flex-1 auto-rows-fr">
          {days.map((date, idx) => {
            const dateEvents = getEventsForDate(date);
            const isCurrentMonth = date.getMonth() === currentDate.getMonth();
            const isSelectedDate = isSelected(date);
            const isTodayDate = isToday(date);

            return (
              <div
                key={idx}
                onClick={() => handleDateClick(date)}
                className={`${COLORS.border} border-b border-r p-2 min-h-[100px] cursor-pointer transition-colors duration-200 hover:bg-gray-50/60 ${!isCurrentMonth ? 'bg-gray-50/30 text-gray-400' : ''} ${isSelectedDate ? COLORS.selected : ''}`}
              >
                <div className={`text-sm font-medium mb-1.5 w-6 h-6 flex items-center justify-center rounded-full ${isTodayDate ? 'bg-[var(--aura-4)] text-white font-semibold' : 'text-gray-700'} ${isSelectedDate ? 'ring-1 ring-[color:color-mix(in_srgb,var(--aura-4)_50%,transparent)]' : ''}`}>
                  {date.getDate()}
                </div>
                <div className="space-y-0.5 overflow-hidden">
                  {dateEvents.slice(0, 3).map(event => (
                    <div
                      key={event.id}
                      onClick={(e) => handleEventClick(event, e)}
                      className={`text-[10px] px-1.5 py-0.5 rounded truncate ${COLORS.eventBg} ${COLORS.eventHover} cursor-pointer transition-colors`}
                      title={event.summary}
                    >
                      {event.summary}
                    </div>
                  ))}
                  {dateEvents.length > 3 && (
                    <div className="text-[10px] text-gray-400 px-1.5">
                      +{dateEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const days = getDaysForView();
    const hourSlots = getHourSlots();

    return (
      <div className="flex-1 flex overflow-hidden">
        <div className="w-14 pr-3 text-right bg-gray-50/40">
          <div className="h-10" />
          {hourSlots.map(hour => (
            <div key={hour} className="h-16 text-[10px] text-gray-400 text-right pt-2 font-medium">
              {formatHour(hour)}
            </div>
          ))}
        </div>

        <div className="flex-1">
          <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(120px, 1fr))` }}>
            {days.map((date, idx) => (
              <div key={idx} className={`text-center border-b ${COLORS.border}`}>
                <div className={`text-[11px] font-medium py-2 uppercase tracking-wide ${isToday(date) ? 'text-[var(--aura-4)]' : 'text-gray-400'}`}>
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className={`text-lg font-semibold py-1 mb-1 ${isToday(date) ? 'text-[var(--aura-4)]' : 'text-gray-800'} ${isSelected(date) ? 'bg-[var(--aura-4)] text-white rounded-full w-8 h-8 mx-auto flex items-center justify-center' : ''}`}>
                  {date.getDate()}
                </div>
              </div>
            ))}

            {hourSlots.map(hour => (
              <div key={hour} className="contents">
                {days.map((date, dayIdx) => {
                  const dayEvents = getEventsForDate(date).filter(event => {
                    if (!event.start.dateTime) return false;
                    const eventStart = new Date(event.start.dateTime);
                    const eventEnd = new Date(event.end?.dateTime || eventStart);
                    return eventStart.getHours() <= hour && eventEnd.getHours() > hour;
                  });

                  return (
                    <div
                      key={dayIdx}
                      onClick={() => handleDateClick(date, `${hour.toString().padStart(2, '0')}:00`)}
                      className={`${COLORS.border} border-b border-r relative h-16 cursor-pointer transition-colors duration-150 hover:bg-gray-50/50 ${isSelected(date) ? 'bg-[color-mix(in_srgb,var(--aura-4)_5%,transparent)]' : ''}`}
                    >
                      {dayEvents.map(event => {
                        const pos = getEventPosition(event);
                        if (pos.top / 60 !== hour) return null;
                        return (
                          <div
                            key={event.id}
                            onClick={(e) => handleEventClick(event, e)}
                            className="absolute left-0.5 right-0.5 bg-[color-mix(in_srgb,var(--aura-4)_18%,transparent)] border border-[color:color-mix(in_srgb,var(--aura-4)_30%,transparent)] rounded px-1.5 py-1 text-[10px] text-gray-900 cursor-pointer hover:bg-[color-mix(in_srgb,var(--aura-4)_25%,transparent)] transition-colors pointer-events-auto group"
                            style={{
                              top: `${pos.top % 60}px`,
                              height: `${Math.max(pos.height, 30)}px`
                            }}
                          >
                            <div className="font-medium truncate">{event.summary}</div>
                            {event.location && (
                              <div className="text-[9px] text-white/60 truncate">{event.location}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const hourSlots = getHourSlots();
    const dayEvents = getEventsForDate(selectedDate);
    const now = new Date();
    const isTodayDate = isSameDay(selectedDate, now);

    // Calculate current time position (in minutes from midnight)
    const getMinutesFromMidnight = (date: Date) => date.getHours() * 60 + date.getMinutes();
    const nowMinutes = isTodayDate ? getMinutesFromMidnight(now) : -1;

    // Event color mapping based on event type/keywords
    const getEventColor = (event: CalendarEvent) => {
      const title = event.summary.toLowerCase();
      if (title.includes('team') || title.includes('sync')) return { gradient: 'from-violet-500/25 to-indigo-500/15', border: 'border-l-2 border-violet-500/50', accent: '#8b5cf6' };
      if (title.includes('call') || title.includes('meeting')) return { gradient: 'from-sky-500/25 to-blue-500/15', border: 'border-l-2 border-sky-500/50', accent: '#0ea5e9' };
      if (title.includes('lunch') || title.includes('break')) return { gradient: 'from-emerald-500/25 to-teal-500/15', border: 'border-l-2 border-emerald-500/50', accent: '#10b981' };
      if (title.includes('review') || title.includes('code')) return { gradient: 'from-amber-500/25 to-orange-500/15', border: 'border-l-2 border-amber-500/50', accent: '#f59e0b' };
      if (title.includes('van') || title.includes('fund')) return { gradient: 'from-fuchsia-500/25 to-pink-500/15', border: 'border-l-2 border-fuchsia-500/50', accent: '#d946ef' };
      return { gradient: 'from-violet-500/25 to-indigo-500/15', border: 'border-l-2 border-violet-500/50', accent: '#8b5cf6' };
    };

    // Event icon (emoji based on keywords)
    const getEventIcon = (event: CalendarEvent) => {
      const title = event.summary.toLowerCase();
      if (title.includes('team') || title.includes('sync')) return '🗓️';
      if (title.includes('call') || title.includes('meeting')) return '📞';
      if (title.includes('lunch') || title.includes('break') || title.includes('food')) return '🍽️';
      if (title.includes('review') || title.includes('code')) return '👥';
      if (title.includes('van') || title.includes('fund') || title.includes('money')) return '💰';
      return '⚡';
    };

    return (
      <div className="flex-1 flex overflow-hidden bg-white/5">
        {/* Time labels column */}
        <div className="w-20 pr-4 text-right flex-shrink-0 bg-white/5">
          <div className="h-12" />
          {hourSlots.map(hour => (
            <div key={hour} className="h-[60px] text-[10px] text-white/50 text-right pr-2 pt-2 font-mono leading-none">
              {formatHour(hour)}
            </div>
          ))}
        </div>

        {/* Main timeline area */}
        <div className="flex-1 relative">
          {/* Hour grid lines */}
          {hourSlots.map(hour => (
            <div key={hour} className="h-[60px] border-b border-gray-200/10 relative" />
          ))}

          {/* NOW indicator */}
          {isTodayDate && nowMinutes >= 0 && (
            <div
              className="absolute left-0 right-0 z-20 pointer-events-none"
              style={{ top: `${nowMinutes}px` }}
            >
              <div className="absolute inset-0 bg-rose-500/90 h-0.5 -translate-y-1/2 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
              <div className="absolute right-2 -top-5 bg-rose-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shadow-lg">
                NOW
              </div>
            </div>
          )}

          {/* All-day events section */}
          <div className="absolute top-0 left-2 right-2 z-10 bg-gradient-to-b from-white/80 via-white/70 to-transparent backdrop-blur-sm p-3 border-b border-gray-200/30">
            <div className="text-[10px] font-semibold text-white/50 uppercase tracking-wide mb-2">All-day Events</div>
            {dayEvents.filter(e => e.start.date).map(event => {
              const color = getEventColor(event);
              return (
                <div
                  key={event.id}
                  onClick={(e) => { e.stopPropagation(); handleEventClick(event, e); }}
                  className={`mb-2 p-2.5 bg-gradient-to-r ${color.gradient} ${color.border} rounded-lg text-gray-900 cursor-pointer hover:brightness-105 transition-all group backdrop-blur-sm shadow-sm`}
                >
                  <div className="font-semibold text-sm flex items-center gap-2">
                    <span className="text-base">{getEventIcon(event)}</span>
                    <span className="truncate">{event.summary}</span>
                  </div>
                  {event.location && (
                    <div className="text-xs text-white/60 mt-1 flex items-center gap-1 ml-6">
                      <span>📍</span>{event.location}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Timed events */}
          {dayEvents.filter(e => e.start.dateTime).map(event => {
            const pos = getEventPosition(event);
            const color = getEventColor(event);
            const startTime = new Date(event.start.dateTime);
            const endTime = event.end?.dateTime ? new Date(event.end.dateTime) : startTime;
            const timeDisplay = `${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

            return (
              <div
                key={event.id}
                onClick={(e) => { e.stopPropagation(); handleEventClick(event, e); }}
                className={`absolute left-1 right-1 z-10 bg-gradient-to-r ${color.gradient} ${color.border} rounded-lg p-2 cursor-pointer hover:brightness-110 transition-all group backdrop-blur-sm shadow-lg hover:shadow-xl`}
                style={{
                  top: `${pos.top}px`,
                  height: `${Math.max(pos.height, 32)}px`
                }}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg flex-shrink-0 mt-0.5">{getEventIcon(event)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-900 truncate group-hover:text-gray-950">
                      {event.summary}
                    </div>
                    <div className="text-xs text-white/60 mt-0.5 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {timeDisplay}
                    </div>
                    {event.location && (
                      <div className="text-xs text-white/50 mt-0.5 flex items-center gap-1 truncate">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Click-to-add overlay (only if no all-day events to avoid overlap) */}
          <div
            className="absolute inset-0"
            onClick={() => openCreateModal(selectedDate)}
          />
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`${COLORS.bg} rounded-2xl border ${COLORS.border} ${COLORS.shadow} p-12 flex items-center justify-center`}>
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[color:color-mix(in_srgb,var(--aura-4)_30%,transparent)] border-t-[var(--aura-4)] rounded-full animate-spin mx-auto" />
          <div className="text-sm font-medium text-white/50">Loading events…</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${COLORS.bg} rounded-2xl border ${COLORS.border} ${COLORS.shadow} overflow-hidden transition-all duration-300 ${isAnimating ? 'opacity-80 scale-[0.997]' : 'opacity-100 scale-100'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-4 border-b ${COLORS.headerBg}`}>
        <div className="flex items-center gap-4">
          {/* Back button (shown when not in month view) */}
          {(view === 'day' || view === 'week') && (
            <button
              onClick={() => setView('month')}
              className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 border border-gray-200/60 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              aria-label="Back to month view"
            >
              <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
          )}

          <div className="flex gap-1">
            <button
              onClick={navigatePrevious}
              className={`w-9 h-9 rounded-full ${COLORS.button} flex items-center justify-center transition-all hover:scale-105 active:scale-95`}
              aria-label="Previous"
            >
              <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={navigateNext}
              className={`w-9 h-9 rounded-full ${COLORS.button} flex items-center justify-center transition-all hover:scale-105 active:scale-95`}
              aria-label="Next"
            >
              <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <button
            onClick={navigateToday}
            disabled={isCurrentPeriod}
            className={`px-4 py-2 text-xs font-medium uppercase tracking-wide rounded-full transition-all ${COLORS.button} disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            Today
          </button>

          <div className="flex flex-col ml-2">
            <div className={`text-2xl font-semibold ${COLORS.dateText}`}>
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            <div className="text-[10px] text-white/40 uppercase tracking-widest">Your day at a glance</div>
          </div>
        </div>

        {/* Add Event Button - Mockup Style */}
        <button
          onClick={() => openCreateModal()}
          className={`px-5 py-2.5 text-xs font-medium uppercase tracking-wide rounded-full transition-all hover:scale-105 active:scale-95 ${COLORS.addButton} flex items-center gap-2`}
          aria-label="Add new event"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Event
        </button>
      </div>

      {/* Calendar Content - Fixed height with scrollable day view */}
      <div className="h-[500px] overflow-hidden">
        {view === 'month' && renderMonthView()}
        {view === 'week' && renderWeekView()}
        {view === 'day' && (
          <div ref={timelineRef} className="h-full overflow-y-auto">
            {renderDayView()}
          </div>
        )}
      </div>

      {/* Event Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`${COLORS.bg} backdrop-blur-2xl rounded-2xl shadow-2xl w-full max-w-md border ${COLORS.border} overflow-hidden transition-all duration-300`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${COLORS.border}`}>
              <h3 className="text-base font-semibold text-white">
                {editingEvent ? 'Edit Event' : 'New Event'}
              </h3>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="text-white/40 hover:text-white/60 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2.5 bg-black/40 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                  placeholder="Add title"
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <label className="text-xs font-medium text-white/60 uppercase tracking-wider">
                  All-day
                </label>
                <button
                  type="button"
                  onClick={() => setIsAllDay(!isAllDay)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    isAllDay ? 'bg-[var(--aura-4)]' : 'bg-white/20'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    isAllDay ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-1.5">
                    {isAllDay ? 'Date' : 'Start'}
                  </label>
                  <input
                    type={isAllDay ? 'date' : 'datetime-local'}
                    required
                    value={startDateTime.split('T')[0]}
                    onChange={(e) => {
                      if (isAllDay) {
                        setStartDateTime(e.target.value);
                      } else {
                        setStartDateTime(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2.5 bg-black/40 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--aura-4)_30%,transparent)] focus:border-[var(--aura-4)] transition-all"
                  />
                </div>
                {!isAllDay && (
                  <div>
                    <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-1.5">
                      Time
                    </label>
                    <input
                      type="time"
                      required
                      value={startDateTime.split('T')[1]?.slice(0, 5) || ''}
                      onChange={(e) => {
                        const [date] = startDateTime.split('T');
                        setStartDateTime(`${date}T${e.target.value}:00`);
                      }}
                      className="w-full px-3 py-2.5 bg-black/40 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--aura-4)_30%,transparent)] focus:border-[var(--aura-4)] transition-all"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-1.5">
                    {isAllDay ? 'End date' : 'End'}
                  </label>
                  <input
                    type={isAllDay ? 'date' : 'datetime-local'}
                    required
                    value={endDateTime.split('T')[0]}
                    onChange={(e) => {
                      if (isAllDay) {
                        setEndDateTime(e.target.value);
                      } else {
                        setEndDateTime(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2.5 bg-black/40 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--aura-4)_30%,transparent)] focus:border-[var(--aura-4)] transition-all"
                  />
                </div>
                {!isAllDay && (
                  <div>
                    <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-1.5">
                      Time
                    </label>
                    <input
                      type="time"
                      required
                      value={endDateTime.split('T')[1]?.slice(0, 5) || ''}
                      onChange={(e) => {
                        const [date] = endDateTime.split('T');
                        setEndDateTime(`${date}T${e.target.value}:00`);
                      }}
                      className="w-full px-3 py-2.5 bg-black/40 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--aura-4)_30%,transparent)] focus:border-[var(--aura-4)] transition-all"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-1.5">
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2.5 bg-black/40 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--aura-4)_30%,transparent)] focus:border-[var(--aura-4)] transition-all"
                  placeholder="Add location"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-black/40 border border-white/20 rounded-xl text-white placeholder-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--aura-4)_30%,transparent)] focus:border-[var(--aura-4)] transition-all"
                  placeholder="Add description"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:from-white/10 disabled:to-white/10 disabled:text-white/30 rounded-xl text-sm font-medium transition-all disabled:cursor-not-allowed shadow-lg"
                >
                  {isSubmitting ? 'Saving…' : editingEvent ? 'Save Changes' : 'Add Event'}
                </button>
                {editingEvent && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-[color-mix(in_srgb,var(--aura-4)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--aura-4)_10%,transparent)] text-[var(--aura-4)] border border-[color:color-mix(in_srgb,var(--aura-4)_10%,transparent)] rounded-xl text-sm font-medium transition-all disabled:cursor-not-allowed"
                  >
                    Delete
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
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
// Project Manager Widget
// ─────────────────────────────────────────────────────────────────────────────────
interface ProjectManagerWidgetProps {
  projects: Project[];
  apps: AppItem[];
  onOpenProject: (path: string) => void;
  onLaunchApp: (app: AppItem) => void;
}

function ProjectManagerWidget({ projects, apps, onOpenProject, onLaunchApp }: ProjectManagerWidgetProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const selectedProject = projects.find(p => p.id === selectedProjectId) || null;

  // Find associated apps for a project (by matching directory)
  const getProjectApps = (project: Project) => {
    return apps.filter(app => app.directory && isSubdirectory(project.path, app.directory));
  };

  // Check if any app for this project is running
  const isProjectRunning = (project: Project) => {
    return getProjectApps(project).some(app => app.isOnline);
  };

  // Handler to run project's main service (pick first non-online app, or toggle)
  const handleRunProject = (project: Project) => {
    const projectApps = getProjectApps(project);
    if (projectApps.length === 0) {
      alert('No known service associated with this project. Add it to the Grimoire first.');
      return;
    }
    // Prefer to start a stopped app; if all running, maybe do nothing or stop all?
    const stoppedApp = projectApps.find(app => !app.isOnline);
    if (stoppedApp) {
      onLaunchApp(stoppedApp);
    } else {
      // All are running; maybe toggle the first one off? Or do nothing.
      alert('All associated services are already running.');
    }
  };

  return (
    <div className={`${GLASS} rounded-2xl p-6 bg-gradient-to-br ${ACCENT.purple} h-[500px] flex flex-col`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50">Project Manager</h3>
        <span className="text-[10px] text-white/30">{projects.length} projects</span>
      </div>

      {/* Project selector */}
      <div className="mb-4">
        <select
          value={selectedProjectId || ''}
          onChange={(e) => setSelectedProjectId(e.target.value || null)}
          className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/50"
        >
          <option value="">-- Select a Project --</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} {isProjectRunning(p) ? '●' : '○'}
            </option>
          ))}
        </select>
      </div>

      {/* Project details when selected */}
      {selectedProject && (
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Header with actions */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-white">{selectedProject.name}</div>
              <div className="text-[10px] text-white/40 truncate max-w-[180px]">{selectedProject.path}</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onOpenProject(selectedProject.path)}
                className="px-3 py-1 text-xs font-medium uppercase tracking-wide rounded bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-colors"
                title="Open in Antigravity"
              >
                Open
              </button>
              <button
                onClick={() => handleRunProject(selectedProject)}
                className="px-3 py-1 text-xs font-medium uppercase tracking-wide rounded bg-purple-500/20 border border-purple-400/40 text-purple-300 hover:bg-purple-500/30 transition-colors"
                title="Start/Run project service"
              >
                {isProjectRunning(selectedProject) ? 'Running' : 'Run'}
              </button>
            </div>
          </div>

          {/* Tasks */}
          {selectedProject.tasks.length === 0 ? (
            <div className="text-xs text-white/40 italic">No tasks found in todo.md</div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                Tasks ({selectedProject.tasks.filter(t => t.status !== 'done').length} active)
              </div>
              {selectedProject.tasks.map(task => (
                <div
                  key={task.id}
                  className={`p-2 rounded border ${
                    task.status === 'done' ? 'bg-white/5 border-white/5 text-white/30 line-through' :
                    task.status === 'in-progress' ? 'bg-purple-500/10 border-purple-400/30' :
                    task.status === 'blocked' ? 'bg-rose-500/10 border-rose-400/30' :
                    'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{task.title}</div>
                      {task.agent && (
                        <div className="text-[10px] text-purple-300 uppercase mt-1">
                          @{task.agent}
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-white/30 capitalize">{task.status.replace('-', ' ')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!selectedProject && (
        <div className="flex-1 flex items-center justify-center text-white/40 text-sm text-center px-4">
          Select a project from the dropdown to view tasks and manage services.
        </div>
      )}
    </div>
  );
}

// Helper to check if a path is a subdirectory of another
function isSubdirectory(parent: string, child: string): boolean {
  const p = parent.toLowerCase().replace(/\\/g, '/');
  const c = child.toLowerCase().replace(/\\/g, '/');
  const normalizedParent = p.endsWith('/') ? p : p + '/';
  return c.startsWith(normalizedParent) || c === p;
}

// ─────────────────────────────────────────────────────────────────────────────────
// Command Palette
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [sidebarsCollapsed, setSidebarsCollapsed] = useState(true);

  // ─── Data Fetching ─────────────────────────────────────────────────────────────
  const fetchAllNonChatData = useCallback(async () => {
    const [msgs, wthr, fund, github, cal, grimoire, projs] = await Promise.all([
      getPiMessages(),
      getMarketWeather(),
      getVanFundData(),
      getGithubActivity(),
      getCalendarData(),
      getGrimoire(),
      getProjects()
    ]);
    setPiMessages(msgs);
    setWeather(wthr);
    setVanFund(fund);
    setGithubActivity(github);
    if (cal.success) setCalendarEvents(cal.events);
    setProjects(projs);
    
    // Update apps list from grimoire
    if (grimoire && grimoire.length > 0) {
      setApps(prev => {
        // Merge grimoire with existing apps to preserve online status if possible
        const existingMap = new Map(prev.map(app => [app.id, app]));
        const mergedApps: AppItem[] = [];

        // Merge each grimoire app with existing client app (if any)
        for (const gApp of grimoire) {
          const existing = existingMap.get(gApp.id);
          if (existing) {
            // Start with server data
            const merged = { ...gApp };
            // Preserve client-side fields from existing
            const clientFields: (keyof AppItem)[] = [
              'isOnline', 'status', 'isEmbedded', 'port', 'embeddedUrl', 'badge', 'todoData', 'hasTodo'
            ];
            for (const field of clientFields) {
              if (existing[field] !== undefined) {
                merged[field] = existing[field];
              }
            }
            mergedApps.push(merged as AppItem);
            existingMap.delete(gApp.id); // mark processed
          } else {
            mergedApps.push(gApp);
          }
        }

        // Add any remaining existing apps (new local apps not in grimoire)
        for (const leftover of existingMap.values()) {
          mergedApps.push(leftover);
        }

        return mergedApps;
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

  const fetchChatHistory = useCallback(async () => {
    const chat = await getChatHistory(selectedAgent);
    setChatHistory(chat);
  }, [selectedAgent]);

  useEffect(() => { fetchAllNonChatData(); }, [fetchAllNonChatData]);
  useEffect(() => { fetchChatHistory(); }, [fetchChatHistory]);
  useInterval(fetchAllNonChatData, 10000);
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
        // Success: keep user message, add Pi's response
        setChatHistory(prev => [...prev.slice(0, -1), userMsg, result.piResponse!]);
      } else if (result.piResponse) {
        // API returned a response even though success=false (edge case)
        setChatHistory(prev => [...prev.slice(0, -1), userMsg, result.piResponse!]);
      } else {
        // No response at all: remove optimistic user message and add error
        setChatHistory(prev => [...prev.slice(0, -1)]);
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          text: result.error || 'The aether remained silent... please try again.',
          time: Date.now(),
          isError: true
        };
        setChatHistory(prev => [...prev, errorMsg]);
      }
    } catch (error) {
      // Network or unexpected error: remove optimistic user message and add error
      setChatHistory(prev => [...prev.slice(0, -1)]);
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
  }, [selectedAgent]);

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

      {/* MAIN CONTENT */}
      <main className={`relative z-10 grid ${sidebarsCollapsed ? 'grid-cols-[0%_100%] w-[98%] mx-auto mt-4' : 'grid-cols-[11%_89%] w-[90%] mx-auto mt-6 mb-2'} ultra-glass overflow-hidden transition-all duration-700 h-[55vh] ${selectedApp ? 'blur-xl scale-95 opacity-30 grayscale pointer-events-none' : 'opacity-100 scale-100'}`}>
        
        {/* SIDEBAR */}
        <nav className={`main-menu-glass border-r border-white/20 h-full flex flex-col justify-between transition-opacity duration-500 ${sidebarsCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
          <div>
            <div className="flex flex-col items-center py-8 cursor-pointer" onClick={() => setSidebarsCollapsed(true)} title="Collapse sidebars">
              <div className="w-16 h-16 rounded-full border-2 border-white/20 p-1 mb-4 flex items-center justify-center overflow-hidden bg-white/5 hover:bg-white/10 transition-colors">
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
        <section className={`grid ${sidebarsCollapsed ? 'grid-cols-[100%_0%]' : 'grid-cols-[73%_27%]'}`}>
          
          {/* LEFT CONTENT */}
          <div className="p-8 overflow-y-auto max-h-[90vh] custom-scrollbar">
            
            {/* VIEW: DISCOVER */}
            {activeView === 'discover' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Header / Search */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    {sidebarsCollapsed && (
                      <button onClick={() => setSidebarsCollapsed(false)} className="text-xl hover:scale-110 transition-transform" title="Expand sidebars">🧙‍♂️</button>
                    )}
                    <h1 className="text-2xl font-bold text-white uppercase tracking-widest">Discover Missions</h1>
                  </div>
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
                <div className="mb-12 grid grid-cols-3 gap-6">
                  <div className="col-span-2">
                    <TemporalFluxCell events={calendarEvents} onRefresh={fetchAllNonChatData} />
                  </div>
                  <div className="col-span-1 bg-black/20 rounded-2xl border border-white/10">
                    {/* Widget placeholder - to be filled */}
                  </div>
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
                     onCreate={() => {
                       const emptyApp: AppItem = {
                         id: 'new',
                         name: '',
                         icon: '🌐',
                         badge: '',
                         status: 'idle',
                         colorClass: 'bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a]',
                         url: '#',
                         isEmbedded: true,
                         appType: 'web'
                       };
                       setSelectedApp(emptyApp);
                       setIsEditMode(false);
                       setStartInFullscreen(false);
                     }}
                   />
                </div>

                {/* Todo Board */}
                <div className="mb-12">
                   <TodoBoardCell />
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
          <div className={`border-l border-white/20 p-8 flex flex-col transition-all duration-500 ${sidebarsCollapsed ? 'opacity-0 p-0 overflow-hidden border-l-0' : 'opacity-100'}`}>
            
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
