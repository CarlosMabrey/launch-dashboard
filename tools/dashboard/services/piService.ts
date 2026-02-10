import { AppItem, DashboardTask, TodoBoardData, TodoSection } from '../types';

const API_BASE = 'http://localhost:3005/api/pi';

export interface PiMessage {
    id: string;
    text: string;
    type: 'info' | 'warning' | 'success' | 'quest';
    time: number;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    reasoning?: string | null;
    time: number;
    isError?: boolean;
    previewCode?: string;
    previewUrl?: string;
}

export interface MarketWeather {
    vibe: string;
    trend: 'bullish' | 'bearish' | 'neutral' | 'chaotic';
    lastUpdated: number;
}

export interface VanFundData {
    current: number;
    target: number;
    contributions: Array<{ amount: number; reason: string; time: number }>;
}

export interface GithubActivity {
    totalContributions: number;
    dailyHistory: Record<string, number>;
}

export interface CalendarEvent {
    id: string;
    summary: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
    description?: string;
    location?: string;
    category?: 'work' | 'personal' | 'van' | 'health' | 'finance' | 'meeting' | 'focus' | 'social' | 'other';
    recurrence?: string;
}

export interface CalendarData {
    success: boolean;
    events: CalendarEvent[];
    error?: string;
    mock?: boolean;
}

export async function getCalendarData(calendarId?: string): Promise<CalendarData> {
    try {
        const params = new URLSearchParams();
        if (calendarId) params.set('calendarId', calendarId);
        const response = await fetch(`${API_BASE}/calendar?${params}`);
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch calendar data:', error);
        return { success: false, events: [], error: String(error) };
    }
}

export async function createCalendarEvent(event: any, calendarId?: string): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE}/calendar/event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, calendarId })
        });
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Failed to create event:', error);
        return false;
    }
}

export async function updateCalendarEvent(eventId: string, event: any, calendarId?: string): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE}/calendar/event/${eventId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, calendarId })
        });
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Failed to update event:', error);
        return false;
    }
}

export async function deleteCalendarEvent(eventId: string, calendarId?: string): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE}/calendar/event/${eventId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ calendarId })
        });
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Failed to delete event:', error);
        return false;
    }
}

export async function summarizeLogs(appId: string, logs: any[]): Promise<string> {
    try {
        const response = await fetch(`${API_BASE}/summarize-logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appId, logs })
        });
        const data = await response.json();
        return data.summary || 'The aether is silent... no summary found.';
    } catch (error) {
        console.error('Failed to summarize logs:', error);
        return 'The crystal ball is clouded... failed to summarize.';
    }
}

export async function getPiMessages(): Promise<PiMessage[]> {
    try {
        const response = await fetch(`${API_BASE}/messages`);
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch Pi messages:', error);
        return [];
    }
}

export async function sendPiMessage(text: string, type: string = 'info'): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE}/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, type })
        });
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Failed to send Pi message:', error);
        return false;
    }
}

// ============================================
// Chat API (Real conversation with Pi)
// ============================================

export async function getChatHistory(agentId: string = 'dashboard'): Promise<ChatMessage[]> {
    try {
        const params = new URLSearchParams({ agentId });
        const response = await fetch(`${API_BASE}/chat?${params}`);
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch chat history:', error);
        return [];
    }
}

export async function sendChatMessage(message: string, agentId: string = 'dashboard'): Promise<{
    success: boolean;
    userMessage?: ChatMessage;
    piResponse?: ChatMessage;
    history?: ChatMessage[];
    error?: string;
}> {
    try {
        const response = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, agentId })
        });
        return await response.json();
    } catch (error) {
        console.error('Failed to send chat message:', error);
        return { success: false, error: String(error) };
    }
}

export async function clearChatHistory(agentId: string = 'dashboard'): Promise<ChatMessage[]> {
    try {
        const params = new URLSearchParams({ agentId });
        const response = await fetch(`${API_BASE}/chat?${params}`, { method: 'DELETE' });
        const data = await response.json();
        return data.history || [];
    } catch (error) {
        console.error('Failed to clear chat history:', error);
        return [];
    }
}

export async function getMarketWeather(): Promise<MarketWeather> {
    try {
        const response = await fetch(`${API_BASE}/weather`);
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch market weather:', error);
        return { vibe: 'Unknown Vibe', trend: 'neutral', lastUpdated: Date.now() };
    }
}

export async function getVanFundData(): Promise<VanFundData> {
    try {
        const response = await fetch(`${API_BASE}/van-fund`);
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch Van Fund data:', error);
        return { current: 0, target: 50000, contributions: [] };
    }
}

export async function getGithubActivity(): Promise<GithubActivity> {
    try {
        const response = await fetch(`${API_BASE}/github-activity`);
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch GitHub activity:', error);
        return { totalContributions: 0, dailyHistory: {} };
    }
}

export async function logGithubContribution(): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE}/github-activity/log`, { method: 'POST' });
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Failed to log contribution:', error);
        return false;
    }
}

export async function getGrimoire(): Promise<AppItem[]> {
    try {
        const response = await fetch(`${API_BASE}/grimoire`);
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch grimoire:', error);
        return [];
    }
}

// ============================================
// Dashboard Global Todo Board API
// ============================================

/**
 * Fetch all tasks from the global todo board
 */
export async function getTodoBoard(): Promise<TodoBoardData> {
    try {
        const response = await fetch(`${API_BASE}/todos`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch todo board:', error);
        // Return empty structure on error
        return { sections: [], taskById: new Map(), totalTasks: 0, completedCount: 0, progressPercent: 0 };
    }
}

/**
 * Update a task by ID (partial update)
 */
export async function updateTask(id: string, updates: Partial<DashboardTask>): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE}/todos/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Failed to update task:', error);
        return false;
    }
}

/**
 * Create a new task
 */
export async function createTask(task: Omit<DashboardTask, 'id' | 'created' | 'order'> & { section: string }): Promise<DashboardTask> {
    try {
        const response = await fetch(`${API_BASE}/todos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task)
        });
        const data = await response.json();
        return data.task;
    } catch (error) {
        console.error('Failed to create task:', error);
        throw error;
    }
}

/**
 * Delete a task by ID
 */
export async function deleteTask(id: string): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE}/todos/${id}`, { method: 'DELETE' });
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Failed to delete task:', error);
        return false;
    }
}

/**
 * Execute a task (starts agent work)
 */
export async function executeTask(id: string, agent: string = 'pi', model?: string, instructions?: string): Promise<{ success: boolean; sessionId?: string }> {
    try {
        const response = await fetch(`${API_BASE}/todos/${id}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agent, model, instructions })
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Failed to execute task:', error);
        return { success: false };
    }
}

/**
 * Append a log entry to a task's results (called by agent)
 */
export async function appendTaskLog(id: string, log: string): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE}/todos/${id}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ log })
        });
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Failed to append task log:', error);
        return false;
    }
}

/**
 * List available agent types for execution
 */
export async function getAgentTypes(): Promise<Array<{ id: string; name: string; description?: string }>> {
    try {
        const response = await fetch(`${API_BASE}/todos/agent/types`);
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch agent types:', error);
        return [{ id: 'pi', name: 'Pi (Main Agent)' }];
    }
}

// ============================================
// Projects API
// ============================================

export interface Project {
    id: string;
    name: string;
    path: string;
    hasTodo: boolean;
    tasks: Array<{
        id: string;
        title: string;
        status: string;
        agent?: string;
        priority?: string;
        section: string;
    }>;
}

export async function getProjects(): Promise<Project[]> {
    try {
        const response = await fetch(`${API_BASE}/projects`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch projects:', error);
        return [];
    }
}
