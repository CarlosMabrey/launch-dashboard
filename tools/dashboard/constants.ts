
import { AppItem } from './types';

// Initial apps - can be empty, users can add their own
export const INITIAL_APPS: AppItem[] = [
    {
        id: 'command-dashboard',
        name: 'Command Dashboard',
        icon: '🛸',
        badge: 'PORT: 3005',
        status: 'active',
        colorClass: 'bg-gradient-to-br from-[#0f172a] to-[#1e293b]',
        url: '#',
        command: 'npm run dev',
        directory: 'D:/AI Programs/dashboard',
        isEmbedded: true,
        appType: 'web'
    },
    {
        id: 'code-preview',
        name: 'Code Preview',
        icon: '🔮',
        badge: '3000',
        port: '3000',
        status: 'idle',
        colorClass: 'bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a]',
        url: '#',
        command: 'npx -y serve apps/code-preview',
        directory: 'D:/AI Programs/dashboard',
        isEmbedded: true,
        appType: 'web'
    }
];
