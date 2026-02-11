import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DashboardTask, DashboardTaskPriority, DashboardTaskStatus, TodoSection } from '../types';
import * as PiService from '../services/piService';
import { LucideIcon, Sparkles, Wand2, Hammer, Zap, CheckCircle2, AlertCircle, Clock, Trash2, Edit3, Play, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';

const GLASS = 'bg-white/5 backdrop-blur-xl border border-white/10';
const GLASS_HOVER = 'hover:bg-white/15 hover:border-white/20 hover:shadow-2xl hover:shadow-violet-500/10';

const priorityAura: Record<DashboardTaskPriority, string> = {
    critical: 'shadow-[0_0_15px_-3px_rgba(220,38,38,0.4)] border-red-500/30',
    high: 'shadow-[0_0_15px_-3px_rgba(244,63,94,0.3)] border-rose-500/30',
    medium: 'shadow-[0_0_15px_-3px_rgba(245,158,11,0.2)] border-amber-500/30',
    low: 'shadow-[0_0_15px_-3px_rgba(16,185,129,0.1)] border-emerald-500/30',
};

const priorityText: Record<DashboardTaskPriority, string> = {
    critical: 'text-red-400',
    high: 'text-rose-400',
    medium: 'text-amber-400',
    low: 'text-emerald-400',
};

const statusConfig: Record<DashboardTaskStatus, { label: string; icon: any; color: string; subtext: string }> = {
    todo: {
        label: 'Manifestation',
        icon: Sparkles,
        color: 'text-slate-400',
        subtext: 'Awaiting the ritual'
    },
    'in-progress': {
        label: 'Incantation',
        icon: Wand2,
        color: 'text-violet-400',
        subtext: 'Echoing through the aether'
    },
    blocked: {
        label: 'Void Stasis',
        icon: AlertCircle,
        color: 'text-rose-400',
        subtext: 'Bound by ancient forces'
    },
    done: {
        label: 'Ascended',
        icon: CheckCircle2,
        color: 'text-emerald-400',
        subtext: 'Eternally inscribed'
    },
};

// ─── Modal Components ──────────────────────────────────────────────────────────

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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
            <div className={`${GLASS} rounded-[2.5rem] p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl shadow-violet-500/10`}>
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-widest">Refine Ritual</h3>
                        <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest mt-1">Adjusting the manifestation parameters</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-[0.2em] text-white/40 ml-1">Incantation Title</label>
                        <input required
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-violet-500/50 focus:bg-white/10 transition-all text-lg font-bold"
                            value={form.title}
                            onChange={e => setForm({ ...form, title: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-black tracking-[0.2em] text-white/40 ml-1">Priority Aura</label>
                            <select
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-violet-500/50 appearance-none cursor-pointer"
                                value={form.priority}
                                onChange={e => setForm({ ...form, priority: e.target.value as any })}
                            >
                                <option value="low" className="bg-slate-900">Low Energy</option>
                                <option value="medium" className="bg-slate-900">Stable Arcane</option>
                                <option value="high" className="bg-slate-900">High Resonance</option>
                                <option value="critical" className="bg-slate-900">ENTROPIC CRITICAL</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-black tracking-[0.2em] text-white/40 ml-1">Spiritual State</label>
                            <select
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-violet-500/50 appearance-none cursor-pointer"
                                value={form.status}
                                onChange={e => setForm({ ...form, status: e.target.value as any })}
                            >
                                <option value="todo" className="bg-slate-900">Manifestation (Todo)</option>
                                <option value="in-progress" className="bg-slate-900">Incantation (Active)</option>
                                <option value="blocked" className="bg-slate-900">Void Stasis (Blocked)</option>
                                <option value="done" className="bg-slate-900">Ascended (Complete)</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-black tracking-[0.2em] text-white/40 ml-1">Sigils (Tags)</label>
                            <input
                                placeholder="comma-separated"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-violet-500/50 transition-all font-mono"
                                value={form.tags}
                                onChange={e => setForm({ ...form, tags: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-black tracking-[0.2em] text-white/40 ml-1">Temporal Estimate</label>
                            <input
                                placeholder="e.g. 4h, 2d"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-violet-500/50 transition-all"
                                value={form.estimate}
                                onChange={e => setForm({ ...form, estimate: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-[10px] uppercase font-black tracking-[0.2em] text-white/40">Manifestation Flow</label>
                            <span className="text-[10px] font-bold text-violet-400">{form.progress}%</span>
                        </div>
                        <input type="range" min="0" max="100"
                            className="w-full accent-violet-500 h-1.5 bg-white/10 rounded-full cursor-pointer appearance-none"
                            value={form.progress}
                            onChange={e => setForm({ ...form, progress: Number(e.target.value) })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-[0.2em] text-white/40 ml-1">Aetheric Description</label>
                        <textarea
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-violet-500/50 transition-all h-32 resize-none custom-scrollbar"
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-[0.2em] text-white/40 ml-1">Execution Echoes (Logs)</label>
                        <textarea
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-violet-300 focus:outline-none focus:border-violet-500/50 transition-all h-24 font-mono text-[10px] custom-scrollbar"
                            value={form.results}
                            onChange={e => setForm({ ...form, results: e.target.value })}
                        />
                    </div>

                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="px-8 py-4 text-xs font-black uppercase tracking-widest text-white/40 hover:text-white transition-all">Cancel</button>
                        <button type="submit" className="px-10 py-4 text-xs font-black uppercase tracking-widest bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/30 text-violet-100 rounded-[1.5rem] shadow-xl shadow-violet-500/10 transition-all hover:scale-105 active:scale-95">Update Rite</button>
                    </div>
                </form>
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
    const [priority, setPriority] = useState<any>('medium');
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in zoom-in duration-300">
            <div className={`${GLASS} rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl shadow-indigo-500/10`}>
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-widest">New Manifestation</h3>
                        <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest mt-1">Summoning a new task into reality</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-[0.2em] text-white/40 ml-1">Ritual Plane (Section)</label>
                        <select
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-violet-500/50 appearance-none cursor-pointer"
                            value={section}
                            onChange={e => setSection(e.target.value)}
                        >
                            {sections.map(s => <option key={s.title} value={s.title} className="bg-slate-900">{s.title.replace(/^##+ /, '')}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-[0.2em] text-white/40 ml-1">Ritual Title</label>
                        <input required
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-violet-500/50 transition-all font-bold"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="What shall be manifest?"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-black tracking-[0.2em] text-white/40 ml-1">Energy Level</label>
                            <select
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-violet-500/50 appearance-none cursor-pointer"
                                value={priority}
                                onChange={e => setPriority(e.target.value as any)}
                            >
                                <option value="low" className="bg-slate-900">Low</option>
                                <option value="medium" className="bg-slate-900">Medium</option>
                                <option value="high" className="bg-slate-900">High</option>
                                <option value="critical" className="bg-slate-900">Critical</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-black tracking-[0.2em] text-white/40 ml-1">Estimate</label>
                            <input
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-violet-500/50 transition-all"
                                value={estimate}
                                onChange={e => setEstimate(e.target.value)}
                                placeholder="2h, 1d..."
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="px-8 py-4 text-xs font-black uppercase tracking-widest text-white/40 hover:text-white transition-all">Cancel</button>
                        <button type="submit" disabled={submitting} className="px-10 py-4 text-xs font-black uppercase tracking-widest bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/30 text-emerald-100 rounded-[1.5rem] shadow-xl shadow-emerald-500/10 transition-all hover:scale-105 active:scale-95 disabled:opacity-50">
                            {submitting ? 'Manifesting...' : 'Begin Ritual'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface ExecuteModalProps {
    task: DashboardTask;
    agents: any[];
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in zoom-in duration-300">
            <div className={`${GLASS} rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl shadow-violet-500/10`}>
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-widest">Invoke Agent</h3>
                        <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest mt-1">Delegating the ritual to a spiritual guide</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">
                        <X size={20} />
                    </button>
                </div>
                <div className="mb-6 bg-white/5 p-4 rounded-2xl border border-white/10">
                    <p className="text-sm font-bold text-white/90">{task.title}</p>
                    <p className="text-xs text-white/40 mt-1 line-clamp-2">{task.description}</p>
                </div>
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-[0.2em] text-white/40 ml-1">Summoned Guide</label>
                        <select
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-violet-500/50 appearance-none cursor-pointer"
                            value={selectedAgent}
                            onChange={e => onAgentChange(e.target.value)}
                        >
                            {agents.map(a => <option key={a.id} value={a.id} className="bg-slate-900">{a.name} {a.description && `- ${a.description}`}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-[0.2em] text-white/40 ml-1">Command Sigils (Instructions)</label>
                        <textarea
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-violet-500/50 transition-all h-32 resize-none custom-scrollbar"
                            placeholder="e.g. Use web_search to find latest info..."
                            value={instructions}
                            onChange={e => setInstructions(e.target.value)}
                        />
                    </div>
                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="px-8 py-4 text-xs font-black uppercase tracking-widest text-white/40 hover:text-white transition-all">Cancel</button>
                        <button
                            onClick={handleExecute}
                            disabled={executing}
                            className="px-10 py-4 text-xs font-black uppercase tracking-widest bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/30 text-violet-100 rounded-[1.5rem] shadow-xl shadow-violet-500/10 transition-all hover:scale-105 active:scale-95"
                        >
                            {executing ? 'Invoking...' : 'Begin Invocation'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ... existing component logic continues ...

interface TaskCardProps {
    task: DashboardTask;
    onToggle: (task: DashboardTask) => void;
    onEdit: (task: DashboardTask) => void;
    onDelete: (task: DashboardTask) => void;
    onExecute: (task: DashboardTask) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onToggle, onEdit, onDelete, onExecute }) => {
    const [expanded, setExpanded] = useState(false);
    const StatusIcon = statusConfig[task.status].icon;

    return (
        <div className={`group relative rounded-2xl p-4 ${GLASS} ${GLASS_HOVER} ${priorityAura[task.priority]} transition-all duration-500 transform hover:-translate-y-1 mb-4 flex flex-col gap-3 border-l-4 ${task.priority === 'critical' ? 'border-l-red-500' : task.priority === 'high' ? 'border-l-rose-500' : task.priority === 'medium' ? 'border-l-amber-500' : 'border-l-emerald-500'}`}>
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${priorityText[task.priority]}`}>
                            {task.priority}
                        </span>
                        {(task.tags || []).map(tag => (
                            <span key={tag} className="text-[9px] uppercase tracking-wider text-white/30 bg-white/5 px-1.5 py-0.5 rounded-md border border-white/5">
                                {tag}
                            </span>
                        ))}
                    </div>
                    <h4 className={`text-sm font-semibold tracking-wide ${task.status === 'done' ? 'line-through text-white/20' : 'text-white/90 group-hover:text-white'}`}>
                        {task.title}
                    </h4>
                </div>
                <input
                    type="checkbox"
                    checked={task.status === 'done'}
                    onChange={() => onToggle(task)}
                    className="mt-1 w-5 h-5 rounded-lg border-white/10 bg-white/5 text-violet-500 focus:ring-violet-500/50 cursor-pointer transition-all hover:scale-110"
                />
            </div>

            {task.description && (
                <p className={`text-xs text-white/40 leading-relaxed font-light ${expanded ? '' : 'line-clamp-2'}`}>
                    {task.description}
                </p>
            )}

            {(task.estimate || task.progress !== undefined) && (
                <div className="flex items-center gap-3 mt-1">
                    {task.estimate && (
                        <div className="flex items-center gap-1.5 text-[10px] text-white/30">
                            <Clock size={10} />
                            <span>{task.estimate}</span>
                        </div>
                    )}
                    {task.progress !== undefined && task.status !== 'done' && (
                        <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden relative">
                            <div
                                className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${task.progress}%` }}
                            />
                            <div className="absolute inset-0 bg-white/10 opacity-20 animate-pulse" />
                        </div>
                    )}
                </div>
            )}

            {task.results && expanded && (
                <div className="mt-2 relative">
                    <div className="absolute -left-2 top-0 bottom-0 w-0.5 bg-violet-500/20" />
                    <pre className="text-[10px] font-mono text-violet-200/50 whitespace-pre-wrap bg-black/40 p-3 rounded-xl border border-white/5 max-h-40 overflow-y-auto custom-scrollbar">
                        {task.results}
                    </pre>
                </div>
            )}

            <div className="flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0 pt-2 border-t border-white/5">
                <div className="flex gap-1">
                    <button
                        onClick={() => onExecute(task)}
                        className="p-1.5 text-violet-400 hover:text-white hover:bg-violet-500/20 rounded-lg transition-colors"
                        title="Invoke Agent"
                    >
                        <Play size={14} fill="currentColor" fillOpacity={0.2} />
                    </button>
                    <button
                        onClick={() => onEdit(task)}
                        className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="Edit Ritual"
                    >
                        <Edit3 size={14} />
                    </button>
                    <button
                        onClick={() => onDelete(task)}
                        className="p-1.5 text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors"
                        title="Banish"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
                {task.results && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="text-[10px] uppercase font-bold tracking-widest text-white/30 hover:text-white transition-colors flex items-center gap-1"
                    >
                        {expanded ? 'Seal Logs' : 'Reveal Logs'}
                        {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    </button>
                )}
            </div>
        </div>
    );
};

const TodoBoardKanban: React.FC = () => {
    const [board, setBoard] = useState<{ sections: TodoSection[]; totalTasks: number; completedCount: number; progressPercent: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [filterSearch, setFilterSearch] = useState('');
    const [agents, setAgents] = useState<any[]>([]);
    const [selectedAgent, setSelectedAgent] = useState('pi');

    // Modals state
    const [editingTask, setEditingTask] = useState<DashboardTask | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [executingTask, setExecutingTask] = useState<DashboardTask | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(false);

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

    const tasksByStatus = useMemo(() => {
        const map: Record<DashboardTaskStatus, DashboardTask[]> = {
            todo: [],
            'in-progress': [],
            blocked: [],
            done: [],
        };

        if (!board) return map;

        board.sections.forEach(section => {
            section.tasks.forEach(task => {
                if (filterSearch && !task.title.toLowerCase().includes(filterSearch.toLowerCase()) && !task.description?.toLowerCase().includes(filterSearch.toLowerCase())) {
                    return;
                }
                if (map[task.status]) {
                    map[task.status].push(task);
                }
            });
        });

        return map;
    }, [board, filterSearch]);

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
        if (success) await fetchBoard();
    };

    const handleDelete = async (task: DashboardTask) => {
        if (!confirm(`Banish task "${task.title}"?`)) return;
        const success = await PiService.deleteTask(task.id);
        if (success) await fetchBoard();
    };

    const handleExecute = async (task: DashboardTask, instructions?: string) => {
        const result = await PiService.executeTask(task.id, selectedAgent, undefined, instructions);
        if (result.success) {
            setExecutingTask(null);
            await fetchBoard();
        }
    };

    if (loading && !board) {
        return (
            <div className="h-96 flex flex-col items-center justify-center gap-4 text-white/20">
                <Sparkles size={48} className="animate-pulse" />
                <p className="text-sm font-bold tracking-[0.3em] uppercase">Scrying the Aether...</p>
            </div>
        );
    }

    return (
        <div className="todo-kanban flex flex-col">
            <div className="flex items-center justify-between mb-8">
                <div
                    className="flex items-center gap-4 cursor-pointer group/title"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    <div className={`w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shadow-lg shadow-violet-500/5 transition-transform duration-500 ${isCollapsed ? '' : 'group-hover/title:scale-110 group-hover/title:rotate-12'}`}>
                        <Sparkles className="text-violet-400" size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-black text-white uppercase tracking-[0.2em]">Grand Rituals</h2>
                            <ChevronDown size={18} className={`text-white/20 transition-transform duration-500 ${isCollapsed ? '-rotate-90' : ''}`} />
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/40 uppercase tracking-widest">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                {board?.completedCount}/{board?.totalTasks} Ascended
                            </div>
                            <div className="text-[10px] font-bold text-violet-400/60 uppercase tracking-widest bg-violet-500/5 px-2 py-0.5 rounded-full border border-violet-500/10">
                                {board?.progressPercent}% Manifested
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <div className="relative group">
                        <div className="absolute inset-0 bg-violet-500/5 blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
                        <input
                            type="text"
                            placeholder="Filter rituals..."
                            value={filterSearch}
                            onChange={e => setFilterSearch(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 w-48 transition-all focus:w-64"
                        />
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 text-violet-200 text-xs font-black uppercase tracking-widest px-6 py-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                    >
                        <Plus size={16} strokeWidth={3} />
                        Manifest
                    </button>
                </div>
            </div>

            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100'}`}>
                <div className="flex gap-6 overflow-x-auto pb-8 custom-scrollbar scroll-smooth">
                    {(['todo', 'in-progress', 'blocked', 'done'] as DashboardTaskStatus[]).map(status => {
                        const config = statusConfig[status];
                        const tasks = tasksByStatus[status];
                        const Icon = config.icon;

                        return (
                            <div key={status} className="flex-shrink-0 w-80 flex flex-col gap-4">
                                <div className="flex items-center justify-between px-2">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl bg-white/5 border border-white/10 ${config.color}`}>
                                            <Icon size={18} />
                                        </div>
                                        <div>
                                            <h3 className="text-xs font-black text-white/90 uppercase tracking-[0.15em]">{config.label}</h3>
                                            <p className="text-[9px] text-white/30 uppercase tracking-wider font-medium">{config.subtext}</p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-black bg-white/5 text-white/40 px-2 py-0.5 rounded-lg border border-white/5">
                                        {tasks.length}
                                    </span>
                                </div>

                                <div className="flex-1 min-h-[500px] bg-white/[0.02] rounded-[2rem] p-3 border border-white/[0.03] backdrop-blur-sm">
                                    <div className="space-y-1">
                                        {tasks.map(task => (
                                            <TaskCard
                                                key={task.id}
                                                task={task}
                                                onToggle={handleToggleStatus}
                                                onEdit={setEditingTask}
                                                onDelete={handleDelete}
                                                onExecute={setExecutingTask}
                                            />
                                        ))}
                                        {tasks.length === 0 && (
                                            <div className="h-40 flex flex-col items-center justify-center text-center p-6 bg-white/[0.01] rounded-2xl border border-dashed border-white/5">
                                                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-2 text-white/10">
                                                    <Zap size={20} />
                                                </div>
                                                <p className="text-[10px] text-white/20 uppercase font-black tracking-widest">Awaiting Spell</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

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

export default TodoBoardKanban;
