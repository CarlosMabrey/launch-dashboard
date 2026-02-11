import React from 'react';
import { AppItem } from '../types';

const GLASS = 'bg-white/5 backdrop-blur-xl border border-white/10';
const GLASS_HOVER = 'hover:bg-white/10 hover:border-white/20';

interface AppGrimoireProps {
  apps: AppItem[];
  onLaunch: (app: AppItem) => void;
  onContextMenu: (app: AppItem, e: React.MouseEvent) => void;
  onCreate?: () => void;
}

interface AppCardProps {
  app: AppItem;
  onLaunch: () => void;
  onContext: (e: React.MouseEvent) => void;
}

function AppCard({ app, onLaunch, onContext }: AppCardProps) {
  const progress = app.todoData?.progressPercent || 0;

  return (
    <div
      onClick={onLaunch}
      onContextMenu={onContext}
      className={`${GLASS} ${GLASS_HOVER} rounded-2xl p-4 cursor-pointer transition-all duration-300 group relative overflow-hidden hover:scale-[1.02] hover:shadow-lg hover:shadow-white/5`}
    >
      {/* Status indicator */}
      <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${app.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'}`} />

      {/* Icon */}
      <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">{app.icon}</div>

      {/* Name & Badge */}
      <h4 className="text-sm font-semibold text-white truncate">{app.name}</h4>
      <p className="text-[10px] text-white/40 uppercase tracking-wide truncate">{app.badge}</p>

      {/* Todo Progress Bar */}
      {app.hasTodo && (
        <div className="mt-3">
          <div className="flex justify-between text-[9px] text-white/40 mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppGrimoireCell({ apps, onLaunch, onContextMenu, onCreate }: AppGrimoireProps) {
  return (
    <div className={`${GLASS} rounded-2xl p-6 bg-gradient-to-br from-indigo-500/10 to-purple-600/5`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50">App Grimoire</h3>
          <p className="text-[10px] text-white/30 mt-1">Manifested from the D:\Pi aether</p>
        </div>
        <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
          <span className="text-[10px] font-mono text-indigo-300">{apps.length} ARTIFACTS</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {apps.map((app) => (
          <AppCard
            key={app.id}
            app={app}
            onLaunch={() => onLaunch(app)}
            onContext={(e) => onContextMenu(app, e)}
          />
        ))}

        {/* Magic Add Slot */}
        <div
          className="border-2 border-dashed border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center hover:border-white/20 hover:bg-white/[0.02] transition-all cursor-pointer group"
          onClick={onCreate}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCreate?.(); } }}
        >
          <div className="text-2xl text-white/20 group-hover:text-white/40 group-hover:scale-110 transition-all">+</div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-white/10 group-hover:text-white/30 mt-2">New Ritual</div>
        </div>
      </div>
    </div>
  );
}
