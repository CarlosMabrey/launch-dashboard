import React, { useState, useMemo } from 'react';
import { AppItem } from '../types';
import { Project } from '../services/piService';

const GLASS = 'bg-white/5 backdrop-blur-xl border border-white/10';
const GLASS_HOVER = 'hover:bg-white/10 hover:border-white/20';
const ACCENT = {
  emerald: 'from-emerald-500/20 to-emerald-600/5',
  blue: 'from-sky-500/20 to-sky-600/5',
  red: 'from-rose-500/20 to-rose-600/5',
  purple: 'from-violet-500/20 to-violet-600/5',
  amber: 'from-amber-500/20 to-amber-600/5',
};

interface ProjectManagerWidgetProps {
  projects: Project[];
  apps: AppItem[];
  onOpenProject: (path: string) => void;
  onLaunchApp: (app: AppItem) => void;
}

export default function ProjectManagerWidget({ projects, apps, onOpenProject, onLaunchApp }: ProjectManagerWidgetProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const selectedProject = projects.find(p => p.id === selectedProjectId) || null;

  // Find associated apps for a project (by matching directory)
  const getProjectApps = (project: Project) => {
    return apps.filter(app => app.directory && isSubdirectory(project.path, app.directory));
  };

  // Check if any app for this project is running
  const isProjectRunning = (project: Project) => {
    return getProjectApps(project).some(app => app.isOnline);
  };

  // Handler to run project's main service
  const handleRunProject = (project: Project) => {
    const projectApps = getProjectApps(project);
    if (projectApps.length === 0) {
      alert('No known service associated with this project. Add it to the Grimoire first.');
      return;
    }
    const stoppedApp = projectApps.find(app => !app.isOnline);
    if (stoppedApp) {
      onLaunchApp(stoppedApp);
    } else {
      alert('All associated services are already running.');
    }
  };

  return (
    <div className={`${GLASS} rounded-2xl p-6 bg-gradient-to-br ${ACCENT.purple} h-[500px] flex flex-col`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50">Project Manager</h3>
        <span className="text-[10px] text-white/30">{projects.length} projects</span>
      </div>

      {/* Project selector */}
      <div className="mb-4">
        <select
          value={selectedProjectId || ''}
          onChange={(e) => setSelectedProjectId(e.target.value || null)}
          className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/50"
        >
          <option value="">-- Select a Project --</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} {isProjectRunning(p) ? '●' : '○'}
            </option>
          ))}
        </select>
      </div>

      {/* Project details when selected */}
      {selectedProject && (
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Header with actions */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-white">{selectedProject.name}</div>
              <div className="text-[10px] text-white/40 truncate max-w-[180px]">{selectedProject.path}</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onOpenProject(selectedProject.path)}
                className="px-3 py-1 text-xs font-medium uppercase tracking-wide rounded bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-colors"
                title="Open in Antigravity"
              >
                Open
              </button>
              <button
                onClick={() => handleRunProject(selectedProject)}
                className="px-3 py-1 text-xs font-medium uppercase tracking-wide rounded bg-purple-500/20 border border-purple-400/40 text-purple-300 hover:bg-purple-500/30 transition-colors"
                title="Start/Run project service"
              >
                {isProjectRunning(selectedProject) ? 'Running' : 'Run'}
              </button>
            </div>
          </div>

          {/* Tasks */}
          {selectedProject.tasks.length === 0 ? (
            <div className="text-xs text-white/40 italic">No tasks found in todo.md</div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                Tasks ({selectedProject.tasks.filter(t => t.status !== 'done').length} active)
              </div>
              {selectedProject.tasks.map(task => (
                <div
                  key={task.id}
                  className={`p-2 rounded border ${
                    task.status === 'done' ? 'bg-white/5 border-white/5 text-white/30 line-through' :
                    task.status === 'in-progress' ? 'bg-purple-500/10 border-purple-400/30' :
                    task.status === 'blocked' ? 'bg-rose-500/10 border-rose-400/30' :
                    'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{task.title}</div>
                      {task.agent && (
                        <div className="text-[10px] text-purple-300 uppercase mt-1">
                          @{task.agent}
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-white/30 capitalize">{task.status.replace('-', ' ')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!selectedProject && (
        <div className="flex-1 flex items-center justify-center text-white/40 text-sm text-center px-4">
          Select a project from the dropdown to view tasks and manage services.
        </div>
      )}
    </div>
  );
}

// Helper to check if a path is a subdirectory of another
function isSubdirectory(parent: string, child: string): boolean {
  const p = parent.toLowerCase().replace(/\\/g, '/');
  const c = child.toLowerCase().replace(/\\/g, '/');
  const normalizedParent = p.endsWith('/') ? p : p + '/';
  return c.startsWith(normalizedParent) || c === p;
}
