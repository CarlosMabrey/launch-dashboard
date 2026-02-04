
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AppItem, Status } from '../types';
import { GoogleGenAI } from "@google/genai";
import { getServiceStatus, ServiceStatus } from '../services/processService';
import { summarizeLogs } from '../services/piService';
import { PRESETS, SYSTEM_PROMPT } from './igenConstants';

interface AppWindowProps {
  app: AppItem;
  isNew?: boolean;
  isEdit?: boolean;
  startInFullscreen?: boolean;
  onClose: () => void;
  onCreate?: (newApp: AppItem) => void;
  onUpdate?: (updatedApp: AppItem, closeWindow?: boolean) => void;
  onDelete?: (id: string) => void;
  onToggleService?: () => void;
  onEdit?: () => void;
  isSidebarVisible?: boolean;
}

type ImageSize = '1K' | '2K' | '4K';

/**
 * Removes the background from a base64 image by sampling the top-left pixel color
 * and making similar pixels transparent.
 */
const removeImageBackground = (base64: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return resolve(base64);

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { data } = imageData;

      // Sample background color from 4 corners to find the most consistent one
      const corners = [
        [0, 0],
        [canvas.width - 1, 0],
        [0, canvas.height - 1],
        [canvas.width - 1, canvas.height - 1]
      ];

      let r_bg = 0, g_bg = 0, b_bg = 0;
      corners.forEach(([x, y]) => {
        const idx = (y * canvas.width + x) * 4;
        r_bg += data[idx];
        g_bg += data[idx + 1];
        b_bg += data[idx + 2];
      });
      r_bg /= 4; g_bg /= 4; b_bg /= 4;

      // Check if it's specifically our Chroma Key Green (#00FF00)
      const isChromaGreen = r_bg < 100 && g_bg > 150 && b_bg < 100;

      // Use a tighter tolerance for chroma green to avoid eating into the icon
      // but a wider one for white/black which often have compression artifacts
      const isExtreme = (r_bg > 240 && g_bg > 240 && b_bg > 240) || (r_bg < 15 && g_bg < 15 && b_bg < 15);
      const tolerance = isChromaGreen ? 110 : (isExtreme ? 60 : 35);

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Euclidean distance in RGB space
        const diff = Math.sqrt(
          Math.pow(r - r_bg, 2) +
          Math.pow(g - g_bg, 2) +
          Math.pow(b - b_bg, 2)
        );

        if (diff < tolerance) {
          // Smooth the edges slightly by using the distance for alpha
          if (diff > tolerance * 0.8) {
            data[i + 3] = Math.min(255, (diff - tolerance * 0.8) / (tolerance * 0.2) * 255);
          } else {
            data[i + 3] = 0;
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
};

const AppWindow: React.FC<AppWindowProps> = ({ app, isNew = false, isEdit = false, startInFullscreen = false, onClose, onCreate, onUpdate, onDelete, onToggleService, onEdit, isSidebarVisible = false }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [browserViewUrl, setBrowserViewUrl] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(startInFullscreen);
  const [serviceLogs, setServiceLogs] = useState<ServiceStatus['logs']>([]);
  const [logSummary, setLogSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const embedContainerRef = useRef<HTMLDivElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const lastBoundsRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Icon Studio State
  const [showStudio, setShowStudio] = useState(false);
  const [baseConcept, setBaseConcept] = useState('');
  const [studioPrompt, setStudioPrompt] = useState('');
  const [studioHistory, setStudioHistory] = useState<string[]>([]);
  const [selectedStudioIcon, setSelectedStudioIcon] = useState<string | null>(null);

  // Custom icons saved from AI generation
  const [customIcons, setCustomIcons] = useState<string[]>(() => {
    const saved = localStorage.getItem('jellylaunch_custom_icons');
    return saved ? JSON.parse(saved) : [];
  });

  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<AppItem>>({
    name: '',
    icon: '🌐',
    badge: '',
    status: 'idle',
    command: '',
    directory: '',
    embeddedUrl: '',
    colorClass: 'bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a]',
    isEmbedded: true,
    appType: 'web',  // Default to web type for local apps
    batPath: '',
    port: ''
  });

  // Initialize form data when editing or loading existing app
  useEffect(() => {
    if (isEdit && app) {
      setFormData({
        name: app.name,
        icon: app.icon,
        badge: app.badge,
        status: app.status,
        command: app.command,
        directory: app.directory,
        embeddedUrl: app.embeddedUrl,
        colorClass: app.colorClass,
        isEmbedded: app.isEmbedded,
        appType: app.appType,
        batPath: app.batPath || '',
        port: app.port || ''
      });
    }
  }, [isEdit, app]);

  // Sync fullscreen state when startInFullscreen prop changes
  useEffect(() => {
    if (startInFullscreen) {
      setIsFullscreen(true);
    }
  }, [startInFullscreen]);

  // State for minimize animation
  const [isMinimizing, setIsMinimizing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen && !isMinimizing) {
          setIsMinimizing(true);
          setTimeout(() => onClose(), 400);
        } else if (!isMinimizing) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleEsc);

    if (!isNew && !isEdit && app.isEmbedded) {
      // URL-type apps: use embeddedUrl directly
      if (app.appType === 'url' && app.embeddedUrl) {
        setBrowserViewUrl(app.embeddedUrl);
      } else if (app.embeddedUrl) {
        // Use explicitly set embeddedUrl if available
        setBrowserViewUrl(app.embeddedUrl);
      } else if (app.badge === 'Internal') {
        try {
          const baseUrl = window.location.origin === 'null' ? window.location.href.split('index.html')[0] : window.location.origin;
          const url = new URL(app.url, baseUrl);
          url.searchParams.set('jelly', 'true');
          url.searchParams.set('api_port', '3001'); // Pass backend port
          setBrowserViewUrl(url.toString());
        } catch (e) {
          setBrowserViewUrl('');
        }
      } else if (app.port || app.badge) {
        try {
          const port = app.port || (app.badge?.includes(':') ? app.badge.split(':').pop() : app.badge);
          let urlStr = `http://localhost:${port || '3000'}`;

          const url = new URL(urlStr);
          if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname.startsWith('192.168.') || url.hostname.startsWith('10.')) {
            url.searchParams.set('jelly', 'true');
            url.searchParams.set('api_port', '3001'); // Pass backend port
          }
          setBrowserViewUrl(url.toString());
        } catch (e) {
          setBrowserViewUrl('');
        }
      } else {
        setBrowserViewUrl('');
      }
    } else {
      setBrowserViewUrl('');
    }

    // Listen for load events from main process (using modern subscription pattern)
    let unsubSuccess: (() => void) | undefined;
    let unsubFail: (() => void) | undefined;

    const handleLoadSuccess = ({ url }: { url: string }) => {
      if (url === browserViewUrl) {
        setIsLoaded(true);
        setLoadError(null);
      }
    };

    const handleLoadFail = ({ url, error }: { url: string, error: string }) => {
      if (url === browserViewUrl) {
        setLoadError(error);
      }
    };

    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.onBrowserViewLoadSuccess) {
      unsubSuccess = electronAPI.onBrowserViewLoadSuccess(handleLoadSuccess);
      unsubFail = electronAPI.onBrowserViewLoadFail(handleLoadFail);
    }

    // Reset load state when URL changes
    setIsLoaded(false);
    setLoadError(null);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleEsc);
      if (unsubSuccess) unsubSuccess();
      if (unsubFail) unsubFail();
    };
  }, [onClose, app, isNew, isEdit, isFullscreen, isMinimizing, browserViewUrl]);

  // Poll for logs when service is online
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    const fetchLogs = async () => {
      if (!isNew && !isEdit && app.id) {
        const status = await getServiceStatus(app.id);
        setServiceLogs(status.logs);
      }
    };

    if (app.isOnline || serviceLogs.length > 0) {
      fetchLogs();
      pollInterval = setInterval(fetchLogs, 1000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [app.isOnline, app.id, isNew, isEdit]);

  const updateBounds = useCallback(() => {
    const electronAPI = (window as any).electronAPI;
    if (embedContainerRef.current && isVisible && !isMinimizing && electronAPI?.updateBrowserViewBounds) {
      const rect = embedContainerRef.current.getBoundingClientRect();

      // If rect is all zeros, it might be hidden or not yet rendered
      if (rect.width === 0 || rect.height === 0) return;

      // Reserve 8px trigger zone for sidebar activation when not visible
      // Use full sidebar width (56px) when sidebar is visible
      const triggerZone = 8;
      const sidebarWidth = 56;
      const xOffset = isSidebarVisible ? sidebarWidth : (isFullscreen ? triggerZone : 0);

      const currentBounds = {
        x: Math.round(rect.x + xOffset),
        y: Math.round(rect.y),
        width: Math.round(rect.width - xOffset),
        height: Math.round(rect.height)
      };

      if (
        currentBounds.x !== lastBoundsRef.current.x ||
        currentBounds.y !== lastBoundsRef.current.y ||
        currentBounds.width !== lastBoundsRef.current.width ||
        currentBounds.height !== lastBoundsRef.current.height
      ) {
        electronAPI.updateBrowserViewBounds(currentBounds);
        lastBoundsRef.current = currentBounds;
      }
    }
  }, [isVisible, isMinimizing, isSidebarVisible, isFullscreen]);

  // Trigger update when properties that affect bounds change
  useEffect(() => {
    updateBounds();
  }, [updateBounds]);

  // BrowserView Lifecycle Management - Using Pooled views
  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.createBrowserView) return;

    let resizeObserver: ResizeObserver | null = null;
    let isMounted = true;
    let hasViewStarted = false;

    // URL-type apps are always "online" for embedding purposes
    const isEffectivelyOnline = app.appType === 'url' || app.isOnline;

    const initView = async () => {
      if (!isMounted || !isVisible || !browserViewUrl || !app.isEmbedded || !isEffectivelyOnline || isMinimizing) {
        return;
      }

      const rect = embedContainerRef.current?.getBoundingClientRect();

      // If we don't have valid dimensions yet, wait for ResizeObserver or next effect run
      if (!rect || rect.width <= 0 || rect.height <= 0) {
        // We still set up the ResizeObserver even if width is 0, so it can trigger as soon as layout happens
        if (embedContainerRef.current && !resizeObserver) {
          resizeObserver = new ResizeObserver(() => {
            if (!hasViewStarted) initView();
            else updateBounds();
          });
          resizeObserver.observe(embedContainerRef.current);
        }
        return;
      }

      hasViewStarted = true;

      const triggerZone = 8;
      const sidebarWidth = 56;
      const xOffset = isSidebarVisible ? sidebarWidth : (isFullscreen ? triggerZone : 0);

      const initialBounds = {
        x: Math.round(rect.x + xOffset),
        y: Math.round(rect.y),
        width: Math.round(rect.width - xOffset),
        height: Math.round(rect.height)
      };

      // Call createBrowserView (handles re-attachment in main process)
      await electronAPI.createBrowserView({
        url: browserViewUrl,
        bounds: initialBounds,
        appId: app.id
      });

      if (!isMounted) return;
      lastBoundsRef.current = initialBounds;

      // Ensure ResizeObserver is active for subsequent moves/resizes
      if (embedContainerRef.current && !resizeObserver) {
        resizeObserver = new ResizeObserver(() => updateBounds());
        resizeObserver.observe(embedContainerRef.current);
      }

      const scrollableParent = embedContainerRef.current?.closest('.overflow-auto');
      if (scrollableParent) {
        scrollableParent.addEventListener('scroll', updateBounds);
      }

      window.addEventListener('resize', updateBounds);
    };

    initView();

    return () => {
      isMounted = false;
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', updateBounds);
      const scrollableParent = embedContainerRef.current?.closest('.overflow-auto');
      if (scrollableParent) {
        scrollableParent.removeEventListener('scroll', updateBounds);
      }

      if (electronAPI.hideBrowserView) {
        electronAPI.hideBrowserView();
      }
    };
  }, [isVisible, isMinimizing, browserViewUrl, app.isEmbedded, app.isOnline, app.appType, isSidebarVisible, isFullscreen, updateBounds]);

  // Clean up BrowserView if URL changes or service stops (but not for URL-type apps)
  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.destroyBrowserView) return;

    // Don't destroy for URL-type apps since they're always "online"
    if (app.appType !== 'url' && !app.isOnline && browserViewUrl) {
      electronAPI.destroyBrowserView(browserViewUrl);
    }
  }, [app.isOnline, app.appType, browserViewUrl]);

  // Auto-scroll terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [serviceLogs]);

  const handleDeploy = () => {
    if (formData.name) {
      let finalDirectory = formData.directory;
      let finalCommand = formData.command;
      let finalBadge = formData.badge;
      let finalPort = formData.port;

      // Handle .bat file path if provided
      if (formData.batPath) {
        // Simple path parsing
        const path = formData.batPath.replace(/\\/g, '/');
        const lastSlash = path.lastIndexOf('/');
        if (lastSlash !== -1) {
          finalDirectory = formData.batPath.substring(0, lastSlash);
          finalCommand = `.\\${formData.batPath.substring(lastSlash + 1)}`;
        } else {
          finalCommand = `.\\${formData.batPath}`;
        }
      }

      // Handle Port if provided
      if (formData.port) {
        finalBadge = formData.port;
      } else if (formData.badge && !formData.port) {
        // If badge is a number, use it as port
        if (/^\d+$/.test(formData.badge)) {
          finalPort = formData.badge;
        }
      }

      // For URL type apps, use the embeddedUrl field directly
      // For other types, construct from port if embedded
      let embeddedUrl: string | undefined;
      if (formData.appType === 'url') {
        embeddedUrl = formData.embeddedUrl;
      } else if (formData.isEmbedded && (finalPort || finalBadge)) {
        const port = finalPort || (finalBadge?.includes(':') ? finalBadge.split(':').pop() : finalBadge);
        if (port) {
          embeddedUrl = `http://localhost:${port}`;
        }
      }

      const appData = {
        ...formData,
        id: isNew ? `app-${Date.now()}` : app.id,
        url: formData.appType === 'url' ? (formData.embeddedUrl || '#') : (app.url || '#'),
        directory: finalDirectory,
        command: finalCommand,
        badge: finalBadge || finalPort,
        port: finalPort,
        status: 'idle',
        isOnline: formData.appType === 'url' ? true : (app.isOnline || false),
        isEmbedded: formData.isEmbedded || formData.appType === 'url',
        embeddedUrl,
      } as AppItem;

      if (isNew && onCreate) {
        onCreate(appData);
      } else if (isEdit && onUpdate) {
        onUpdate(appData);
      }
    }
  };

  const refreshBrowserView = () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.reloadBrowserView) {
      electronAPI.reloadBrowserView();
    }
  };

  const openInExternalBrowser = () => {
    if (app.embeddedUrl) {
      window.open(browserViewUrl, '_blank');
    }
  };

  const toggleEmbeddedMode = () => {
    if (onUpdate) {
      const updatedApp = {
        ...app,
        isEmbedded: !app.isEmbedded,
        embeddedUrl: !app.isEmbedded && app.badge ? `http://localhost:${app.badge.split(':').pop() || '3000'}` : undefined
      };
      onUpdate(updatedApp, false);
    }
  };

  const generateLogo = async (overridePrompt?: string, isRefinement = false) => {
    const promptToUse = overridePrompt || studioPrompt;
    if (!formData.name && !promptToUse) return;

    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
      setGenerationError('API key not configured. Add GEMINI_API_KEY to .env.local');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    try {
      const ai = new GoogleGenAI({ apiKey });

      let styleDetails = overridePrompt || studioPrompt;
      let fullPrompt = "";

      if (isRefinement) {
        fullPrompt = `${SYSTEM_PROMPT}\n\nTask: Edit/Refine this icon for "${formData.name}". Instructions: ${styleDetails}`;
      } else {
        // Build base idea: use baseConcept if provided, else just the app name
        const concept = baseConcept ? `${baseConcept}` : `a high-end icon for ${formData.name}`;
        fullPrompt = `${SYSTEM_PROMPT}\n\nTask: Create a professional icon. Subject: ${concept}. Style Details: ${styleDetails}`;
      }

      let response;
      if (isRefinement && selectedStudioIcon) {
        // Image-to-image refinement
        const imageData = selectedStudioIcon.split(',')[1];
        const mimeType = selectedStudioIcon.split(';')[0].split(':')[1];

        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [
              { inlineData: { data: imageData, mimeType } },
              { text: fullPrompt }
            ]
          }
        });
      } else {
        // Basic generation
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: fullPrompt,
        });
      }

      const part = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
      if (part?.inlineData?.data) {
        const rawIconDataUrl = `data:image/png;base64,${part.inlineData.data}`;

        // Process for transparency
        const iconDataUrl = await removeImageBackground(rawIconDataUrl);

        setSelectedStudioIcon(iconDataUrl);
        setStudioHistory(prev => [iconDataUrl, ...prev]);
        setStudioPrompt(''); // Clear prompt after usage
      } else {
        setGenerationError('No image was generated. Try a different prompt.');
      }
    } catch (error: any) {
      console.error('Logo generation failed:', error);
      setGenerationError(error.message || 'Generation failed');
    } finally { setIsGenerating(false); }
  };

  const applyStudioIcon = () => {
    if (selectedStudioIcon) {
      setFormData(prev => ({ ...prev, icon: selectedStudioIcon, colorClass: 'bg-white/5' }));

      // Save to persistence
      const updatedIcons = [...new Set([...customIcons, selectedStudioIcon])];
      setCustomIcons(updatedIcons);
      localStorage.setItem('jellylaunch_custom_icons', JSON.stringify(updatedIcons));

      setShowStudio(false);
    }
  };

  const deleteCustomIcon = (iconToDelete: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const updatedIcons = customIcons.filter(icon => icon !== iconToDelete);
    setCustomIcons(updatedIcons);
    localStorage.setItem('jellylaunch_custom_icons', JSON.stringify(updatedIcons));
    // If the deleted icon was selected, reset to default
    if (formData.icon === iconToDelete) {
      setFormData(prev => ({ ...prev, icon: '🌐' }));
    }
  };

  const handleSummarizeLogs = async () => {
    if (serviceLogs.length === 0) return;
    setIsSummarizing(true);
    try {
      const summary = await summarizeLogs(app.name, serviceLogs);
      setLogSummary(summary);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSummarizing(false);
    }
  };

  if (startInFullscreen && app.isEmbedded && browserViewUrl) {
    const openExternal = () => {
      window.open(browserViewUrl, '_blank');
    };

    return (
      <div
        className={`fixed inset-0 z-40 bg-black transition-all duration-400 ease-out
          ${isVisible && !isMinimizing ? 'opacity-100' : 'opacity-0'}
          ${isMinimizing ? 'scale-[0.1] -translate-x-[45vw] rounded-3xl' : 'scale-100'}`}
        style={{ transformOrigin: 'left center' }}
        tabIndex={0}
        onKeyDown={(e) => {
          // ESC or Shift+Tab to close
          if ((e.key === 'Escape' || (e.shiftKey && e.key === 'Tab')) && !isMinimizing) {
            e.preventDefault();
            setIsMinimizing(true);
            setTimeout(() => onClose(), 400);
          }
        }}
        ref={(el) => el?.focus()}
      >
        {/* Gradient edge strip - matches dashboard aura colors */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[8px] z-[50] overflow-hidden"
          style={{ pointerEvents: 'none' }}
        >
          {/* Animated gradient background using aura colors */}
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

        {/* Embed container - BrowserView renders here */}
        <div
          ref={embedContainerRef}
          className="absolute inset-0 w-full h-full"
        />

        {/* Loading/Status overlay - with pointer-events-none so it doesn't block BrowserView */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {!app.isOnline && app.appType !== 'url' && (
            <div className="text-center space-y-3">
              <p className="text-white/20 text-sm font-mono uppercase tracking-widest italic">Engine Offline</p>
              <p className="text-white/10 text-[10px]">Launch service to establish link</p>
            </div>
          )}
          {(app.isOnline || app.appType === 'url') && !isLoaded && (
            <div className="text-center space-y-4">
              <p className="text-white/20 text-sm font-mono animate-pulse uppercase tracking-widest">
                {loadError ? 'Link Interference' : 'Establishing Neural Link...'}
              </p>
              {loadError ? (
                <div className="space-y-2">
                  <p className="text-red-400/60 text-[10px] max-w-xs mx-auto">{loadError}</p>
                  <button
                    onClick={refreshBrowserView}
                    className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[9px] font-bold uppercase tracking-widest text-white/40 hover:text-white"
                  >
                    Force Sync (Retry)
                  </button>
                </div>
              ) : (
                app.appType === 'url' && (
                  <p className="text-white/15 text-[10px] max-w-md">
                    Some sites block embedding. If the page doesn't load, try opening externally.
                  </p>
                )
              )}
            </div>
          )}
        </div>

        {/* Control bar - ALWAYS visible and clickable (high z-index) */}
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300
            ${isMinimizing ? 'opacity-0 -translate-y-4' : 'opacity-100'}`}
        >
          <div className="flex items-center gap-2">
            {/* Close button */}
            <button
              onClick={() => {
                if (!isMinimizing) {
                  setIsMinimizing(true);
                  setTimeout(() => onClose(), 400);
                }
              }}
              className="flex items-center gap-3 px-4 py-2 rounded-full bg-black/80 backdrop-blur-xl border border-white/10 shadow-2xl hover:bg-black/90 hover:border-white/20 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm border border-white/10 ${app.colorClass}`}>
                  {app.icon.startsWith('data')
                    ? <img src={app.icon} className="w-full h-full object-cover rounded-lg" alt={app.name} />
                    : app.icon}
                </div>
                <span className="text-[11px] font-semibold text-white/80">{app.name}</span>
              </div>
              <div className="w-[1px] h-4 bg-white/10" />
              <div className="flex items-center gap-1.5 group-hover:text-white transition-colors">
                <kbd className="px-2 py-0.5 rounded bg-white/10 text-[9px] font-mono text-white/60 border border-white/20 group-hover:bg-white/20">ESC</kbd>
                <span className="text-[9px] text-white/40 uppercase tracking-wider group-hover:text-white/60">close</span>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-neonGreen animate-pulse shadow-[0_0_6px_#00ffaa]" />
            </button>

            {/* Open external button for URL apps */}
            {app.appType === 'url' && (
              <button
                onClick={openExternal}
                className="px-3 py-2 rounded-full bg-black/80 backdrop-blur-xl border border-white/10 shadow-2xl hover:bg-neonBlue/20 hover:border-neonBlue/30 transition-all cursor-pointer"
                title="Open in browser"
              >
                <svg className="w-4 h-4 text-white/60 hover:text-neonBlue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 md:p-12 transition-all duration-500 ease-out
        ${isVisible && !isMinimizing ? 'opacity-100' : 'opacity-0'}
        ${isMinimizing ? 'pointer-events-none' : ''}`}
    >
      <div
        className={`absolute inset-0 bg-black/80 backdrop-blur-xl cursor-pointer transition-all duration-400
          ${isMinimizing ? 'opacity-0' : 'opacity-100'}`}
        onClick={() => {
          if (isFullscreen && !isMinimizing) {
            setIsMinimizing(true);
            setTimeout(() => onClose(), 400);
          } else if (!isMinimizing) {
            onClose();
          }
        }}
      />

      <div
        className={`relative bg-[#0c0c0c] border border-white/10 rounded-3xl shadow-[0_40px_120px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden
          transition-all duration-400 ease-[cubic-bezier(0.4,0,0.2,1)]
          ${isMinimizing
            ? 'scale-[0.15] -translate-x-[45vw] translate-y-0 opacity-0 rounded-2xl'
            : isFullscreen
              ? 'w-full h-full max-w-none max-h-none rounded-none'
              : 'w-full max-w-5xl h-auto max-h-[85vh]'}`}
        style={{
          transformOrigin: 'left center'
        }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div className="flex gap-1.5">
              <button onClick={onClose} className="w-3 h-3 rounded-full bg-white/10 hover:bg-red-500/80 transition-all border border-white/5" />
              <div className="w-3 h-3 rounded-full bg-white/5 border border-white/5" />
              <div className="w-3 h-3 rounded-full bg-white/5 border border-white/5" />
            </div>
            <div className="h-4 w-[1px] bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[11px] tracking-[0.2em] uppercase text-white/40">
                {isNew ? 'Manifest Initialization' : isEdit ? 'Edit Configuration' : `Service Engine: ${app.name}`}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-[10px] font-bold uppercase tracking-widest opacity-30 hover:opacity-100 transition-opacity">Esc</button>
        </div>

        <div className="flex-1 overflow-auto p-10 font-sans">
          {(isNew || isEdit) ? (
            <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16">
              <div className="space-y-10">
                <div>
                  <h2 className="text-3xl font-bold mb-3 tracking-tighter italic">{isNew ? 'Add New App' : 'Edit Configuration'}</h2>
                  <p className="text-white/40 text-[13px] leading-relaxed">
                    {formData.appType === 'url'
                      ? 'Add a website to your launcher dashboard.'
                      : 'Configure your local application.'}
                  </p>
                </div>

                <div className="space-y-8">
                  {/* App Type Selection - FIRST */}
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold">App Type</label>
                    <div className="space-y-3">
                      <select
                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-5 text-white/90 text-[13px] outline-none"
                        value={formData.appType}
                        onChange={(e) => {
                          const appType = e.target.value as 'web' | 'electron' | 'terminal' | 'url';
                          setFormData({
                            ...formData,
                            appType,
                            // Auto-enable embedded for URL type
                            isEmbedded: appType === 'url' ? true : formData.isEmbedded
                          });
                        }}
                      >
                        <option value="url">🌐 External URL/Website</option>
                        <option value="web">💻 Local Web App (npm/node)</option>
                        <option value="electron">⚡ Electron App</option>
                        <option value="terminal">🖥️ Terminal/CLI</option>
                      </select>
                    </div>
                  </div>

                  {/* Basic Info - Always shown */}
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold">
                      {formData.appType === 'url' ? 'Website Info' : 'App Info'}
                    </label>
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="App Name"
                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-5 text-white/90 text-[13px] outline-none"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />

                      {/* URL input for URL type apps */}
                      {formData.appType === 'url' && (
                        <input
                          type="url"
                          placeholder="Website URL (e.g. https://example.com)"
                          className="w-full bg-white/[0.03] border border-neonBlue/30 rounded-xl py-3 px-5 text-neonBlue text-[13px] outline-none focus:border-neonBlue/50"
                          value={formData.embeddedUrl || ''}
                          onChange={(e) => setFormData({ ...formData, embeddedUrl: e.target.value })}
                        />
                      )}
                    </div>
                  </div>

                  {/* Local App Configuration - Only for non-URL apps */}
                  {formData.appType !== 'url' && (
                    <div className="space-y-4">
                      <label className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold">Local Configuration</label>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <label className="text-[9px] uppercase tracking-widest text-white/30 ml-2">Quick Setup (.bat file)</label>
                          <input
                            type="text"
                            placeholder="Full path to .bat file (e.g. C:\apps\start.bat)"
                            className="w-full bg-white/[0.03] border border-neonBlue/30 rounded-xl py-3 px-5 text-neonBlue text-[13px] font-mono outline-none focus:border-neonBlue/60"
                            value={formData.batPath}
                            onChange={(e) => setFormData({ ...formData, batPath: e.target.value })}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <label className="text-[9px] uppercase tracking-widest text-white/30 ml-2">App Port</label>
                            <input
                              type="text"
                              placeholder="Port (e.g. 3000)"
                              className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-5 text-white/90 text-[13px] outline-none"
                              value={formData.port}
                              onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] uppercase tracking-widest text-white/30 ml-2">Display Badge</label>
                            <input
                              type="text"
                              placeholder="Badge (e.g. Dev)"
                              className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-5 text-white/90 text-[13px] outline-none"
                              value={formData.badge}
                              onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[9px] uppercase tracking-widest text-white/30 ml-2">Advanced: Project Directory</label>
                          <input
                            type="text"
                            placeholder="Project Directory (e.g. D:\AI Programs\my-app)"
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-5 text-white/60 text-[13px] font-mono outline-none"
                            value={formData.directory}
                            onChange={(e) => setFormData({ ...formData, directory: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[9px] uppercase tracking-widest text-white/30 ml-2">Advanced: Launch Command</label>
                          <input
                            type="text"
                            placeholder="Launch Command (npm start, etc.)"
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-5 text-white/60 text-[13px] font-mono outline-none"
                            value={formData.command}
                            onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                          />
                        </div>

                        {/* Embedded checkbox */}
                        <div className="flex items-center gap-3 bg-white/[0.03] border border-white/10 rounded-xl py-3 px-5">
                          <input
                            type="checkbox"
                            id="isEmbedded"
                            checked={formData.isEmbedded || false}
                            onChange={(e) => setFormData({ ...formData, isEmbedded: e.target.checked })}
                            className="w-4 h-4 rounded border-white/20 bg-white/10"
                          />
                          <label htmlFor="isEmbedded" className="text-white/90 text-[13px] flex-1">
                            Open inside launcher (embedded mode)
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold">App Icon</label>

                    {/* Current icon preview */}
                    <div className="flex gap-4 items-start">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl border border-white/10 bg-white/[0.03] shrink-0 ${formData.colorClass}`}>
                        {formData.icon?.startsWith('data') ? <img src={formData.icon} className="w-full h-full object-cover rounded-2xl" /> : formData.icon}
                      </div>

                      <div className="flex-1 space-y-3">
                        {/* Preset Icons Grid */}
                        <div className="bg-white/[0.02] p-3 rounded-xl border border-white/5">
                          <span className="text-[9px] text-white/40 uppercase font-bold block mb-2">Quick Select</span>
                          <div className="grid grid-cols-8 gap-1.5">
                            {['🚀', '⚡', '🎯', '💎', '🔮', '🎨', '📊', '🔧',
                              '🌐', '📱', '💻', '🖥️', '🎮', '🎵', '📷', '🎬',
                              '📁', '📂', '🗂️', '📋', '📝', '✏️', '🔍', '🔐',
                              '⚙️', '🛠️', '🔌', '💡', '🌟', '✨', '🔥', '💫'
                            ].map(emoji => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => setFormData({ ...formData, icon: emoji })}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg hover:bg-white/10 transition-all
                                  ${formData.icon === emoji ? 'bg-white/15 ring-1 ring-white/20' : 'bg-white/[0.03]'}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>

                          {/* Custom AI-Generated Icons */}
                          {customIcons.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-white/5">
                              <span className="text-[9px] text-neonBlue/60 uppercase font-bold block mb-2">AI Generated (right-click to delete)</span>
                              <div className="grid grid-cols-8 gap-1.5">
                                {customIcons.map((iconUrl, index) => (
                                  <button
                                    key={`custom-${index}`}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, icon: iconUrl, colorClass: 'bg-white/5' })}
                                    onContextMenu={(e) => deleteCustomIcon(iconUrl, e)}
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden hover:bg-white/10 transition-all
                                      ${formData.icon === iconUrl ? 'ring-2 ring-neonBlue/50' : 'bg-white/[0.03]'}`}
                                    title="Right-click to delete"
                                  >
                                    <img src={iconUrl} className="w-full h-full object-cover" alt="Custom icon" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* AI Generation Entry Point */}
                        <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-white/40 uppercase font-bold tracking-widest">Icon Studio</span>
                            <div className="flex gap-1">
                              <div className="w-1 h-1 rounded-full bg-neonBlue animate-pulse" />
                              <div className="w-1 h-1 rounded-full bg-neonBlue/40" />
                            </div>
                          </div>
                          <p className="text-[10px] text-white/30 leading-relaxed italic">Create high-fidelity Apple-style icons with precision presets and AI refining tools.</p>
                          <button
                            onClick={() => setShowStudio(true)}
                            className="w-full py-3 bg-white/5 hover:bg-neonBlue/20 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl border border-white/10 hover:border-neonBlue/30 transition-all group flex items-center justify-center gap-3"
                          >
                            <span className="group-hover:scale-110 transition-transform">💎</span>
                            Open iGen Studio
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* iGen Studio Modal Overlay */}
                {showStudio && (
                  <div className="fixed inset-0 z-[60] flex items-center justify-center p-8 md:p-12 animate-in fade-in zoom-in duration-300">
                    <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl" />
                    <div className="relative w-full max-w-5xl bg-[#0c0c0c] border border-white/10 rounded-[40px] shadow-3xl flex flex-col overflow-hidden max-h-full">
                      {/* Studio Header */}
                      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5 bg-white/[0.02]">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center text-xl shadow-inner-white border border-white/10">✨</div>
                          <div>
                            <h3 className="text-xl font-bold tracking-tight text-white/90 italic">iGen Studio Pro</h3>
                            <p className="text-[9px] font-mono text-neonBlue/60 uppercase tracking-[0.2em]">Apple Aesthetic Icon Engine</p>
                          </div>
                        </div>
                        <button onClick={() => setShowStudio(false)} className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white/20 hover:text-white transition-colors">Close</button>
                      </div>

                      <div className="flex-1 overflow-auto p-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
                        {/* Left Side: Controls */}
                        <div className="space-y-8">
                          <div className="space-y-4">
                            <label className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold">1. Base Concept (Optional)</label>
                            <input
                              type="text"
                              value={baseConcept}
                              onChange={(e) => setBaseConcept(e.target.value)}
                              placeholder={`e.g. "A mechanical phoenix", "Abstract geometry"...`}
                              className="w-full p-4 bg-white/[0.03] border border-white/10 rounded-2xl text-white text-sm focus:border-neonBlue/30 outline-none transition-all placeholder:text-white/10"
                            />
                            <p className="text-[9px] text-white/20 italic">This guides what the icon actually is. If empty, we'll use the app name: "{formData.name}".</p>
                          </div>

                          <div className="space-y-4">
                            <label className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold">2. Select Style Preset</label>
                            <div className="grid grid-cols-2 gap-3">
                              {PRESETS.map(preset => (
                                <button
                                  key={preset.id}
                                  onClick={() => {
                                    generateLogo(preset.prompt);
                                  }}
                                  className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all text-left group"
                                >
                                  <span className="text-2xl group-hover:scale-125 transition-transform">{preset.icon}</span>
                                  <span className="text-sm font-semibold text-white/80">{preset.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <label className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold">{selectedStudioIcon ? '3. Refinement Tool' : '3. Custom Style Prompt'}</label>
                            <div className="relative">
                              <textarea
                                value={studioPrompt}
                                onChange={(e) => setStudioPrompt(e.target.value)}
                                placeholder={selectedStudioIcon ? "e.g., 'Make the symbol neon blue', 'Add a metallic rim'..." : "Describe a custom style (e.g. 'Cyberpunk with heavy grit')..."}
                                className="w-full h-24 p-5 bg-white/[0.03] border border-white/10 rounded-3xl resize-none text-white/90 text-sm focus:border-neonBlue/30 outline-none transition-all placeholder:text-white/10"
                              />
                            </div>
                            <button
                              onClick={() => generateLogo(undefined, !!selectedStudioIcon)}
                              disabled={isGenerating || (!studioPrompt && !selectedStudioIcon && !baseConcept)}
                              className="w-full py-4 bg-neonBlue text-black rounded-2xl font-bold text-xs uppercase tracking-[0.1em] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 flex items-center justify-center gap-3"
                            >
                              {isGenerating ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                  Synthesizing...
                                </>
                              ) : (
                                <>
                                  {selectedStudioIcon ? '⚡ Refine Icon' : (baseConcept ? '💎 Craft from Concept' : '💎 Generate from Text')}
                                </>
                              )}
                            </button>
                            {generationError && <p className="text-red-400 text-center text-xs font-medium">{generationError}</p>}
                          </div>

                          {studioHistory.length > 0 && (
                            <div className="space-y-4">
                              <label className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold">Session History</label>
                              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                                {studioHistory.map((img, i) => (
                                  <button
                                    key={i}
                                    onClick={() => setSelectedStudioIcon(img)}
                                    className={`w-16 h-16 rounded-xl border-2 flex-shrink-0 transition-all overflow-hidden bg-white/5 ${selectedStudioIcon === img ? 'border-neonBlue' : 'border-transparent opacity-40 hover:opacity-100'}`}
                                  >
                                    <img src={img} className="w-full h-full object-contain" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Right Side: High Fidelity Preview */}
                        <div className="flex flex-col items-center justify-center gap-10">
                          <div className="relative group">
                            {/* Animated background glows */}
                            <div className="absolute -inset-20 bg-neonBlue/10 blur-[100px] rounded-full animate-pulse-slow" />

                            <div className="relative w-64 h-64 md:w-80 md:h-80 bg-[#050505] rounded-[60px] border border-white/10 shadow-premium flex items-center justify-center overflow-hidden saturate-125">
                              {selectedStudioIcon ? (
                                <img src={selectedStudioIcon} className="w-full h-full object-contain" />
                              ) : (
                                <div className="text-center space-y-4 p-10">
                                  <div className="w-16 h-16 mx-auto bg-white/5 rounded-3xl border border-dashed border-white/20 flex items-center justify-center">
                                    <span className="text-3xl opacity-20">🎨</span>
                                  </div>
                                  <p className="text-xs text-white/20 leading-relaxed">Select a preset or type a prompt to begin the crafting sequence.</p>
                                </div>
                              )}

                              {isGenerating && (
                                <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-4">
                                  <div className="w-12 h-12 border-4 border-neonBlue/20 border-t-neonBlue rounded-full animate-spin" />
                                  <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-neonBlue">Synthesizing...</p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              onClick={applyStudioIcon}
                              disabled={!selectedStudioIcon || isGenerating}
                              className="px-10 py-4 bg-white text-black rounded-2xl font-bold text-xs uppercase tracking-[0.1em] hover:scale-105 active:scale-95 transition-all disabled:opacity-20"
                            >
                              Apply to App Icon
                            </button>
                            <button
                              onClick={() => setShowStudio(false)}
                              className="px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold text-xs uppercase tracking-[0.1em] transition-all"
                            >
                              Discard
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-8 border-t border-white/5 flex justify-end gap-6">
                  <button onClick={onClose} className="text-[10px] font-bold uppercase text-white/20">{isNew ? 'Abort' : 'Cancel'}</button>
                  <button onClick={handleDeploy} disabled={!formData.name} className="px-10 py-3 bg-neonBlue text-black rounded-xl text-[11px] font-bold uppercase hover:scale-105 active:scale-95 transition-all">{isNew ? 'Build Cockpit Entry' : 'Update Configuration'}</button>
                </div>
              </div>

              <div className="bg-white/[0.01] rounded-3xl p-10 border border-white/5 flex flex-col justify-center items-center gap-10">
                <div className="text-center space-y-2">
                  <p className="text-[10px] font-mono text-white/20 tracking-[0.4em] uppercase">Binding Sequence</p>
                  <div className="h-1 w-20 bg-neonBlue/20 mx-auto rounded-full" />
                </div>
                <div className="relative group">
                  <div className="absolute -inset-10 bg-neonBlue/5 blur-3xl rounded-full" />
                  <div className="relative bg-[#050505] p-12 rounded-[40px] border border-white/5 shadow-2xl saturate-150">
                    <div className={`w-24 h-24 rounded-3xl mx-auto flex items-center justify-center text-4xl mb-6 shadow-premium ${formData.colorClass}`}>
                      {formData.icon?.startsWith('data') ? <img src={formData.icon} className="w-full h-full object-cover" /> : formData.icon}
                    </div>
                    <p className="font-bold text-white/90 text-lg tracking-tight mb-1">{formData.name || 'TARGET_UNSET'}</p>
                    <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">{formData.badge || 'WAITING_PORT'}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-12">
              <div className="flex items-center justify-between pb-10 border-b border-white/5">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-5xl font-bold tracking-tighter text-white/90">{app.name}</h2>
                    <p className="text-[11px] font-mono text-white/30 uppercase tracking-[0.3em]">{app.command || 'Direct Launch'}</p>
                    {app.directory && <p className="text-[10px] font-mono text-white/20 truncate max-w-md" title={app.directory}>📁 {app.directory}</p>}
                  </div>
                  <div className="flex gap-4">
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${app.isOnline ? 'bg-neonGreen/10 border-neonGreen/20 text-neonGreen' : 'bg-white/5 border-white/10 text-white/20'}`}>
                      <div className={`w-2 h-2 rounded-full ${app.isOnline ? 'bg-neonGreen animate-pulse shadow-[0_0_8px_#00ffaa]' : 'bg-white/20'}`} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{app.isOnline ? 'Engine Active' : 'System Idle'}</span>
                    </div>
                    <span className="text-[10px] self-center text-white/10 font-bold uppercase tracking-widest">{app.badge ? `Port: ${app.badge.split(':').pop() || 'Dynamic'}` : 'Terminal Mode'}</span>
                    {app.appType && <span className="text-[10px] self-center text-white/10 font-bold uppercase tracking-widest">{app.appType}</span>}
                    {app.isEmbedded && <span className="text-[10px] self-center text-neonBlue font-bold uppercase tracking-widest">Embedded</span>}
                  </div>
                </div>
                <div className="relative group">
                  <div className={`absolute -inset-4 rounded-[40px] blur-2xl transition-all duration-700 ${app.isOnline ? 'bg-neonBlue/20 opacity-100' : 'opacity-0'}`} />
                  <div className={`w-32 h-32 rounded-[40px] border border-white/10 shadow-2xl relative z-10 overflow-hidden transition-transform duration-500 group-hover:scale-110 ${app.colorClass}`}>
                    {app.icon.startsWith('data') ? <img src={app.icon} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-5xl">{app.icon}</div>}
                  </div>
                </div>
              </div>

              {app.isEmbedded && browserViewUrl && (
                <div className={isFullscreen ? 'fixed inset-0 z-[100] bg-black flex flex-col' : 'space-y-6'}>
                  <div className={`flex items-center justify-between ${isFullscreen ? 'p-6 bg-black/90 backdrop-blur-md border-b border-white/10 absolute top-0 left-0 right-0 z-[101]' : 'mb-4'}`}>
                    <h3 className={`text-[10px] font-bold uppercase tracking-widest ${isFullscreen ? 'text-white/60' : 'text-white/30'}`}>
                      {isFullscreen ? `Active Session: ${app.name}` : 'Embedded Application'}
                    </h3>
                    <div className="flex gap-2 relative z-50">
                      <button
                        onClick={refreshBrowserView}
                        className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/10 transition-all"
                      >
                        Refresh
                      </button>
                      <button
                        onClick={() => {
                          if (isFullscreen && !isMinimizing) {
                            setIsMinimizing(true);
                            setTimeout(() => onClose(), 400);
                          } else {
                            setIsFullscreen(!isFullscreen);
                          }
                        }}
                        className={`px-4 py-2 border rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${isFullscreen
                          ? 'bg-neonBlue/20 border-neonBlue/40 text-neonBlue hover:bg-neonBlue/30'
                          : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'
                          }`}
                      >
                        {isFullscreen ? 'Minimize' : 'Fullscreen'}
                      </button>
                      {isFullscreen && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                          <kbd className="px-2 py-0.5 rounded bg-white/10 text-[9px] font-mono text-white/60 border border-white/20">ESC</kbd>
                          <span className="text-[9px] text-white/40 uppercase tracking-wider">to minimize</span>
                        </div>
                      )}
                      {!isFullscreen && (
                        <>
                          <button
                            onClick={openInExternalBrowser}
                            className="px-4 py-2 bg-neonBlue/10 border border-neonBlue/20 rounded-lg text-[10px] font-bold uppercase tracking-widest text-neonBlue hover:bg-neonBlue/20 transition-all"
                          >
                            External
                          </button>
                          <button
                            onClick={toggleEmbeddedMode}
                            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/10 transition-all"
                          >
                            Disable
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div
                    ref={embedContainerRef}
                    className={`relative bg-black/40 border border-white/5 overflow-hidden transition-all duration-500 ease-spring ${isFullscreen ? 'w-full h-full rounded-none mt-0' : 'w-full rounded-2xl shadow-2xl'
                      }`}
                    style={{ height: isFullscreen ? '100%' : '650px' }}
                  >
                    {!isFullscreen && (
                      <div className="absolute top-0 left-0 right-0 h-8 bg-white/5 border-b border-white/5 flex items-center px-4 gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500/20" />
                        <div className="w-2 h-2 rounded-full bg-yellow-500/20" />
                        <div className="w-2 h-2 rounded-full bg-green-500/20" />
                        <div className="ml-auto text-[8px] font-mono text-white/20">{browserViewUrl}</div>
                      </div>
                    )}

                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      {!app.isOnline && app.appType !== 'url' ? (
                        <div className="text-center space-y-3">
                          <p className="text-white/20 text-sm font-mono uppercase tracking-widest italic">Engine Offline</p>
                          <p className="text-white/10 text-[10px]">Launch service to establish link</p>
                        </div>
                      ) : !isLoaded ? (
                        <div className="text-center space-y-4">
                          <p className="text-white/20 text-sm font-mono animate-pulse uppercase tracking-widest">
                            {loadError ? 'Link Failure' : 'Establishing Neural Link...'}
                          </p>
                          {loadError && (
                            <p className="text-red-400/40 text-[9px] max-w-xs mx-auto pointer-events-auto">
                              {loadError}
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-6">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/30">Cockpit Controls</h3>
                  <button
                    onClick={onToggleService}
                    className={`w-full py-8 rounded-3xl text-[11px] font-bold uppercase tracking-[0.4em] transition-all duration-500 border relative overflow-hidden group/btn ${app.isOnline
                      ? 'bg-black text-neonPink border-neonPink shadow-[0_0_30px_rgba(255,0,255,0.1)]'
                      : 'bg-white text-black border-white shadow-premium hover:scale-[1.02]'
                      }`}
                  >
                    <span className="relative z-10">{app.isOnline ? 'Terminate Service' : 'Engage Service'}</span>
                    {!app.isOnline && <div className="absolute inset-0 bg-gradient-to-r from-neonBlue/0 via-neonBlue/10 to-neonBlue/0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />}
                  </button>

                  {!app.isEmbedded && (
                    <button
                      onClick={toggleEmbeddedMode}
                      className="w-full py-4 rounded-2xl text-[10px] font-bold uppercase tracking-[0.3em] bg-neonBlue/10 border border-neonBlue/20 text-neonBlue hover:bg-neonBlue/20 transition-all"
                    >
                      Enable Embedded Mode
                    </button>
                  )}

                  <div className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl space-y-4">
                    <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest text-white/20">
                      <span>Service Integrity</span>
                      <span className={app.isOnline ? 'text-neonGreen' : ''}>{app.isOnline ? 'Optimal' : 'Checking...'}</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-1000 ${app.isOnline ? 'w-full bg-neonGreen' : 'w-[5%] bg-white/20'}`} />
                    </div>
                  </div>
                </div>

                <div className="bg-black/60 border border-white/5 rounded-3xl p-6 font-mono text-[11px] text-white/30 h-[320px] relative shadow-inner flex flex-col group/terminal">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-500/20" />
                      <div className="w-2 h-2 rounded-full bg-yellow-500/20" />
                      <div className="w-2 h-2 rounded-full bg-green-500/20" />
                    </div>
                    <div className="flex items-center gap-3">
                      {serviceLogs.length > 0 && (
                        <button 
                          onClick={handleSummarizeLogs}
                          disabled={isSummarizing}
                          className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 border border-white/10 rounded hover:bg-white/5 transition-all text-neonBlue/60 hover:text-neonBlue disabled:opacity-30"
                        >
                          {isSummarizing ? 'Scrying...' : 'Summarize'}
                        </button>
                      )}
                      <span className="text-[8px] opacity-30 font-bold uppercase tracking-widest px-2 py-0.5 border border-white/10 rounded">Live Feedback</span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto space-y-1 custom-scrollbar pr-2 relative">
                    {logSummary ? (
                      <div className="bg-neonBlue/5 border border-neonBlue/20 rounded-xl p-4 mb-4 animate-in fade-in zoom-in duration-500 relative">
                        <button 
                          onClick={() => setLogSummary(null)}
                          className="absolute top-2 right-3 text-[10px] text-white/20 hover:text-white"
                        >
                          ✕
                        </button>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs">🔮</span>
                          <span className="text-[9px] font-bold uppercase tracking-widest text-neonBlue">Wizard's Summary</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-white/70 italic whitespace-pre-wrap">
                          {logSummary}
                        </p>
                      </div>
                    ) : null}

                    {serviceLogs.length > 0 ? (
                      serviceLogs.map((log, i) => (
                        <div key={i} className="flex gap-3 animate-in fade-in slide-in-from-left-1 duration-300">
                          <span className="opacity-10 shrink-0">[{new Date(log.time).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                          <span className={log.type === 'stderr' ? 'text-red-400/80' : 'text-white/60'}>{log.text}</span>
                        </div>
                      ))
                    ) : app.isOnline ? (
                      <div className="space-y-2">
                        <p className="text-neonBlue">$ {app.command}</p>
                        <p className="animate-pulse">Initializing engine...</p>
                      </div>
                    ) : (
                      <p className="italic opacity-20">Engine offline. Logs unavailable.</p>
                    )}
                    <div ref={terminalEndRef} />
                  </div>

                  <div className="absolute bottom-4 right-6 text-[8px] opacity-10 font-bold uppercase tracking-widest">JellyMonitor v2.4</div>
                </div>
              </div>

              <div className="pt-12 border-t border-white/5 flex items-center justify-between">
                <p className="text-[10px] text-white/10 uppercase tracking-widest font-bold">Service UID: {app.id}</p>
                <div className="flex gap-4">
                  <button
                    onClick={onEdit}
                    className="px-6 py-2 text-[9px] font-bold uppercase tracking-widest text-neonBlue/30 hover:text-neonBlue transition-colors"
                  >
                    Edit
                  </button>
                  <button onClick={() => onDelete && onDelete(app.id)} className="px-6 py-2 text-[9px] font-bold uppercase tracking-widest text-red-500/30 hover:text-red-500 transition-colors">Decommission</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppWindow;
