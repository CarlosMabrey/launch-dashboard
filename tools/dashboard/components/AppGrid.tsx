
import React from 'react';
import { AppItem } from '../types';
import AppCard from './AppCard';
import CalendarCell from './CalendarCell';
import VanFundCell from './VanFundCell';
import GitHubHeatmapCell from './GitHubHeatmapCell';
import LivingLedgerCell from './LivingLedgerCell';
import OmniscienceCell from './OmniscienceCell';

interface AppGridProps {
  apps: AppItem[];
  onOpenApp: (app: AppItem) => void;
  onLaunchApp?: (app: AppItem) => void;
  onContextMenu?: (app: AppItem, e: React.MouseEvent) => void;
  onTodoClick?: (app: AppItem) => void;
}

const AppGrid: React.FC<AppGridProps> = ({ apps, onOpenApp, onLaunchApp, onContextMenu, onTodoClick }) => {
  return (
    <div className="relative">
      {/* Premium glass container */}
      <div
        className="rounded-3xl p-10 relative overflow-hidden backdrop-blur-2xl"
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.04)'
        }}
      >
        {/* Subtle top reflection */}
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }}
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-12 justify-items-center">
          <CalendarCell />
          <VanFundCell />
          <GitHubHeatmapCell />
          <LivingLedgerCell />
          <OmniscienceCell apps={apps} />
          {apps.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              onClick={onOpenApp}
              onLaunch={onLaunchApp}
              onContextMenu={onContextMenu}
              onTodoClick={onTodoClick}
            />
          ))}
          <AppCard
            app={{
              id: 'new', name: '', icon: '+', badge: '',
              status: 'init', colorClass: '', url: '#'
            }}
            isNew
            onClick={onOpenApp}
          />
        </div>
      </div>
    </div>
  );
};

export default AppGrid;

