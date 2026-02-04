const API_BASE = 'http://localhost:3005/api';

export interface ServiceStatus {
    running: boolean;
    logs: Array<{ type: 'stdout' | 'stderr'; text: string; time: number }>;
}

// Access the electron API exposed via preload
const electronAPI = (window as any).electronAPI;

export async function startService(id: string, command: string, directory?: string, badge?: string): Promise<boolean> {
    if (electronAPI) {
        try {
            // Extract numerical port from badge if it exists (e.g. "Local: 3000" -> 3000)
            let port = undefined;
            if (badge) {
                const portMatch = badge.match(/\d+$/);
                if (portMatch) port = parseInt(portMatch[0]);
            }

            const result = await electronAPI.startService({ id, command, directory, port });
            return result.success;
        } catch (error) {
            console.error('Electron IPC startService failed:', error);
            return false;
        }
    }

    try {
        const response = await fetch(`${API_BASE}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, command, directory })
        });
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Failed to start service:', error);
        return false;
    }
}

export async function stopService(id: string): Promise<boolean> {
    if (electronAPI) {
        try {
            const result = await electronAPI.stopService(id);
            return result.success;
        } catch (error) {
            console.error('Electron IPC stopService failed:', error);
            return false;
        }
    }

    try {
        const response = await fetch(`${API_BASE}/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Failed to stop service:', error);
        return false;
    }
}

export async function getServiceStatus(id: string): Promise<ServiceStatus> {
    if (electronAPI) {
        try {
            return await electronAPI.getServiceStatus(id);
        } catch (error) {
            console.error('Electron IPC getServiceStatus failed:', error);
            return { running: false, logs: [] };
        }
    }

    try {
        const response = await fetch(`${API_BASE}/status/${id}`);
        return await response.json();
    } catch (error) {
        console.error('Failed to get service status:', error);
        return { running: false, logs: [] };
    }
}

export async function checkBackendHealth(): Promise<boolean> {
    if (electronAPI) return true; // Main process is always there

    try {
        const response = await fetch(`${API_BASE}/health`);
        return response.ok;
    } catch {
        return false;
    }
}

export async function openInAntigravity(directory: string): Promise<boolean> {
    if (electronAPI?.openAntigravity) {
        try {
            const result = await electronAPI.openAntigravity(directory);
            return result.success;
        } catch (error) {
            console.error('Electron IPC openAntigravity failed:', error);
            return false;
        }
    }
    console.warn('Antigravity integration is only available in Electron environment');
    return false;
}
