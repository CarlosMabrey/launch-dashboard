
import React, { useEffect, useState, useRef, useCallback } from 'react';

// Dark, moody, ethereal color palettes
const AURA_PALETTES = {
  obsidian: ['#1a0a2e', '#16213e', '#0f3460', '#533483'],
  midnight: ['#0d0221', '#150734', '#1a1a3e', '#3d1a5e'],
  void: ['#050510', '#0a0a20', '#15152d', '#1f1f40'],
  ember: ['#1a0505', '#2d0a0a', '#3d1515', '#4a1a1a'],
  aurora: ['#0a1a1a', '#102828', '#153838', '#1a4545'],
  cosmic: ['#0f0520', '#1a0a35', '#251045', '#301555'],
  phantom: ['#080812', '#0f0f1f', '#18182d', '#22223d'],
  velvet: ['#150815', '#200f20', '#2a1530', '#351a40'],
};

// Parallax multipliers for depth effect
const PARALLAX_PRIMARY = 0.015;
const PARALLAX_SECONDARY = 0.008;

interface BackgroundProps {
  palette?: keyof typeof AURA_PALETTES;
}

const Background: React.FC<BackgroundProps> = ({ palette = 'obsidian' }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [currentPalette, setCurrentPalette] = useState(palette);
  const primaryLayerRef = useRef<HTMLDivElement>(null);
  const secondaryLayerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | undefined>(undefined);

  // Apply palette colors to CSS custom properties
  const applyPalette = useCallback((paletteName: keyof typeof AURA_PALETTES) => {
    const colors = AURA_PALETTES[paletteName];
    const root = document.documentElement;
    root.style.setProperty('--aura-1', colors[0]);
    root.style.setProperty('--aura-2', colors[1]);
    root.style.setProperty('--aura-3', colors[2]);
    root.style.setProperty('--aura-4', colors[3]);
  }, []);

  // Initialize and handle palette changes
  useEffect(() => {
    applyPalette(currentPalette);
  }, [currentPalette, applyPalette]);

  // Cycle through palettes slowly for ambient feel (optional)
  useEffect(() => {
    const paletteKeys = Object.keys(AURA_PALETTES) as (keyof typeof AURA_PALETTES)[];
    let currentIndex = paletteKeys.indexOf(palette);

    const cycleInterval = setInterval(() => {
      currentIndex = (currentIndex + 1) % paletteKeys.length;
      setCurrentPalette(paletteKeys[currentIndex]);
    }, 30000); // Change every 30 seconds

    return () => clearInterval(cycleInterval);
  }, [palette]);

  // Parallax mouse movement with requestAnimationFrame for smooth performance
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Cancel any pending animation frame
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;
        setMousePos({ x, y });

        // Apply parallax transforms directly for performance
        if (primaryLayerRef.current) {
          const primaryX = x * window.innerWidth * PARALLAX_PRIMARY;
          const primaryY = y * window.innerHeight * PARALLAX_PRIMARY;
          primaryLayerRef.current.style.transform = `translate(${primaryX}px, ${primaryY}px)`;
        }

        if (secondaryLayerRef.current) {
          const secondaryX = x * window.innerWidth * PARALLAX_SECONDARY;
          const secondaryY = y * window.innerHeight * PARALLAX_SECONDARY;
          secondaryLayerRef.current.style.transform = `translate(${secondaryX}px, ${secondaryY}px)`;
        }
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <div className="aura-container">
      {/* Primary aura layer - moves faster */}
      <div
        ref={primaryLayerRef}
        className="aura-layer"
        style={{ transition: 'transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
      />

      {/* Secondary aura layer - moves slower for depth */}
      <div
        ref={secondaryLayerRef}
        className="aura-layer-secondary"
        style={{ transition: 'transform 1.2s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
      />

      {/* Anti-banding noise dithering */}
      <div className="aura-noise" />

      {/* Subtle vignette for depth */}
      <div className="aura-vignette" />
    </div>
  );
};

export default Background;