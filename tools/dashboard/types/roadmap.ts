// ============================================
// Roadmap Feature Types
// ============================================

export type RoadmapStatus = 'todo' | 'in-progress' | 'blocked' | 'done';
export type RoadmapPriority = 1 | 2 | 3 | 4;
export type RoadmapAssignee = 'Carlos' | 'Pi' | 'Agent' | '';
export type RoadmapSource = 'main-todo' | 'project';

export interface RoadmapItem {
    id: string;
    title: string;
    description?: string;
    status: RoadmapStatus;
    priority: RoadmapPriority;
    project: string;
    category?: string;
    estimateHours?: number;
    assignee?: RoadmapAssignee;
    dependencies: string[]; // IDs of other roadmap items
    dueDate?: string; // ISO date
    source: RoadmapSource;
    sourceId: string; // ID in source (task ID or markdown anchor)
    path?: string; // file path for editing (e.g., D:\Pi\tools\dashboard\todo.md or D:\Pi\projects\myproject\todo.md)
}

export interface ProjectInfo {
    name: string;
    path: string;
    hasTodo: boolean;
    todoPath?: string;
}

export interface RoadmapStats {
    total: number;
    byStatus: Record<RoadmapStatus, number>;
    urgentCount: number; // priority 1 items that are not done
}

export type RoadmapView = 'list' | 'kanban' | 'projectmap';
