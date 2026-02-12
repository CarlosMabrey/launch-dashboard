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
  getProjects, Project, getAgentTypes, AgentType, updateAppMetadata, getRunningServices,
  deleteAppFromRegistry
} from './services/piService';
import { getGenAIHistory, getGenAIOutputUrl } from './services/genaiService';
import { useInterval } from './hooks/useLocalStorage';
import AppWindow from './components/AppWindow';
import EmbeddedAppSidebar from './components/EmbeddedAppSidebar';
import AuraSettings from './components/AuraSettings';
import LiquidBackground from './components/LiquidBackground';
import TodoBoardKanban from './components/TodoBoardKanban';
import VoiceAssistantCell from './components/VoiceAssistantCell';
import ResourceMonitor from './components/ResourceMonitor';
import AgentRosterCell from './components/AgentRosterCell';
import GenAICell from './components/GenAICell';
import BackgroundMode from './components/BackgroundMode';
// Core Grid Components
import { SentimentScryerCell } from './components/SentimentScryerCell';
import { VanFundCell } from './components/VanFundCell';
import { ActivePulseCell } from './components/ActivePulseCell';
import AppGrimoireCell from './components/AppGrimoireCell';
import TemporalFluxCell from './components/TemporalFluxCell';
import CommandPalette from './components/CommandPalette';
import ContextMenu from './components/ContextMenu';
import TitleBar from './components/TitleBar';
import RoadmapPage from './components/RoadmapPage';
import RoadmapHeader from './components/RoadmapHeader';


// ════════════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ════════════════════════════════════════════════════════════════════════════════
export const GLASS = 'bg-white/5 backdrop-blur-xl border border-white/10';
export const GLASS_HOVER = 'hover:bg-white/10 hover:border-white/20';
export const ACCENT = {
  emerald: 'from-emerald-500/20 to-emerald-600/5',
  blue: 'from-sky-500/20 to-sky-600/5',
  red: 'from-rose-500/20 to-rose-600/5',
  purple: 'from-violet-500/20 to-violet-600/5',
  amber: 'from-amber-500/20 to-amber-600/5',
};

const App: React.FC = () => {
  // ─── State ─────────────────────────────────────────────────────────────────────
  const [apps, setApps] = useState<AppItem[]>(INITIAL_APPS);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; app: AppItem } | null>(null);

  // App Window State (for fullscreen preview)
  const [selectedApp, setSelectedApp] = useState<AppItem | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [startInFullscreen, setStartInFullscreen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<'discover' | 'genai' | 'agents' | 'logs' | 'roadmap'>(() => {
    const saved = localStorage.getItem('dashboard_active_view');
    return (saved as 'discover' | 'genai' | 'agents' | 'logs' | 'roadmap') || 'discover';
  });
  const [chatInputValue, setChatInputValue] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string>('pi');
  const [availableAgents, setAvailableAgents] = useState<AgentType[]>([]);

  // Cell data
  const [piMessages, setPiMessages] = useState<PiMessage[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [genAIHistory, setGenAIHistory] = useState<Array<{ id: string, url: string, isVideo: boolean, time: number }>>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [weather, setWeather] = useState<MarketWeather>({ vibe: 'Initializing...', trend: 'neutral', lastUpdated: Date.now() });
  const [vanFund, setVanFund] = useState<VanFundData>({ current: 0, target: 50000, contributions: [] });
  const [githubActivity, setGithubActivity] = useState<GithubActivity>({ totalContributions: 0, dailyHistory: {} });
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [sidebarsCollapsed, setSidebarsCollapsed] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(0);
  const [previewImage, setPreviewImage] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [selectedAetherIndex, setSelectedAetherIndex] = useState<number>(-1);

  // ─── Data Fetching ─────────────────────────────────────────────────────────────
  const fetchAllNonChatData = useCallback(async () => {
    const [msgs, wthr, fund, github, cal, grimoire, projs, running] = await Promise.all([
      getPiMessages(),
      getMarketWeather(),
      getVanFundData(),
      getGithubActivity(),
      getCalendarData(),
      getGrimoire(),
      getProjects(),
      getRunningServices()
    ]);
    setPiMessages(msgs);
    setWeather(wthr);
    setVanFund(fund);
    setGithubActivity(github);
    if (cal.success) setCalendarEvents(cal.events);
    setProjects(projs);

    // Update apps list from grimoire — server + registry is the single source of truth
    const runningIds = new Set(running.map(s => s.id));

    if (grimoire && grimoire.length > 0) {
      setApps(prev => {
        // Keep any optimistic local-only apps (created <10s ago, not yet on server)
        const serverIds = new Set(grimoire.map(g => g.id));
        const pendingLocals = prev.filter(local => {
          if (serverIds.has(local.id)) return false;
          if (local.id.startsWith('app-')) {
            const ts = parseInt(local.id.split('-')[1]);
            if (!isNaN(ts) && Date.now() - ts < 10000) return true;
          }
          return false;
        });

        // Server apps with running-service status AND port detection overlaid
        const serverApps = grimoire.map(app => {
          const isRunning = runningIds.has(app.id);
          const isPortOpen = app.portOpen || false;
          const isOnline = isRunning || isPortOpen;
          return {
            ...app,
            isOnline,
            isManaged: isRunning, // Track whether dashboard controls this service
            status: (isOnline ? 'active' : 'idle') as Status
          };
        });

        return [...serverApps, ...pendingLocals];
      });
    } else {
      // No grimoire results — clear apps (the server is empty)
      setApps([]);
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

  const fetchGenAIImages = useCallback(async () => {
    try {
      const history = await getGenAIHistory();
      const sortedPrompts = Object.entries(history).sort((a: any, b: any) =>
        (b[1].prompt?.[0] || 0) - (a[1].prompt?.[0] || 0)
      );

      const results: Array<{ id: string, url: string, isVideo: boolean, time: number }> = [];
      // Assign synthetic timestamps based on order relative to "now" to keep them relevant in the feed
      // usage of prompt[0] as timestamp is unreliable in all environments
      const baseTime = Date.now();

      sortedPrompts.slice(0, 10).forEach(([id, data], idx) => {
        const promptData = data as any;
        if (!promptData?.outputs) return;

        for (const nodeOutput of Object.values(promptData.outputs)) {
          const no = nodeOutput as any;
          const outs = [...(no?.images || []), ...(no?.gifs || [])];
          for (const out of outs) {
            const isVid = out.filename?.match(/\.(mp4|webm|mov|gif)$/i);
            const url = getGenAIOutputUrl(out.filename, out.type, out.subfolder);
            results.push({
              id: `${id}-${out.filename}`,
              url,
              isVideo: !!isVid,
              time: baseTime - (idx * 60000) // Deduct 1 minute per older item to stagger them
            });
          }
        }
      });
      setGenAIHistory(results);
    } catch (e) {
      // Silent fail (service might be offline)
    }
  }, []);

  const fetchChatHistory = useCallback(async () => {
    const chat = await getChatHistory(selectedAgent);
    setChatHistory(chat);
  }, [selectedAgent]);

  const fetchAgents = useCallback(async () => {
    try {
      const agents = await getAgentTypes();
      setAvailableAgents(agents);
      // Ensure selectedAgent is in the fetched list; if not, switch to first agent
      if (selectedAgent && !agents.find(a => a.id === selectedAgent) && agents.length > 0) {
        setSelectedAgent(agents[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
  }, [selectedAgent]);

  useEffect(() => { fetchAllNonChatData(); }, [fetchAllNonChatData]);
  useEffect(() => { fetchChatHistory(); }, [fetchChatHistory]);
  useEffect(() => { fetchAgents(); }, [fetchAgents]);
  useInterval(fetchAllNonChatData, 10000);
  useInterval(fetchTodos, 5000);
  useInterval(fetchGenAIImages, 5000);

  // ─── Persist activeView to localStorage ───────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('dashboard_active_view', activeView);
  }, [activeView]);

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

  // ─── Aether Feedback Keyboard Navigation ─────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle arrow keys when the image preview modal is open
      if (!previewImage) {
        return;
      }

      const target = e.target as HTMLElement;
      const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
                             target.isContentEditable ||
                             (target.getAttribute('role') === 'textbox');

      // Don't intercept if user is typing in an input
      if (isInputFocused) {
        return;
      }

      const chatItems = chatHistory.map(m => ({ ...m, type: 'chat', sortTime: m.time, url: '' }));
      const genItems = genAIHistory.map(g => ({
        id: g.id,
        type: 'genai' as const,
        text: g.isVideo ? 'Generated Video' : 'Generated Image',
        role: 'assistant' as const,
        time: g.time,
        sortTime: g.time,
        url: g.url
      }));

      const combined = [...chatItems, ...genItems]
        .sort((a, b) => b.sortTime - a.sortTime)
        .slice(0, 8);

      if (combined.length === 0) return;

      let newIndex = selectedAetherIndex;

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        newIndex = selectedAetherIndex >= combined.length - 1 ? 0 : selectedAetherIndex + 1;
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        newIndex = selectedAetherIndex <= 0 ? combined.length - 1 : selectedAetherIndex - 1;
      }

      if (newIndex !== selectedAetherIndex) {
        setSelectedAetherIndex(newIndex);
        const selected = combined[newIndex];
        if (selected && selected.type === 'genai' && selected.url) {
          setPreviewImage({
            url: selected.url,
            type: selected.text.includes('Video') ? 'video' : 'image'
          });
        }
      }

      if (e.key === 'Escape') {
        setSelectedAetherIndex(-1);
        setPreviewImage(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chatHistory, genAIHistory, selectedAetherIndex, previewImage]);

  // ─── App Actions ───────────────────────────────────────────────────────────────
  const handleLaunchApp = useCallback(async (app: AppItem) => {
    // URL-type apps are always online and just need to open
    if (app.appType === 'url') {
      setSelectedApp(app);
      setIsEditMode(false);
      setStartInFullscreen(true);
      return;
    }

    const isOffline = !app.isOnline;
    const isManaged = app.isManaged;

    if (isOffline && app.command) {
      // App is offline; start the service
      const success = await startService(app.id, app.command, app.directory, app.badge);
      if (success) {
        const updatedApp = { ...app, isOnline: true, isManaged: true, status: 'active' as Status };
        setApps(prev => prev.map(a => a.id === app.id ? updatedApp : a));

        // If embedded, open in fullscreen
        if (app.isEmbedded) {
          setSelectedApp(updatedApp);
          setIsEditMode(false);
          setStartInFullscreen(true);
        }
      }
    } else if (isManaged && app.isOnline) {
      // App is online AND managed by dashboard → stop it
      await stopService(app.id);
      setApps(prev => prev.map(a => a.id === app.id ? { ...a, isOnline: false, isManaged: false, status: 'idle' as Status } : a));
    } else if (app.isOnline && !isManaged) {
      // App is online but NOT managed (external process detected via port).
      // Just open/connect to it without trying to stop the external server.
      if (app.isEmbedded) {
        setSelectedApp(app);
        setIsEditMode(false);
        setStartInFullscreen(true);
      }
    }
    // If app is not embedded and not managed, we could also consider launching externally, but default behavior is fine.
  }, [setApps]);

  const handleDeleteApp = useCallback(async (id: string) => {
    setApps(prev => prev.filter(a => a.id !== id));
    setContextMenu(null);
    setSelectedApp(null);
    // Remove from server registry so it stays gone
    await deleteAppFromRegistry(id);
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
    const history = await clearChatHistory(selectedAgent);
    setChatHistory(history);
  }, [selectedAgent]);

  const handleCloseWindow = useCallback(() => {
    setSelectedApp(null);
    setIsEditMode(false);
    setStartInFullscreen(false);
  }, []);

  const handleCreateApp = useCallback(async (newApp: AppItem) => {
    const timestamp = Date.now();
    const appWithId: AppItem = {
      ...newApp,
      id: `app-${timestamp}`,
      isOnline: false,
      lastModified: timestamp
    };
    setApps(prev => [...prev, appWithId]);
    setSelectedApp(null);
    // Persist to server
    await updateAppMetadata(appWithId);
  }, [setApps]);

  const handleUpdateApp = useCallback(async (updatedApp: AppItem, closeWindow = true) => {
    const appWithTimestamp = { ...updatedApp, lastModified: Date.now() };
    setApps(prev => prev.map(app => app.id === updatedApp.id ? appWithTimestamp : app));

    if (closeWindow) {
      setSelectedApp(null);
      setIsEditMode(false);
    } else {
      setSelectedApp(appWithTimestamp);
    }
    // Persist to server
    await updateAppMetadata(appWithTimestamp);
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
      {/* Custom TitleBar for frameless Electron window */}
      <TitleBar />

      {/* Global sidebar expand button - visible when collapsed on any tab */}
      {sidebarsCollapsed && (
        <button
          onClick={() => setSidebarsCollapsed(false)}
          className="fixed left-4 top-14 z-50 p-2 text-xl hover:scale-110 transition-transform"
          title="Expand sidebars (S)"
        >
          🧙‍♂️
        </button>
      )}

      {/* Background Mode */}
      <BackgroundMode />

      {/* Aura Scheme + Color Adjuster */}
      <AuraSettings />

      {/* MAIN CONTENT */}
      <main className={`relative z-10 grid ${sidebarsCollapsed ? 'grid-cols-[0%_100%] w-[98%] mx-auto mt-4' : 'grid-cols-[11%_89%] w-[90%] mx-auto mt-6 mb-2'} ultra-glass overflow-hidden transition-all duration-700 h-[60vh] ${selectedApp ? 'blur-xl scale-95 opacity-30 grayscale pointer-events-none' : 'opacity-100 scale-100'}`}>

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
              <li className={`nav-item-glass mb-2 ${activeView === 'genai' ? 'active' : 'opacity-40 hover:opacity-100'}`} onClick={() => setActiveView('genai')}>
                <a href="#" className="flex flex-col items-center gap-1">
                  <span className="text-lg">🎨</span>
                  <span className="text-[10px] uppercase tracking-tighter">GenAI</span>
                </a>
              </li>
              <li className={`nav-item-glass mb-2 ${activeView === 'roadmap' ? 'active' : 'opacity-40 hover:opacity-100'}`} onClick={() => setActiveView('roadmap')}>
                <a href="#" className="flex flex-col items-center gap-1">
                  <span className="text-lg">🗺️</span>
                  <span className="text-[10px] uppercase tracking-tighter">Roadmap</span>
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
        <section className={`grid ${sidebarsCollapsed ? 'grid-cols-[100%_0%]' : 'grid-cols-[73%_27%]'} h-full min-h-0`}>

          {/* LEFT CONTENT */}
          <div className="p-8 overflow-y-auto h-full custom-scrollbar">

            {/* VIEW: DISCOVER */}
            {activeView === 'discover' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Primary Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                  <div className="lg:col-span-2 h-full">
                    <SentimentScryerCell weather={weather} />
                  </div>
                  <VanFundCell data={vanFund} />
                  <ActivePulseCell activity={githubActivity} />
                </div>

                {/* Main Calendar View */}
                <div className="mb-12 grid grid-cols-3 gap-6">
                  <div className="col-span-2">
                    <TemporalFluxCell events={calendarEvents} onRefresh={fetchAllNonChatData} />
                  </div>
                  <div className="col-span-1">
                    <VoiceAssistantCell />
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
                  <TodoBoardKanban />
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
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full flex flex-col">
                <AgentRosterCell />
              </div>
            )}
            {/* VIEW: GENAI */}
            {activeView === 'genai' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full flex flex-col">
                {/* @ts-ignore */}
                <GenAICell />
              </div>
            )}
            {/* VIEW: ROADMAP */}
            {activeView === 'roadmap' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full flex flex-col">
                <RoadmapPage />
              </div>
            )}
          </div>

          {/* RIGHT CONTENT */}
          <div className={`border-l border-white/20 p-8 flex flex-col h-full overflow-hidden transition-all duration-500 ${sidebarsCollapsed ? 'opacity-0 p-0 border-l-0' : 'opacity-100'}`}>

            {/* Recent Heartbeats (Recommended Songs Area) */}
            <div className="flex-1 overflow-hidden min-h-0 mb-6 relative">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-white/50 mb-6">Aether Feedback</h2>
              <div className="space-y-4">
                <div className="space-y-4">
                  {(() => {
                    const chatItems = chatHistory.map(m => ({ ...m, type: 'chat', sortTime: m.time, url: '' }));
                    const genItems = genAIHistory.map(g => ({
                      id: g.id,
                      type: 'genai',
                      text: g.isVideo ? 'Generated Video' : 'Generated Image',
                      role: 'assistant',
                      time: g.time,
                      sortTime: g.time,
                      url: g.url
                    }));

                    const combined = [...chatItems, ...genItems]
                      .sort((a, b) => b.sortTime - a.sortTime)
                      .slice(0, 8);

                    return combined.map((msg, idx) => (
                      <div
                        key={msg.id}
                        className={`flex items-center gap-4 group cursor-pointer transition-all ${
                          selectedAetherIndex === idx ? 'bg-white/5 rounded-lg border border-indigo-500/30' : ''
                        }`}
                        onClick={() => {
                          if (msg.type === 'genai' && msg.url) {
                            setSelectedAetherIndex(idx);
                            setPreviewImage({ url: msg.url, type: msg.text.includes('Video') ? 'video' : 'image' });
                          }
                        }}
                      >
                        <div
                          className={`w-10 h-10 rounded-lg border flex items-center justify-center text-sm shrink-0 overflow-hidden transition-colors ${
                            msg.type === 'genai'
                              ? selectedAetherIndex === idx
                                ? 'bg-indigo-500/20 border-indigo-500'
                                : 'bg-purple-500/10 border-purple-500/20 hover:border-purple-400/50'
                              : 'bg-white/5 border-white/10'
                          }`}
                        >
                          {msg.type === 'genai' ? (
                            msg.url ? <img src={msg.url} className="w-full h-full object-cover" alt="GenAI" /> : '🎨'
                          ) : (
                            msg.role === 'user' ? '👤' : '🧙‍♂️'
                          )}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className={`text-xs font-medium truncate ${msg.type === 'genai' ? 'text-purple-300' : 'text-white'}`}>
                            {msg.text}
                          </p>
                          <p className="text-[10px] text-white/30 uppercase">
                            {new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {msg.type === 'genai' && ' • AI Artifact'}
                          </p>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>

            {/* AI Heartbeat (Music Player Area) */}
            {/* AI Resource Monitor - Stickied to bottom */}
            <ResourceMonitor apps={apps} className="flex-shrink-0" />

          </div>
        </section>
      </main>

      {/* SUBTERRANEAN CHAT TRAY - Maximum Abyssal Expansion */}
      <div className={`fixed bottom-0 left-0 right-0 z-40 px-8 pb-12 pt-4 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent transition-all duration-500 h-[34vh] flex flex-col justify-end ${selectedApp ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'}`}>

        {/* Aether Echoes - Rising high into the created negative space */}
        <div className="max-w-6xl mx-auto mb-8 space-y-6 flex-1 flex flex-col overflow-y-auto scrollbar-none pointer-events-auto">
          <div className="flex-1" /> {/* Spacer to push content to bottom when history is small */}
          {chatHistory.map((msg, idx) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-5 duration-1000 last:mb-2`} style={{ opacity: msg.role === 'assistant' ? (0.4 + (idx / chatHistory.length) * 0.6) : 1 }}>
              <div className={`max-w-[92%] px-8 py-4 rounded-[2rem] text-[15px] border backdrop-blur-2xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] ${msg.role === 'user' ? 'bg-indigo-500/15 border-indigo-400/30 text-indigo-50 text-shadow-sm' : 'bg-white/5 border-white/10 text-white shadow-inner'}`}>
                <ReactMarkdown
                  components={{
                    p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                    code: ({ node, inline, ...props }: any) =>
                      inline
                        ? <code className="bg-white/10 px-1.5 py-0.5 rounded text-indigo-200" {...props} />
                        : <pre className="bg-black/40 p-4 rounded-xl overflow-x-auto border border-white/10 my-3"><code {...props} /></pre>,
                    ul: ({ node, ...props }) => <ul className="list-disc ml-6 mb-2" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal ml-6 mb-2" {...props} />,
                    li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                    h1: ({ node, ...props }) => <h1 className="text-xl font-bold mb-2" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-lg font-bold mb-2" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="text-base font-bold mb-2" {...props} />,
                    blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-white/20 pl-4 italic my-2" {...props} />,
                    strong: ({ node, ...props }) => <strong className="font-bold text-white" {...props} />,
                    em: ({ node, ...props }) => <em className="italic text-white/90" {...props} />,
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

            {/* Agent Selector */}
            {availableAgents.length > 0 && (
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white mr-4 focus:outline-none focus:border-indigo-500/50 capitalize"
              >
                {availableAgents.map(agent => (
                  <option key={agent.id} value={agent.id} className="bg-slate-900">
                    {agent.name}
                  </option>
                ))}
              </select>
            )}

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
              placeholder={`Whisper to ${availableAgents.find(a => a.id === selectedAgent)?.name || selectedAgent}...`}
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
            <button
              onClick={handleClearChat}
              className="p-3 text-white/40 hover:text-white transition-colors"
              title="Clear chat history"
            >
              <i className="fa fa-times"></i>
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
          sidebarWidth={sidebarWidth}
          onClose={handleCloseWindow}
          onCreate={handleCreateApp}
          onUpdate={handleUpdateApp}
          onDelete={handleDeleteApp}
          onToggleService={() => handleToggleService(selectedApp.id)}
          onEdit={() => setIsEditMode(true)}
        />
      )}

      {/* Embedded App Sidebar (with integrated Pi Chat) */}
      <EmbeddedAppSidebar
        apps={apps}
        selectedAppId={selectedApp?.id}
        onSelectApp={(app) => {
          setSelectedApp(app);
          setIsEditMode(false);
          setStartInFullscreen(true);
        }}
        onGoToDashboard={handleCloseWindow}
        onVisibilityChange={setSidebarWidth}
        chatHistory={chatHistory}
        isChatLoading={isChatLoading}
        selectedAgent={selectedAgent}
        availableAgents={availableAgents}
        onSendMessage={handleSendChatMessage}
        onClearChat={handleClearChat}
        onAgentChange={setSelectedAgent}
      />

      {/* Fullscreen Media Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-2xl flex flex-col animate-in fade-in duration-300">
          {/* Toolbar */}
          <div className="absolute top-4 right-4 z-50 flex items-center gap-4">
            <a
              href={previewImage.url}
              download
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm font-medium transition-colors flex items-center gap-2 backdrop-blur-md"
              onClick={(e) => e.stopPropagation()}
            >
              <i className="fa fa-download"></i> Download
            </a>
            <button
              onClick={() => setPreviewImage(null)}
              className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md"
            >
              <i className="fa fa-times text-xl"></i>
            </button>
          </div>

          {/* Content */}
          <div
            className="flex-1 flex items-center justify-center p-8 overflow-hidden cursor-zoom-out"
            onClick={() => setPreviewImage(null)}
          >
            {previewImage.type === 'video' ? (
              <video
                src={previewImage.url}
                controls
                autoPlay
                loop
                className="max-w-full max-h-full rounded-lg shadow-2xl object-contain cursor-default"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <img
                src={previewImage.url}
                alt="Full Preview"
                className="max-w-full max-h-full rounded-lg shadow-2xl object-contain cursor-default transition-transform duration-200 hover:scale-[1.02]"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
