import { AppItem } from '../types';

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
    time: number;
    isError?: boolean;
    previewCode?: string; // HTML/React code to preview
    previewUrl?: string;  // URL to preview (e.g., from code-preview app)
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

export async function getChatHistory(): Promise<ChatMessage[]> {
    try {
        const response = await fetch(`${API_BASE}/chat`);
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

export async function clearChatHistory(): Promise<ChatMessage[]> {
    try {
        const response = await fetch(`${API_BASE}/chat`, { method: 'DELETE' });
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
