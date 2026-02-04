import React from 'react';
import PiWhisper from './PiWhisper';
import SentimentScryer from './SentimentScryer';

const Header: React.FC = () => {
  return (
    <header className="text-center mb-16 pt-8 relative">
      <SentimentScryer />
      
      {/* Clean, premium typography */}
      <h1 className="text-6xl md:text-7xl font-extralight tracking-[-0.04em] text-white/90 mb-3">
        Launch
      </h1>
      <p className="text-[10px] font-medium tracking-[0.5em] uppercase text-white/25">
        Service Orchestration
      </p>
      
      <PiWhisper />
    </header>
  );
};

export default Header;
