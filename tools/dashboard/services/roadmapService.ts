import { RoadmapItem, ProjectInfo, RoadmapStats, RoadmapPriority } from '../types/roadmap';

const API_BASE = 'http://localhost:3005';

/**
 * Convert a dashboard task object to a RoadmapItem
 */
function convertDashboardTask(task: any, project: string, source: 'main-todo' | 'project', sourceId: string, path?: string): RoadmapItem {
    // Map priority: dashboard uses 'critical'|'high'|'medium'|'low' -> roadmap uses 1|2|3|4
    const priorityMap: Record<string, number> = {
        critical: 1,
        high: 2,
        medium: 3,
        low: 4
    };
    const priority = priorityMap[task.priority] || 3;

    // Parse estimate string (e.g., "4h", "2d", "30m") into hours
    let estimateHours: number | undefined;
    if (task.estimate) {
        const match = task.estimate.match(/^(\d+)([hmd])$/);
        if (match) {
            const value = parseInt(match[1], 10);
            const unit = match[2];
            switch (unit) {
                case 'm': estimateHours = value / 60; break;
                case 'h': estimateHours = value; break;
                case 'd': estimateHours = value * 24; break;
            }
        }
    }

    return {
        id: `${source}-${project}-${task.id}`,
        title: task.title,
        description: task.description || task.results || '',
        status: task.status as RoadmapItem['status'],
        priority: priority as RoadmapPriority,
        project,
        category: task.section || undefined,
        estimateHours,
        assignee: (task.assigned_to || task.agent || '') as any,
        dependencies: task.dependencies || [],
        dueDate: undefined, // Not available in current data
        source,
        sourceId,
        path
    };
}

/**
 * Aggregate roadmap items from all sources
 */
export async function loadAllItems(): Promise<RoadmapItem[]> {
    try {
        const response = await fetch(`${API_BASE}/api/roadmap/items`);
        if (!response.ok) {
            throw new Error(`Failed to fetch roadmap items: ${response.statusText}`);
        }
        const data = await response.json();
        return data.items as RoadmapItem[];
    } catch (error) {
        console.error('RoadmapService: Failed to load items:', error);
        return [];
    }
}

/**
 * Get list of available projects (for filtering)
 */
export async function getProjects(): Promise<ProjectInfo[]> {
    try {
        const response = await fetch(`${API_BASE}/api/pi/projects`);
        if (!response.ok) {
            throw new Error(`Failed to fetch projects: ${response.statusText}`);
        }
        const data = await response.json();
        return data.projects as ProjectInfo[];
    } catch (error) {
        console.error('RoadmapService: Failed to load projects:', error);
        return [];
    }
}

/**
 * Calculate stats for a set of items
 */
export function calculateStats(items: RoadmapItem[]): RoadmapStats {
    const byStatus: Record<string, number> = { todo: 0, 'in-progress': 0, blocked: 0, done: 0 };
    let urgent = 0;
    for (const item of items) {
        byStatus[item.status] = (byStatus[item.status] || 0) + 1;
        if (item.priority === 1 && item.status !== 'done') {
            urgent++;
        }
    }
    return {
        total: items.length,
        byStatus: byStatus as Record<RoadmapItem['status'], number>,
        urgentCount: urgent
    };
}

/**
 * Filter items by project
 */
export function filterByProject(items: RoadmapItem[], project: string): RoadmapItem[] {
    if (!project || project === 'all') return items;
    return items.filter(item => item.project === project);
}

/**
 * Search items by title and description
 */
export function searchItems(items: RoadmapItem[], query: string): RoadmapItem[] {
    if (!query.trim()) return items;
    const lower = query.toLowerCase();
    return items.filter(item =>
        item.title.toLowerCase().includes(lower) ||
        (item.description && item.description.toLowerCase().includes(lower))
    );
}

/**
 * Update status of a roadmap item (optimistic)
 * Note: This updates local state only; future: write back to todo.md
 */
export async function updateItemStatus(itemId: string, newStatus: RoadmapItem['status']): Promise<boolean> {
    // For now, this is a no-op since we are read-only. Future implementation would send PATCH to server to update the underlying task.
    console.log(`Roadmap: update status for ${itemId} to ${newStatus} (not yet implemented)`);
    return true;
}

/**
 * SSE connection for real-time updates
 */
export function connectToUpdates(callback: () => void): () => void {
    const eventSource = new EventSource(`${API_BASE}/api/roadmap/events`);
    eventSource.onmessage = (event) => {
        if (event.data === 'roadmap-update') {
            callback();
        }
    };
    eventSource.onerror = () => {
        console.warn('Roadmap SSE connection failed, falling back to polling');
        eventSource.close();
    };
    return () => eventSource.close();
}
