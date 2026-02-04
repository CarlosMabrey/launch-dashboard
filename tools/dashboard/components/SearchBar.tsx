
import React, { useEffect, useRef } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="relative w-full max-w-xl mx-auto mb-16 px-4 sm:px-0">
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-neonBlue/20 to-neonPink/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search projects or commands (⌘+K)"
          className="relative w-full bg-white/5 backdrop-blur-3xl saturate-200 border border-white/10 rounded-2xl py-4 px-6 text-[15px] text-white/90 outline-none transition-all duration-300 focus:border-white/20 focus:shadow-premium shadow-xl placeholder:text-white/20"
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none opacity-20 group-focus-within:opacity-40 transition-opacity">
          <span className="text-[10px] font-bold border border-white/30 rounded px-1.5 py-0.5 tracking-tighter">CMD</span>
          <span className="text-[10px] font-bold border border-white/30 rounded px-1.5 py-0.5 tracking-tighter">K</span>
        </div>
      </div>
    </div>
  );
};

export default SearchBar;