import express from 'express';
import cors from 'cors';
import { spawn, execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { google } from 'googleapis';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });

const app = express();
const PORT = 3005;
const PI_ROOT = 'D:\\Pi';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

app.use(cors({
    origin: '*',
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Store running processes
const runningProcesses = new Map();

// Pi's Messages Storage (legacy whispers)
let piMessages = [
    { id: 'welcome', text: 'The bridge is open, Grand Architect. Pi is listening.', type: 'info', time: Date.now() }
];

// Chat Histories - one per agent (isolated sessions)
const chatHistories = {
    'dashboard': [
        { id: 'system-welcome', role: 'assistant', text: 'The bridge is open, Grand Architect. How may I assist you?', time: Date.now() }
    ]
    // Other agents start empty; will be created on first message
};

// Ensure mockups directory exists
const MOCKUPS_DIR = path.join(PI_ROOT, 'tools', 'dashboard', 'apps', 'code-preview', 'saved', 'mockups');
if (!fs.existsSync(MOCKUPS_DIR)) {
    fs.mkdirSync(MOCKUPS_DIR, { recursive: true });
}

// Serve static mockups from code-preview/saved/mockups
app.use('/mockups', express.static(MOCKUPS_DIR));

// Serve voice assistant audio files
const VOICE_AUDIO_DIR = path.join(process.cwd(), 'apps', 'voice-assistant', 'audios');
if (!fs.existsSync(VOICE_AUDIO_DIR)) {
    fs.mkdirSync(VOICE_AUDIO_DIR, { recursive: true });
}
app.use('/apps/voice-assistant/audios', express.static(VOICE_AUDIO_DIR));

// OpenClaw Gateway Config
// Token resolution order:
// 1) OPENCLAW_GATEWAY_TOKEN env var
// 2) ~/.openclaw/openclaw.json (gateway auth token)
// 3) ~/.openclaw/identity/device-auth.json (operator token; usually NOT the gateway token)
const resolveOpenClawToken = () => {
    if (process.env.OPENCLAW_GATEWAY_TOKEN) return process.env.OPENCLAW_GATEWAY_TOKEN;

    // Preferred: gateway auth token from ~/.openclaw/openclaw.json
    try {
        const cfgPath = path.join(process.env.USERPROFILE || '', '.openclaw', 'openclaw.json');
        if (fs.existsSync(cfgPath)) {
            const raw = fs.readFileSync(cfgPath, 'utf8');
            const json = JSON.parse(raw);
            const token = json?.gateway?.auth?.token;
            if (typeof token === 'string' && token.length > 0) return token;
        }
    } catch (e) {
        // fall through
    }

    // Fallback: operator token (may not be accepted by the gateway HTTP auth)
    try {
        const deviceAuthPath = path.join(process.env.USERPROFILE || '', '.openclaw', 'identity', 'device-auth.json');
        if (fs.existsSync(deviceAuthPath)) {
            const raw = fs.readFileSync(deviceAuthPath, 'utf8');
            const json = JSON.parse(raw);
            const token = json?.tokens?.operator?.token;
            if (typeof token === 'string' && token.length > 0) return token;
        }
    } catch (e) {
        // fall through
    }

    return '';
};

const OPENCLAW_GATEWAY = {
    baseUrl: process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789',
    token: resolveOpenClawToken()
};

// Map dashboard agent selection to system prompts and actual gateway agent
function getAgentConfig(agentId) {
    switch (agentId) {
        case 'coding':
            return {
                systemPrompt: 'You are a coding specialist. Focus on software development, debugging, code reviews, and technical implementation. Provide concise, practical solutions with code examples when appropriate. Use best practices and explain technical decisions clearly.',
                gatewayAgentId: 'main'
            };
        case 'research':
            return {
                systemPrompt: 'You are a research specialist. Your role is to gather, synthesize, and summarize information from various sources. Use web search to find up-to-date data, provide citations, and present balanced perspectives. Focus on delivering well-structured, factual reports with clear sourcing.',
                gatewayAgentId: 'main'
            };
        case 'pi':
        case 'dashboard':
        default:
            return { systemPrompt: null, gatewayAgentId: 'main' };
    }
}

/**
 * Spawn a background agent session via OpenClaw Gateway
 * Uses the `openclaw gateway call sessions_spawn` CLI
 */
async function spawnAgentSession(task, agentId, model, instructions) {
    // Map the selected agent to a persona prefix and actual gateway agent
    const { systemPrompt, gatewayAgentId: actualAgentId } = getAgentConfig(agentId);
    // Build the task description, prepending persona if provided
    const personaPrefix = systemPrompt ? `${systemPrompt}\n\n` : '';
    const taskDescription = personaPrefix + `Execute task: ${task.title}\n\nDescription: ${task.description || 'No description provided.'}\n\nAdditional instructions: ${instructions || 'No additional instructions.'}`;

    const params = {
        task: taskDescription,
        agentId: actualAgentId, // always use main agent in gateway
        label: `Todo: ${task.title}`
    };
    if (model) params.model = model;

    // Resolve the openclaw command path
    let openclawCmd;
    if (process.platform === 'win32') {
        const npmPrefix = process.env.npm_config_prefix || 'C:\\nvm4w\\nodejs';
        openclawCmd = path.join(npmPrefix, 'openclaw.cmd');
    } else {
        openclawCmd = 'openclaw';
    }

    return new Promise((resolve) => {
        execFile(openclawCmd, ['gateway', 'call', 'sessions_spawn', '--params', JSON.stringify(params)], { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                console.error('Failed to spawn agent session:', error);
                console.error('stderr:', stderr);
                return resolve({ success: false, error: error.message });
            }
            try {
                // The CLI outputs JSON with result/error fields
                const output = stdout.toString().trim();
                const result = JSON.parse(output);
                if (result.error) {
                    console.error('Gateway call error:', result.error);
                    resolve({ success: false, error: result.error });
                } else {
                    const sessionId = result.result?.sessionId;
                    if (sessionId) {
                        resolve({ success: true, sessionId });
                    } else {
                        resolve({ success: false, error: 'No sessionId returned' });
                    }
                }
            } catch (e) {
                console.error('Failed to parse gateway response:', e);
                resolve({ success: false, error: 'Invalid response from gateway' });
            }
        });
    });
}

// GitHub API Config
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Market Weather Storage
let marketWeather = {
    vibe: "Calibrating the celestial markets...",
    trend: "neutral",
    lastUpdated: Date.now()
};

// Van Fund & Contribution Storage
let vanFundData = {
    current: 1500,
    target: 50000,
    contributions: [] // History of additions
};

let githubActivity = {
    totalContributions: 0,
    dailyHistory: {} // YYYY-MM-DD: count
};

// Snippets Storage
const SNIPPETS_FILE = path.join(process.cwd(), 'snippets.json');

// ============================================
// App Grimoire (D:\\Pi Scanner + Registry)
// ============================================

// Persistent registry for manually-added apps and config overrides.
// This file is the source of truth for user-created apps and
// any customization applied to auto-discovered apps.
const GRIMOIRE_REGISTRY_PATH = path.join(process.cwd(), 'grimoire-registry.json');

const loadGrimoireRegistry = () => {
    try {
        if (fs.existsSync(GRIMOIRE_REGISTRY_PATH)) {
            return JSON.parse(fs.readFileSync(GRIMOIRE_REGISTRY_PATH, 'utf8'));
        }
    } catch (e) {
        console.error('Error loading grimoire registry:', e);
    }
    return { apps: {}, hidden: [] }; // apps: id -> metadata, hidden: array of IDs to exclude from scan
};

const saveGrimoireRegistry = (registry) => {
    try {
        fs.writeFileSync(GRIMOIRE_REGISTRY_PATH, JSON.stringify(registry, null, 2));
    } catch (e) {
        console.error('Error saving grimoire registry:', e);
    }
};

// Initialize registry on startup
let grimoireRegistry = loadGrimoireRegistry();

const scanDirectory = (dir, depth = 0, currentDepth = 0) => {
    if (currentDepth > depth) return [];
    let appsList = [];

    // Safety check: Don't scan node_modules or .git
    if (dir.includes('node_modules') || dir.includes('.git')) return [];

    try {
        if (!fs.existsSync(dir)) return [];
        const items = fs.readdirSync(dir, { withFileTypes: true });

        for (const item of items) {
            if (item.isDirectory() && !item.name.startsWith('.')) {
                const fullPath = path.join(dir, item.name);
                const metadataPath = path.join(fullPath, 'metadata.json');
                const todoPath = path.join(fullPath, 'todo.md');

                // Check for metadata first (explicit app definition)
                if (fs.existsSync(metadataPath)) {
                    try {
                        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                        const appData = {
                            id: metadata.id || item.name,
                            name: metadata.name || item.name,
                            icon: metadata.icon || '📦',
                            badge: metadata.badge || 'APP',
                            status: 'idle',
                            colorClass: metadata.colorClass || 'bg-blue-500',
                            url: metadata.url || '',
                            command: metadata.command || '',
                            directory: fullPath,
                            isOnline: false,
                            isEmbedded: metadata.isEmbedded || false,
                            appType: metadata.appType || 'terminal',
                            embeddedUrl: metadata.embeddedUrl || undefined,
                            port: metadata.port || undefined,
                            hasTodo: fs.existsSync(todoPath),
                            source: 'scanned'
                        };
                        appsList.push(appData);
                    } catch (e) {
                        console.error(`Error parsing metadata in ${fullPath}:`, e);
                    }
                }
                // Fallback to todo.md if metadata.json is missing & it's not a generic container folder
                else if (fs.existsSync(todoPath)) {
                    const appData = {
                        id: item.name,
                        name: item.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                        icon: '📝',
                        badge: 'PROJECT',
                        status: 'idle',
                        colorClass: 'bg-emerald-500',
                        url: '',
                        directory: fullPath,
                        isOnline: false,
                        isEmbedded: false,
                        appType: 'terminal',
                        hasTodo: true,
                        source: 'scanned'
                    };
                    appsList.push(appData);
                }
                // Fallback: Check for executable scripts (Folder Mode)
                else {
                    try {
                        const dirFiles = fs.readdirSync(fullPath);
                        const scriptFile = dirFiles.find(f => f.match(/\.(bat|cmd|ps1|exe)$/i));

                        if (scriptFile) {
                            const appData = {
                                id: item.name,
                                name: item.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                                icon: '🚀',
                                badge: 'SCRIPT',
                                status: 'idle',
                                colorClass: 'bg-amber-600',
                                url: '',
                                command: scriptFile.endsWith('.ps1') ? `powershell -File .\\${scriptFile}` : `.\\${scriptFile}`,
                                directory: fullPath,
                                isOnline: false,
                                isEmbedded: false,
                                appType: 'terminal',
                                hasTodo: false,
                                source: 'scanned'
                            };
                            appsList.push(appData);
                        }
                    } catch (e) {
                        // ignore access errors
                    }
                }

                // Recurse deeper even if we found an app (e.g. monorepos)? 
                // For now, if we found an app, we assume it's the leaf app. 
                // If not, we dive deeper.
                if (!fs.existsSync(metadataPath)) {
                    appsList = [...appsList, ...scanDirectory(fullPath, depth, currentDepth + 1)];
                }
            }
        }
    } catch (e) {
        console.error(`Error scanning directory ${dir}:`, e);
    }
    return appsList;
};

const scanGrimoire = () => {
    // Explicitly scan known app repositories (NOT skills — those aren't apps)
    const toolsApps = scanDirectory(path.join(PI_ROOT, 'tools'), 3);
    const projectsApps = scanDirectory(path.join(PI_ROOT, 'projects'), 3);
    const vortexApps = scanDirectory(path.join(PI_ROOT, 'external-vortex'), 2);

    // Build scanned apps map (deduplicate by ID)
    const scannedMap = new Map();
    for (const app of [...toolsApps, ...projectsApps, ...vortexApps]) {
        scannedMap.set(app.id, app);
    }

    // Reload registry from disk (always fresh)
    grimoireRegistry = loadGrimoireRegistry();
    const hiddenIds = new Set(grimoireRegistry.hidden || []);

    // Remove hidden apps from scanned results
    for (const id of hiddenIds) {
        scannedMap.delete(id);
    }

    // Merge: registry overrides scanned apps, and adds any registry-only apps
    const finalMap = new Map(scannedMap);

    for (const [id, regApp] of Object.entries(grimoireRegistry.apps)) {
        // Skip hidden apps even if they're in the registry
        if (hiddenIds.has(id)) continue;

        if (finalMap.has(id)) {
            // Scanned app exists — merge registry overrides on top
            const scanned = finalMap.get(id);
            finalMap.set(id, {
                ...scanned,
                ...regApp,
                directory: regApp.directory || scanned.directory,
                hasTodo: scanned.hasTodo,
                source: 'merged'
            });
        } else {
            // Registry-only app (manually added, or app whose directory was removed)
            finalMap.set(id, {
                ...regApp,
                status: 'idle',
                isOnline: false,
                hasTodo: false,
                source: 'registry'
            });
        }
    }

    return Array.from(finalMap.values());
};



app.get('/api/pi/grimoire', (req, res) => {
    const appsList = scanGrimoire();
    res.json(appsList);
});


app.post('/api/pi/grimoire/update', (req, res) => {
    const appData = req.body;
    if (!appData.id) {
        return res.status(400).json({ success: false, error: 'ID is required' });
    }

    try {
        let saveDir = appData.directory;

        // Handle URL apps or apps without a specific directory
        if (!saveDir || saveDir === '#' || saveDir === '') {
            saveDir = path.join(PI_ROOT, 'external-vortex', appData.id);
        }

        // Prepare metadata for saving (remove transient fields like isOnline, status, todoData)
        const metadata = {
            id: appData.id,
            name: appData.name,
            icon: appData.icon,
            badge: appData.badge,
            colorClass: appData.colorClass,
            url: appData.url,
            command: appData.command,
            isEmbedded: appData.isEmbedded,
            appType: appData.appType,
            embeddedUrl: appData.embeddedUrl,
            port: appData.port,
            directory: saveDir
        };

        // Also write metadata.json to the app's directory if it exists/is writable
        try {
            if (!fs.existsSync(saveDir)) {
                fs.mkdirSync(saveDir, { recursive: true });
            }
            const metadataPath = path.join(saveDir, 'metadata.json');
            // Don't save base64 icon blobs into filesystem metadata (too large)
            // Save them only in the registry
            const fsMetadata = { ...metadata };
            if (fsMetadata.icon && fsMetadata.icon.length > 500) {
                fsMetadata.icon = '📦'; // Placeholder in filesystem; real icon in registry
            }
            fs.writeFileSync(metadataPath, JSON.stringify(fsMetadata, null, 2));
            console.log(`✅ Metadata.json persisted at: ${metadataPath}`);
        } catch (fsErr) {
            console.warn(`⚠️ Couldn't write metadata.json to ${saveDir}: ${fsErr.message}`);
        }

        // Always save to the central registry (authoritative source)
        grimoireRegistry = loadGrimoireRegistry();
        grimoireRegistry.apps[appData.id] = metadata;
        saveGrimoireRegistry(grimoireRegistry);
        console.log(`✅ Registry updated for [${appData.name}] (id: ${appData.id})`);

        res.json({ success: true, message: `App saved: ${appData.name}`, directory: saveDir });
    } catch (e) {
        console.error('Error updating grimoire:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.delete('/api/pi/grimoire/:id', (req, res) => {
    const { id } = req.params;
    try {
        grimoireRegistry = loadGrimoireRegistry();
        const appName = (grimoireRegistry.apps[id]?.name) || id;

        // Remove from registry apps if present
        if (grimoireRegistry.apps[id]) {
            delete grimoireRegistry.apps[id];
        }

        // Add to hidden list so filesystem-scanned apps don't reappear
        if (!grimoireRegistry.hidden) grimoireRegistry.hidden = [];
        if (!grimoireRegistry.hidden.includes(id)) {
            grimoireRegistry.hidden.push(id);
        }

        saveGrimoireRegistry(grimoireRegistry);
        console.log(`🗑️ Hidden [${appName}] (id: ${id}) — won't reappear from scans`);
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting from grimoire:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Unhide an app (restore a previously hidden app)
app.post('/api/pi/grimoire/unhide/:id', (req, res) => {
    const { id } = req.params;
    try {
        grimoireRegistry = loadGrimoireRegistry();
        if (grimoireRegistry.hidden) {
            grimoireRegistry.hidden = grimoireRegistry.hidden.filter(h => h !== id);
            saveGrimoireRegistry(grimoireRegistry);
            console.log(`👁️ Unhidden [${id}] — will reappear on next scan`);
        }
        res.json({ success: true });
    } catch (e) {
        console.error('Error unhiding app:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});



const loadSnippets = () => {
    try {
        if (fs.existsSync(SNIPPETS_FILE)) {
            return JSON.parse(fs.readFileSync(SNIPPETS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Error loading snippets:', e);
    }
    return [];
};

const saveSnippetsData = (snippets) => {
    try {
        fs.writeFileSync(SNIPPETS_FILE, JSON.stringify(snippets, null, 2));
    } catch (e) {
        console.error('Error saving snippets:', e);
    }
};

// Start a service
app.post('/api/start', (req, res) => {
    const { id, command, directory } = req.body;

    if (!command) {
        return res.status(400).json({ error: 'Command is required' });
    }

    // Kill existing process if running
    if (runningProcesses.has(id)) {
        const existing = runningProcesses.get(id);
        existing.process.kill();
        runningProcesses.delete(id);
    }

    const cwd = directory || process.cwd();

    // On Windows, use PowerShell to ensure access to PowerShell-specific commands and functions
    const isWindows = process.platform === 'win32';
    let cmd, args;

    if (isWindows) {
        cmd = 'powershell';
        args = ['-Command', '. $PROFILE; ' + command];
    } else {
        [cmd, ...args] = command.split(' ');
    }

    console.log(`\n🚀 Starting service [${id}]: ${command}`);
    console.log(`   📁 Directory: ${cwd}\n`);

    try {
        const child = spawn(cmd, args, {
            cwd,
            shell: false, // Don't use shell: true when explicitly calling powershell
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, FORCE_COLOR: '1' }
        });

        const logs = [];

        child.stdout.on('data', (data) => {
            const line = data.toString();
            logs.push({ type: 'stdout', text: line, time: Date.now() });
            if (logs.length > 100) logs.shift();
            process.stdout.write(`[${id}] ${line}`);
        });

        child.stderr.on('data', (data) => {
            const line = data.toString();
            logs.push({ type: 'stderr', text: line, time: Date.now() });
            if (logs.length > 100) logs.shift();
            process.stderr.write(`[${id}] ${line}`);
        });

        child.on('error', (err) => {
            console.error(`[${id}] Process error:`, err.message);
            runningProcesses.delete(id);
        });

        child.on('exit', (code) => {
            console.log(`[${id}] Process exited with code ${code}`);
            runningProcesses.delete(id);
        });

        runningProcesses.set(id, { process: child, logs, command, directory: cwd });

        res.json({ success: true, message: `Started: ${command}` });
    } catch (err) {
        console.error(`Failed to start [${id}]:`, err.message);
        res.status(500).json({ error: err.message });
    }
});

// Stop a service
app.post('/api/stop', (req, res) => {
    const { id } = req.body;

    if (runningProcesses.has(id)) {
        const { process: proc } = runningProcesses.get(id);
        console.log(`\n⏹️  Stopping service [${id}]\n`);

        // On Windows, use taskkill to properly terminate the process tree
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', proc.pid.toString(), '/f', '/t'], { shell: true });
        } else {
            proc.kill('SIGTERM');
        }

        runningProcesses.delete(id);
        res.json({ success: true, message: 'Service stopped' });
    } else {
        res.json({ success: true, message: 'Service was not running' });
    }
});

// Get service status
app.get('/api/status/:id', (req, res) => {
    const { id } = req.params;
    const isRunning = runningProcesses.has(id);
    const data = runningProcesses.get(id);

    res.json({
        running: isRunning,
        logs: data?.logs?.slice(-20) || []
    });
});

// Get all running services
app.get('/api/services', (req, res) => {
    const services = [];
    for (const [id, data] of runningProcesses) {
        services.push({ id, command: data.command, directory: data.directory });
    }
    res.json(services);
});

// ============================================
// Google Calendar Integration
// ============================================

const CALENDAR_CREDENTIALS_PATH = path.join(process.cwd(), 'service-account.json');
const DEFAULT_CALENDAR_ID = 'carlomabrey@gmail.com'; // Hardcoded based on user profile

/**
 * Fetch calendar events
 */
async function getCalendarEventsInternal(calendarId = DEFAULT_CALENDAR_ID) {
    try {
        if (!fs.existsSync(CALENDAR_CREDENTIALS_PATH)) {
            console.warn('⚠️ Google Calendar credentials not found at:', CALENDAR_CREDENTIALS_PATH);
            return {
                success: false,
                error: 'Credentials missing',
                mock: true,
                events: [
                    { id: '1', summary: 'Connect Google Calendar', start: { dateTime: new Date().toISOString() }, description: 'Add service-account.json to dashboard root' },
                    { id: '2', summary: 'Daily Wizard Standup', start: { dateTime: new Date(Date.now() + 3600000).toISOString() } }
                ]
            };
        }

        const auth = new google.auth.GoogleAuth({
            keyFile: CALENDAR_CREDENTIALS_PATH,
            scopes: ['https://www.googleapis.com/auth/calendar'],
        });

        const calendar = google.calendar({ version: 'v3', auth });
        const res = await calendar.events.list({
            calendarId: calendarId,
            timeMin: new Date().toISOString(),
            maxResults: 50, // Increased to capture more events for busyness
            singleEvents: true,
            orderBy: 'startTime',
        });

        const events = (res.data.items || []).map(event => {
            // Extract category from extendedProperties if present
            const category = event.extendedProperties?.private?.category;
            return {
                id: event.id,
                summary: event.summary,
                start: {
                    dateTime: event.start?.dateTime,
                    date: event.start?.date
                },
                end: {
                    dateTime: event.end?.dateTime,
                    date: event.end?.date
                },
                description: event.description,
                location: event.location,
                ...(category && { category })
            };
        });

        return { success: true, events };
    } catch (error) {
        console.error('Error fetching calendar events:', error);
        return { success: false, error: error.message };
    }
}

app.get('/api/pi/calendar', async (req, res) => {
    const calendarId = req.query.calendarId || DEFAULT_CALENDAR_ID;
    const data = await getCalendarEventsInternal(calendarId);
    res.json(data);
});

/**
 * Create/Update/Delete Calendar Events
 */
app.post('/api/pi/calendar/event', async (req, res) => {
    const { event, calendarId = DEFAULT_CALENDAR_ID } = req.body;
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: CALENDAR_CREDENTIALS_PATH,
            scopes: ['https://www.googleapis.com/auth/calendar'],
        });
        const calendar = google.calendar({ version: 'v3', auth });

        // Inject category into extendedProperties if present
        const eventBody = { ...event };
        if (event.category) {
            eventBody.extendedProperties = {
                private: {
                    category: event.category
                }
            };
        }

        const response = await calendar.events.insert({
            calendarId,
            requestBody: eventBody,
        });
        res.json({ success: true, event: response.data });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/pi/calendar/event/:eventId', async (req, res) => {
    const { eventId } = req.params;
    const { event, calendarId = DEFAULT_CALENDAR_ID } = req.body;
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: CALENDAR_CREDENTIALS_PATH,
            scopes: ['https://www.googleapis.com/auth/calendar'],
        });
        const calendar = google.calendar({ version: 'v3', auth });

        // Inject category into extendedProperties if present
        const eventBody = { ...event };
        if (event.category) {
            eventBody.extendedProperties = {
                private: {
                    category: event.category
                }
            };
        }

        const response = await calendar.events.update({
            calendarId,
            eventId,
            requestBody: eventBody,
        });
        res.json({ success: true, event: response.data });
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/pi/calendar/event/:eventId', async (req, res) => {
    const { eventId } = req.params;
    const { calendarId = DEFAULT_CALENDAR_ID } = req.body;
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: CALENDAR_CREDENTIALS_PATH,
            scopes: ['https://www.googleapis.com/auth/calendar'],
        });
        const calendar = google.calendar({ version: 'v3', auth });
        await calendar.events.delete({
            calendarId,
            eventId,
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// AI Calendar Command Integration
// ============================================

// Use Gemini to interpret calendar commands from chat
async function interpretCalendarCommand(text) {
    const prompt = `You are a calendar command interpreter for a voice/chat assistant. Extract the user's intended calendar operation.

User message: "${text}"

Return a JSON object with these fields:
- action: "create" | "update" | "delete" | "list" | null (if not a calendar request)
- event: { summary, start, end, description, location } for create/update (start and end should be ISO 8601 strings in America/Denver timezone; if end missing, set to 1 hour after start)
- eventId: string identifier for update/delete (if user refers by description, leave blank)
- resolveReferences: boolean (true if user refers to an event by description like "the meeting with John" and you need to match it)
- listFilter: { today?: boolean, thisWeek?: boolean, start?: ISO, end?: ISO } for list action

Only return the JSON, no other text.`;

    try {
        const result = await model.generateContent(prompt);
        let jsonText = result.response.text().trim();
        // Extract JSON from possible markdown code block
        const jsonMatch = jsonText.match(/```json\n?([\s\S]*?)\n?```/) || jsonText.match(/{[\s\S]*}/);
        if (jsonMatch) {
            jsonText = jsonMatch[1] || jsonMatch[0];
        }
        const parsed = JSON.parse(jsonText);
        return parsed;
    } catch (error) {
        console.error('Calendar interpretation error:', error);
        return { action: null };
    }
}

// Direct calendar operation helpers (mirroring the API endpoints but usable internally)
async function createCalendarEventDirect(calendarId, eventBody) {
    try {
        if (!fs.existsSync(CALENDAR_CREDENTIALS_PATH)) {
            throw new Error('Calendar credentials missing');
        }
        const auth = new google.auth.GoogleAuth({
            keyFile: CALENDAR_CREDENTIALS_PATH,
            scopes: ['https://www.googleapis.com/auth/calendar'],
        });
        const calendar = google.calendar({ version: 'v3', auth });
        const response = await calendar.events.insert({
            calendarId,
            requestBody: eventBody,
        });
        return response.data;
    } catch (error) {
        console.error('Error creating calendar event:', error);
        throw error;
    }
}

async function updateCalendarEventDirect(calendarId, eventId, eventBody) {
    try {
        if (!fs.existsSync(CALENDAR_CREDENTIALS_PATH)) {
            throw new Error('Calendar credentials missing');
        }
        const auth = new google.auth.GoogleAuth({
            keyFile: CALENDAR_CREDENTIALS_PATH,
            scopes: ['https://www.googleapis.com/auth/calendar'],
        });
        const calendar = google.calendar({ version: 'v3', auth });
        const response = await calendar.events.update({
            calendarId,
            eventId,
            requestBody: eventBody,
        });
        return response.data;
    } catch (error) {
        console.error('Error updating calendar event:', error);
        throw error;
    }
}

async function deleteCalendarEventDirect(calendarId, eventId) {
    try {
        if (!fs.existsSync(CALENDAR_CREDENTIALS_PATH)) {
            throw new Error('Calendar credentials missing');
        }
        const auth = new google.auth.GoogleAuth({
            keyFile: CALENDAR_CREDENTIALS_PATH,
            scopes: ['https://www.googleapis.com/auth/calendar'],
        });
        const calendar = google.calendar({ version: 'v3', auth });
        await calendar.events.delete({
            calendarId,
            eventId,
        });
        return true;
    } catch (error) {
        console.error('Error deleting calendar event:', error);
        throw error;
    }
}

async function listCalendarEventsDirect(calendarId, timeMin, maxResults = 50) {
    try {
        if (!fs.existsSync(CALENDAR_CREDENTIALS_PATH)) {
            console.warn('Google Calendar credentials not found');
            return { success: false, error: 'Credentials missing', mock: true, events: [] };
        }
        const auth = new google.auth.GoogleAuth({
            keyFile: CALENDAR_CREDENTIALS_PATH,
            scopes: ['https://www.googleapis.com/auth/calendar'],
        });
        const calendar = google.calendar({ version: 'v3', auth });
        const res = await calendar.events.list({
            calendarId,
            timeMin: timeMin || new Date().toISOString(),
            maxResults,
            singleEvents: true,
            orderBy: 'startTime',
        });
        const events = (res.data.items || []).map(event => ({
            id: event.id,
            summary: event.summary,
            start: { dateTime: event.start?.dateTime, date: event.start?.date },
            end: { dateTime: event.end?.dateTime, date: event.end?.date },
            description: event.description,
            location: event.location,
        }));
        return { success: true, events };
    } catch (error) {
        console.error('Error listing calendar events:', error);
        return { success: false, error: error.message };
    }
}

// Execute calendar operation from parsed intent
async function executeCalendarOperation(intent, calendarId = DEFAULT_CALENDAR_ID) {
    try {
        switch (intent.action) {
            case 'create':
                if (!intent.event?.start) throw new Error('Missing start time for event creation');
                const created = await createCalendarEventDirect(calendarId, intent.event);
                return {
                    success: true,
                    action: 'created',
                    event: created,
                    summary: `Created event: ${intent.event.summary}`
                };
            case 'update':
                if (!intent.eventId && !intent.resolveReferences) throw new Error('Missing eventId for update');
                const updated = await updateCalendarEventDirect(calendarId, intent.eventId, intent.event);
                return {
                    success: true,
                    action: 'updated',
                    event: updated,
                    summary: `Updated event: ${intent.event.summary || intent.eventId}`
                };
            case 'delete':
                if (!intent.eventId) throw new Error('Missing eventId for delete');
                await deleteCalendarEventDirect(calendarId, intent.eventId);
                return {
                    success: true,
                    action: 'deleted',
                    summary: `Deleted event: ${intent.eventId}`
                };
            case 'list':
                let timeMin, timeMax;
                if (intent.listFilter) {
                    const now = new Date();
                    if (intent.listFilter.today) {
                        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        timeMin = startOfDay.toISOString();
                        const endOfDay = new Date(startOfDay);
                        endOfDay.setDate(endOfDay.getDate() + 1);
                        timeMax = endOfDay.toISOString();
                    } else if (intent.listFilter.thisWeek) {
                        const day = now.getDay();
                        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
                        const monday = new Date(now.setDate(diff));
                        monday.setHours(0, 0, 0, 0);
                        timeMin = monday.toISOString();
                        const nextMonday = new Date(monday);
                        nextMonday.setDate(nextMonday.getDate() + 7);
                        timeMax = nextMonday.toISOString();
                    } else {
                        timeMin = intent.listFilter.start;
                        timeMax = intent.listFilter.end;
                    }
                }
                const listResult = await listCalendarEventsDirect(calendarId, timeMin, 50);
                if (!listResult.success) throw new Error(listResult.error);
                const events = listResult.events;
                const eventLines = events.map(e => {
                    const start = e.start.dateTime || e.start.date;
                    return `• ${e.summary} (${new Date(start).toLocaleString()})`;
                }).join('\n');
                return {
                    success: true,
                    action: 'listed',
                    events,
                    summary: `Found ${events.length} events:\n${eventLines || '(none)'}`
                };
            default:
                return { success: false, action: null, summary: 'Not a calendar command' };
        }
    } catch (error) {
        console.error('Calendar operation error:', error);
        return { success: false, action: intent?.action, error: error.message };
    }
}

// ============================================
// AI Log Summarizer API
// ============================================

app.post('/api/pi/summarize-logs', async (req, res) => {
    const { appId, logs } = req.body;

    if (!logs || !Array.isArray(logs)) {
        return res.status(400).json({ error: 'Logs array is required' });
    }

    try {
        const logText = logs.map(l => `[${new Date(l.time).toLocaleTimeString()}] ${l.text}`).join('\n');

        const prompt = `You are a helpful AI assistant for a software developer. 
Summarize the following application logs for the app "${appId}". 
Highlight any errors, warnings, or significant lifecycle events (startups, connections).
Be concise and whimsical in your tone, like a wizard reading a crystal ball.

LOGS:
${logText.slice(-5000)} // Keep it within reasonable limits`;

        const result = await model.generateContent(prompt);
        const summary = result.response.text();

        res.json({ success: true, summary });
    } catch (error) {
        console.error('Error summarizing logs:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Pi Integration API
// ============================================

app.get('/api/pi/messages', (req, res) => {
    res.json(piMessages);
});

app.post('/api/pi/message', (req, res) => {
    const { text, type = 'info' } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    const newMessage = {
        id: `pi-${Date.now()}`,
        text,
        type,
        time: Date.now()
    };

    piMessages.unshift(newMessage);
    if (piMessages.length > 10) piMessages.pop(); // Keep last 10

    res.json({ success: true, message: newMessage });
});

app.get('/api/pi/weather', (req, res) => {
    res.json(marketWeather);
});

app.post('/api/pi/weather', (req, res) => {
    const { vibe, trend } = req.body;
    marketWeather = {
        vibe,
        trend,
        lastUpdated: Date.now()
    };
    res.json({ success: true, weather: marketWeather });
});

// ============================================
// Pi Chat API (Real conversation with OpenClaw)
// ============================================

// Get chat history (optionally filtered by agent)
app.get('/api/pi/chat', (req, res) => {
    let agentId = req.query.agentId;
    if (Array.isArray(agentId)) agentId = agentId[0];
    if (!agentId) agentId = 'dashboard';
    const history = chatHistories[agentId] || chatHistories['dashboard'] || [];
    res.json(history);
});

// Send message to Pi and get response
app.post('/api/pi/chat', async (req, res) => {
    const { message, agentId = 'dashboard' } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    // Ensure this agent has a history array
    if (!chatHistories[agentId]) {
        chatHistories[agentId] = [];
    }
    const history = chatHistories[agentId];

    // Add user message to history
    const userMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: message,
        time: Date.now()
    };
    history.push(userMessage);

    // LITE MODE: "render test" interceptor
    if (message.toLowerCase().trim() === 'render test') {
        const testCode = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { margin: 0; background: #0c0c0c; color: #00f2ff; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; overflow: hidden; }
        .box { width: 100px; height: 100px; background: #8b5cf6; border-radius: 20px; animation: spin 4s linear infinite; box-shadow: 0 0 30px #8b5cf6; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        h1 { font-size: 1rem; text-transform: uppercase; letter-spacing: 2px; margin-top: 20px; text-shadow: 0 0 10px #00f2ff; }
    </style>
</head>
<body>
    <div class="box"></div>
    <h1>Test Manifested</h1>
</body>
</html>`;

        const piResponse = {
            id: `pi-test-${Date.now()}`,
            role: 'assistant',
            text: 'Behold, the Lite-Manifestation! The render engine is operational and verified.',
            time: Date.now(),
            previewCode: testCode
        };
        history.push(piResponse);
        return res.json({ success: true, userMessage, piResponse, history });
    }

    // Scan user message for HTML blocks (both fenced and bare) to generate immediate previews
    const userPreviews = [];

    // Fenced blocks in user message
    const userFencedRegex = /```(?:html|xml)?\s*([\s\S]*?)```/gi;
    let userFencedMatch;
    while ((userFencedMatch = userFencedRegex.exec(message)) !== null) {
        const code = userFencedMatch[1].trim();
        if (code.includes('<') && (code.includes('</') || code.includes('/>'))) {
            const filename = `preview-${crypto.randomUUID().slice(0, 8)}.html`;
            const fullPath = path.join(MOCKUPS_DIR, filename);
            let html = code;
            if (!code.toLowerCase().includes('<!doctype') && !code.toLowerCase().includes('<html>')) {
                html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background: #0c0c0c; color: white; font-family: sans-serif; padding: 20px; }
    </style>
</head>
<body>
    ${code}
</body>
</html>`;
            }
            try {
                fs.writeFileSync(fullPath, html);
                userPreviews.push({ url: `http://localhost:3005/mockups/${filename}`, code: html });
            } catch (e) {
                console.error('Failed to write user preview:', e);
            }
        }
    }

    // Bare HTML elements in user message (skip fenced regions)
    let residualUser = message.replace(userFencedRegex, '___FENCED_BLOCK_PLACEHOLDER___');
    const userBareHtmlRegex = /<(div|svg|section|article|aside|main|nav|header|footer|table|form|ul|ol|li)(\s[^>]*)?>[\s\S]*?<\/\1>/gi;
    let userBareMatch;
    while ((userBareMatch = userBareHtmlRegex.exec(residualUser)) !== null) {
        const fullHtml = userBareMatch[0];
        if (fullHtml.includes('___FENCED_BLOCK_PLACEHOLDER___')) continue;
        // Heuristic: likely a widget if it has a style attribute (reduces false positives)
        if (!/(style|class)=/i.test(fullHtml)) continue;
        const filename = `preview-${crypto.randomUUID().slice(0, 8)}.html`;
        const fullPath = path.join(MOCKUPS_DIR, filename);
        let html = fullHtml;
        if (!fullHtml.toLowerCase().includes('<!doctype') && !fullHtml.toLowerCase().includes('<html>')) {
            html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background: #0c0c0c; color: white; font-family: sans-serif; padding: 20px; }
    </style>
</head>
<body>
    ${fullHtml}
</body>
</html>`;
        }
        try {
            fs.writeFileSync(fullPath, html);
            userPreviews.push({ url: `http://localhost:3005/mockups/${filename}`, code: html });
        } catch (e) {
            console.error('Failed to write user bare preview:', e);
        }
    }

    // Check for calendar commands
    const lowerMessage = message.toLowerCase();
    const isCalendarCommand = /calendar|event|meeting|appointment|schedule|remind/.test(lowerMessage);
    let calendarResult = null;
    if (isCalendarCommand) {
        try {
            const intent = await interpretCalendarCommand(message);
            if (intent && intent.action) {
                calendarResult = await executeCalendarOperation(intent);
            }
        } catch (err) {
            console.error('Calendar command handling error:', err);
        }
    }

    try {
        // Call OpenClaw Gateway OpenResponses API
        const { systemPrompt, gatewayAgentId } = getAgentConfig(agentId);
        const requestBody = {
            model: gatewayAgentId,
            input: message,
            user: `dashboard-chat-${agentId}` // separate sessions per agent
        };
        if (systemPrompt) {
            requestBody.instructions = systemPrompt;
        }

        const responsePromise = fetch(`${OPENCLAW_GATEWAY.baseUrl}/v1/responses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENCLAW_GATEWAY.token}`
            },
            body: JSON.stringify(requestBody)
        });

        // Timeout for gateway response (don't block forever)
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Gateway timeout')), 90000) // 90 seconds
        );

        const response = await Promise.race([responsePromise, timeoutPromise]);

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Gateway returned ${response.status}: ${errorBody}`);
        }

        const data = await response.json();

        // Extract content from OpenResponses format
        let outputText = data.output?.[0]?.content?.[0]?.text || 'I received your message but had trouble responding.';
        let reasoning = data.reasoning || data.thoughts || data.output?.[0]?.reasoning || null; // Capture thought process
        let previewUrl = null;
        let previewCode = null;

        // Collect AI-generated previews
        const aiPreviews = [];

        // 1) Fenced code blocks: ```html ... ```
        const fencedRegex = /```(?:html|xml)?\s*([\s\S]*?)```/gi;
        let fencedMatch;
        while ((fencedMatch = fencedRegex.exec(outputText)) !== null) {
            const code = fencedMatch[1].trim();
            if (code.includes('<') && (code.includes('</') || code.includes('/>'))) {
                const filename = `preview-${crypto.randomUUID().slice(0, 8)}.html`;
                const fullPath = path.join(MOCKUPS_DIR, filename);
                let html = code;
                if (!code.toLowerCase().includes('<!doctype') && !code.toLowerCase().includes('<html>')) {
                    html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background: #0c0c0c; color: white; font-family: sans-serif; padding: 20px; }
    </style>
</head>
<body>
    ${code}
</body>
</html>`;
                }
                fs.writeFileSync(fullPath, html);
                aiPreviews.push({ url: `http://localhost:3005/mockups/${filename}`, code: html });
            }
        }

        // 2) Bare HTML elements (e.g., <div ...>...</div>, <svg ...>...</svg>) that are not inside fenced blocks
        // Replace fenced blocks with placeholders to avoid double-detection
        let residualText = outputText.replace(fencedRegex, '___FENCED_BLOCK_PLACEHOLDER___');
        const bareHtmlRegex = /<(div|svg|section|article|aside|main|nav|header|footer|table|form|ul|ol|li)(\s[^>]*)?>[\s\S]*?<\/\1>/gi;
        let bareMatch;
        while ((bareMatch = bareHtmlRegex.exec(residualText)) !== null) {
            const fullHtml = bareMatch[0];
            if (fullHtml.includes('___FENCED_BLOCK_PLACEHOLDER___')) continue; // skip placeholder
            // Heuristic: likely a widget if it has a style attribute (reduces false positives)
            if (!/(style|class)=/i.test(fullHtml)) continue;
            const filename = `preview-${crypto.randomUUID().slice(0, 8)}.html`;
            const fullPath = path.join(MOCKUPS_DIR, filename);
            let html = fullHtml;
            if (!fullHtml.toLowerCase().includes('<!doctype') && !fullHtml.toLowerCase().includes('<html>')) {
                html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background: #0c0c0c; color: white; font-family: sans-serif; padding: 20px; }
    </style>
</head>
<body>
    ${fullHtml}
</body>
</html>`;
            }
            fs.writeFileSync(fullPath, html);
            aiPreviews.push({ url: `http://localhost:3005/mockups/${filename}`, code: html });
        }

        // Merge user and AI previews
        const mergedPreviews = [...userPreviews, ...aiPreviews];

        // Backward compatibility fields point to first merged preview
        previewUrl = mergedPreviews[0]?.url || null;
        previewCode = mergedPreviews[0]?.code || null;

        // Add Pi's response to history
        const piResponse = {
            id: `pi-${Date.now()}`,
            role: 'assistant',
            text: outputText,
            reasoning: reasoning,
            time: Date.now(),
            ...(mergedPreviews.length > 0 && { previews: mergedPreviews }),
            previewUrl,
            previewCode
        };
        // If a calendar action was performed, prepend confirmation to the response
        if (calendarResult && calendarResult.success) {
            piResponse.text = `📅 *Calendar Update*\n${calendarResult.summary}\n\n${piResponse.text}`;
            piResponse.calendarResult = calendarResult;
        }
        history.push(piResponse);

        // Keep history manageable (last 50 messages)
        if (history.length > 50) {
            chatHistories[agentId] = history.slice(-50);
        }

        res.json({
            success: true,
            userMessage,
            piResponse,
            history: history
        });

    } catch (error) {
        console.error('Error calling OpenClaw Gateway:', error);

        // Add error message to history
        const errorResponse = {
            id: `pi-${Date.now()}`,
            role: 'assistant',
            text: `The aether is turbulent... I couldn't reach the gateway. (${error.message})`,
            time: Date.now(),
            isError: true
        };
        history.push(errorResponse);

        res.status(500).json({
            success: false,
            error: error.message,
            piResponse: errorResponse,
            history: history
        });
    }
});

// Clear chat history (per agent)
app.delete('/api/pi/chat', (req, res) => {
    let agentId = req.query.agentId;
    if (Array.isArray(agentId)) agentId = agentId[0];
    if (!agentId) agentId = 'dashboard';
    const initialMessage = { id: 'system-welcome', role: 'assistant', text: 'The bridge is open, Grand Architect. How may I assist you?', time: Date.now() };
    chatHistories[agentId] = [initialMessage];
    res.json({ success: true, history: chatHistories[agentId] });
});

// ============================================
// Piper TTS Configuration
// ============================================
const PIPER_PATH = process.env.PIPER_PATH || path.join(process.cwd(), 'piper.exe');
const PIPER_VOICE = process.env.PIPER_VOICE || ''; // e.g., 'D:\tools\piper\voices\en_GB\en_GB-aru-medium.onnx'

// Voice mapping from frontend voice names to Piper model paths
const PIPER_VOICE_MAP = {
    'nova': '',        // Not used - we'll use PIPER_VOICE directly
    'serene': '',
    'aria': '',
    'knight': ''
    // Actually we'll use the PIPER_VOICE env var as the single voice
};

// ============================================
// Voice TTS API (QWEN 3 Integration + Piper Local)
// ============================================
app.post('/api/pi/voice/tts', async (req, res) => {
    const { text, voice = 'nova' } = req.body;
    if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text is required' });
    }

    try {
        const audioDir = path.join(process.cwd(), 'apps', 'voice-assistant', 'audios');
        if (!fs.existsSync(audioDir)) {
            fs.mkdirSync(audioDir, { recursive: true });
        }

        const filename = `tts-${crypto.randomUUID().slice(0, 8)}.wav`;
        const audioPath = path.join(audioDir, filename);
        const audioUrl = `/apps/voice-assistant/audios/${filename}`;

        // Priority 1: Piper Local (if configured)
        const piperExe = PIPER_PATH;
        const piperVoice = PIPER_VOICE;
        if (piperExe && fs.existsSync(piperExe) && piperVoice && fs.existsSync(piperVoice)) {
            console.log(`[Piper] Generating TTS with voice: ${piperVoice}`);

            // Piper command: piper.exe -m <model.onnx> -f <output.wav> -- "text"
            const piperProcess = spawn(piperExe, [
                '-m', piperVoice,
                '-f', audioPath,
                '--',
                text
            ]);

            // Capture stderr for debugging
            let stderr = '';
            piperProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            // Promise to wait for process exit
            await new Promise((resolve, reject) => {
                piperProcess.on('close', (code) => {
                    if (code === 0) {
                        console.log('[Piper] TTS generation successful');
                        resolve();
                    } else {
                        const err = new Error(`Piper exited with code ${code}`);
                        err.stderr = stderr;
                        reject(err);
                    }
                });
                piperProcess.on('error', (err) => {
                    reject(err);
                });
            });

            // Estimate duration: roughly 2.5 chars per second (same as before)
            const estimatedDuration = Math.max(1, Math.ceil(text.length / 2.5));

            return res.json({
                success: true,
                audioUrl,
                duration: estimatedDuration,
                voice,
                textLength: text.length,
                engine: 'piper'
            });
        }

        // Priority 2: DashScope API (if key configured)
        const dashScopeKey = process.env.DASHSCOPE_API_KEY;
        if (dashScopeKey) {
            console.log('[DashScope] Generating TTS via cloud API');

            // Map voice to DashScope voice ID
            const voiceMap = {
                'nova': 'miranda',
                'serene': 'steffan',
                'aria': 'amy',
                'knight': 'joshua'
            };
            const dashVoice = voiceMap[voice] || 'miranda';

            const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/audio/tts/synthesize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${dashScopeKey}`
                },
                body: JSON.stringify({
                    model: 'sambert-tts-v1',
                    input: {
                        text: text
                    },
                    parameters: {
                        voice: dashVoice,
                        format: 'mp3',
                        sample_rate: 24000
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('DashScope TTS error:', response.status, errorText);
                throw new Error(`DashScope API error: ${response.status}`);
            }

            const buffer = Buffer.from(await response.arrayBuffer());
            fs.writeFileSync(audioPath, buffer);

            // Estimate duration
            const estimatedDuration = Math.max(1, Math.ceil(text.length / 2.5));

            res.json({
                success: true,
                audioUrl,
                duration: estimatedDuration,
                voice,
                textLength: text.length,
                engine: 'dashscope'
            });
            return;
        }

        // Fallback: silent/no TTS
        console.warn('No TTS engine configured. Set PIPER_PATH/PIPER_VOICE or DASHSCOPE_API_KEY');
        fs.writeFileSync(audioPath, Buffer.from(''), 'utf8');
        const estimatedDuration = Math.max(1, Math.ceil(text.length / 2.5));
        return res.json({
            success: true,
            audioUrl,
            duration: estimatedDuration,
            voice,
            textLength: text.length,
            fallback: true,
            engine: 'none'
        });

    } catch (error) {
        console.error('TTS generation error:', error);
        res.status(500).json({ error: 'Failed to generate speech', details: error.message });
    }
});

// ============================================
// Van Fund & Contribution API
// ============================================

app.get('/api/pi/van-fund', (req, res) => {
    res.json(vanFundData);
});

app.post('/api/pi/van-fund/add', (req, res) => {
    const { amount, reason } = req.body;
    if (!amount) return res.status(400).json({ error: 'Amount is required' });

    vanFundData.current += Number(amount);
    vanFundData.contributions.unshift({
        amount,
        reason,
        time: Date.now()
    });

    res.json({ success: true, data: vanFundData });
});

app.get('/api/pi/github-activity', async (req, res) => {
    try {
        if (!GITHUB_TOKEN) {
            return res.json(githubActivity);
        }

        const query = `
          query {
            viewer {
              contributionsCollection {
                contributionCalendar {
                  totalContributions
                  weeks {
                    contributionDays {
                      contributionCount
                      date
                    }
                  }
                }
              }
            }
          }
        `;

        const response = await fetch('https://api.github.com/graphql', {
            method: 'POST',
            headers: {
                'Authorization': `bearer ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'User-Agent': 'OpenClaw-Dashboard'
            },
            body: JSON.stringify({ query })
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const result = await response.json();
        const calendar = result.data.viewer.contributionsCollection.contributionCalendar;

        // Transform into the format expected by the frontend
        const dailyHistory = {};
        calendar.weeks.forEach(week => {
            week.contributionDays.forEach(day => {
                dailyHistory[day.date] = day.contributionCount;
            });
        });

        res.json({
            totalContributions: calendar.totalContributions,
            dailyHistory
        });
    } catch (error) {
        console.error('Error fetching GitHub activity:', error);
        res.json(githubActivity); // Fallback to manual storage
    }
});

app.post('/api/pi/github-activity/log', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    githubActivity.totalContributions += 1;
    githubActivity.dailyHistory[today] = (githubActivity.dailyHistory[today] || 0) + 1;

    res.json({ success: true, data: githubActivity });
});

// Snippets API
app.get('/api/snippets', (req, res) => {
    res.json(loadSnippets());
});

app.post('/api/snippets', (req, res) => {
    const snippets = req.body;
    saveSnippetsData(snippets);
    res.json({ success: true });
});

// ============================================
// Todo/Status API
// ============================================

/**
 * Parse YAML frontmatter from markdown content
 */
const parseFrontmatter = (content) => {
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return {};

    const yaml = frontmatterMatch[1];
    const result = {};

    // Simple YAML parser for our known fields
    const lines = yaml.split('\n');
    for (const line of lines) {
        const match = line.match(/^(\w+):\s*(.+?)(?:\s*#.*)?$/);
        if (match) {
            let [, key, value] = match;
            // Remove quotes and parse values
            value = value.replace(/^["']|["']$/g, '').trim();
            if (value === 'null' || value === '') result[key] = null;
            else if (value === 'true') result[key] = true;
            else if (value === 'false') result[key] = false;
            else if (/^\d+$/.test(value)) result[key] = parseInt(value, 10);
            else result[key] = value;
        }
    }

    return result;
};

/**
 * Parse tasks from markdown content
 */
const parseTasks = (content) => {
    const tasks = {
        inProgress: [],
        blocked: [],
        completed: [],
        backlog: []
    };

    // Task regex: matches [ ], [/], [x], [!] format
    const taskRegex = /^[-*]\s*\[([x\/! ])\]\s*(?:#(\d+)\s+)?(.+?)(?:\s*`@(agent|human)`)?(?:\s*`~([^`]+)`)?(?:\s*`([^`]+)`)*\s*(?:✓(\d{4}-\d{2}-\d{2}))?$/gm;

    // Find section boundaries
    const sections = {
        inProgress: /### In Progress\s*\n([\s\S]*?)(?=###|## |$)/,
        blocked: /### Blocked\s*\n([\s\S]*?)(?=###|## |$)/,
        completed: /## ✅ Completed[^\n]*\n([\s\S]*?)(?=## |$)/,
        backlog: /## 📋 Backlog\s*\n([\s\S]*?)(?=## |$)/,
        todo: /### Todo\s*\n([\s\S]*?)(?=###|## |$)/
    };

    let match;

    // Parse In Progress section
    const inProgressMatch = content.match(sections.inProgress);
    if (inProgressMatch) {
        while ((match = taskRegex.exec(inProgressMatch[1])) !== null) {
            tasks.inProgress.push({
                id: match[2] || null,
                text: match[3].trim(),
                status: 'in-progress',
                assignee: match[4] || null,
                estimate: match[5] || null,
                tags: match[6] ? [match[6]] : []
            });
        }
    }

    // Parse Blocked section
    const blockedMatch = content.match(sections.blocked);
    if (blockedMatch) {
        taskRegex.lastIndex = 0;
        while ((match = taskRegex.exec(blockedMatch[1])) !== null) {
            tasks.blocked.push({
                id: match[2] || null,
                text: match[3].trim(),
                status: 'blocked',
                assignee: match[4] || null,
                estimate: match[5] || null,
                tags: match[6] ? [match[6]] : []
            });
        }
    }

    // Parse Completed section
    const completedMatch = content.match(sections.completed);
    if (completedMatch) {
        taskRegex.lastIndex = 0;
        while ((match = taskRegex.exec(completedMatch[1])) !== null) {
            tasks.completed.push({
                id: match[2] || null,
                text: match[3].trim(),
                status: 'done',
                assignee: match[4] || null,
                estimate: match[5] || null,
                tags: match[6] ? [match[6]] : [],
                completedAt: match[7] || null
            });
        }
    }

    // Parse Todo section (goes to backlog)
    const todoMatch = content.match(sections.todo);
    if (todoMatch) {
        taskRegex.lastIndex = 0;
        while ((match = taskRegex.exec(todoMatch[1])) !== null) {
            tasks.backlog.push({
                id: match[2] || null,
                text: match[3].trim(),
                status: 'todo',
                assignee: match[4] || null,
                estimate: match[5] || null,
                tags: match[6] ? [match[6]] : []
            });
        }
    }

    // Parse Backlog section
    const backlogMatch = content.match(sections.backlog);
    if (backlogMatch) {
        taskRegex.lastIndex = 0;
        while ((match = taskRegex.exec(backlogMatch[1])) !== null) {
            tasks.backlog.push({
                id: match[2] || null,
                text: match[3].trim(),
                status: 'todo',
                assignee: match[4] || null,
                estimate: match[5] || null,
                tags: match[6] ? [match[6]] : []
            });
        }
    }

    return tasks;
};

/**
 * Parse a todo.md file and return structured data
 */
const parseTodoFile = (filePath) => {
    try {
        if (!fs.existsSync(filePath)) return null;

        const content = fs.readFileSync(filePath, 'utf8');
        const frontmatter = parseFrontmatter(content);
        const tasks = parseTasks(content);

        const totalTasks = tasks.inProgress.length + tasks.blocked.length + tasks.completed.length + tasks.backlog.length;
        const completedCount = tasks.completed.length;
        const progressPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

        return {
            metadata: {
                project: frontmatter.project || null,
                version: frontmatter.version || null,
                status: frontmatter.status || 'active',
                priority: frontmatter.priority || 'medium',
                health: frontmatter.health ?? 100,
                lastUpdated: frontmatter.last_updated || null,
                agentSession: frontmatter.agent_session || null
            },
            inProgress: tasks.inProgress,
            blocked: tasks.blocked,
            completed: tasks.completed,
            backlog: tasks.backlog,
            totalTasks,
            completedCount,
            progressPercent
        };
    } catch (error) {
        console.error(`Error parsing todo file ${filePath}:`, error);
        return null;
    }
};

// Get todo data for a specific app
app.get('/api/todo/:appId', (req, res) => {
    const { appId } = req.params;
    const { directory } = req.query;

    if (!directory) {
        return res.status(400).json({ error: 'Directory is required' });
    }

    const todoPath = path.join(directory, 'todo.md');
    const todoData = parseTodoFile(todoPath);

    if (!todoData) {
        return res.status(404).json({ error: 'No todo.md found' });
    }

    res.json(todoData);
});

// Get todos for multiple apps at once
app.post('/api/todos', (req, res) => {
    const { apps } = req.body;

    if (!Array.isArray(apps)) {
        return res.status(400).json({ error: 'Apps array is required' });
    }

    const results = {};

    for (const app of apps) {
        if (app.directory) {
            const todoPath = path.join(app.directory, 'todo.md');
            results[app.id] = parseTodoFile(todoPath);
        }
    }

    res.json(results);
});

// ============================================
// Dashboard Global Todo Board API
// ============================================

const TODO_DASHBOARD_FILE = path.join(process.cwd(), 'todo.md');

function parseDashboardTodo(content) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/m;
    const frontmatterMatch = content.match(frontmatterRegex);
    let frontmatter = '';
    let body = content;
    if (frontmatterMatch) {
        frontmatter = frontmatterMatch[1];
        body = content.slice(frontmatterMatch[0].length);
    }

    const lines = body.split('\n');
    const sections = [];
    let currentSection = null;
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const headingMatch = line.match(/^(#+)\s+(.+)$/);
        if (headingMatch) {
            currentSection = { title: line, tasks: [] };
            sections.push(currentSection);
            i++;
            continue;
        }

        if (line.trim() === '[task]') {
            let blockLines = [];
            i++;
            while (i < lines.length && lines[i].trim() !== '[/task]') {
                blockLines.push(lines[i]);
                i++;
            }
            if (blockLines.length > 0 && currentSection) {
                const task = parseTaskBlock(blockLines.join('\n'));
                if (task) {
                    task.order = currentSection.tasks.length;
                    currentSection.tasks.push(task);
                }
            }
            i++; // skip [/task]
            continue;
        }

        i++;
    }

    return { frontmatter, sections };
}

function parseTaskBlock(blockText) {
    const lines = blockText.split('\n').filter(l => l.trim() !== '');
    const task = {};
    for (const line of lines) {
        const m = line.match(/^(\w+):\s*(.+)$/);
        if (!m) continue;
        let key = m[1];
        let value = m[2].trim();

        switch (key) {
            case 'id':
                task.id = value;
                break;
            case 'title':
                task.title = value;
                break;
            case 'priority':
                task.priority = value;
                break;
            case 'tags':
                if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1);
                task.tags = value.split(',').map(t => t.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
                break;
            case 'estimate':
                task.estimate = value;
                break;
            case 'status':
                task.status = value;
                break;
            case 'created':
                task.created = value;
                break;
            case 'started':
                task.started = value;
                break;
            case 'completed':
                task.completed = value;
                break;
            case 'progress':
                task.progress = parseInt(value, 10);
                if (isNaN(task.progress)) task.progress = undefined;
                break;
            case 'assigned_to':
            case 'agent':
                task.assigned_to = value;
                break;
            case 'description':
                task.description = value;
                break;
            case 'results':
                task.results = value;
                break;
            case 'dependencies':
                if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1);
                task.dependencies = value.split(',').map(t => t.trim()).filter(Boolean);
                break;
        }
    }
    if (!task.id || !task.title || !task.status) return null;
    return task;
}

function writeDashboardTodo(data) {
    const { frontmatter, sections } = data;
    let content = '---\n' + frontmatter + '\n---\n\n';
    for (const section of sections) {
        content += section.title + '\n\n';
        for (const task of section.tasks) {
            content += '[task]\n';
            const fields = ['id', 'title', 'priority', 'tags', 'estimate', 'status', 'created', 'started', 'completed', 'progress', 'assigned_to', 'agent', 'description', 'results', 'dependencies'];
            for (const field of fields) {
                if (task[field] !== undefined && task[field] !== null && task[field] !== '') {
                    let v = task[field];
                    if (Array.isArray(v)) {
                        v = '[' + v.map(item => typeof item === 'string' && item.includes(' ') ? `"${item}"` : item).join(', ') + ']';
                    }
                    content += `${field}: ${v}\n`;
                }
            }
            content += '[/task]\n\n';
        }
        content += '\n';
    }
    return content;
}

function generateTodoId(sections) {
    let max = 0;
    for (const sec of sections) {
        for (const t of sec.tasks) {
            const num = parseInt(t.id, 10);
            if (!isNaN(num) && num > max) max = num;
        }
    }
    return String(max + 1).padStart(3, '0');
}

function findTaskIndex(sections, id) {
    for (let i = 0; i < sections.length; i++) {
        const idx = sections[i].tasks.findIndex(t => t.id === id);
        if (idx !== -1) return { sectionIndex: i, taskIndex: idx };
    }
    return null;
}

function loadTodoBoard() {
    try {
        if (!fs.existsSync(TODO_DASHBOARD_FILE)) return { frontmatter: '', sections: [] };
        const content = fs.readFileSync(TODO_DASHBOARD_FILE, 'utf8');
        return parseDashboardTodo(content);
    } catch (e) {
        console.error('Error loading todo board:', e);
        return { frontmatter: '', sections: [] };
    }
}

function saveTodoBoard(data) {
    try {
        const content = writeDashboardTodo(data);
        const tempPath = TODO_DASHBOARD_FILE + '.tmp';
        fs.writeFileSync(tempPath, content, 'utf8');
        fs.renameSync(tempPath, TODO_DASHBOARD_FILE);
        return true;
    } catch (e) {
        console.error('Error saving todo board:', e);
        return false;
    }
}

// Dashboard Global Todo Board Endpoints

app.get('/api/pi/todos', (req, res) => {
    try {
        const data = loadTodoBoard();
        let total = 0, completed = 0;
        for (const sec of data.sections) {
            total += sec.tasks.length;
            completed += sec.tasks.filter(t => t.status === 'done').length;
        }
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        res.json({ sections: data.sections, totalTasks: total, completedCount: completed, progressPercent: progress });
    } catch (e) {
        console.error('Error fetching todos:', e);
        res.status(500).json({ error: 'Failed to fetch todos' });
    }
});

app.patch('/api/pi/todos/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    try {
        const data = loadTodoBoard();
        const found = findTaskIndex(data.sections, id);
        if (!found) return res.status(404).json({ success: false, error: 'Task not found' });
        const task = data.sections[found.sectionIndex].tasks[found.taskIndex];
        for (const key in updates) {
            if (['id', 'section', 'order'].includes(key)) continue;
            task[key] = updates[key];
        }
        if (!saveTodoBoard(data)) return res.status(500).json({ success: false, error: 'Save failed' });
        res.json({ success: true, task });
    } catch (e) {
        console.error('Error updating task:', e);
        res.status(500).json({ success: false, error: 'Update failed' });
    }
});

app.post('/api/pi/todos', (req, res) => {
    const taskData = req.body;
    try {
        const data = loadTodoBoard();
        const sectionTitle = taskData.section;
        if (!sectionTitle) return res.status(400).json({ success: false, error: 'Section title required' });
        let section = data.sections.find(s => s.title === sectionTitle);
        if (!section) return res.status(400).json({ success: false, error: 'Section not found' });
        const id = taskData.id || generateTodoId(data.sections);
        const now = new Date().toISOString();
        const newTask = {
            id,
            title: taskData.title,
            priority: taskData.priority || 'medium',
            tags: Array.isArray(taskData.tags) ? taskData.tags : [],
            estimate: taskData.estimate || undefined,
            status: taskData.status || 'todo',
            created: taskData.created || now,
            started: taskData.started || undefined,
            completed: taskData.completed || undefined,
            progress: taskData.progress || 0,
            assigned_to: taskData.assigned_to || undefined,
            agent: taskData.agent || taskData.assigned_to || undefined,
            description: taskData.description || undefined,
            results: taskData.results || undefined,
            dependencies: Array.isArray(taskData.dependencies) ? taskData.dependencies : undefined,
            order: section.tasks.length
        };
        section.tasks.push(newTask);
        if (!saveTodoBoard(data)) return res.status(500).json({ success: false, error: 'Save failed' });
        res.json({ success: true, task: newTask });
    } catch (e) {
        console.error('Error creating task:', e);
        res.status(500).json({ success: false, error: 'Create failed' });
    }
});

app.delete('/api/pi/todos/:id', (req, res) => {
    const { id } = req.params;
    try {
        const data = loadTodoBoard();
        const found = findTaskIndex(data.sections, id);
        if (!found) return res.status(404).json({ success: false, error: 'Task not found' });
        data.sections[found.sectionIndex].tasks.splice(found.taskIndex, 1);
        data.sections[found.sectionIndex].tasks.forEach((t, idx) => { t.order = idx; });
        if (!saveTodoBoard(data)) return res.status(500).json({ success: false, error: 'Save failed' });
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting task:', e);
        res.status(500).json({ success: false, error: 'Delete failed' });
    }
});

app.post('/api/pi/todos/:id/execute', async (req, res) => {
    const { id } = req.params;
    const { agent = 'pi', model, instructions } = req.body;
    try {
        const data = loadTodoBoard();
        const found = findTaskIndex(data.sections, id);
        if (!found) return res.status(404).json({ success: false, error: 'Task not found' });
        const task = data.sections[found.sectionIndex].tasks[found.taskIndex];
        if (task.status === 'done') return res.status(400).json({ success: false, error: 'Task already done' });
        const now = new Date().toISOString();
        task.status = 'in-progress';
        task.started = now;
        task.progress = 0;
        if (!task.results) task.results = '';
        task.results += `[${new Date().toLocaleString()}] Execution started with agent: ${agent}\n`;
        if (instructions) task.results += `Instructions: ${instructions}\n`;
        if (!saveTodoBoard(data)) return res.status(500).json({ success: false, error: 'Save failed' });

        // Spawn a background agent session (non-blocking, best-effort)
        let sessionId = null;
        try {
            const spawnResult = await spawnAgentSession(task, agent, model, instructions);
            if (spawnResult.success && spawnResult.sessionId) {
                sessionId = spawnResult.sessionId;
                task.results += `[${new Date().toLocaleString()}] Agent session spawned: ${sessionId}\n`;
                // Save the updated results with session ID
                saveTodoBoard(data);
            } else {
                console.warn(`Failed to spawn agent session for task ${id}:`, spawnResult.error);
                task.results += `[${new Date().toLocaleString()}] Agent spawn warning: ${spawnResult.error || 'unknown error'}\n`;
                saveTodoBoard(data);
            }
        } catch (spawnError) {
            console.error('Error spawning agent session:', spawnError);
            task.results += `[${new Date().toLocaleString()}] Agent spawn error: ${spawnError.message || spawnError}\n`;
            saveTodoBoard(data);
        }

        res.json({ success: true, task, agent, model, sessionId });
    } catch (e) {
        console.error('Error executing task:', e);
        res.status(500).json({ success: false, error: 'Execution failed' });
    }
});

app.post('/api/pi/todos/:id/log', (req, res) => {
    const { id } = req.params;
    const { log } = req.body;
    try {
        const data = loadTodoBoard();
        const found = findTaskIndex(data.sections, id);
        if (!found) return res.status(404).json({ success: false, error: 'Task not found' });
        const task = data.sections[found.sectionIndex].tasks[found.taskIndex];
        if (!task.results) task.results = '';
        task.results += `[${new Date().toLocaleString()}] ${log}\n`;
        if (!saveTodoBoard(data)) return res.status(500).json({ success: false, error: 'Save failed' });
        res.json({ success: true });
    } catch (e) {
        console.error('Error appending log:', e);
        res.status(500).json({ success: false, error: 'Log failed' });
    }
});

app.get('/api/pi/todos/agent/types', (req, res) => {
    res.json([
        { id: 'dashboard', name: 'Dashboard Agent', description: 'Primary assistant for dashboard interactions' },
        { id: 'pi', name: 'Pi (Main Agent)', description: 'The primary assistant with full tool access' },
        { id: 'coding', name: 'Coding Specialist', description: 'Focused on software development tasks' },
        { id: 'research', name: 'Research Agent', description: 'Web search and information synthesis' }
    ]);
});

// ============================================
// Projects API
// ============================================

app.get('/api/pi/projects', (req, res) => {
    try {
        const projectsDir = path.join(PI_ROOT, 'projects');
        const projects = [];

        if (fs.existsSync(projectsDir)) {
            const folders = fs.readdirSync(projectsDir).filter(f => {
                const p = path.join(projectsDir, f);
                return fs.statSync(p).isDirectory() && !f.startsWith('.');
            });

            for (const folder of folders) {
                const projectPath = path.join(projectsDir, folder);
                const todoPath = path.join(projectPath, 'todo.md');
                let hasTodo = false;
                let projectTasks = [];

                if (fs.existsSync(todoPath)) {
                    hasTodo = true;
                    try {
                        const todoData = parseTodoFile(todoPath);
                        if (todoData) {
                            // Flatten tasks from all sections into a unified list
                            const flatten = (tasks, section) => tasks.map(t => ({
                                id: t.id || `${section}-${t.id || Math.random().toString(36).substr(2, 9)}`,
                                title: t.text,
                                status: t.status || (section === 'inProgress' ? 'in-progress' : section === 'backlog' ? 'todo' : section === 'blocked' ? 'blocked' : 'done'),
                                agent: t.assignee,
                                priority: 'medium',
                                section
                            }));
                            projectTasks = [
                                ...flatten(todoData.inProgress, 'inProgress'),
                                ...flatten(todoData.blocked, 'blocked'),
                                ...flatten(todoData.completed, 'completed'),
                                ...flatten(todoData.backlog, 'backlog')
                            ];
                        }
                    } catch (e) {
                        console.warn(`Failed to parse todo.md for project ${folder}:`, e);
                    }
                }

                projects.push({
                    id: folder.toLowerCase().replace(/\s+/g, '-'),
                    name: folder,
                    path: projectPath,
                    hasTodo,
                    tasks: projectTasks
                });
            }
        }

        res.json({ projects });
    } catch (e) {
        console.error('Error fetching projects:', e);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', services: runningProcesses.size });
});

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🪼  JellyLaunch Backend Server                         ║
║                                                          ║
║   Running on http://localhost:${PORT}                       ║
║   Ready to manage your services...                       ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`);
});

// Cleanup on exit — kill all child processes and release port 3005
const gracefulShutdown = (signal) => {
    console.log(`\n\n🧹 Received ${signal} — shutting down all services...`);
    for (const [id, { process: proc }] of runningProcesses) {
        console.log(`   Stopping [${id}]...`);
        try {
            if (process.platform === 'win32') {
                spawn('taskkill', ['/pid', proc.pid.toString(), '/f', '/t'], { shell: true });
            } else {
                proc.kill('SIGTERM');
            }
        } catch (e) {
            // Process may already be dead
        }
    }
    setTimeout(() => process.exit(0), 500);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Windows-specific: detect when parent process (concurrently) dies
// When the parent exits, stdin closes — we use that as a shutdown signal
if (process.platform === 'win32') {
    process.stdin.resume();
    process.stdin.on('end', () => gracefulShutdown('stdin-close'));
}
