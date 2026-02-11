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
// Design tokens (match App.tsx + Hybrid Mockup)
const GLASS = 'bg-[#0a0a12]/70 backdrop-blur-3xl border border-white/10';
const GLASS_HOVER = 'hover:bg-[#0a0a12]/80 hover:border-white/20';
const ACCENT = {
  emerald: 'from-emerald-500/20 to-emerald-600/5',
  blue: 'from-sky-500/20 to-sky-600/5',
  red: 'from-rose-500/20 to-rose-600/5',
  purple: 'from-violet-500/20 to-violet-600/5',
  amber: 'from-amber-500/20 to-amber-600/5',
};

// Default category colors (fallback if localStorage is empty)
const DEFAULT_CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; ring: string }> = {
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

// Predefined color themes (Tailwind classes)
const COLOR_THEMES: Record<string, { bg: string; border: string; text: string; ring: string }> = {
  blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-700', ring: 'ring-blue-500/30' },
  emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-700', ring: 'ring-emerald-500/30' },
  rose: { bg: 'bg-rose-500/20', border: 'border-rose-500/40', text: 'text-rose-700', ring: 'ring-rose-500/30' },
  violet: { bg: 'bg-violet-500/20', border: 'border-violet-500/40', text: 'text-violet-700', ring: 'ring-violet-500/30' },
  amber: { bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-700', ring: 'ring-amber-500/30' },
  cyan: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/40', text: 'text-cyan-700', ring: 'ring-cyan-500/30' },
  pink: { bg: 'bg-pink-500/20', border: 'border-pink-500/40', text: 'text-pink-700', ring: 'ring-pink-500/30' },
  indigo: { bg: 'bg-indigo-500/20', border: 'border-indigo-500/40', text: 'text-indigo-700', ring: 'ring-indigo-500/30' },
  gray: { bg: 'bg-gray-500/20', border: 'border-gray-500/40', text: 'text-gray-700', ring: 'ring-gray-500/30' },
  lime: { bg: 'bg-lime-500/20', border: 'border-lime-500/40', text: 'text-lime-700', ring: 'ring-lime-500/30' },
  orange: { bg: 'bg-orange-500/20', border: 'border-orange-500/40', text: 'text-orange-700', ring: 'ring-orange-500/30' },
  teal: { bg: 'bg-teal-500/20', border: 'border-teal-500/40', text: 'text-teal-700', ring: 'ring-teal-500/30' },
  fuchsia: { bg: 'bg-fuchsia-500/20', border: 'border-fuchsia-500/40', text: 'text-fuchsia-700', ring: 'ring-fuchsia-500/30' },
  sky: { bg: 'bg-sky-500/20', border: 'border-sky-500/40', text: 'text-sky-700', ring: 'ring-sky-500/30' },
  yellow: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-700', ring: 'ring-yellow-500/30' },
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

  // Category management state
  const [categoryColors, setCategoryColors] = useState<Record<string, { bg: string; border: string; text: string; ring: string }>>(() => {
    try {
      const saved = localStorage.getItem('calendar_category_colors');
      return saved ? JSON.parse(saved) : DEFAULT_CATEGORY_COLORS;
    } catch {
      return DEFAULT_CATEGORY_COLORS;
    }
  });
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [tempCategoryColors, setTempCategoryColors] = useState<Record<string, { bg: string; border: string; text: string; ring: string }>>(categoryColors);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const dayViewScrollRef = useRef<HTMLDivElement>(null);
  const weekViewScrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(new Date());

  // ─── Real-time Clock for Time Indicator ───────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // ─── Auto-scroll to Current Time ──────────────────────────────────────────
  useEffect(() => {
    const hours = now.getHours();
    const minutes = now.getMinutes();

    const performScroll = () => {
      if (view === 'day' && dayViewScrollRef.current && isToday(selectedDate)) {
        const containerHeight = dayViewScrollRef.current.clientHeight || 500;
        const scrollPos = ((hours + minutes / 60) * 80) + 32 - (containerHeight / 2);
        dayViewScrollRef.current.scrollTo({ top: Math.max(0, scrollPos), behavior: 'smooth' });
      }

      if (view === 'week' && weekViewScrollRef.current) {
        const { start, end } = getWeekRange(currentDate);
        const today = new Date();
        if (today >= start && today <= end) {
          const containerHeight = weekViewScrollRef.current.clientHeight || 500;
          const scrollPos = ((hours + minutes / 60) * 64) - (containerHeight / 2);
          weekViewScrollRef.current.scrollTo({ top: Math.max(0, scrollPos), behavior: 'smooth' });
        }
      }
    };

    // Use a small timeout to ensure the DOM is painted and clientHeight is accurate,
    // especially after transitioning from the loading state.
    const scrollTimeout = setTimeout(performScroll, 100);
    return () => clearTimeout(scrollTimeout);
  }, [view, selectedDate, currentDate, events]); // Added events to dependency array

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

  // Format date for datetime-local input (local time, no timezone)
  function formatDateTimeLocal(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  // ─── Event CRUD ───────────────────────────────────────────────────────────────
  const openCreateModal = (date?: Date, hour?: number) => {
    const baseDate = date || selectedDate;
    const year = baseDate.getFullYear();
    const month = String(baseDate.getMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    if (hour !== undefined) {
      const startH = String(hour).padStart(2, '0');
      const endH = String((hour + 1) % 24).padStart(2, '0');
      setStartDateTime(`${dateStr}T${startH}:00:00`);
      setEndDateTime(`${dateStr}T${endH}:00:00`);
    } else {
      setStartDateTime(`${dateStr}T09:00:00`);
      setEndDateTime(`${dateStr}T10:00:00`);
    }
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
      setStartDateTime(formatDateTimeLocal(start));
      setEndDateTime(formatDateTimeLocal(end));
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

  // Toggle all-day with proper date/datetime conversion
  const toggleAllDay = () => {
    if (isAllDay) {
      // Converting to all-day: strip time portion
      setStartDateTime(startDateTime.split('T')[0]);
      setEndDateTime(endDateTime.split('T')[0]);
    } else {
      // Converting to timed: add default times (preserve date part)
      const datePart = startDateTime.split('T')[0] || formatDateTimeLocal(new Date()).split('T')[0];
      const endDatePart = endDateTime.split('T')[0] || datePart;
      setStartDateTime(`${datePart}T09:00`);
      setEndDateTime(`${endDatePart}T10:00`);
    }
    setIsAllDay(!isAllDay);
  };

  // ─── Category Color Management ─────────────────────────────────────────────────
  const openCategoryManager = () => {
    setTempCategoryColors({ ...categoryColors });
    setShowCategoryManager(true);
    setNewCategoryName('');
    setEditingCategory(null);
  };

  const saveCategoryColors = () => {
    setCategoryColors(tempCategoryColors);
    localStorage.setItem('calendar_category_colors', JSON.stringify(tempCategoryColors));
    setShowCategoryManager(false);
  };

  const addNewCategory = () => {
    if (!newCategoryName.trim()) return;
    const name = newCategoryName.toLowerCase().replace(/\s+/g, '-');
    if (tempCategoryColors[name]) return; // Already exists

    // Assign a random color from a palette of accent colors
    const accentColors = [
      { bg: 'bg-cyan-500/20', border: 'border-cyan-500/40', text: 'text-cyan-700', ring: 'ring-cyan-500/30' },
      { bg: 'bg-lime-500/20', border: 'border-lime-500/40', text: 'text-lime-700', ring: 'ring-lime-500/30' },
      { bg: 'bg-orange-500/20', border: 'border-orange-500/40', text: 'text-orange-700', ring: 'ring-orange-500/30' },
      { bg: 'bg-teal-500/20', border: 'border-teal-500/40', text: 'text-teal-700', ring: 'ring-teal-500/30' },
      { bg: 'bg-fuchsia-500/20', border: 'border-fuchsia-500/40', text: 'text-fuchsia-700', ring: 'ring-fuchsia-500/30' },
      { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-700', ring: 'ring-yellow-500/30' },
      { bg: 'bg-sky-500/20', border: 'border-sky-500/40', text: 'text-sky-700', ring: 'ring-sky-500/30' },
      { bg: 'bg-rose-500/20', border: 'border-rose-500/40', text: 'text-rose-700', ring: 'ring-rose-500/30' },
      { bg: 'bg-violet-500/20', border: 'border-violet-500/40', text: 'text-violet-700', ring: 'ring-violet-500/30' },
      { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-700', ring: 'ring-emerald-500/30' },
    ];
    const randomColor = accentColors[Math.floor(Math.random() * accentColors.length)];

    setTempCategoryColors({
      ...tempCategoryColors,
      [name]: randomColor
    });
    setNewCategoryName('');
  };

  const updateCategoryColor = (catName: string, field: keyof typeof DEFAULT_CATEGORY_COLORS, value: string) => {
    setTempCategoryColors(prev => ({
      ...prev,
      [catName]: {
        ...prev[catName],
        [field]: value
      }
    }));
  };

  const deleteCategory = (catName: string) => {
    if (catName === DEFAULT_CATEGORY) return; // Can't delete default
    const { [catName]: _, ...rest } = tempCategoryColors;
    setTempCategoryColors(rest);
    if (editingCategory === catName) setEditingCategory(null);
    // If the current selected category was deleted, reset to default
    if (category === catName) setCategory(DEFAULT_CATEGORY);
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
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

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
      .filter(event => (event.start.dateTime || event.start.date)?.startsWith(dateStr))
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
    if (view === 'day') setSelectedDate(next);
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
    if (view === 'day') setSelectedDate(next);
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
    setCurrentDate(date); // Sync header date
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
                className={`border-b border-r p-3 min-h-[120px] cursor-pointer transition-all duration-300 hover:bg-white/[0.04] ${!isCurrentMonth ? 'opacity-20 translate-y-0' : 'opacity-100'} ${isSelectedDate ? 'bg-white/[0.08]' : ''} relative group/cell`}
              >
                {/* Cell Highlight */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover/cell:opacity-100 transition-opacity" />

                <div className="relative z-10">
                  <div className={`text-xs font-bold mb-3 w-7 h-7 flex items-center justify-center rounded-xl transition-all ${isTodayDate ? 'bg-[var(--aura-4)] text-white shadow-[0_0_15px_var(--aura-4)]' : 'text-white/40 group-hover/cell:text-white/80'} ${isSelectedDate ? 'border border-white/20' : ''}`}>
                    {date.getDate()}
                  </div>

                  <div className="space-y-1.5">
                    {dateEvents.slice(0, 4).map(event => {
                      const catColor = categoryColors[event.category] || categoryColors[DEFAULT_CATEGORY];
                      return (
                        <div
                          key={event.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, event)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => handleEventClick(event, e)}
                          className={`text-[9px] font-medium px-2 py-1 rounded-lg truncate ${catColor.bg} border-l-2 ${catColor.border} text-white/90 hover:brightness-125 transition-all active:scale-95`}
                        >
                          {event.summary}
                        </div>
                      );
                    })}
                    {dateEvents.length > 4 && (
                      <div className="text-[9px] text-white/20 font-bold tracking-widest px-2 uppercase">
                        +{dateEvents.length - 4} Shift
                      </div>
                    )}
                  </div>
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
      <div className="flex-1 flex flex-col overflow-hidden" ref={containerRef}>
        {/* Week Day Headers (Sticky-like) */}
        <div className="flex border-b border-white/10 shrink-0">
          <div className="w-14 pr-3 bg-white/5" />
          <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(120px, 1fr))` }}>
            {days.map((date, idx) => (
              <div key={idx} className={`text-center py-2 ${GLASS} border-b-0`}>
                <div className={`text-[10px] font-medium uppercase tracking-wide ${isToday(date) ? 'text-[var(--aura-4)]' : 'text-white/50'}`}>
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className={`text-sm font-semibold mt-1 ${isToday(date) ? 'text-[var(--aura-4)]' : 'text-white'}`}>
                  {date.getDate()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable Grid Body */}
        <div
          className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth custom-scrollbar"
          ref={weekViewScrollRef}
        >
          <div className="flex min-h-max">
            {/* Hour Labels */}
            <div className="w-14 pr-3 text-right bg-white/5 border-r border-white/5 shrink-0">
              {hourSlots.map(hour => (
                <div key={hour} className="h-16 text-[10px] text-white/50 text-right pt-2 font-medium">
                  {formatHour(hour)}
                </div>
              ))}
            </div>

            {/* Grid Columns */}
            <div className="flex-1 grid relative" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(120px, 1fr))` }}>
              {hourSlots.map(hour => (
                <React.Fragment key={hour}>
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
                          const catColor = categoryColors[event.category] || categoryColors[DEFAULT_CATEGORY];
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
                              className={`absolute left-0.5 right-0.5 ${catColor.bg} border ${catColor.border} rounded px-1.5 py-1 text-[10px] text-gray-900 cursor-pointer pointer-events-auto hover:brightness-110 transition-colors z-20 ${isConflicting ? 'ring-1 ring-rose-500' : ''} shadow-sm`}
                              style={{
                                top: `${pos.top % 60}px`,
                                height: `${Math.max(pos.height, 30)}px`
                              }}
                            >
                              <div className="font-medium truncate leading-tight">{event.summary}</div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
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
      <div className="flex-1 flex overflow-hidden">
        {/* Agenda Flux Timeline Column */}
        <div className="w-56 border-r border-white/5 p-6 overflow-y-auto no-scrollbar bg-white/[0.02]">
          <div className="flex items-center justify-between mb-8">
            <p className="text-[10px] font-bold tracking-[0.2em] text-white/20 uppercase">Agenda Flux</p>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--aura-4)]"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-white/10"></div>
            </div>
          </div>

          <div className="relative pl-6 border-l border-white/10 space-y-10 py-2">
            {sortedEvents.map((event, idx) => {
              const timeStr = event.start.dateTime
                ? new Date(event.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
                : 'All day';
              const isPast = event.start.dateTime && new Date(event.start.dateTime) < new Date();

              return (
                <div key={event.id} className="relative group/item cursor-pointer" onClick={() => openEditModal(event)}>
                  <div className={`absolute -left-[29px] top-0 w-3 h-3 rounded-full border-2 border-[#0a0a12] ${isPast ? 'bg-white/20' : 'bg-[var(--aura-4)] shadow-[0_0_10px_var(--aura-4)]'} transition-transform group-hover/item:scale-125`} />
                  <div className="flex flex-col transition-all group-hover/item:translate-x-2">
                    <span className={`text-[10px] font-mono ${isPast ? 'text-white/20' : 'text-[var(--aura-4)]'}`}>{timeStr}</span>
                    <h4 className={`text-sm font-medium ${isPast ? 'text-white/40 line-through' : 'text-white/90'}`}>{event.summary}</h4>
                    {!isPast && event.location && <span className="text-[9px] text-white/30 mt-1">📍 {event.location}</span>}
                  </div>
                </div>
              );
            })}
            {sortedEvents.length === 0 && (
              <div className="text-white/20 text-[11px] italic">Alignment complete. No scheduled flux.</div>
            )}
          </div>
        </div>

        {/* Detailed View Column */}
        <div
          className="flex-1 overflow-y-auto relative custom-scrollbar scroll-smooth bg-white/[0.01]"
          ref={dayViewScrollRef}
        >
          <div className="flex p-8 min-h-max">
            {/* Hour Labels */}
            <div className="w-16 pr-4 text-right border-r border-white/5 shrink-0">
              {getHourSlots().map(hour => (
                <div key={hour} className="h-20 text-[10px] text-white/20 text-right pt-2 font-mono">
                  {formatHour(hour)}
                </div>
              ))}
            </div>

            {/* Grid Area */}
            <div className="flex-1 relative">
              {/* Hour grid lines */}
              <div className="absolute inset-0 pointer-events-none">
                {getHourSlots().map(hour => (
                  <div key={hour} className="h-20 border-b border-white/[0.03]" />
                ))}
              </div>

              {/* Empty grid slots for clicking */}
              <div className="relative z-10">
                {getHourSlots().map(hour => (
                  <div
                    key={hour}
                    className="h-20 w-full hover:bg-white/[0.02] cursor-cell transition-colors"
                    onDoubleClick={() => openCreateModal(selectedDate, hour)}
                  />
                ))}
              </div>

              {/* Current Time Indicator */}
              {isToday(selectedDate) && (
                <div
                  className="absolute left-0 right-0 z-[100] flex items-center pointer-events-none translate-y-[-1px]"
                  style={{ top: `${((now.getHours() * 60 + now.getMinutes()) / 60) * 80}px` }}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,1)] -ml-1 border-2 border-white" />
                  <div className="flex-1 h-[2px] bg-gradient-to-r from-rose-500 via-rose-500/40 to-transparent" />
                  <span className="text-[10px] font-bold font-mono text-white bg-rose-500 px-2 py-0.5 rounded-full border border-rose-400 ml-2 shadow-[0_0_10px_rgba(244,63,94,0.4)]">
                    {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </span>
                </div>
              )}

              {/* Timed Events Rendered as Blocks */}
              <div className="absolute inset-0 pointer-events-none">
                {sortedEvents.filter(ev => !ev.start.date).map(event => {
                  const pos = getEventPosition(event);
                  const catColor = categoryColors[event.category] || categoryColors[DEFAULT_CATEGORY];
                  return (
                    <div
                      key={event.id}
                      onClick={(e) => { e.stopPropagation(); openEditModal(event); }}
                      className={`absolute left-0 right-4 rounded-2xl ${catColor.bg} border ${catColor.border} p-4 cursor-pointer hover:brightness-110 transition-all group z-20 pointer-events-auto shadow-lg`}
                      style={{
                        top: `${(pos.top / 60) * 80}px`, // 80px per hour
                        height: `${(pos.height / 60) * 80}px`,
                        minHeight: '40px'
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-white group-hover:text-[var(--aura-4)] transition-colors line-clamp-1">{event.summary}</h4>
                          {event.description && <p className="text-xs text-white/40 mt-1 line-clamp-2">{event.description}</p>}
                        </div>
                        <span className="text-[10px] font-mono text-white/50">{formatHour(new Date(event.start.dateTime!).getHours())}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
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
    <>
      <div className={`${GLASS} rounded-[40px] border border-white/10 overflow-hidden transition-all duration-300 ${isAnimating ? 'opacity-80 scale-[0.997]' : 'opacity-100 scale-100'} relative group h-[580px] flex flex-col`}>
        {/* Decorative Orbs */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-purple-600/10 blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-indigo-600/10 blur-[80px] pointer-events-none" />

        {/* Header (Crystal Shard Style) */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-white/5 relative z-10 bg-white/[0.02]">
          <div className="flex items-center gap-8">
            {/* Mega Date Display */}
            <div className="flex items-center gap-4">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-extrabold tracking-tighter text-white leading-none">
                  {currentDate.getDate()}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white/90 uppercase tracking-tighter">
                    {currentDate.toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  <span className="text-[9px] font-bold text-[var(--aura-4)] uppercase tracking-widest mt-0.5">
                    {currentDate.toLocaleDateString('en-US', { month: 'long' })}
                  </span>
                </div>
              </div>
            </div>

            <div className="h-8 w-px bg-white/10" />

            {/* Navigation Controls */}
            <div className="flex items-center gap-3">
              <div className="flex bg-white/5 p-1 rounded-full border border-white/10">
                <button
                  onClick={navigatePrevious}
                  className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center transition-all"
                  aria-label="Previous"
                >
                  <svg className="w-3 h-3 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={navigateNext}
                  className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center transition-all"
                  aria-label="Next"
                >
                  <svg className="w-3 h-3 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <button
                onClick={navigateToday}
                className={`text-[9px] font-bold uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border border-white/10 transition-all ${isCurrentPeriod ? 'opacity-20 pointer-events-none' : 'hover:bg-white/10 text-white'}`}
              >
                Today
              </button>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* View Selector */}
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 backdrop-blur-md">
              {(['month', 'week', 'day'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-5 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all ${view === v
                    ? 'bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.05)] border border-white/10'
                    : 'text-white/30 hover:text-white hover:bg-white/5'
                    }`}
                >
                  {v}
                </button>
              ))}
            </div>

            <div className="h-8 w-px bg-white/10" />

            {/* Add Event Button */}
            <button
              onClick={() => openCreateModal()}
              className="group/add relative flex items-center justify-center w-11 h-11 rounded-full bg-white/5 hover:bg-[var(--aura-4)] border border-white/10 transition-all duration-500"
            >
              <div className="absolute inset-0 rounded-full bg-[var(--aura-4)] blur-lg opacity-0 group-hover/add:opacity-40 transition-opacity" />
              <svg className="w-5 h-5 text-white relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            {/* Category Manager Button */}
            <button
              onClick={openCategoryManager}
              className="group/cat relative flex items-center justify-center w-11 h-11 rounded-full bg-white/5 hover:bg-purple-500/20 border border-white/10 transition-all duration-500"
              title="Manage Category Colors"
            >
              <div className="absolute inset-0 rounded-full bg-purple-500 blur-lg opacity-0 group-hover/cat:opacity-40 transition-opacity" />
              <svg className="w-5 h-5 text-white relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </button>
          </div>
        </div>

        {/* Calendar Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {view === 'month' && renderMonthView()}
          {view === 'week' && renderWeekView()}
          {view === 'day' && renderDayView()}
        </div>

        {/* */}
      </div>

      {/* Event Modal (Moved outside scaled container to avoid clipping) */}
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
                  {Object.keys(categoryColors).map(cat => (
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
                  onClick={toggleAllDay}
                  className={`relative w-11 h-6 rounded-full transition-colors ${isAllDay ? 'bg-[var(--aura-4)]' : 'bg-white/20'
                    }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isAllDay ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-1.5">
                    {isAllDay ? 'Date' : 'Start'}
                  </label>
                  <input
                    type="date"
                    required
                    value={startDateTime.split('T')[0]}
                    onChange={(e) => {
                      if (isAllDay) {
                        setStartDateTime(e.target.value);
                      } else {
                        // Preserve time portion when changing date
                        const timePart = startDateTime.split('T')[1] || '00:00';
                        setStartDateTime(`${e.target.value}T${timePart}`);
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
                        const datePart = startDateTime.split('T')[0] || '';
                        setStartDateTime(`${datePart}T${e.target.value}:00`);
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
                    type="date"
                    required
                    value={endDateTime.split('T')[0]}
                    onChange={(e) => {
                      if (isAllDay) {
                        setEndDateTime(e.target.value);
                      } else {
                        // Preserve time portion when changing date
                        const timePart = endDateTime.split('T')[1] || '00:00';
                        setEndDateTime(`${e.target.value}T${timePart}`);
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
                        const datePart = endDateTime.split('T')[0] || '';
                        setEndDateTime(`${datePart}T${e.target.value}:00`);
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
      )
      }

      {/* Category Manager Modal */}
      {showCategoryManager && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`${GLASS} backdrop-blur-2xl rounded-2xl shadow-2xl w-full max-w-2xl border border-white/10 overflow-hidden transition-all duration-300`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b border-white/10`}>
              <h3 className="text-base font-semibold text-white">
                Category Colors
              </h3>
              <button
                onClick={() => setShowCategoryManager(false)}
                className="text-white/50 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Add New Category */}
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder='New category name (e.g., "coding")'
                  className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--aura-4)] transition-all"
                />
                <button
                  type="button"
                  onClick={addNewCategory}
                  disabled={!newCategoryName.trim()}
                  className="px-5 py-2.5 bg-[var(--aura-4)] hover:brightness-75 disabled:brightness-50 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-all disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>

              {/* Category List */}
              <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                {Object.entries(tempCategoryColors).map(([catName, colors]) => {
                  const themeEntry = Object.entries(COLOR_THEMES).find(([, themeColors]) =>
                    themeColors.bg === colors.bg &&
                    themeColors.border === colors.border &&
                    themeColors.text === colors.text &&
                    themeColors.ring === colors.ring
                  );
                  const currentTheme = themeEntry ? themeEntry[0] : 'custom';

                  return (
                    <div key={catName} className={`p-4 rounded-xl ${GLASS} border border-white/5 group`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="text"
                            value={catName}
                            onChange={(e) => {
                              const newName = e.target.value.toLowerCase().replace(/\s+/g, '-');
                              if (newName && newName !== catName) {
                                setTempCategoryColors(prev => {
                                  const { [catName]: _, ...rest } = prev;
                                  return { ...rest, [newName]: prev[catName] };
                                });
                              }
                            }}
                            className="w-32 px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-[var(--aura-4)]"
                          />
                          <span className="text-xs text-white/40">
                            Click to rename
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {catName !== DEFAULT_CATEGORY && (
                            <button
                              type="button"
                              onClick={() => deleteCategory(catName)}
                              className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Color Theme Selector */}
                      <div>
                        <label className="block text-[10px] font-medium text-white/50 uppercase tracking-wider mb-1.5">
                          Color Theme
                        </label>
                        <select
                          value={currentTheme}
                          onChange={(e) => {
                            const themeName = e.target.value;
                            if (themeName !== 'custom' && COLOR_THEMES[themeName]) {
                              setTempCategoryColors(prev => ({
                                ...prev,
                                [catName]: COLOR_THEMES[themeName]
                              }));
                            }
                          }}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-[var(--aura-4)]"
                        >
                          <option value="custom" disabled>Custom (pick a theme)</option>
                          {Object.keys(COLOR_THEMES).map(theme => (
                            <option key={theme} value={theme} className="bg-gray-800 text-white">
                              {theme.charAt(0).toUpperCase() + theme.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/10 bg-white/5">
              <button
                onClick={() => setShowCategoryManager(false)}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-sm font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={saveCategoryColors}
                className="px-5 py-2.5 bg-[var(--aura-4)] hover:brightness-75 text-white rounded-xl text-sm font-medium transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tooltip */}
      {
        tooltip && (
          <div
            className="fixed z-[300] px-3 py-2 bg-white/95 backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl text-xs text-gray-900 max-w-xs transform -translate-x-1/2 -translate-y-full pointer-events-none"
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
        )
      }
    </>
  );
}


