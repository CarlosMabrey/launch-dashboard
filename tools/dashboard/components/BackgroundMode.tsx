import React, { useState, useEffect } from 'react';
import LiquidBackground from './LiquidBackground';

interface BackgroundModeProps {
  // No props needed; reads from localStorage and dispatches events
}

export default function BackgroundMode({}: BackgroundModeProps) {
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
