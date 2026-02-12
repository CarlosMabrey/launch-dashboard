// GenAI Service — talks to the dashboard server which proxies to ComfyUI

const API_BASE = 'http://localhost:3005/api/pi';

export interface GenAIConfig {
  workflows: Record<string, GenAIWorkflowDefinition>;
}

export interface GenAIWorkflowDefinition {
  id: string;
  name: string;
  file?: string; // not present if using modes only
  modes?: Record<string, string>;
  default?: string;
  description?: string;
  icon?: string;
  features?: Array<{
    id: string;
    label: string;
    default: boolean;
    type: 'parameter' | 'bypass';
    target?: string;
    nodes?: string[];
    fallback?: any;
  }>;
}

export async function getGenAIConfig(): Promise<GenAIConfig> {
  const response = await fetch(`${API_BASE}/genai/config`);
  if (!response.ok) throw new Error('Failed to fetch GenAI config');
  return response.json();
}

export async function getGenAIStatus(): Promise<{ connected: boolean; stats?: any; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/genai/status`);
    if (!response.ok) return { connected: false };
    return response.json();
  } catch {
    return { connected: false };
  }
}

export async function getGenAIWorkflowFile(filePath: string): Promise<any> {
  const response = await fetch(`${API_BASE}/genai/workflow?file=${encodeURIComponent(filePath)}`);
  if (!response.ok) throw new Error(`Workflow file not found: ${filePath}`);
  return response.json();
}

export async function getGenAIModels(type: string, engine: 'comfy' | 'forge' = 'comfy'): Promise<string[]> {
  const url = engine === 'forge'
    ? `${API_BASE}/forge/models?type=${encodeURIComponent(type)}`
    : `${API_BASE}/genai/models?type=${encodeURIComponent(type)}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${type} models`);
  return response.json();
}

export async function uploadGenAIImage(file: File): Promise<{ name: string }> {
  const reader = new FileReader();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const response = await fetch(`${API_BASE}/genai/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, base64: dataUrl })
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Upload failed: ${err}`);
  }
  return response.json();
}

export async function queueGenAIWorkflow(workflow: any, clientId?: string): Promise<{ prompt_id: string }> {
  const response = await fetch(`${API_BASE}/genai/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workflow, clientId })
  });
  if (!response.ok) {
    const errText = await response.text();
    let errMsg = errText;
    try {
      const errJson = JSON.parse(errText);
      if (errJson.error && errJson.node_errors) {
        // Format ComfyUI validation errors nicely
        const details = Object.entries(errJson.node_errors || {})
          .map(([nodeId, errs]: [string, any]) => `Node ${nodeId}: ${errs.errors && errs.errors.map((e: any) => e.message).join(', ') || 'Validation error'}`)
          .join('\n');
        errMsg = `${errJson.error.message || 'Workflow Validation Failed'}\n${details}`;
      } else if (errJson.message) {
        errMsg = errJson.message;
      }
    } catch {
      // Not JSON, use text
    }
    throw new Error(`Queue failed: ${errMsg}`);
  }
  return response.json();
}

export async function getGenAIHistory(): Promise<any> {
  const response = await fetch(`${API_BASE}/genai/history`);
  if (!response.ok) throw new Error('Failed to fetch history');
  return response.json();
}

export function getGenAIOutputUrl(filename: string, type?: string, subfolder?: string): string {
  const params = new URLSearchParams({ filename });
  if (type) params.set('type', type);
  if (subfolder) params.set('subfolder', subfolder);
  return `${API_BASE}/genai/view?${params.toString()}`;
}

export function connectGenAIWebSocket(
  clientId: string,
  onMessage: (data: any) => void,
  onClose?: () => void,
  onError?: (err: Event) => void
): WebSocket | null {
  try {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProtocol}//localhost:3005/api/pi/genai/ws?clientId=${clientId}`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (e) {
        // Non-JSON message (binary preview data), ignore
      }
    };

    ws.onclose = () => {
      onClose?.();
    };

    ws.onerror = (err) => {
      onError?.(err);
    };

    return ws;
  } catch (e) {
    console.error('[GenAI WS] Connection failed:', e);
    return null;
  }
}

export async function listUserGenAIWorkflows(): Promise<Array<{ fileName: string; content: any }>> {
  const response = await fetch(`${API_BASE}/genai/user-workflows`);
  if (!response.ok) throw new Error('Failed to fetch user workflows');
  return response.json();
}

export async function saveUserGenAIWorkflow(data: { name: string; content: any }): Promise<{ success: boolean; fileName?: string }> {
  const response = await fetch(`${API_BASE}/genai/user-workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return response.json();
}

export async function deleteUserGenAIWorkflow(name: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/genai/user-workflows/${encodeURIComponent(name)}`, {
    method: 'DELETE'
  });
  return response.json();
}

// ─── WebUI Forge Neo API ──────────────────────────────────────────────────

export async function getForgeStatus(): Promise<{ online: boolean; apiEnabled?: boolean }> {
  try {
    const response = await fetch(`${API_BASE}/forge/status`);
    if (!response.ok) return { online: false };
    return response.json();
  } catch {
    return { online: false };
  }
}

export async function getForgeModels(type?: string): Promise<string[]> {
  const url = type ? `${API_BASE}/forge/models?type=${encodeURIComponent(type)}` : `${API_BASE}/forge/models`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch Forge models');
  return response.json();
}

export async function getForgeSamplers(): Promise<string[]> {
  const response = await fetch(`${API_BASE}/forge/samplers`);
  if (!response.ok) throw new Error('Failed to fetch Forge samplers');
  return response.json();
}

export async function getForgeSchedulers(): Promise<string[]> {
  const response = await fetch(`${API_BASE}/forge/schedulers`);
  if (!response.ok) throw new Error('Failed to fetch Forge schedulers');
  return response.json();
}

export async function queueForgeTxt2Img(payload: any): Promise<{ images: string[]; info: string }> {
  const response = await fetch(`${API_BASE}/forge/txt2img`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Forge txt2img failed: ${err}`);
  }
  return response.json();
}

export async function queueForgeImg2Img(payload: any): Promise<{ images: string[]; info: string }> {
  const response = await fetch(`${API_BASE}/forge/img2img`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Forge img2img failed: ${err}`);
  }
  return response.json();
}

export async function getForgeProgress(): Promise<{ progress: number; ETA: number; state?: any }> {
  try {
    const response = await fetch(`${API_BASE}/forge/progress`);
    if (!response.ok) throw new Error('Failed to fetch Forge progress');
    return response.json();
  } catch {
    return { progress: 0, ETA: 0 };
  }
}

export interface MemoryStats {
  vram_used: number;
  vram_total: number;
  loaded_models: string[];
}

export async function getMemoryStats(): Promise<MemoryStats> {
  try {
    const response = await fetch(`${API_BASE}/genai/memory`);
    if (!response.ok) return { vram_used: 0, vram_total: 0, loaded_models: [] };
    return await response.json();
  } catch {
    return { vram_used: 0, vram_total: 0, loaded_models: [] };
  }
}

export async function unloadModels(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/genai/unload`, { method: 'POST' });
    const data = await response.json();
    return data.success;
  } catch {
    return false;
  }
}

export function validateWorkflowInputs(uiInputs: any[], values: Record<string, any>): string[] {
  const errors: string[] = [];
  for (const input of uiInputs) {
    // Skip inputs that are not visible (hidden from UI)
    if (input.visible === false) continue;
    if (!input.optional && (values[input.key] === undefined || values[input.key] === null || values[input.key] === '')) {
      errors.push(`Missing required input: ${input.label || input.key}`);
    }
    if (input.type === 'NUMBER' && values[input.key] !== undefined) {
      const val = Number(values[input.key]);
      if (isNaN(val)) errors.push(`Invalid number for ${input.label || input.key}`);
    }
  }
  return errors;
}
