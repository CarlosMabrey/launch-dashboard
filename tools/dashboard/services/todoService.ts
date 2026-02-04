import { TodoData, TodoMetadata, TodoTask } from '../types';

const API_BASE = 'http://localhost:3005';

// Cache for todo data to reduce API calls
const todoCache = new Map<string, { data: TodoData; timestamp: number }>();
const CACHE_TTL = 3000; // 3 seconds

/**
 * Fetch todo data for a specific app
 */
export async function getTodoData(appId: string, directory?: string): Promise<TodoData | null> {
    // Check cache first
    const cached = todoCache.get(appId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    try {
        const params = new URLSearchParams();
        if (directory) params.set('directory', directory);

        const response = await fetch(`${API_BASE}/api/todo/${appId}?${params}`);
        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`Failed to fetch todo: ${response.statusText}`);
        }

        const data: TodoData = await response.json();

        // Update cache
        todoCache.set(appId, { data, timestamp: Date.now() });

        return data;
    } catch (error) {
        console.error(`Error fetching todo for ${appId}:`, error);
        return null;
    }
}

/**
 * Fetch todos for multiple apps at once
 */
export async function getAllTodos(apps: Array<{ id: string; directory?: string }>): Promise<Map<string, TodoData>> {
    const results = new Map<string, TodoData>();

    try {
        const response = await fetch(`${API_BASE}/api/todos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apps })
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch todos: ${response.statusText}`);
        }

        const data = await response.json();

        for (const [appId, todoData] of Object.entries(data)) {
            if (todoData) {
                results.set(appId, todoData as TodoData);
                todoCache.set(appId, { data: todoData as TodoData, timestamp: Date.now() });
            }
        }
    } catch (error) {
        console.error('Error fetching all todos:', error);
    }

    return results;
}

/**
 * Clear cache for a specific app or all apps
 */
export function clearTodoCache(appId?: string): void {
    if (appId) {
        todoCache.delete(appId);
    } else {
        todoCache.clear();
    }
}

/**
 * Get status color based on todo metadata
 */
export function getStatusColor(metadata: TodoMetadata): string {
    if (metadata.status === 'blocked') return '#ef4444'; // red
    if (metadata.status === 'completed') return '#22c55e'; // green
    if (metadata.status === 'on-hold') return '#f59e0b'; // amber

    // For active projects, use health to determine color
    if (metadata.health >= 70) return '#22c55e'; // green
    if (metadata.health >= 40) return '#f59e0b'; // amber
    return '#ef4444'; // red
}

/**
 * Get priority color
 */
export function getPriorityColor(priority: TodoMetadata['priority']): string {
    switch (priority) {
        case 'critical': return '#dc2626'; // red-600
        case 'high': return '#f97316'; // orange-500
        case 'medium': return '#3b82f6'; // blue-500
        case 'low': return '#6b7280'; // gray-500
        default: return '#6b7280';
    }
}

/**
 * Format relative time for last updated
 */
export function formatLastUpdated(isoString?: string): string {
    if (!isoString) return 'Never';

    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
}
