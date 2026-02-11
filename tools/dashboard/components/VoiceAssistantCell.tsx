import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, Settings, Play, Pause, SkipForward, XCircle } from 'lucide-react';
import { generateTTS } from '../services/piService';

// Voice options for QWEN 3 TTS
const VOICES = [
  { id: 'nova', name: 'Nova', description: 'Warm, clear, and engaging' },
  { id: 'serene', name: 'Serene', description: 'Calm and soothing' },
  { id: 'aria', name: 'Aria', description: 'Bright and expressive' },
  { id: 'knight', name: 'Knight', description: 'Deep and authoritative' }
];

interface VoiceAssistantCellProps {
  className?: string;
}

const VoiceAssistantCell: React.FC<VoiceAssistantCellProps> = ({ className = '' }) => {
  // State
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [piResponse, setPiResponse] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(() => {
    const saved = localStorage.getItem('voice_assistant_voice');
    return saved || 'nova';
  });
  const [listeningMode, setListeningMode] = useState(() => {
    const saved = localStorage.getItem('voice_assistant_mode');
    return saved || 'push-to-talk';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Refs
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const blobCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const pushToTalkRef = useRef(false);

  // ─────────────────────────────────────────────────────────────
  // AUDIO REACTIVE VISUALIZATION STATE
  // ─────────────────────────────────────────────────────────────
  const [visualizationMode, setVisualizationMode] = useState<'blob' | 'waveform' | 'orb'>('blob');
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const [blobPalette, setBlobPalette] = useState(1);
  const [isAudioAnalyzing, setIsAudioAnalyzing] = useState(false);

  // Blob shapes (procedural)
  const blobShapes = [
    (ctx: CanvasRenderingContext2D, width: number, height: number, distortion: number) => {
      const cx = width / 2, cy = height / 2;
      const baseRadius = Math.min(width, height) * 0.4;
      ctx.beginPath();
      for (let i = 0; i < 360; i += 2) {
        const angle = (i * Math.PI) / 180;
        const radiusVariance = Math.sin(angle * 3 + distortion) * 20 + Math.cos(angle * 5 + distortion * 1.5) * 15;
        const radius = baseRadius + radiusVariance;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    },
    (ctx: CanvasRenderingContext2D, width: number, height: number, distortion: number) => {
      const cx = width / 2, cy = height / 2;
      const baseRadius = Math.min(width, height) * 0.38;
      ctx.beginPath();
      for (let i = 0; i < 360; i += 3) {
        const angle = (i * Math.PI) / 180;
        const radiusVariance = Math.sin(angle * 4 + distortion * 0.8) * 25 + Math.cos(angle * 2 + distortion) * 12;
        const radius = baseRadius + radiusVariance;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    },
    (ctx: CanvasRenderingContext2D, width: number, height: number, distortion: number) => {
      const cx = width / 2, cy = height / 2;
      const baseRadius = Math.min(width, height) * 0.42;
      ctx.beginPath();
      for (let i = 0; i < 360; i += 4) {
        const angle = (i * Math.PI) / 180;
        const radiusVariance = Math.sin(angle * 2 + distortion * 1.2) * 18 + Math.cos(angle * 6 + distortion * 0.6) * 22;
        const radius = baseRadius + radiusVariance;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    },
    (ctx: CanvasRenderingContext2D, width: number, height: number, distortion: number) => {
      const cx = width / 2, cy = height / 2;
      const baseRadius = Math.min(width, height) * 0.35;
      ctx.beginPath();
      for (let i = 0; i < 360; i += 5) {
        const angle = (i * Math.PI) / 180;
        const radiusVariance = Math.sin(angle * 7 + distortion) * 15 + Math.cos(angle * 3 + distortion * 2) * 20;
        const radius = baseRadius + radiusVariance;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
  ];

  // Color palettes (from provided CSS)
  const blobColors = [
    { primary: '#984ddf', secondary: '#4344ad', tertiary: '#74d9e1', bg: '#101030' },
    { primary: '#ff3838', secondary: '#ff9d7c', tertiary: '#ffdda0', bg: '#545454' },
    { primary: '#291528', secondary: '#3a3e3b', tertiary: '#9e829c', bg: '#300030' },
    { primary: '#bb74ff', secondary: '#7c7dff', tertiary: '#a0f8ff', bg: '#ffffff' },
    { primary: '#c1d7ae', secondary: '#9eff72', tertiary: '#ffcab1', bg: '#968e85' },
    { primary: '#ff8c42', secondary: '#fcaf58', tertiary: '#f9c784', bg: '#ffffff' },
  ];

  // Audio analysis setup
  const setupAudioAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const audioContext = audioContextRef.current;
      const source = audioContext.createMediaStreamSource(stream);
      microphoneRef.current = source;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;
      const bufferLength = analyser.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);
      setIsAudioAnalyzing(true);
      visualizeAudio();
    } catch (error) {
      console.error('Audio analysis setup failed:', error);
      setIsAudioAnalyzing(false);
    }
  };

  const stopAudioAnalysis = () => {
    if (microphoneRef.current) {
      microphoneRef.current.disconnect();
      microphoneRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsAudioAnalyzing(false);
  };

  // Main audio visualization loop
  const visualizeAudio = () => {
    const canvas = blobCanvasRef.current;
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;
    if (!canvas || !analyser || !dataArray) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    const colors = blobColors[blobPalette - 1];
    analyser.getByteFrequencyData(dataArray as any);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    const average = sum / dataArray.length;
    const distortion = average / 255 * 5;
    const time = Date.now() / 1000;
    const shapeIndex = Math.floor((time * 0.5) % blobShapes.length);
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < 4; i++) {
      const offset = i * (Math.PI / 2);
      const blobDistortion = distortion + time * 0.5 + offset;
      const shapeFn = blobShapes[(shapeIndex + i) % blobShapes.length];
      const colorMap = [colors.primary, colors.secondary, colors.tertiary, colors.bg];
      ctx.fillStyle = colorMap[i];
      ctx.globalAlpha = i === 0 ? 0.7 : i === 1 ? 0.5 : i === 2 ? 0.3 : 0.1;
      shapeFn(ctx, width, height, blobDistortion);
      ctx.fill();
    }
    if (average > 30) {
      ctx.shadowBlur = average / 10;
      ctx.shadowColor = colors.primary;
    }
    animationFrameRef.current = requestAnimationFrame(visualizeAudio);
  };

  // Auto-start/stop audio analysis based on listening state
  useEffect(() => {
    if (isListening) {
      setupAudioAnalysis();
    } else {
      stopAudioAnalysis();
    }
    return () => stopAudioAnalysis();
  }, [isListening]);

  // Palette rotation while listening
  useEffect(() => {
    if (isAudioAnalyzing) {
      const interval = setInterval(() => {
        setBlobPalette(prev => (prev % 6) + 1);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [isAudioAnalyzing]);

  // ─────────────────────────────────────────────────────────────
  // Web Speech API Setup (STT)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition API not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = listeningMode === 'continuous';
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      if (final) {
        setTranscript(final);
        handlePiResponse(final);
      } else if (interim) {
        setTranscript(interim);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setTranscript('Microphone access denied. Please allow microphone permissions.');
      }
    };

    recognition.onend = () => {
      if (listeningMode === 'continuous' && isListening) {
        try { recognition.start(); } catch (e) { /* ignore */ }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognition) recognition.stop();
    };
  }, [listeningMode, isListening]);

  // ─────────────────────────────────────────────────────────────
  // STT Controls
  // ─────────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setTranscript('Speech Recognition not available in this browser.');
      return;
    }
    try {
      recognitionRef.current.start();
      setIsListening(true);
      setTranscript('');
      setPiResponse('');
      setAudioUrl(null);
      setAudioError(null);
    } catch (e) {
      console.error('Failed to start recognition:', e);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  // Push-to-talk handlers
  const handleMouseDown = () => {
    if (listeningMode === 'push-to-talk' && !isListening) {
      pushToTalkRef.current = true;
      startListening();
    }
  };

  const handleMouseUp = () => {
    if (listeningMode === 'push-to-talk' && isListening) {
      pushToTalkRef.current = false;
      stopListening();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    handleMouseDown();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    handleMouseUp();
  };

  // ─────────────────────────────────────────────────────────────
  // Pi Chat Integration
  // ─────────────────────────────────────────────────────────────
  const handlePiResponse = async (userInput: string) => {
    setIsProcessing(true);
    try {
      // Quick commands
      const command = userInput.toLowerCase().trim();
      if (command.startsWith('show tasks') || command === 'tasks') {
        setPiResponse('Opening Todo Board...');
        window.dispatchEvent(new CustomEvent('dashboard:openCell', { detail: 'todo' }));
        setTimeout(() => stopListening(), 1000);
        setIsProcessing(false);
        return;
      }
      if (command.startsWith('show calendar') || command === 'calendar') {
        setPiResponse('Opening Calendar...');
        window.dispatchEvent(new CustomEvent('dashboard:openCell', { detail: 'calendar' }));
        setTimeout(() => stopListening(), 1000);
        setIsProcessing(false);
        return;
      }
      if (command.startsWith('show van fund') || command === 'van fund') {
        setPiResponse('Opening Van Fund tracker...');
        window.dispatchEvent(new CustomEvent('dashboard:openCell', { detail: 'vanfund' }));
        setTimeout(() => stopListening(), 1000);
        setIsProcessing(false);
        return;
      }
      if (command.startsWith('show market') || command === 'market' || command === 'weather') {
        setPiResponse('Checking market sentiment...');
        window.dispatchEvent(new CustomEvent('dashboard:openCell', { detail: 'market' }));
        setTimeout(() => stopListening(), 1000);
        setIsProcessing(false);
        return;
      }
      if (command.startsWith('show github') || command === 'github') {
        setPiResponse('Opening GitHub Activity...');
        window.dispatchEvent(new CustomEvent('dashboard:openCell', { detail: 'github' }));
        setTimeout(() => stopListening(), 1000);
        setIsProcessing(false);
        return;
      }

      // Regular chat with Pi
      // Dynamic import to avoid circular deps if needed
      const { sendChatMessage } = require('../services/piService');
      const result = await sendChatMessage(userInput);
      if (result.success && result.piResponse) {
        setPiResponse(result.piResponse.text);
        await generateSpeech(result.piResponse.text);
      } else {
        setPiResponse('Sorry, I encountered an error connecting to Pi.');
      }
    } catch (error) {
      console.error('Pi chat error:', error);
      setPiResponse('Connection to Pi failed. Please try again.');
    } finally {
      setIsProcessing(false);
      if (listeningMode === 'push-to-talk') {
        setTimeout(() => stopListening(), 2000);
      }
    }
  };

  // ─────────────────────────────────────────────────────────────
  // TTS Generation & Playback
  // ─────────────────────────────────────────────────────────────
  const generateSpeech = async (text: string) => {
    try {
      setAudioError(null);
      const result = await generateTTS(text, selectedVoice);
      if (result.success && result.audioUrl) {
        setAudioUrl(result.audioUrl);
        setAudioDuration(result.duration || 0);
        setTimeout(() => playAudio(), 500);
      } else {
        setAudioError(result.error || 'TTS generation failed');
        speakWithBrowserSynthesis(text);
      }
    } catch (error) {
      console.error('TTS error:', error);
      setAudioError('TTS unavailable');
      speakWithBrowserSynthesis(text);
    }
  };

  const speakWithBrowserSynthesis = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = speechSynthesis.getVoices();
      const voiceMap: Record<string, string> = {
        'nova': 'Google US English',
        'serene': 'Google UK English Female',
        'aria': 'Samantha',
        'knight': 'Daniel'
      };
      const target = voiceMap[selectedVoice];
      if (target) {
        const match = voices.find(v => v.name.includes(target.split(' ')[0]));
        if (match) utterance.voice = match;
      }
      utterance.rate = 0.9;
      utterance.pitch = 1;
      speechSynthesis.speak(utterance);
      setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
    }
  };

  const playAudio = () => {
    if (audioRef.current && audioUrl) {
      audioRef.current.src = audioUrl;
      audioRef.current.play()
        .then(() => setIsSpeaking(true))
        .catch((err) => {
          console.error('Audio playback failed:', err);
          setAudioError('Playback failed');
        });
    }
  };

  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsSpeaking(false);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsSpeaking(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Settings Persistence
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('voice_assistant_voice', selectedVoice);
  }, [selectedVoice]);

  useEffect(() => {
    localStorage.setItem('voice_assistant_mode', listeningMode);
  }, [listeningMode]);

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div className={`voice-assistant-cell ${className}`}>
      <audio ref={audioRef} onEnded={() => setIsSpeaking(false)} onError={() => setAudioError('Playback error')} />

      <style>{`
        .voice-assistant-cell {
          font-family: 'Inter', system-ui, sans-serif;
        }
        .glass-panel {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
        }
        .pulse-ring {
          animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.7); }
          70% { box-shadow: 0 0 0 15px rgba(139, 92, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0); }
        }
        .waveform-container canvas {
          width: 100%;
          height: 120px;
          border-radius: 8px;
        }
        .waveform-container {
          position: relative;
        }
        .settings-panel {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.3s ease;
        }
        .settings-panel.open {
          max-height: 400px;
        }
      `}</style>

      <div className="glass-panel p-6 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Volume2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">Voice Assistant</h3>
              <p className="text-white/50 text-xs">QWEN 3 TTS + Speech Input</p>
            </div>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
            title="Voice Settings"
          >
            <Settings className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* Audio-Reactive Blob Visualization */}
        <div className="waveform-container bg-black/20 rounded-xl p-3 overflow-hidden" style={{ minHeight: '120px' }}>
          <canvas 
            ref={blobCanvasRef} 
            width={320} 
            height={120} 
            className="w-full h-full rounded-lg"
          />
          {!isAudioAnalyzing && !isListening && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-white/20 text-xs text-center">
                Hold mic to activate<br />audio-reactive blobs
              </div>
            </div>
          )}
        </div>

        {/* Palette Switcher (only visible during active listening) */}
        {isListening && (
          <div className="flex items-center justify-center gap-2">
            <span className="text-[10px] text-white/40 uppercase">Aura</span>
            {[1, 2, 3, 4, 5, 6].map(p => (
              <button
                key={p}
                onClick={() => setBlobPalette(p)}
                className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${
                  blobPalette === p 
                    ? 'border-white/60 scale-110' 
                    : 'border-white/10 hover:border-white/30'
                }`}
                style={{ background: `radial-gradient(${blobColors[p-1].primary}, ${blobColors[p-1].secondary})` }}
                title={`Palette ${p}`}
              />
            ))}
          </div>
        )}

        {/* Transcript / Response Display */}
        <div className="min-h-[80px] bg-black/20 rounded-xl p-4">
          {isProcessing ? (
            <div className="flex items-center gap-2 text-purple-300">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              <span className="text-sm">Pi is thinking...</span>
            </div>
          ) : transcript ? (
            <div className="space-y-2">
              <div className="text-xs text-white/40 uppercase tracking-wider">You said</div>
              <div className="text-white/90 text-sm leading-relaxed">{transcript}</div>
              {piResponse && (
                <>
                  <div className="text-xs text-white/40 uppercase tracking-wider mt-3">Pi responds</div>
                  <div className="text-emerald-300/90 text-sm leading-relaxed">{piResponse}</div>
                </>
              )}
            </div>
          ) : (
            <p className="text-white/40 text-sm text-center">
              {isListening ? 'Listening...' : 'Tap the microphone to speak'}
            </p>
          )}
        </div>

        {/* Error Display */}
        {audioError && (
          <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2">
            <XCircle className="w-4 h-4" />
            <span>{audioError}</span>
          </div>
        )}

        {/* Main Controls */}
        <div className="flex items-center justify-center gap-4">
          {/* Microphone Button */}
          <button
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            disabled={isProcessing}
            className={`
              w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300
              ${isListening
                ? 'bg-gradient-to-br from-red-500 to-rose-600 pulse-ring scale-105'
                : 'bg-gradient-to-br from-violet-500 to-purple-600 hover:scale-105'}
              ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            title={listeningMode === 'push-to-talk' ? 'Hold to talk' : 'Toggle listening'}
          >
            {isListening ? (
              <MicOff className="w-7 h-7 text-white" />
            ) : (
              <Mic className="w-7 h-7 text-white" />
            )}
          </button>

          {/* Audio Playback Controls */}
          {(audioUrl || isSpeaking) && (
            <div className="flex items-center gap-2">
              {isSpeaking ? (
                <button onClick={pauseAudio} className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                  <Pause className="w-5 h-5 text-white" />
                </button>
              ) : (
                <button onClick={playAudio} className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                  <Play className="w-5 h-5 text-white" />
                </button>
              )}
              <button onClick={stopAudio} className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                <SkipForward className="w-5 h-5 text-white/60" />
              </button>
            </div>
          )}
        </div>

        {/* Quick Commands */}
        <div className="flex flex-wrap gap-2 justify-center">
          {[
            { key: 'todo', label: 'Tasks', icon: '📋' },
            { key: 'calendar', label: 'Calendar', icon: '📅' },
            { key: 'vanfund', label: 'Van Fund', icon: '🚐' },
            { key: 'market', label: 'Market', icon: '📈' },
            { key: 'github', label: 'GitHub', icon: '💻' }
          ].map(cmd => (
            <button
              key={cmd.key}
              onClick={() => {
                const cmdMap: Record<string, string> = {
                  'todo': 'Show tasks',
                  'calendar': 'Show calendar',
                  'vanfund': 'Show van fund',
                  'market': 'Show market',
                  'github': 'Show github'
                };
                handlePiResponse(cmdMap[cmd.key]);
              }}
              disabled={isProcessing || isListening}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white/70 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <span>{cmd.icon}</span>
              <span>{cmd.label}</span>
            </button>
          ))}
        </div>

        {/* Listening Mode Indicator */}
        <div className="flex items-center justify-center gap-2 text-xs text-white/40">
          <span>Mode:</span>
          <button
            onClick={() => setListeningMode(listeningMode === 'push-to-talk' ? 'continuous' : 'push-to-talk')}
            className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors capitalize"
          >
            {listeningMode === 'push-to-talk' ? 'Push-to-Talk' : 'Continuous'}
          </button>
        </div>

        {/* Settings Panel */}
        <div className={`settings-panel ${showSettings ? 'open' : ''}`}>
          <div className="pt-4 border-t border-white/10 space-y-4">
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block">Voice</label>
              <div className="grid grid-cols-2 gap-2">
                {VOICES.map(voice => (
                  <button
                    key={voice.id}
                    onClick={() => setSelectedVoice(voice.id)}
                    className={`
                      p-2 rounded-lg text-left transition-all
                      ${selectedVoice === voice.id
                        ? 'bg-violet-500/20 border border-violet-500/50'
                        : 'bg-white/5 border border-white/5 hover:bg-white/10'}
                    `}
                  >
                    <div className="text-sm font-medium text-white">{voice.name}</div>
                    <div className="text-xs text-white/40 mt-0.5">{voice.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceAssistantCell;
