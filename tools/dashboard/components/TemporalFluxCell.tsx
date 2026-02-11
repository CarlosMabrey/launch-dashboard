import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CalendarEvent } from '../services/piService';
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '../services/piService';

// Utility hooks (replicated from App.tsx for modularity)
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

/**
 * Calculate position and height for an event in week view
 * Returns top offset (minutes from start of day) and height (duration in minutes)
 */
function getEventPosition(event: any) {
  const start = event.start?.dateTime ? new Date(event.start.dateTime) : new Date(event.start.date);
  const end = event.end?.dateTime ? new Date(event.end.dateTime) : new Date(event.end.date || event.start.date);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const height = Math.max(endMinutes - startMinutes, 30); // minimum 30 min height for visibility
  return { top: startMinutes, height };
}

// Design tokens (match App.tsx)
const GLASS = 'bg-white/5 backdrop-blur-xl border border-white/10';
const GLASS_HOVER = 'hover:bg-white/10 hover:border-white/20';
const ACCENT = {
  emerald: 'from-emerald-500/20 to-emerald-600/5',
  blue: 'from-sky-500/20 to-sky-600/5',
  red: 'from-rose-500/20 to-rose-600/5',
  purple: 'from-violet-500/20 to-violet-600/5',
  amber: 'from-amber-500/20 to-amber-600/5',
};

// Category colors for events
const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; ring: string }> = {
  work: { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-700', ring: 'ring-blue-500/30' },
  personal: { bg: 'bg-green-500/20', border: 'border-green-500/40', text: 'text-green-700', ring: 'ring-green-500/30' },
  van: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-700', ring: 'ring-emerald-500/30' },
  health: { bg: 'bg-rose-500/20', border: 'border-rose-500/40', text: 'text-rose-700', ring: 'ring-rose-500/30' },
  finance: { bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-700', ring: 'ring-amber-500/30' },
  meeting: { bg: 'bg-violet-500/20', border: 'border-violet-500/40', text: 'text-violet-700', ring: 'ring-violet-500/30' },
  focus: { bg: 'bg-indigo-500/20', border: 'border-indigo-500/40', text: 'text-indigo-700', ring: 'ring-indigo-500/30' },
  social: { bg: 'bg-pink-500/20', border: 'border-pink-500/40', text: 'text-pink-700', ring: 'ring-pink-500/30' },
  other: { bg: 'bg-gray-500/20', border: 'border-gray-500/40', text: 'text-gray-700', ring: 'ring-gray-500/30' },
};

const DEFAULT_CATEGORY = 'other';

interface TemporalFluxProps {
  events: CalendarEvent[];
  onRefresh: () => Promise<void>;
}

interface EventWithCategory extends CalendarEvent {
  isRecurring?: boolean;
}

interface ConflictSet {
  [eventId: string]: Set<string>;
}

export default function TemporalFluxCell({ events, onRefresh }: TemporalFluxProps) {
  // ─── State ─────────────────────────────────────────────────────────────────────
  const [view, setView] = useState<'month' | 'week' | 'day'>(() => {
    const saved = localStorage.getItem('calendar_last_view');
    return (saved as 'month' | 'week' | 'day') || 'month';
  });
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const saved = localStorage.getItem('calendar_current_date');
    return saved ? new Date(JSON.parse(saved)) : new Date();
  });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<EventWithCategory | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithCategory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [draggedEvent, setDraggedEvent] = useState<EventWithCategory | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; event: EventWithCategory } | null>(null);
  const [conflicts, setConflicts] = useState<ConflictSet>({});

  // Form state
  const [title, setTitle] = useState('');
  const [startDateTime, setStartDateTime] = useState('');
  const [endDateTime, setEndDateTime] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<string>(DEFAULT_CATEGORY);
  const [isAllDay, setIsAllDay] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);

  // ─── Persistence ─────────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('calendar_last_view', view);
  }, [view]);

  useEffect(() => {
    localStorage.setItem('calendar_current_date', JSON.stringify(currentDate));
  }, [currentDate]);

  // ─── Mobile Detection ───────────────────────────────────────────────────────
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-collapse to week view on mobile
  useEffect(() => {
    if (isMobile && view === 'month') {
      setView('week');
    }
  }, [isMobile, view]);

  // ─── Keyboard Shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showModal) {
        if (e.key === 'Escape') {
          setShowModal(false);
          resetForm();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          navigatePrevious();
          break;
        case 'ArrowRight':
          e.preventDefault();
          navigateNext();
          break;
        case 'Enter':
          e.preventDefault();
          openCreateModal(selectedDate);
          break;
        case 'Escape':
          setSelectedEvent(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal, view, selectedDate]);

  // ─── Drag and Drop Handlers ───────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, event: EventWithCategory) => {
    setDraggedEvent(event);
    e.dataTransfer.effectAllowed = 'move';
    (e.target as HTMLElement).style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = '1';
    setDraggedEvent(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnDate = (date: Date) => {
    if (!draggedEvent) return;

    const newStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const oldStart = new Date(draggedEvent.start.dateTime || draggedEvent.start.date || Date.now());
    const oldEnd = new Date(draggedEvent.end?.dateTime || draggedEvent.end?.date || oldStart);
    const durationMs = oldEnd.getTime() - oldStart.getTime();
    const newEnd = new Date(newStart.getTime() + durationMs);

    updateEvent(draggedEvent.id, {
      ...draggedEvent,
      start: { dateTime: newStart.toISOString() },
      end: { dateTime: newEnd.toISOString() },
    });

    setDraggedEvent(null);
  };

  // ─── Event CRUD ───────────────────────────────────────────────────────────────
  const openCreateModal = (date?: Date) => {
    const baseDate = date || selectedDate;
    const dateStr = baseDate.toISOString().split('T')[0];
    setStartDateTime(`${dateStr}T09:00:00`);
    setEndDateTime(`${dateStr}T10:00:00`);
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (event: EventWithCategory) => {
    setEditingEvent(event);
    setTitle(event.summary);
    setDescription(event.description || '');
    setLocation(event.location || '');
    setCategory(event.category || DEFAULT_CATEGORY);

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

  const updateEvent = async (eventId: string, updatedEvent: EventWithCategory) => {
    const eventBody = {
      summary: updatedEvent.summary,
      start: updatedEvent.start,
      end: updatedEvent.end,
      description: updatedEvent.description,
      location: updatedEvent.location,
      ...(updatedEvent.category && { category: updatedEvent.category })
    };
    await updateCalendarEvent(eventId, eventBody);
    await onRefresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const eventBody = {
      summary: title,
      start: isAllDay ? { date: startDateTime.split('T')[0] } : { dateTime: startDateTime },
      end: isAllDay ? { date: endDateTime.split('T')[0] } : { dateTime: endDateTime },
      description,
      location,
      category,
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
    setCategory(DEFAULT_CATEGORY);
    setIsAllDay(false);
    setEditingEvent(null);
  };

  // ─── Conflict Detection ───────────────────────────────────────────────────────
  useEffect(() => {
    const overlapMap: ConflictSet = {};
    const timedEvents = events.filter(ev => ev.start.dateTime && ev.end?.dateTime);
    for (let i = 0; i < timedEvents.length; i++) {
      for (let j = i + 1; j < timedEvents.length; j++) {
        const a = timedEvents[i];
        const b = timedEvents[j];
        const aStart = new Date(a.start.dateTime!).getTime();
        const aEnd = new Date(a.end!.dateTime!).getTime();
        const bStart = new Date(b.start.dateTime!).getTime();
        const bEnd = new Date(b.end!.dateTime!).getTime();

        const overlaps = (aStart < bEnd && aEnd > bStart);
        if (overlaps) {
          if (!overlapMap[a.id]) overlapMap[a.id] = new Set();
          if (!overlapMap[b.id]) overlapMap[b.id] = new Set();
          overlapMap[a.id].add(b.id);
          overlapMap[b.id].add(a.id);
        }
      }
    }
    setConflicts(overlapMap);
  }, [events]);

  // ─── Date Utilities ───────────────────────────────────────────────────────────
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
    const filtered = events.filter(ev => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = ev.summary.toLowerCase().includes(q);
        const matchesDesc = ev.description?.toLowerCase().includes(q) || false;
        const matchesLocation = ev.location?.toLowerCase().includes(q) || false;
        return matchesTitle || matchesDesc || matchesLocation;
      }
      return true;
    });
    return filtered
      .filter(event => (event.start.dateTime || event.start.date)?.split('T')[0] === dateStr)
      .sort((a, b) => {
        const aTime = a.start.dateTime || a.start.date || '';
        const bTime = b.start.dateTime || b.start.date || '';
        return aTime.localeCompare(bTime);
      });
  };

  const getBusynessLevel = (date: Date): number => {
    const dayEvents = getEventsForDate(date);
    if (dayEvents.length === 0) return 0;
    if (dayEvents.length <= 2) return 1;
    if (dayEvents.length <= 4) return 2;
    return 3;
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

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getDate() === d2.getDate() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getFullYear() === d2.getFullYear();
  };

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

  // ─── Navigation ───────────────────────────────────────────────────────────────
  const navigatePrevious = () => {
    setIsAnimating(true);
    const next = new Date(currentDate);
    if (view === 'month') {
      next.setMonth(next.getMonth() - 1);
    } else if (view === 'week') {
      next.setDate(next.getDate() - 7);
    } else {
      next.setDate(next.getDate() - 1);
    }
    setCurrentDate(next);
    setTimeout(() => setIsAnimating(false), 250);
  };

  const navigateNext = () => {
    setIsAnimating(true);
    const next = new Date(currentDate);
    if (view === 'month') {
      next.setMonth(next.getMonth() + 1);
    } else if (view === 'week') {
      next.setDate(next.getDate() + 7);
    } else {
      next.setDate(next.getDate() + 1);
    }
    setCurrentDate(next);
    setTimeout(() => setIsAnimating(false), 250);
  };

  const navigateToday = () => {
    setIsAnimating(true);
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
    setTimeout(() => setIsAnimating(false), 250);
  };

  // ─── Interaction Handlers ─────────────────────────────────────────────────────
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setView('day'); // Switch to day view when clicking a date
  };

  const handleEventClick = (event: EventWithCategory, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEvent(event);
    openEditModal(event);
  };

  const handleEventHover = (e: React.MouseEvent, event: EventWithCategory) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
      event,
    });
  };

  const handleEventLeave = () => {
    setTooltip(null);
  };

  const formatHour = (hour: number) => {
    return hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
  };

  // ─── Render Views ─────────────────────────────────────────────────────────────
  const renderMonthView = () => {
    const days = getDaysForView();
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className={`grid grid-cols-7 ${GLASS} border-b`}>
          {weekDays.map(day => (
            <div key={day} className="text-center text-[11px] font-medium text-white/50 py-3 uppercase tracking-wider">
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
            const busyness = getBusynessLevel(date);

            return (
              <div
                key={idx}
                onClick={() => handleDateClick(date)}
                onDragOver={(e) => handleDragOver(e)}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOnDate(date);
                }}
                className={`${GLASS} border-b border-r p-2 min-h-[100px] cursor-pointer transition-colors duration-200 hover:bg-white/10 ${!isCurrentMonth ? 'text-white/30' : ''} ${isSelectedDate ? 'bg-white/10' : ''}`}
              >
                <div className={`text-sm font-medium mb-1.5 w-6 h-6 flex items-center justify-center rounded-full ${isTodayDate ? 'bg-[var(--aura-4)] text-white font-semibold ring-2 ring-[color:color-mix(in_srgb,var(--aura-4)_50%,transparent)]' : 'text-white/80'} ${isSelectedDate ? 'ring-1 ring-[color:color-mix(in_srgb,var(--aura-4)_50%,transparent)]' : ''}`}>
                  {date.getDate()}
                </div>
                <div className="flex gap-0.5 mb-1">
                  {busyness >= 1 && <div className="w-1.5 h-1.5 rounded-full bg-[var(--aura-4)]" />}
                  {busyness >= 2 && <div className="w-1.5 h-1.5 rounded-full bg-[var(--aura-4)]" />}
                  {busyness >= 3 && <div className="w-1.5 h-1.5 rounded-full bg-[var(--aura-4)]" />}
                </div>
                <div className="space-y-0.5 overflow-hidden">
                  {dateEvents.slice(0, 3).map(event => {
                    const catColor = CATEGORY_COLORS[event.category || DEFAULT_CATEGORY];
                    const isConflicting = conflicts[event.id]?.size > 0;
                    return (
                      <div
                        key={event.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, event)}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => handleEventClick(event, e)}
                        onMouseEnter={(e) => handleEventHover(e, event)}
                        onMouseLeave={handleEventLeave}
                        className={`text-[10px] px-1.5 py-0.5 rounded truncate ${catColor.bg} ${catColor.border} border-l-2 cursor-pointer transition-colors ${isConflicting ? 'ring-1 ring-rose-500/50' : ''}`}
                        title={event.summary}
                      >
                        {event.summary}
                      </div>
                    );
                  })}
                  {dateEvents.length > 3 && (
                    <div className="text-[10px] text-white/30 px-1.5">
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
      <div className="flex-1 flex overflow-hidden" ref={containerRef}>
        <div className="w-14 pr-3 text-right bg-white/5">
          <div className="h-10" />
          {hourSlots.map(hour => (
            <div key={hour} className="h-16 text-[10px] text-white/50 text-right pt-2 font-medium">
              {formatHour(hour)}
            </div>
          ))}
        </div>

        <div className="flex-1">
          <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(120px, 1fr))` }}>
            {days.map((date, idx) => (
              <div key={idx} className={`text-center border-b ${GLASS}`}>
                <div className={`text-[11px] font-medium py-2 uppercase tracking-wide ${isToday(date) ? 'text-[var(--aura-4)]' : 'text-white/50'}`}>
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className={`text-lg font-semibold py-1 mb-1 ${isToday(date) ? 'text-[var(--aura-4)]' : 'text-white'} ${isSelected(date) ? 'bg-[var(--aura-4)] text-white rounded-full w-8 h-8 mx-auto flex items-center justify-center' : ''}`}>
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
                      onClick={() => handleDateClick(date)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDropOnDate(date);
                      }}
                      className={`${GLASS} border-b border-r relative h-16 cursor-pointer transition-colors duration-150 hover:bg-white/10 ${isSelected(date) ? 'bg-white/10' : ''}`}
                    >
                      {dayEvents.map(event => {
                        const pos = getEventPosition(event);
                        if (Math.floor(pos.top / 60) !== hour) return null;
                        const catColor = CATEGORY_COLORS[event.category || DEFAULT_CATEGORY];
                        const isConflicting = conflicts[event.id]?.size > 0;
                        return (
                          <div
                            key={event.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, event)}
                            onDragEnd={handleDragEnd}
                            onClick={(e) => handleEventClick(event, e)}
                            onMouseEnter={(e) => handleEventHover(e, event)}
                            onMouseLeave={handleEventLeave}
                            className={`absolute left-0.5 right-0.5 ${catColor.bg} border ${catColor.border} rounded px-1.5 py-1 text-[10px] text-gray-900 cursor-pointer pointer-events-auto hover:brightness-110 transition-colors ${isConflicting ? 'ring-1 ring-rose-500' : ''}`}
                            style={{
                              top: `${pos.top % 60}px`,
                              height: `${Math.max(pos.height, 30)}px`
                            }}
                          >
                            <div className="font-medium truncate">{event.summary}</div>
                            {event.location && (
                              <div className="text-[9px] text-gray-600 truncate">{event.location}</div>
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
    const dayEvents = getEventsForDate(selectedDate).filter(ev => ev.start.dateTime || ev.start.date);
    const sortedEvents = [...dayEvents].sort((a, b) => {
      const aTime = a.start.dateTime || a.start.date || '';
      const bTime = b.start.dateTime || b.start.date || '';
      return aTime.localeCompare(bTime);
    });

    return (
      <div className="flex-1 flex overflow-hidden bg-white/5">
        <div className="w-32 pr-3 text-right border-r border-white/10 py-4">
          <div className="text-[11px] font-medium text-white/50 uppercase tracking-wide mb-3">Time</div>
          {getHourSlots().map(hour => (
            <div key={hour} className="h-10 text-[11px] text-white/50 text-right pt-2 font-medium leading-none">
              {formatHour(hour)}
            </div>
          ))}
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
          <div className="text-[11px] font-medium text-white/50 uppercase tracking-wide mb-3">Events</div>
          <div className="space-y-2">
            {sortedEvents.map(event => {
              const catColor = CATEGORY_COLORS[event.category || DEFAULT_CATEGORY];
              const isConflicting = conflicts[event.id]?.size > 0;
              const timeStr = event.start.dateTime
                ? new Date(event.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'All day';

              return (
                <div
                  key={event.id}
                  onClick={() => openEditModal(event)}
                  className={`p-3 rounded-lg ${catColor.bg} border ${catColor.border} ${isConflicting ? 'ring-1 ring-rose-500' : ''} cursor-pointer hover:brightness-110 transition-colors`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{event.summary}</div>
                      {event.location && (
                        <div className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                          <span>📍</span>{event.location}
                        </div>
                      )}
                    </div>
                    <div className="text-xs font-mono text-gray-500 whitespace-nowrap">{timeStr}</div>
                  </div>
                  {event.description && (
                    <div className="text-xs text-gray-600 mt-2 line-clamp-2">{event.description}</div>
                  )}
                </div>
              );
            })}
            {sortedEvents.length === 0 && (
              <div className="text-center text-white/30 py-8">
                <p>No events scheduled</p>
                <p className="text-xs mt-1">Click anywhere or press Enter to create</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (events.length === 0) {
    return (
      <div className={`${GLASS} rounded-2xl border border-white/10 p-12 flex items-center justify-center`}>
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[var(--aura-4)] border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-sm font-medium text-white/60">Loading events…</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${GLASS} rounded-2xl border border-white/10 overflow-hidden transition-all duration-300 ${isAnimating ? 'opacity-80 scale-[0.997]' : 'opacity-100 scale-100'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/20 bg-white/80">
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            <button
              onClick={navigatePrevious}
              className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              aria-label="Previous"
            >
              <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={navigateNext}
              className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              aria-label="Next"
            >
              <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <button
            onClick={navigateToday}
            disabled={isCurrentPeriod}
            className={`px-5 py-2 text-xs font-medium uppercase tracking-wide rounded-full transition-all ${
              isCurrentPeriod
                ? 'bg-transparent text-transparent'
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
            }`}
          >
            Today
          </button>

          <h2 className="text-base font-semibold text-gray-900 min-w-[160px] text-center tracking-tight">
            {formatDateDisplay()}
          </h2>
        </div>

        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events…"
            className="pl-8 pr-3 py-1.5 w-48 text-xs rounded-full bg-white/10 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[var(--aura-4)]"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-[10px]">🔍</span>
        </div>

        {/* View Selector */}
        <div className="flex bg-white/10 rounded-lg p-1 border border-white/10">
          {(['month', 'week', 'day'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-2 text-xs font-medium uppercase tracking-wide rounded-md transition-all ${
                view === v
                  ? 'bg-white text-gray-900 shadow-sm border border-white/20'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Add Event Button */}
        <button
          onClick={() => openCreateModal()}
          className="w-12 h-12 rounded-full bg-[var(--aura-4)] hover:brightness-75 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg"
          aria-label="Add event"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Calendar Content */}
      <div className="flex-1 overflow-hidden">
        {view === 'month' && renderMonthView()}
        {view === 'week' && renderWeekView()}
        {view === 'day' && renderDayView()}
      </div>

      {/* Floating Today Button */}
      {!isCurrentPeriod && (
        <button
          onClick={navigateToday}
          className="fixed bottom-6 right-6 z-30 px-4 py-2 rounded-full bg-[var(--aura-4)] hover:brightness-75 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-[color:color-mix(in_srgb,var(--aura-4)_30%,transparent)] transition-transform hover:scale-105 active:scale-95"
        >
          Today
        </button>
      )}

      {/* Event Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`${GLASS} backdrop-blur-2xl rounded-2xl shadow-2xl w-full max-w-md border border-white/10 overflow-hidden transition-all duration-300`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b border-white/10`}>
              <h3 className="text-base font-semibold text-white">
                {editingEvent ? 'Edit Event' : 'New Event'}
              </h3>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="text-white/50 hover:text-white transition-colors"
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
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--aura-4)] transition-all"
                  placeholder="Add title"
                />
              </div>

              {/* Category Selector */}
              <div>
                <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[var(--aura-4)] transition-all"
                >
                  {Object.keys(CATEGORY_COLORS).map(cat => (
                    <option key={cat} value={cat} className="bg-gray-800 text-white">{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                  ))}
                </select>
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
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[var(--aura-4)] transition-all"
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
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[var(--aura-4)] transition-all"
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
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[var(--aura-4)] transition-all"
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
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[var(--aura-4)] transition-all"
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
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--aura-4)] transition-all"
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
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--aura-4)] transition-all"
                  placeholder="Add description"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-[var(--aura-4)] hover:brightness-75 disabled:brightness-50 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-all disabled:cursor-not-allowed shadow-lg"
                >
                  {isSubmitting ? 'Saving…' : editingEvent ? 'Save Changes' : 'Add Event'}
                </button>
                {editingEvent && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-sm font-medium transition-all disabled:cursor-not-allowed"
                  >
                    Delete
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-3 py-2 bg-white/95 backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl text-xs text-gray-900 max-w-xs transform -translate-x-1/2 -translate-y-full pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y - 8 }}
        >
          <div className="font-bold mb-1">{tooltip.event.summary}</div>
          <div className="text-gray-600 mb-1">
            {tooltip.event.start.dateTime || tooltip.event.start.date}
            {tooltip.event.end?.dateTime && ` – ${new Date(tooltip.event.end.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
          </div>
          {tooltip.event.location && <div className="text-gray-600 mb-1">📍 {tooltip.event.location}</div>}
          {tooltip.event.description && <div className="text-gray-600 mb-1">{tooltip.event.description}</div>}
          {tooltip.event.category && <div className="text-[10px] uppercase text-gray-500">Category: {tooltip.event.category}</div>}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
            <div className="w-2 h-2 bg-white/95 border border-white/20 rotate-45" />
          </div>
        </div>
      )}
    </div>
  );
}
