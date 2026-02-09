import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DashboardTask, DashboardTaskPriority, DashboardTaskStatus, TodoSection } from '../types';
import * as PiService from '../services/piService';

const GLASS = 'bg-white/5 backdrop-blur-xl border border-white/10';
const GLASS_HOVER = 'hover:bg-white/10 hover:border-white/20';

const priorityStyles: Record<DashboardTaskPriority, string> = {
  critical: 'bg-red-600/20 text-red-200 border border-red-600/30',
  high: 'bg-rose-500/20 text-rose-200 border border-rose-500/30',
  medium: 'bg-amber-500/20 text-amber-200 border border-amber-500/30',
  low: 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30',
};

const statusStyles: Record<DashboardTaskStatus, string> = {
  todo: 'bg-white/10 text-white/60',
  'in-progress': 'bg-blue-500/20 text-blue-200 border border-blue-500/30',
  blocked: 'bg-red-500/20 text-red-200 border border-red-500/30',
  done: 'bg-green-500/20 text-green-200 border border-green-500/30',
};

interface TaskCardProps {
  task: DashboardTask;
  onToggle: (task: DashboardTask) => void;
  onEdit: (task: DashboardTask) => void;
  onDelete: (task: DashboardTask) => void;
  onExecute: (task: DashboardTask) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onToggle, onEdit, onDelete, onExecute }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`group rounded-xl p-3 ${GLASS} ${GLASS_HOVER} transition-all flex items-start gap-3`}>
      <input 
        type="checkbox" 
        checked={task.status === 'done'} 
        onChange={() => onToggle(task)}
        className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-violet-600 focus:ring-violet-600/50 cursor-pointer"
        title={task.status === 'done' ? 'Mark as todo' : 'Mark as done'}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded ${priorityStyles[task.priority] || priorityStyles.medium}`}>
            {task.priority}
          </span>
          {task.status !== 'todo' && (
            <span className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded ${statusStyles[task.status]}`}>
              {task.status}
            </span>
          )}
          {(task.tags || []).map(tag => (
            <span key={tag} className="text-[10px] uppercase text-white/40 bg-white/5 px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
          {task.estimate && <span className="text-[10px] text-white/30">⏱ {task.estimate}</span>}
          {task.progress !== undefined && task.status !== 'done' && (
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden max-w-[100px]">
              <div className="h-full bg-violet-500" style={{ width: `${task.progress}%` }} />
            </div>
          )}
        </div>
        <h4 className={`text-sm font-medium mt-1 ${task.status === 'done' ? 'line-through text-white/40' : 'text-white/90'}`}>
          {task.title}
        </h4>
        {task.description && (
          <p className="text-xs text-white/50 mt-1 line-clamp-2">{task.description}</p>
        )}
        {task.results && expanded && (
          <pre className="text-[10px] text-white/40 mt-2 whitespace-pre-wrap bg-black/20 p-2 rounded max-h-40 overflow-y-auto">
            {task.results}
          </pre>
        )}
      </div>
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={() => onExecute(task)} 
          className="p-1.5 bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 rounded text-xs"
          title="Execute with Agent"
        >
          ▶
        </button>
        <button 
          onClick={() => onEdit(task)} 
          className="p-1.5 bg-white/10 hover:bg-white/20 text-white/60 rounded text-xs"
          title="Edit"
        >
          ✏️
        </button>
        <button 
          onClick={() => onDelete(task)} 
          className="p-1.5 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 rounded text-xs"
          title="Delete"
        >
          🗑
        </button>
        {task.results && (
          <button 
            onClick={() => setExpanded(!expanded)} 
            className="p-1.5 bg-white/5 hover:bg-white/10 text-white/50 rounded text-xs"
            title={expanded ? 'Collapse' : 'Expand Log'}
          >
            📄
          </button>
        )}
      </div>
    </div>
  );
};

interface TaskEditModalProps {
  task: DashboardTask;
  onSave: (updates: Partial<DashboardTask>) => Promise<void>;
  onClose: () => void;
  sections: TodoSection[];
}

const TaskEditModal: React.FC<TaskEditModalProps> = ({ task, onSave, onClose, sections }) => {
  const [form, setForm] = useState({
    title: task.title,
    priority: task.priority,
    tags: task.tags?.join(', ') || '',
    estimate: task.estimate || '',
    status: task.status,
    description: task.description || '',
    results: task.results || '',
    assigned_to: task.assigned_to || '',
    agent: task.agent || '',
    progress: task.progress || 0,
    started: task.started || '',
    completed: task.completed || '',
    section: task.section || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const updates: Partial<DashboardTask> = {
      title: form.title,
      priority: form.priority as any,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      estimate: form.estimate || undefined,
      status: form.status as any,
      description: form.description || undefined,
      results: form.results || undefined,
      assigned_to: form.assigned_to || undefined,
      agent: form.agent || undefined,
      progress: Number(form.progress) || 0,
      started: form.started || undefined,
      completed: form.completed || undefined,
    };
    await onSave(updates);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className={`${GLASS} rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">Edit Task</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Title</label>
            <input required 
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/50 mb-1">Priority</label>
              <select 
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value as 'low' | 'medium' | 'high' | 'critical' })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Status</label>
              <select 
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value as 'todo' | 'in-progress' | 'blocked' | 'done' })}
              >
                <option value="todo">Todo</option>
                <option value="in-progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/50 mb-1">Tags (comma separated)</label>
              <input 
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
                value={form.tags}
                onChange={e => setForm({ ...form, tags: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Estimate (e.g., 4h)</label>
              <input 
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
                value={form.estimate}
                onChange={e => setForm({ ...form, estimate: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Progress (0-100)</label>
            <input type="number" min="0" max="100"
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
              value={form.progress}
              onChange={e => setForm({ ...form, progress: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Description</label>
            <textarea 
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50 h-20"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Logs / Results</label>
            <textarea 
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50 h-24 font-mono text-[10px]"
              value={form.results}
              onChange={e => setForm({ ...form, results: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/50 mb-1">Assigned To</label>
              <input 
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
                value={form.assigned_to}
                onChange={e => setForm({ ...form, assigned_to: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Agent</label>
              <input 
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
                value={form.agent}
                onChange={e => setForm({ ...form, agent: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/50 mb-1">Started (ISO)</label>
              <input type="datetime-local"
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
                value={form.started?.slice(0,16) || ''}
                onChange={e => setForm({ ...form, started: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Completed (ISO)</label>
              <input type="datetime-local"
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
                value={form.completed?.slice(0,16) || ''}
                onChange={e => setForm({ ...form, completed: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-white/60 hover:text-white">Cancel</button>
            <button type="submit" className="px-4 py-2 text-xs bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/30 text-violet-200 rounded">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ExecuteModalProps {
  task: DashboardTask;
  agents: Array<{ id: string; name: string; description?: string }>;
  selectedAgent: string;
  onAgentChange: (id: string) => void;
  onExecute: (task: DashboardTask, instructions?: string) => Promise<void>;
  onClose: () => void;
}

const ExecuteModal: React.FC<ExecuteModalProps> = ({ task, agents, selectedAgent, onAgentChange, onExecute, onClose }) => {
  const [instructions, setInstructions] = useState('');
  const [executing, setExecuting] = useState(false);

  const handleExecute = async () => {
    setExecuting(true);
    await onExecute(task, instructions);
    setExecuting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className={`${GLASS} rounded-2xl p-6 w-full max-w-md`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">Execute Task</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white">✕</button>
        </div>
        <div className="mb-4">
          <p className="text-sm text-white/80">{task.title}</p>
          <p className="text-xs text-white/40 mt-1">{task.description}</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Agent</label>
            <select 
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
              value={selectedAgent}
              onChange={e => onAgentChange(e.target.value)}
            >
              {agents.map(a => <option key={a.id} value={a.id}>{a.name} {a.description && `- ${a.description}`}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Additional Instructions (optional)</label>
            <textarea 
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50 h-24"
              placeholder="e.g., Use web_search to find latest info, then write a report..."
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-xs text-white/60 hover:text-white">Cancel</button>
            <button 
              onClick={handleExecute} 
              disabled={executing}
              className="px-4 py-2 text-xs bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/30 text-violet-200 rounded disabled:opacity-50"
            >
              {executing ? 'Starting...' : 'Start Execution'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface AddTaskModalProps {
  sections: TodoSection[];
  onAdd: (task: Omit<DashboardTask, 'id' | 'created' | 'order'> & { section: string }) => Promise<void>;
  onClose: () => void;
  initialSection?: string;
}

const AddTaskModal: React.FC<AddTaskModalProps> = ({ sections, onAdd, onClose, initialSection }) => {
  const [section, setSection] = useState(initialSection || sections[0]?.title || '');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low' | 'critical'>('medium');
  const [tags, setTags] = useState('');
  const [estimate, setEstimate] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onAdd({
      title,
      priority,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      estimate: estimate || undefined,
      description: description || undefined,
      status: 'todo',
      section,
    } as any);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className={`${GLASS} rounded-2xl p-6 w-full max-w-md`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">Add New Task</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Section</label>
            <select 
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
              value={section}
              onChange={e => setSection(e.target.value)}
            >
              {sections.map(s => <option key={s.title} value={s.title}>{s.title.replace(/^##+ /, '')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Title</label>
            <input required 
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/50 mb-1">Priority</label>
              <select 
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Estimate (e.g., 4h)</label>
              <input 
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
                value={estimate}
                onChange={e => setEstimate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Tags (comma separated)</label>
            <input 
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
              value={tags}
              onChange={e => setTags(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Description</label>
            <textarea 
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50 h-20"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-white/60 hover:text-white">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-xs bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/30 text-violet-200 rounded disabled:opacity-50">
              {submitting ? 'Adding...' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────────
// Main Todo Board Cell
// ────────────────────────────────────────────────────────────────────────────────

const TodoBoardCell: React.FC = () => {
  const [board, setBoard] = useState<{ sections: TodoSection[]; totalTasks: number; completedCount: number; progressPercent: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [agents, setAgents] = useState<Array<{ id: string; name: string; description?: string }>>([]);
  const [selectedAgent, setSelectedAgent] = useState('pi');
  const [editingTask, setEditingTask] = useState<DashboardTask | null>(null);
  const [executingTask, setExecutingTask] = useState<DashboardTask | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchBoard();
    PiService.getAgentTypes().then(setAgents);
  }, []);

  const fetchBoard = async () => {
    setLoading(true);
    const data = await PiService.getTodoBoard();
    setBoard(data);
    setLoading(false);
  };

  const handleToggleStatus = async (task: DashboardTask) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    const updates: any = { status: newStatus };
    if (newStatus === 'done') {
      updates.completed = new Date().toISOString();
      updates.progress = 100;
    } else {
      updates.completed = undefined;
      updates.progress = 0;
    }
    const success = await PiService.updateTask(task.id, updates);
    if (success) {
      await fetchBoard();
    }
  };

  const handleDelete = async (task: DashboardTask) => {
    if (!confirm(`Delete task "${task.title}"?`)) return;
    const success = await PiService.deleteTask(task.id);
    if (success) {
      await fetchBoard();
    }
  };

  const handleExecute = async (task: DashboardTask, instructions?: string) => {
    const result = await PiService.executeTask(task.id, selectedAgent, undefined, instructions);
    if (result.success) {
      setExecutingTask(null);
      await fetchBoard();
    }
  };

  const matchesFilter = useCallback((task: DashboardTask) => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    if (search && !task.title.toLowerCase().includes(search.toLowerCase()) && !task.description?.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  }, [filterStatus, filterPriority, search]);

  const uniquePriorities = useMemo(() => {
    const priorities = new Set<string>();
    board?.sections.forEach(s => s.tasks.forEach(t => {
      if (t.priority) priorities.add(t.priority);
    }));
    return Array.from(priorities);
  }, [board]);

  return (
    <div className="todo-board">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white uppercase tracking-wider mb-1">📋 Task Board</h2>
          <div className="text-xs text-white/50">
            {board ? `${board.completedCount}/${board.totalTasks} completed (${board.progressPercent}%)` : ''}
          </div>
        </div>
        <div className="flex gap-2">
          <select 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500/50"
          >
            <option value="all">All Status</option>
            <option value="todo">Todo</option>
            <option value="in-progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
          </select>
          <select 
            value={filterPriority} 
            onChange={e => setFilterPriority(e.target.value)}
            className="bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500/50"
          >
            <option value="all">All Priorities</option>
            {uniquePriorities.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
          <input 
            type="text" 
            placeholder="Search tasks..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 w-32 md:w-48"
          />
          <button 
            onClick={() => { setShowAddModal(true); }}
            className="bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/30 text-violet-200 text-xs font-medium uppercase tracking-wider px-4 py-1.5 rounded-lg transition-colors"
          >
            + Add
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/40">Scrying the task aether...</div>
      ) : (
        <div className="space-y-8">
          {board?.sections.map(section => {
            const filteredTasks = section.tasks.filter(matchesFilter);
            return (
              <section key={section.title} className={filteredTasks.length > 0 ? '' : 'hidden'}>
                <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2">
                  {section.title.replace(/^##+ /, '')}
                  <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full">{filteredTasks.length}</span>
                </h3>
                {filteredTasks.length === 0 ? (
                  <div className="text-xs text-white/30 italic py-4">No tasks match current filters.</div>
                ) : (
                  <div className="space-y-2">
                    {filteredTasks.map(task => (
                      <TaskCard 
                        key={task.id} 
                        task={task} 
                        onToggle={handleToggleStatus}
                        onEdit={setEditingTask}
                        onDelete={handleDelete}
                        onExecute={setExecutingTask}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {editingTask && (
        <TaskEditModal 
          task={editingTask} 
          onSave={async (updates) => {
            const success = await PiService.updateTask(editingTask.id, updates);
            if (success) {
              setEditingTask(null);
              await fetchBoard();
            }
          }} 
          onClose={() => setEditingTask(null)} 
          sections={board?.sections || []}
        />
      )}

      {executingTask && (
        <ExecuteModal 
          task={executingTask} 
          agents={agents}
          selectedAgent={selectedAgent}
          onAgentChange={setSelectedAgent}
          onExecute={handleExecute}
          onClose={() => setExecutingTask(null)}
        />
      )}

      {showAddModal && (
        <AddTaskModal 
          sections={board?.sections || []}
          onAdd={async (newTask) => {
            // Use first section as default if none provided
            const targetSection = newTask.section || (board?.sections[0]?.title || '');
            const success = await PiService.createTask({ ...newTask, section: targetSection });
            if (success) {
              setShowAddModal(false);
              await fetchBoard();
            }
          }}
          onClose={() => setShowAddModal(false)}
          initialSection={board?.sections[0]?.title}
        />
      )}
    </div>
  );
};

export default TodoBoardCell;
