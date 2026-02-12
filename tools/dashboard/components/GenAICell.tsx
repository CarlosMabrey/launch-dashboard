import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  getGenAIConfig,
  getGenAIModels,
  getGenAIStatus,
  getGenAIWorkflowFile,
  uploadGenAIImage,
  queueGenAIWorkflow,
  getGenAIOutputUrl,
  getGenAIHistory,
  connectGenAIWebSocket,
  saveUserGenAIWorkflow,
  listUserGenAIWorkflows,
  deleteUserGenAIWorkflow,
  getForgeStatus,
  getForgeModels,
  getForgeSamplers,
  getForgeSchedulers,
  queueForgeTxt2Img,
  queueForgeImg2Img,
  getForgeProgress,
  validateWorkflowInputs,
  getMemoryStats,
  unloadModels,
  MemoryStats,
  GenAIWorkflowDefinition,
  GenAIConfig
} from '../services/genaiService';
import { convertGraphToApi, parameterizeWorkflow } from '../utils/comfyConverter';
import { GenAILoraSelector, LoraConfig } from './GenAILoraSelector';

const API_BASE = 'http://localhost:3005/api/pi';

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Extract UI-configurable inputs from a workflow JSON */
export interface UiInputConfig {
  key: string;
  type: string;
  label: string;
  target?: string; // path.to.prop
  options?: string[];
  default?: any;
  visible?: boolean;
  min?: number;
  max?: number;
  step?: number;
}

/** Extract UI-configurable inputs from a workflow JSON */
function getWorkflowUiInputs(workflowContent: any): UiInputConfig[] {
  if (!workflowContent) return [];

  // Check for explicit __ui.inputs metadata
  if (workflowContent?.__ui?.inputs && Array.isArray(workflowContent.__ui.inputs)) {
    return workflowContent.__ui.inputs
      .filter((i: any) => i && (i.key || i.target))
      .map((i: any) => ({
        key: String(i.key || i.target || ''),
        type: String(i.type || 'TEXT'),
        label: String(i.label || i.key || i.target || ''),
        target: i.target,
        options: i.options,
        default: i.default,
        visible: i.visible !== false, // Default to true if not specified
        min: i.min,
        max: i.max,
        step: i.step
      }));
  }

  // Fallback: scan for {{PLACEHOLDER|TYPE}} tokens
  const found: any[] = [];
  const seen = new Set<string>();

  try {
    const str = JSON.stringify(workflowContent);
    const matches = str.matchAll(/{{(.*?)}}/g);
    for (const match of matches) {
      const full = String(match[1] || '').trim();
      if (!full || seen.has(full)) continue;
      seen.add(full);

      const parts = full.split('|');
      const key = parts[0].trim();
      const explicitType = parts[1] ? parts[1].trim() : null;

      // HEURISTIC: Auto-detect type if not explicit
      let type = explicitType || 'TEXT';
      if (!explicitType) {
        const upper = key.toUpperCase();
        if (upper.includes('IMAGE')) type = 'IMAGE';
        else if (upper.includes('PROMPT')) type = 'PROMPT';
        else if (upper.includes('SEED') || upper.includes('STEPS') || upper.includes('CFG') || upper.includes('WIDTH') || upper.includes('HEIGHT')) type = 'NUMBER';
        else if (upper.includes('MODEL') || upper.includes('UNET') || upper.includes('VAE')) type = 'MODEL';
      }

      found.push({
        key,
        type,
        label: key.replace(/_/g, ' '),
        visible: true,
      });
    }
  } catch (e) {
    console.error('[GenAI] Error parsing workflow for inputs:', e);
  }

  return found;
}

/** Apply template values to a workflow (replace {{KEY}} tokens and apply targeted inputs) */
function applyTemplate(workflow: any, params: Record<string, any>, uiInputs: any[]): any {
  const cloned = JSON.parse(JSON.stringify(workflow));

  // 1. Apply targeted inputs (direct node property mapping)
  uiInputs.forEach(inp => {
    if (inp.target && params[inp.key] !== undefined) {
      const parts = inp.target.split('.');
      let current = cloned;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current = null;
          break;
        }
        current = current[parts[i]];
      }
      if (current && parts[parts.length - 1]) {
        current[parts[parts.length - 1]] = params[inp.key];
      }
    }
  });

  // 2. Replace {{KEY}} and {{KEY|TYPE}} tokens
  function replaceInObject(obj: any) {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        const val = obj[key];
        if (val.startsWith('{{') && val.endsWith('}}')) {
          const paramKey = val.slice(2, -2).split('|')[0];
          if (params[paramKey] !== undefined) {
            obj[key] = params[paramKey];
          }
        } else if (val.includes('{{')) {
          let newVal = val;
          for (const [pKey, pVal] of Object.entries(params)) {
            const regex = new RegExp(`\\{\\{${pKey}(\\|.*?)?\\}\\}`, 'g');
            newVal = newVal.replace(regex, String(pVal));
          }
          obj[key] = newVal;
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        replaceInObject(obj[key]);
      }
    }
  }

  replaceInObject(cloned);
  return cloned;
}

/** Process workflow features (bypass nodes / set parameters) */
function processWorkflowFeatures(
  workflow: any,
  featureStates: Record<string, boolean>,
  featureConfigs: any[]
) {
  featureConfigs.forEach((f: any) => {
    const isEnabled = featureStates[f.id] !== undefined ? featureStates[f.id] : f.default;

    if (f.type === 'parameter') {
      for (const node of Object.values(workflow) as any[]) {
        if (node?.inputs) {
          for (const [key, val] of Object.entries(node.inputs)) {
            if (val === `{{${f.target}}}`) {
              node.inputs[key] = isEnabled;
            }
          }
        }
      }
    } else if (f.type === 'bypass' && !isEnabled) {
      const { target_node, target_input, source_node, source_output = 0 } = f.fallback || {};
      if (workflow[target_node]) {
        workflow[target_node].inputs[target_input] = [source_node, source_output];
      }
      f.nodes?.forEach((nodeId: string) => {
        delete workflow[nodeId];
      });
    }
  });
}

// ─── Inpainting Helpers ───────────────────────────────────────────────────────
/** Generate a simple rectangular mask as base64 PNG */
function generateSimpleMask(width: number, height: number, segment: string): string {
  // Create a canvas to draw the mask
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Fill with black (no change)
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, width, height);

  // Define mask region based on segment type (white = area to regenerate)
  ctx.fillStyle = 'white';
  let x = 0, y = 0, w = width, h = height;

  switch (segment) {
    case 'Upper-clothes':
      // Upper body region (chest/shoulders area)
      y = Math.floor(height * 0.25);
      h = Math.floor(height * 0.35);
      x = Math.floor(width * 0.15);
      w = Math.floor(width * 0.7);
      break;
    case 'Lower-clothes':
      // Lower body region (hips/legs)
      y = Math.floor(height * 0.55);
      h = Math.floor(height * 0.4);
      x = Math.floor(width * 0.2);
      w = Math.floor(width * 0.6);
      break;
    case 'Dress':
      // Full body dress area
      y = Math.floor(height * 0.15);
      h = Math.floor(height * 0.7);
      x = Math.floor(width * 0.1);
      w = Math.floor(width * 0.8);
      break;
    case 'Hat':
      // Head region
      y = Math.floor(height * 0.05);
      h = Math.floor(height * 0.2);
      x = Math.floor(width * 0.25);
      w = Math.floor(width * 0.5);
      break;
    case 'Shoes':
      // Foot region
      y = Math.floor(height * 0.8);
      h = Math.floor(height * 0.15);
      x = Math.floor(width * 0.2);
      w = Math.floor(width * 0.6);
      break;
    default:
      // Default to center region
      x = Math.floor(width * 0.3);
      y = Math.floor(height * 0.3);
      w = Math.floor(width * 0.4);
      h = Math.floor(height * 0.4);
  }

  ctx.fillRect(x, y, w, h);

  // Return as base64 PNG (without data: prefix)
  return canvas.toDataURL('image/png').split(',')[1];
}

/** Upload a base64 image and return the server filename */
async function uploadBase64Image(base64: string, filename: string): Promise<{ name: string }> {
  const response = await fetch(`${API_BASE}/genai/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: filename,
      base64: `data:image/png;base64,${base64}`
    })
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Upload failed: ${err}`);
  }
  return response.json();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GenAICell() {
  const [config, setConfig] = useState<GenAIConfig | null>(null);
  const [workflowsList, setWorkflowsList] = useState<GenAIWorkflowDefinition[]>([]);
  const [selectedWfDef, setSelectedWfDef] = useState<GenAIWorkflowDefinition | null>(null);
  const [workflowContent, setWorkflowContent] = useState<any>(null);
  const [uiInputs, setUiInputs] = useState<UiInputConfig[]>([]);
  const [inputValues, setInputValues] = useState<Record<string, any>>({});
  const [uploadedImages, setUploadedImages] = useState<Record<string, File>>({});
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});
  const [activeLoras, setActiveLoras] = useState<LoraConfig[]>([]);
  const [isEditingJson, setIsEditingJson] = useState(false);
  const [rawJsonText, setRawJsonText] = useState('');
  const [featureStates, setFeatureStates] = useState<Record<string, boolean>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultIsVideo, setResultIsVideo] = useState(false);
  const [recentResults, setRecentResults] = useState<Array<{ url: string; isVideo: boolean; time: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [modelsCache, setModelsCache] = useState<Record<string, string[]>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isForgeConnected, setIsForgeConnected] = useState(false);
  const [isForgeApiEnabled, setIsForgeApiEnabled] = useState(false);
  // Engine is now derived from selectedWfDef
  const [clientId] = useState(() => 'dashboard-' + Math.random().toString(36).substring(2));
  const [importDragOver, setImportDragOver] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // New Features
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [eta, setEta] = useState<number | null>(null);
  const [forgeState, setForgeState] = useState<any>(null); // Job count, etc.

  // Derived Engine (based on selected mode key)
  const engine = selectedWfDef?.default?.toLowerCase() === 'forge' ? 'forge' : 'comfy';

  // Gallery navigation state
  const [selectedGalleryIndex, setSelectedGalleryIndex] = useState<number>(-1);

  const wsRef = useRef<WebSocket | null>(null);
  const promptIdRef = useRef<string | null>(null);
  const isRunningRef = useRef(false);
  const safetyTimeoutRef = useRef<any>(null);
  const pollIntervalRef = useRef<any>(null);

  // Helper to fetch result from history as a fallback/standard complete
  const checkForResult = async (promptId: string) => {
    try {
      console.log(`[GenAI] Checking result for prompt: ${promptId}`);
      const history = await getGenAIHistory();
      const promptData = history[promptId];

      if (!promptData) {
        const historyKeys = Object.keys(history);
        console.log(`[GenAI] Prompt ${promptId} not found in history. Available IDs (top 5):`, historyKeys.slice(0, 5));
        return false;
      }

      console.log(`[GenAI] Prompt data for ${promptId}:`, promptData);

      if (!promptData.outputs) {
        console.log(`[GenAI] Prompt ${promptId} has no outputs yet (status: ${promptData.status?.completed ? 'completed' : 'pending'})`);
        if (promptData.status?.completed) {
          setIsRunning(false);
          isRunningRef.current = false;
          setProgressText('Finished (No outputs)');

          if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

          return true;
        }
        return false;
      }

      // Unified Detection: find ANY result
      const allOutputs: any[] = [];
      for (const nodeOutput of Object.values(promptData.outputs)) {
        const no = nodeOutput as any;
        // Check standard 'images' or 'gifs' keys
        if (no?.images) allOutputs.push(...no.images);
        else if (no?.gifs) allOutputs.push(...no.gifs);
        else {
          // Fallback: search for any key that is an array and contains objects with 'filename'
          for (const val of Object.values(no)) {
            if (Array.isArray(val)) {
              for (const item of val) {
                if (item && typeof item === 'object' && item.filename) {
                  allOutputs.push(item);
                }
              }
            }
          }
        }
      }

      console.log(`[GenAI] Found ${allOutputs.length} output(s) for ${promptId}`);

      if (allOutputs.length > 0) {
        // Clear all timers on success
        if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

        const out = allOutputs[0];
        const isVid = out.filename?.match(/\.(mp4|webm|mov|gif)$/i);
        const url = getGenAIOutputUrl(out.filename, out.type, out.subfolder);
        setResultUrl(url);
        setResultIsVideo(!!isVid);
        setProgress(100);
        setProgressText('Complete!');
        setIsRunning(false);
        isRunningRef.current = false;
        setRecentResults(prev => [
          { url, isVideo: !!isVid, time: Date.now() },
          ...prev.filter(r => r.url !== url).slice(0, 11)
        ]);
        return true;
      } else if (promptData.status?.completed) {
        setIsRunning(false);
        isRunningRef.current = false;
        setProgressText('Complete (Other output types)');

        if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

        return true;
      }
    } catch (e) {
      console.error('Check result error:', e);
    }
    return false;
  };

  // ─── Connection Status ─────────────────────────────────────────────────────
  useEffect(() => {
    const checkStatus = async () => {
      const [comfyStatus, forgeStatus] = await Promise.all([
        getGenAIStatus(),
        getForgeStatus()
      ]);
      setIsConnected(comfyStatus.connected);
      setIsForgeConnected(forgeStatus.online);
      setIsForgeApiEnabled(!!(forgeStatus as any).apiEnabled);
    };
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // ─── Memory Stats Polling ──────────────────────────────────────────────────
  useEffect(() => {
    const checkMemory = async () => {
      const stats = await getMemoryStats();
      setMemoryStats(stats);
    };
    checkMemory();
    const interval = setInterval(checkMemory, 5000);
    return () => clearInterval(interval);
  }, []);

  // ─── WebSocket Connection ──────────────────────────────────────────────────
  useEffect(() => {
    const ws = connectGenAIWebSocket(
      clientId,
      (data) => {
        if (!data?.data?.prompt_id || data.data.prompt_id !== promptIdRef.current) return;

        if (data.type === 'progress') {
          const { value, max } = data.data;
          const percent = Math.round((value / max) * 100);
          setProgress(percent);
          setProgressText(`Processing: ${percent}%`);
          console.log(`[GenAI WS] Progress: ${percent}%`);
        }

        if (data.type === 'status') {
          console.log(`[GenAI WS] Status:`, data.data);
        }

        if (data.type === 'executing') {
          console.log(`[GenAI WS] Executing node: ${data.data.node}`);
          if (data.data.node) {
            setProgressText(`Node: ${data.data.node}`);
          } else {
            // Master signal: execution of the prompt is finished
            console.log(`[GenAI WS] Execution finished signal received for prompt: ${data.data.prompt_id || promptIdRef.current}`);
            setProgressText('Finalizing...');
          }
        }
      },
      () => {
        console.log('[GenAI WS] Disconnected');
      },
      (err) => {
        console.warn('[GenAI WS] Error:', err);
      }
    );
    wsRef.current = ws;
    return () => {
      ws?.close();
    };
  }, [clientId]);

  // ─── Keyboard Navigation for Gallery ───────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (recentResults.length === 0) return;

      // Only respond when gallery is visible and has focus or component is active
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();

        let newIndex = selectedGalleryIndex;

        if (e.key === 'ArrowLeft') {
          newIndex = selectedGalleryIndex <= 0 ? recentResults.length - 1 : selectedGalleryIndex - 1;
        } else if (e.key === 'ArrowRight') {
          newIndex = selectedGalleryIndex >= recentResults.length - 1 ? 0 : selectedGalleryIndex + 1;
        }

        setSelectedGalleryIndex(newIndex);
        const selected = recentResults[newIndex];
        if (selected) {
          setResultUrl(selected.url);
          setResultIsVideo(selected.isVideo);
        }
      }

      if (e.key === 'Escape') {
        setSelectedGalleryIndex(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [recentResults, selectedGalleryIndex]);

  // ─── Config Loading ────────────────────────────────────────────────────────
  useEffect(() => {
    const loadAllWorkflows = async () => {
      try {
        const [cfg, userWfs] = await Promise.all([
          getGenAIConfig(),
          listUserGenAIWorkflows()
        ]);

        const systemList = Object.entries(cfg.workflows).map(
          ([id, def]) => ({ id, ...def }) as GenAIWorkflowDefinition
        );

        const userList = userWfs.map(uw => ({
          id: `user-${uw.fileName}`,
          name: uw.fileName.replace('.json', ''),
          file: `workflows/user/${uw.fileName}`, // Note: prefix workflows/ since server resolves from GENAI_DIR
          icon: '🛠️',
          description: 'User imported workflow'
        } as GenAIWorkflowDefinition));

        const combined = [...systemList, ...userList];
        setConfig(cfg);
        setWorkflowsList(combined);
        if (combined.length > 0) selectWorkflow(combined[0]);
      } catch (err) {
        console.error('Failed to load GenAI config:', err);
        setError('Config load failed. Is the server running?');
      }
    };

    loadAllWorkflows();

    // ─── History Loading ───────────────────────────────────────────────────────
    const loadHistory = async () => {
      try {
        const history = await getGenAIHistory();
        const sortedPrompts = Object.entries(history).sort((a: any, b: any) =>
          (b[1].prompt[0] || 0) - (a[1].prompt[0] || 0)
        );

        const results: Array<{ url: string; isVideo: boolean; time: number }> = [];
        for (const [id, data] of sortedPrompts) {
          const promptData = data as any;
          if (!promptData?.outputs) continue;

          for (const nodeOutput of Object.values(promptData.outputs)) {
            const no = nodeOutput as any;
            const outs = [...(no?.images || []), ...(no?.gifs || [])];
            for (const out of outs) {
              const isVid = out.filename?.match(/\.(mp4|webm|mov|gif)$/i);
              const url = getGenAIOutputUrl(out.filename, out.type, out.subfolder);
              results.push({ url, isVideo: !!isVid, time: Date.now() }); // Timestamp mapping is tricky from history, use current or omit
            }
          }
        }

        if (results.length > 0) {
          setRecentResults(results.slice(0, 12));
          // Auto-select latest if nothing is currently shown
          setResultUrl(results[0].url);
          setResultIsVideo(results[0].isVideo);
        }
      } catch (err) {
        console.error('Failed to load history:', err);
      }
    };
    loadHistory();

    // Pre-fetch LoRAs for the selector
    getGenAIModels('loras').then(loras => setModelsCache(prev => ({ ...prev, loras })));

    setModelsCache(prev => ({
      ...prev,
      samplers: ['euler', 'euler_ancestral', 'heun', 'dpm_2', 'dpm_2_ancestral', 'lms', 'dpmpp_2s_ancestral', 'dpmpp_sde', 'dpmpp_2m', 'dpmpp_2m_sde', 'dpmpp_3m_sde', 'ddim', 'uni_pc', 'uni_pc_bh2'],
      schedulers: ['normal', 'karras', 'exponential', 'sgm_uniform', 'simple', 'ddim_uniform'],
      SAMPLER: ['euler', 'euler_ancestral', 'heun', 'dpm_2', 'dpm_2_ancestral', 'lms', 'dpmpp_2s_ancestral', 'dpmpp_sde', 'dpmpp_2m', 'dpmpp_2m_sde', 'dpmpp_3m_sde', 'ddim', 'uni_pc', 'uni_pc_bh2'],
      SCHEDULER: ['normal', 'karras', 'exponential', 'sgm_uniform', 'simple', 'ddim_uniform'],
    }));
  }, []);

  // ─── Model Fetching ────────────────────────────────────────────────────────
  const fetchModels = useCallback(async (type: string) => {
    try {
      let models: string[] = [];
      if (engine === 'forge') {
        if (type === 'SAMPLER') {
          models = await getForgeSamplers();
        } else if (type === 'SCHEDULER') {
          models = await getForgeSchedulers();
        } else {
          // Normalize type for Forge API
          const forgeType = type === 'MODEL' || type === 'CHECKPOINT' ? 'CHECKPOINT' : type;
          models = await getForgeModels(forgeType);
        }
      } else {
        let apiType = type;
        if (type === 'CHECKPOINT' || type === 'MODEL') apiType = 'checkpoints';
        else if (type === 'LORA') apiType = 'loras';
        else if (type === 'VAE') apiType = 'vae';
        else if (type === 'CLIP') apiType = 'clip';
        else if (type === 'UNET') apiType = 'unet';
        else if (type === 'CONTROLNET') apiType = 'controlnet';

        models = await getGenAIModels(apiType);
      }

      setModelsCache(prev => ({ ...prev, [type]: models }));
      return models;
    } catch (e) {
      console.error(`Failed to fetch ${type} models for ${engine}:`, e);
      return [];
    }
  }, [engine]); // Dependencies: engine to ensure correct endpoint usage

  // ─── Workflow Selection ────────────────────────────────────────────────────
  const selectWorkflow = async (wfDef: GenAIWorkflowDefinition) => {
    setSelectedWfDef(wfDef);
    setError(null);
    setResultUrl(null);
    setInputValues({});
    setImagePreviews({});
    setActiveLoras([]);
    setWorkflowContent(null); // Clear previous content to avoid stale state on error

    // Initialize feature states from config
    const fStates: Record<string, boolean> = {};
    wfDef.features?.forEach(f => {
      fStates[f.id] = f.default;
    });
    setFeatureStates(fStates);

    try {
      let filePath = wfDef.file;
      if (wfDef.modes && wfDef.default) {
        const modeDef = wfDef.modes[wfDef.default];
        if (modeDef) filePath = modeDef;
      }

      if (!filePath) {
        setError('No workflow file specified');
        return;
      }

      const content = await getGenAIWorkflowFile(filePath);

      // ─── Workflow Health Patch ─────────────────────────────────────────────
      // Fix known missing required inputs in community workflows
      const patched = JSON.parse(JSON.stringify(content));
      for (const [nodeId, node] of Object.entries(patched)) {
        if (node?.class_type === 'ReActorFaceSwap') {
          const inputs = node.inputs || {};
          // Required: face_restore_visibility (if missing)
          if (inputs.face_restore_visibility === undefined && inputs.face_restore_visible === undefined) {
            inputs.face_restore_visibility = 1;
          }
        }
      }

      setWorkflowContent(patched);
    } catch (e: any) {
      console.error('Error loading workflow:', e);
      setError(e.message || 'Failed to load workflow');
    }
  };

  // ─── Sync UI Inputs when Workflow Changes ─────────────────────────────────
  useEffect(() => {
    if (!workflowContent) {
      console.log('[GenAI] No workflowContent, skipping input sync');
      return;
    }

    console.log('[GenAI] Syncing UI inputs for content...');
    const inputs = getWorkflowUiInputs(workflowContent);
    console.log('[GenAI] Found inputs:', inputs);
    setUiInputs(inputs);

    const initDefaults = async () => {
      const next: Record<string, any> = {};

      for (const inp of inputs) {
        // ALWAYS use the defined default if present
        if (inp.default !== undefined) {
          next[inp.key] = inp.default;
          continue; // Skip heuristic defaults if explicit default exists
        }

        if (inp.type === 'NUMBER') {
          if (inp.key.toUpperCase().includes('SEED')) next[inp.key] = -1;
          else if (inp.key.toUpperCase().includes('STEPS')) next[inp.key] = 20;
          else if (inp.key.toUpperCase().includes('CFG')) next[inp.key] = 7;
          else if (inp.key.toUpperCase().includes('WIDTH')) next[inp.key] = 512;
          else if (inp.key.toUpperCase().includes('HEIGHT')) next[inp.key] = 768;
          else next[inp.key] = 1;
        } else if (inp.type === 'PROMPT') {
          next[inp.key] = '';
        } else if (['MODEL', 'VAE', 'LORA', 'CLIP', 'UNET', 'TEXT_ENCODER', 'CONTROLNET', 'CHECKPOINT'].includes(inp.type)) {
          const models = await fetchModels(inp.type);
          if (models.length > 0) next[inp.key] = models[0];
        } else if (inp.type === 'SAMPLER') {
          const samplers = await fetchModels('SAMPLER');
          if (samplers.length > 0) next[inp.key] = samplers[0];
        } else if (inp.type === 'SCHEDULER') {
          const schedulers = await fetchModels('SCHEDULER');
          if (schedulers.length > 0) next[inp.key] = schedulers[0];
        } else if (inp.type === 'SELECT' && inp.options && inp.options.length > 0) {
          next[inp.key] = inp.options[0];
        }
      }

      console.log('[GenAI] Initializing default sync values:', next);
      setInputValues(prev => ({ ...next, ...prev }));
    };

    initDefaults();
  }, [workflowContent, fetchModels]);

  // ─── Input Handlers ────────────────────────────────────────────────────────
  const handleInputChange = (key: string, value: any) => {
    setInputValues(prev => ({ ...prev, [key]: value }));
  };

  const handleImageSelect = async (key: string, file: File) => {
    setUploadedImages(prev => ({ ...prev, [key]: file }));
    // Set a non-empty value to pass validation
    setInputValues(prev => ({ ...prev, [key]: file.name }));
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreviews(prev => ({ ...prev, [key]: e.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  // Global paste listener for IMAGE inputs (works without focusing the drop zone)
  useEffect(() => {
    const imageInputKeys = uiInputs.filter(i => i.type === 'IMAGE').map(i => i.key);
    if (imageInputKeys.length === 0) return;

    const handlePaste = (e: ClipboardEvent) => {
      // Don't intercept paste in text inputs/textareas
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) break;
          // Fill the first empty IMAGE slot, or replace the first one
          const emptyKey = imageInputKeys.find(k => !uploadedImages[k]);
          handleImageSelect(emptyKey || imageInputKeys[0], file);
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [uiInputs, uploadedImages]);

  /**
   * injects LoRA loader nodes into the workflow chain.
   * Strategies:
   * 1. Find CheckpointLoaderSimple/UnetLoaderGGUF/CheckpointLoader.
   * 2. Insert LoraLoader nodes in sequence.
   * 3. Rewire original consumers to the end of the LoRA chain.
   */
  const injectLoras = (workflow: any, loras: LoraConfig[]) => {
    if (!loras || loras.length === 0) return workflow;
    const cloned = JSON.parse(JSON.stringify(workflow));

    // 1. Identify Source Nodes (Model & CLIP)
    let modelNodeId: string | null = null;
    let clipNodeId: string | null = null;
    let modelOutputSlot = 0;
    let clipOutputSlot = 1;

    for (const [id, node] of Object.entries(cloned) as [string, any][]) {
      if (node.class_type === 'CheckpointLoaderSimple' || node.class_type === 'CheckpointLoader') {
        modelNodeId = id;
        clipNodeId = id;
        modelOutputSlot = 0;
        clipOutputSlot = 1;
        break;
      } else if (node.class_type === 'UnetLoaderGGUF') {
        modelNodeId = id;
        modelOutputSlot = 0;
      } else if (node.class_type === 'ClipLoaderGGUF') {
        clipNodeId = id;
        clipOutputSlot = 0;
      }
    }

    if (!modelNodeId || !clipNodeId) {
      console.warn('[GenAI] Could not find Model/CLIP source nodes for LoRA injection.');
      return cloned;
    }

    // 2. Generate new LoRA nodes and chain them
    let currentModelSource = [modelNodeId, modelOutputSlot];
    let currentClipSource = [clipNodeId, clipOutputSlot];

    // Helper to find a free ID
    let maxId = 0;
    Object.keys(cloned).forEach(k => {
      const n = parseInt(k);
      if (!isNaN(n) && n > maxId) maxId = n;
    });

    loras.forEach((lora) => {
      maxId++;
      const loraNodeId = String(maxId);

      cloned[loraNodeId] = {
        class_type: "LoraLoader",
        inputs: {
          lora_name: lora.name,
          strength_model: lora.strength_model,
          strength_clip: lora.strength_clip,
          model: currentModelSource,
          clip: currentClipSource
        }
      };

      // Update current source to this node's outputs
      currentModelSource = [loraNodeId, 0];
      currentClipSource = [loraNodeId, 1];
    });

    // 3. Rewire Consumers
    // Check all OTHER nodes. If they use the original sources, point them to the new sources.
    for (const [id, node] of Object.entries(cloned) as [string, any][]) {
      // Skip the new LoRA nodes we just added (though IDs are new, so safe)
      // Skip the source nodes themselves
      if (id === modelNodeId || id === clipNodeId) continue;

      if (node.inputs) {
        for (const key in node.inputs) {
          const val = node.inputs[key];
          if (Array.isArray(val) && val.length === 2) {
            // Check Model Connection
            if (val[0] === modelNodeId && val[1] === modelOutputSlot) {
              // Only replace if it expects a MODEL type? 
              // Hard to know type without definition, but usually safe to assume connection to model output matches.
              node.inputs[key] = currentModelSource;
            }
            // Check CLIP Connection
            if (val[0] === clipNodeId && val[1] === clipOutputSlot) {
              node.inputs[key] = currentClipSource;
            }
          }
        }
      }
    }

    console.log('[GenAI] LoRAs injected:', loras.map(l => l.name));
    return cloned;
  };

  // ─── Run Workflow ──────────────────────────────────────────────────────────
  const handleRun = async () => {
    if (!workflowContent || !selectedWfDef) return;

    // 0. Validate Inputs
    const valErrors = validateWorkflowInputs(uiInputs, inputValues);
    if (valErrors.length > 0) {
      setValidationErrors(valErrors);
      setError('Please fix input errors before running.');
      return;
    }
    setValidationErrors([]);

    const isOffline = (engine === 'comfy' && !isConnected) || (engine === 'forge' && !isForgeConnected);
    const isApiDisabled = (engine === 'forge' && isForgeConnected && !isForgeApiEnabled);

    if (isOffline) {
      setError(`${engine === 'comfy' ? 'ComfyUI' : 'Forge Neo'} is not connected. Please start the engine first.`);
      return;
    }

    if (isApiDisabled) {
      setError('Forge Neo is online, but its API is disabled. Please add --api to your Forge startup flags and restart it.');
      return;
    }

    setError(null);
    setProgress(0);
    setProgressText('Preparing...');
    setIsRunning(true);
    isRunningRef.current = true;
    setResultUrl(null);
    setResultIsVideo(false);

    try {
      // 1. Prepare params and upload IMAGE inputs (files or URLs)
      const params: Record<string, any> = { ...inputValues };
      for (const inp of uiInputs) {
        if (inp.type === 'IMAGE') {
          // Case A: File uploaded via picker/drop
          if (uploadedImages[inp.key]) {
            const uploadResult = await uploadGenAIImage(uploadedImages[inp.key]);
            params[inp.key] = uploadResult.name;
          }
          // Case B: URL from recent gallery or external paste
          else if (typeof params[inp.key] === 'string') {
            const url = params[inp.key];
            try {
              let file: File;
              if (url.startsWith('data:')) {
                // Convert data URL to File directly
                const [header, base64] = url.split(',');
                const mimeMatch = header.match(/data:([^;]+)/);
                const mime = mimeMatch ? mimeMatch[1] : 'image/png';
                const ext = mime.split('/')[1] || 'png';
                const binary = atob(base64);
                const len = binary.length;
                const buffer = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                  buffer[i] = binary.charCodeAt(i);
                }
                const blob = new Blob([buffer], { type: mime });
                file = new File([blob], `data-${Date.now()}.${ext}`, { type: mime });
              } else if (url.startsWith('http://') || url.startsWith('https://')) {
                // Fetch remote URL
                const res = await fetch(url);
                const blob = await res.blob();
                const filename = url.split('/').pop()?.split('?')[0] || `genai-${Date.now()}.png`;
                file = new File([blob], filename, { type: blob.type });
              } else {
                // Not a recognized image URL format; skip upload and leave as-is (might be a plain string)
                continue;
              }
              const uploadResult = await uploadGenAIImage(file);
              params[inp.key] = uploadResult.name;
            } catch (err) {
              throw new Error(`Failed to fetch/upload image for ${inp.key}: ${err}`);
            }
          }
          // else: empty or non-string, leave as is (workflow may have default)
        }
      }

      // 2. Handle seed (-1 = random)
      for (const inp of uiInputs) {
        if (inp.type === 'NUMBER' && (inp.key.toUpperCase().includes('SEED'))) {
          const seedVal = params[inp.key];
          if (seedVal === -1 || seedVal === '-1' || seedVal === undefined) {
            params[inp.key] = Math.floor(Math.random() * 1000000000);
          }
        }
      }

      if (engine === 'comfy') {
        // ─── ComfyUI Path ───────────────────────────────────────────────────
        let finalWorkflow = applyTemplate(workflowContent, params, uiInputs);

        // Inject LoRAs
        finalWorkflow = injectLoras(finalWorkflow, activeLoras);

        if (selectedWfDef.features && selectedWfDef.features.length > 0) {
          processWorkflowFeatures(finalWorkflow, featureStates, selectedWfDef.features);
        }

        setProgressText('Queuing workflow...');
        const queueResult = await queueGenAIWorkflow(finalWorkflow, clientId);
        console.log('[GenAI] Workflow queued. Received prompt_id:', queueResult.prompt_id);
        promptIdRef.current = queueResult.prompt_id;

        let pollCount = 0;
        pollIntervalRef.current = setInterval(async () => {
          pollCount++;
          const currentPromptId = promptIdRef.current;
          if (pollCount > 300 || !currentPromptId || !isRunningRef.current) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            return;
          }

          const found = await checkForResult(currentPromptId);
          if (found) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          }
        }, 3000);

        safetyTimeoutRef.current = setTimeout(() => {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setIsRunning(running => {
            if (running) {
              setError('Generation timed out. Check ComfyUI for status.');
              return false;
            }
            return running;
          });
        }, 600000);

      } else {
        // ─── WebUI Forge Path ───────────────────────────────────────────────
        setProgressText('Sending to Forge...');

        const findVal = (keys: string[], fallback: any) => {
          for (const k of keys) {
            const match = Object.keys(params).find(pk => pk.toUpperCase() === k.toUpperCase());
            if (match) return params[match];
          }
          return fallback;
        };

        const promptBase = findVal(['PROMPT', 'POSITIVE'], "");
        // Append LoRAs to prompt for Forge
        const loraString = activeLoras.map(l => `<lora:${l.name}:${l.strength_model}>`).join(' ');
        const finalPrompt = loraString ? `${promptBase} ${loraString}` : promptBase;

        const payload: any = {
          prompt: finalPrompt,
          negative_prompt: findVal(['NEGATIVE', 'NEGATIVE_PROMPT'], ""),
          steps: Number(findVal(['STEPS', 'STEP_COUNT'], 8)),
          cfg_scale: Number(findVal(['CFG', 'CFG_SCALE'], 1)),
          width: Number(findVal(['WIDTH', 'RES_W'], 1024)),
          height: Number(findVal(['HEIGHT', 'RES_H'], 1024)),
          seed: Number(findVal(['SEED'], -1)),
          sampler_name: findVal(['SAMPLER'], "Res Multistep"),
          scheduler: findVal(['SCHEDULER'], "SGM Uniform"),
          override_settings: {}
        };

        // Add additional params if found
        const shiftVal = findVal(['SHIFT', 'LUMINA_SHIFT'], null);
        if (shiftVal !== null) {
          // In some Forge versions, shift is passed as an override or specific key
          payload.override_settings = { ...payload.override_settings, lumina_shift: Number(shiftVal) };
        }

        const modelVal = findVal(['MODEL', 'CHECKPOINT'], null);
        if (modelVal) {
          payload.override_settings = { ...payload.override_settings, sd_model_checkpoint: modelVal };
        }

        const vaeVal = findVal(['VAE'], null);
        if (vaeVal) {
          payload.override_settings = { ...payload.override_settings, sd_vae: vaeVal };
        }

        // ─── Inpainting Support ───────────────────────────────────────────────
        const imageInput = findVal(['IMAGE', 'IMAGE_NAME'], null);
        const clothesSegment = findVal(['CLOTHES_SEGMENT', 'SEGMENT'], null);
        const inpaintingFill = findVal(['INPAINTING_FILL'], 'Fill with Original');
        const inpaintFullRes = findVal(['INPAINT_FULL_RES'], true);
        const inpaintPadding = findVal(['INPAINT_PADDING'], 32);

        // Map inpainting fill to Forge numeric values
        const fillMap: Record<string, number> = {
          'Fill with Noise': 0,
          'Fill with Original': 1,
          'Fill with Latent Noise': 2
        };
        const inpaintingFillNum = fillMap[inpaintingFill] ?? 1;

        let useImg2Img = false;
        let initImageFilename: string | null = null;
        let maskFilename: string | null = null;

        if (imageInput && typeof imageInput === 'string' && imageInput.startsWith('data:image')) {
          // It's a base64 image from upload
          setProgressText('Uploading image...');
          try {
            const uploadResult = await uploadBase64Image(
              imageInput.split(',')[1],
              `inpaint-${Date.now()}.png`
            );
            initImageFilename = uploadResult.name;

            // Generate mask if we have a segment type
            if (clothesSegment) {
              setProgressText('Generating mask...');
              // Decode base64 to get image dimensions
              const img = new Image();
              await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = reject;
                img.src = imageInput;
              });

              const maskBase64 = generateSimpleMask(img.width, img.height, clothesSegment);
              const maskUpload = await uploadBase64Image(maskBase64, `mask-${Date.now()}.png`);
              maskFilename = maskUpload.name;
            }

            useImg2Img = true;
          } catch (err) {
            console.error('Failed to upload image/mask:', err);
            throw new Error('Image upload failed. Please try again.');
          }
        } else if (imageInput && uploadedImages[imageInput]) {
          // It's a File object from the uploader
          setProgressText('Uploading image...');
          const uploadResult = await uploadGenAIImage(uploadedImages[imageInput]);
          initImageFilename = uploadResult.name;

          if (clothesSegment) {
            setProgressText('Generating mask...');
            // Get image dimensions from the file
            const img = new Image();
            const url = URL.createObjectURL(uploadedImages[imageInput]);
            await new Promise<void>((resolve, reject) => {
              img.onload = () => {
                URL.revokeObjectURL(url);
                resolve();
              };
              img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load image'));
              };
              img.src = url;
            });

            const maskBase64 = generateSimpleMask(img.width, img.height, clothesSegment);
            const maskUpload = await uploadBase64Image(maskBase64, `mask-${Date.now()}.png`);
            maskFilename = maskUpload.name;
          }

          useImg2Img = true;
        }

        console.log('[GenAI] Forge Payload:', payload);

        const forgePoll = setInterval(async () => {
          try {
            const prog = await getForgeProgress();
            const percent = Math.round(prog.progress * 100);
            setProgress(percent);
            setProgressText(`Forge: ${percent}% ${prog.ETA > 0 ? `(ETA: ${Math.round(prog.ETA)}s)` : ''}`);
            if (percent >= 100) clearInterval(forgePoll);
          } catch {
            clearInterval(forgePoll);
          }
        }, 1000);

        try {
          let result;
          if (useImg2Img && initImageFilename) {
            // Use img2img endpoint with inpainting parameters
            const img2imgPayload: any = {
              ...payload,
              init_images: [initImageFilename],
              mask: maskFilename,
              inpainting_fill: inpaintingFillNum,
              inpaint_full_res: inpaintFullRes,
              inpaint_full_res_padding: Number(inpaintPadding),
              inpainting_mask_invert: 0,
              // For inpainting, we typically want to keep the original dimensions
              // but ensure they match the input image
            };
            result = await queueForgeImg2Img(img2imgPayload);
          } else {
            // Standard txt2img
            result = await queueForgeTxt2Img(payload);
          }

          clearInterval(forgePoll);
          if (result.images && result.images.length > 0) {
            const b64 = `data:image/png;base64,${result.images[0]}`;
            setResultUrl(b64);
            setProgress(100);
            setProgressText('Complete!');
            setIsRunning(false);
            isRunningRef.current = false;
            setRecentResults(prev => [
              { url: b64, isVideo: false, time: Date.now() },
              ...prev.slice(0, 11)
            ]);
          }
        } catch (err: any) {
          clearInterval(forgePoll);
          throw err;
        }
      }

    } catch (e: any) {
      console.error('Execution error:', e);
      setError(e.message || 'Failed to run generation');
      setIsRunning(false);
      isRunningRef.current = false;
    }
  };

  // ─── Import Workflow ───────────────────────────────────────────────────────
  const handleImportWorkflow = async (jsonContent: any, fileName: string) => {
    try {
      let content = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
      if (!content || typeof content !== 'object') throw new Error('Invalid JSON');

      // ─── Auto-Conversion ───────────────────────────────────────────────────
      // If it's a "Graph" format (has .nodes), convert it to "API" format.
      if (content.nodes && Array.isArray(content.nodes)) {
        console.log('[GenAI] Detected Graph format, converting to API...');
        content = convertGraphToApi(content);
      }

      // Auto-parameterize if no UI metadata exists (or if we just converted it)
      if (!content.__ui || !content.__ui.inputs) {
        console.log('[GenAI] Auto-parameterizing workflow...');
        content = parameterizeWorkflow(content);
      }

      const name = fileName.replace('.json', '').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Imported Workflow';
      const result = await saveUserGenAIWorkflow({ name, content });
      if (result.success) {
        // Reload config to pick up the new workflow
        setError(null);
        // Add to the list locally
        const newDef: GenAIWorkflowDefinition = {
          id: `user-${name}`,
          name,
          file: `workflows/user/${result.fileName || (name + '.json')}`, // Prefix workflows/ to match server expectation
          icon: '🛠️',
          description: 'User imported workflow'
        };
        setWorkflowsList(prev => [...prev, newDef]);

        // Auto-select the newly imported workflow
        selectWorkflow(newDef);
      }
    } catch (e: any) {
      setError('Import failed: ' + e.message);
    }
  };

  /** Save current UI config back to the workflow file */
  const saveWorkflowInputConfig = async () => {
    if (!selectedWfDef || !workflowContent) return;

    try {
      const updatedContent = { ...workflowContent };
      if (!updatedContent.__ui) updatedContent.__ui = {};
      updatedContent.__ui.inputs = uiInputs;

      // We need to know if it's a system or user workflow.
      // System workflows cannot be overwritten easily via API typically, 
      // but for this "dashboard" tool, we might assume we can overwrite if it's local,
      // OR we save a copy as user-workflow if it was system.
      // For now, let's try to save using the existing name.

      // If it's a system workflow (no "user-" prefix in ID usually, but check file path),
      // we might want to save as a new user workflow if we can't overwrite.
      // But let's assume we can save for now.

      const name = selectedWfDef.name;
      // If it's a built-in workflow, we should probably save a copy?
      // For simplicity in this task, we will attempt to save.

      console.log('[GenAI] Saving workflow config:', updatedContent);

      const result = await saveUserGenAIWorkflow({
        name,
        content: updatedContent,
        // overwrite: true
      });

      if (result.success) {
        setWorkflowContent(updatedContent);
        setIsEditMode(false);
        // If it created a new file (e.g. was system), we might need to update the list,
        // but if we overwrote or mapped correctly, it's fine.
      }
    } catch (e: any) {
      console.error('Failed to save Layout:', e);
      setError('Failed to save layout: ' + e.message);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setImportDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const content = JSON.parse(ev.target?.result as string);
          handleImportWorkflow(content, file.name);
        } catch {
          setError('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleDeleteWorkflow = async (e: React.MouseEvent, wf: GenAIWorkflowDefinition) => {
    e.stopPropagation();
    if (!window.confirm(`Delete workflow "${wf.name}"?`)) return;
    try {
      const fileName = wf.file?.split('/').pop();
      if (!fileName) return;
      const result = await deleteUserGenAIWorkflow(fileName);
      if (result.success) {
        setWorkflowsList(prev => prev.filter(w => w.id !== wf.id));
        if (selectedWfDef?.id === wf.id) {
          const first = workflowsList.find(w => w.id !== wf.id);
          if (first) selectWorkflow(first);
        }
      }
    } catch (e: any) {
      setError('Delete failed: ' + e.message);
    }
  };

  const handleUpdateJson = () => {
    try {
      const parsed = JSON.parse(rawJsonText);
      setWorkflowContent(parsed);
      setIsEditingJson(false);
      setError(null);
    } catch (e) {
      setError('Invalid JSON format');
    }
  };
  const handleSaveToFile = async () => {
    try {
      if (!selectedWfDef?.file) return;
      const parsed = JSON.parse(rawJsonText);
      const isUser = selectedWfDef.id.startsWith('user-');
      const name = selectedWfDef.name;

      const result = await saveUserGenAIWorkflow({ name, content: parsed });
      if (result.success) {
        setWorkflowContent(parsed);
        setIsEditingJson(false);
        setError(null);
        alert('Workflow saved successfully!');
      }
    } catch (e: any) {
      setError('Save failed: ' + e.message);
    }
  };

  const handleModeChange = (mode: string) => {
    if (!selectedWfDef?.modes?.[mode]) return;
    const newDef = { ...selectedWfDef, default: mode };
    selectWorkflow(newDef);
  };

  // ─── Render: Workflow Tabs ─────────────────────────────────────────────────

  const renderWorkflowTabs = () => (
    <div className="flex flex-wrap gap-2 mb-4">
      {workflowsList.map(wf => (
        <button
          key={wf.id}
          className={`group flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all duration-200 ${selectedWfDef?.id === wf.id
            ? 'bg-indigo-500/30 text-indigo-100 border border-indigo-500/50 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
            : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white'
            }`}
          onClick={() => selectWorkflow(wf)}
        >
          <span className="mr-1.5">{wf.icon || '📋'}</span>
          <span className="max-w-[150px] truncate">{wf.name}</span>

          {wf.id.startsWith('user-') && (
            <span
              onClick={(e) => handleDeleteWorkflow(e, wf)}
              className="ml-2 opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-all p-1"
              title="Delete Workflow"
            >
              ✕
            </span>
          )}
        </button>
      ))}
    </div>
  );

  // ─── Render: Mode Selector ─────────────────────────────────────────────────
  const renderModes = () => {
    if (!selectedWfDef?.modes) return null;
    const modes = Object.keys(selectedWfDef.modes);
    if (modes.length <= 1) return null;
    return (
      <div className="flex gap-2 mb-4">
        {modes.map(mode => (
          <button
            key={mode}
            className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider rounded-md transition-all ${selectedWfDef.default === mode
              ? 'bg-violet-500/30 text-violet-200 border border-violet-500/40'
              : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
              }`}
            onClick={() => handleModeChange(mode)}
          >
            {mode}
          </button>
        ))}
      </div>
    );
  };

  // ─── Render: Feature Toggles ───────────────────────────────────────────────
  const renderFeatures = () => {
    if (!selectedWfDef?.features || selectedWfDef.features.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-3 mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
        <span className="text-[10px] text-white/40 uppercase tracking-wider w-full mb-1">Features</span>
        {selectedWfDef.features.map(f => (
          <label key={f.id} className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={featureStates[f.id] ?? f.default}
              onChange={(e) => setFeatureStates(prev => ({ ...prev, [f.id]: e.target.checked }))}
              className="w-4 h-4 rounded border-white/20 bg-white/10 accent-indigo-500"
            />
            <span className="text-xs text-white/70 group-hover:text-white transition-colors">{f.label}</span>
          </label>
        ))}
      </div>
    );
  };

  // ─── Render: Dynamic Inputs ────────────────────────────────────────────────
  const renderInputs = () => {
    if (!workflowContent) return null;
    if (uiInputs.length === 0) {
      return (
        <div className="mt-4 p-4 rounded-lg bg-indigo-500/5 border border-indigo-500/10 text-center">
          <p className="text-xs text-indigo-300 opacity-60 italic">No dynamic inputs detected for this workflow.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4 mt-4">
        {uiInputs.filter(inp => inp && inp.visible !== false).map(inp => {
          if (!inp) return null;
          const key = inp.key;
          const type = inp.type;
          const value = inputValues[key] ?? '';
          const hasError = validationErrors.some(e => e.includes(inp.label) || e.includes(key));

          return (
            <div key={key} className={hasError ? "p-1 rounded bg-rose-500/10 border border-rose-500/30" : ""}>
              {/* Label & Input rendered below (simplified reuse for diff) */}
              {(() => {
                if (type === 'PROMPT' || key === 'PROMPT') {
                  return (
                    <>
                      <label className="text-xs font-semibold text-white/70 uppercase mb-1.5 block tracking-wider">{inp.label}</label>
                      <textarea
                        className={`w-full bg-black/30 border rounded-xl p-3 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 transition-all resize-none ${hasError ? 'border-rose-500/50' : 'border-white/10 focus:border-indigo-500/50 focus:ring-indigo-500/20'}`}
                        placeholder="Describe what you want to generate..."
                        value={value}
                        onChange={(e) => handleInputChange(key, e.target.value)}
                        rows={3}
                      />
                    </>
                  );
                }
                if (type === 'IMAGE') {
                  const preview = imagePreviews[key];
                  const file = uploadedImages[key];
                  return (
                    <>
                      <label className="text-xs font-semibold text-white/70 uppercase mb-1.5 block tracking-wider">{inp.label}</label>
                      {/* Preview State or Drop Zone */}
                      {preview ? (
                        <div className="relative rounded-xl overflow-hidden border border-white/15 bg-black/30 group">
                          <img src={preview} alt="Uploaded preview" className="w-full max-h-64 object-contain bg-[repeating-conic-gradient(#1a1a2e_0%_25%,#0f0f1e_0%_50%)] bg-[length:20px_20px]" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end justify-between p-4">
                            <div className="flex flex-col">
                              <span className="text-white text-xs font-medium truncate max-w-[200px]">{file?.name || 'Image'}</span>
                              {file && <span className="text-white/40 text-[10px]">{(file.size / 1024).toFixed(0)} KB</span>}
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setUploadedImages(prev => { const n = { ...prev }; delete n[key]; return n; }); setInputValues(prev => { const n = { ...prev }; delete n[key]; return n; }); setImagePreviews(prev => { const n = { ...prev }; delete n[key]; return n; }); }} className="px-3 py-1.5 bg-rose-500/20 text-rose-200 text-[10px] font-semibold uppercase tracking-wider rounded-lg border border-rose-500/30">✕ Remove</button>
                          </div>
                        </div>
                      ) : (
                        <div className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer group ${hasError ? 'border-rose-500/40 bg-rose-500/5' : 'border-white/15 bg-white/[0.03] hover:bg-white/[0.06]'}`}
                          onClick={() => document.getElementById(`file-${key}`)?.click()}
                          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onDrop={(e) => {
                            e.preventDefault(); e.stopPropagation();
                            const draggedUrl = e.dataTransfer.getData('application/x-genai-image');
                            if (draggedUrl) { handleInputChange(key, draggedUrl); setImagePreviews(prev => ({ ...prev, [key]: draggedUrl })); return; }
                            const f = e.dataTransfer.files[0]; if (f) handleImageSelect(key, f);
                          }}
                        >
                          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border border-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-all"><span className="text-2xl">🖼️</span></div>
                          <p className="text-sm text-white/60 font-medium mb-1.5">Drop Image Here</p>
                        </div>
                      )}
                      <input id={`file-${key}`} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageSelect(key, f); e.target.value = ''; }} />
                    </>
                  );
                }
                // Model Selectors
                if (['MODEL', 'VAE', 'LORA', 'CLIP', 'UNET', 'TEXT_ENCODER', 'CONTROLNET', 'CHECKPOINT', 'SAMPLER', 'SCHEDULER', 'SELECT'].includes(type) || (type === 'SELECT')) {
                  let options = inp.options || (modelsCache[type] || modelsCache[type.toLowerCase()] || []);
                  // Ensure the default value appears in the dropdown even if not provided by the engine list
                  if (inp.default !== undefined && inp.default !== '' && !options.includes(inp.default)) {
                    options = [inp.default, ...options];
                  }
                  return (
                    <>
                      <label className="text-xs font-semibold text-white/70 uppercase mb-1.5 block tracking-wider">{inp.label}</label>
                      <select
                        className={`w-full bg-black/30 border rounded-xl p-2.5 text-sm text-white focus:outline-none transition-all cursor-pointer ${hasError ? 'border-rose-500/50' : 'border-white/10 focus:border-indigo-500/50'}`}
                        value={value}
                        onChange={(e) => handleInputChange(key, e.target.value)}
                      >
                        {(options || []).map((opt: any) => <option key={opt} value={opt} className="bg-slate-900">{opt}</option>)}
                      </select>
                    </>
                  );
                }
                // Numbers or generic text
                return (
                  <>
                    <label className="text-xs font-semibold text-white/70 uppercase mb-1.5 block tracking-wider">{inp.label}</label>
                    <input
                      type={type === 'NUMBER' ? 'number' : 'text'}
                      step="any"
                      className={`w-full bg-black/30 border rounded-xl p-2.5 text-sm text-white focus:outline-none transition-all ${hasError ? 'border-rose-500/50' : 'border-white/10 focus:border-indigo-500/50'}`}
                      value={value}
                      onChange={(e) => handleInputChange(key, type === 'NUMBER' ? (e.target.value === '' ? '' : parseFloat(e.target.value)) : e.target.value)}
                    />
                  </>
                );
              })()}

              {/* Error Message */}
              {hasError && (
                <p className="text-[10px] text-rose-400 mt-1 font-medium animate-in fade-in slide-in-from-top-1">
                  Please provide a valid value for {inp.label}
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  };


  const renderEditConfig = () => {
    if (!isEditMode) return null;

    return (
      <div className="mb-6 bg-black/40 border border-indigo-500/30 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-indigo-200 uppercase tracking-wider">Workflow Configuration</h4>
          <button
            onClick={saveWorkflowInputConfig}
            className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-md text-[10px] font-bold uppercase tracking-wider hover:bg-indigo-500/30 transition-all"
          >
            Save Layout
          </button>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-[10px] text-white/40 uppercase font-bold text-center mb-2">
            <div className="col-span-1">Vis</div>
            <div className="col-span-3 text-left">Label</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-3">Default Value</div>
            <div className="col-span-3">Key</div>
          </div>

          {uiInputs.map((inp, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white/5 p-2 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
              {/* Visible Toggle */}
              <div className="col-span-1 flex justify-center">
                <input
                  type="checkbox"
                  checked={inp.visible !== false}
                  onChange={(e) => {
                    const newInputs = [...uiInputs];
                    newInputs[idx] = { ...inp, visible: e.target.checked };
                    setUiInputs(newInputs);
                  }}
                  className="rounded bg-black/50 border-white/20 text-indigo-500 focus:ring-indigo-500/50"
                />
              </div>

              {/* Label Edit */}
              <div className="col-span-3">
                <input
                  type="text"
                  value={inp.label}
                  onChange={(e) => {
                    const newInputs = [...uiInputs];
                    newInputs[idx] = { ...inp, label: e.target.value };
                    setUiInputs(newInputs);
                  }}
                  className="w-full bg-black/30 border border-white/10 rounded px-1.5 py-1 text-xs text-white focus:border-indigo-500/50 outline-none"
                />
              </div>

              {/* Type Display */}
              <div className="col-span-2 text-center">
                <span className="text-[9px] px-1.5 py-0.5 bg-white/10 rounded text-white/60">{inp.type}</span>
              </div>

              {/* Default Value Edit */}
              <div className="col-span-3">
                {inp.type === 'NUMBER' ? (
                  <input
                    type="number"
                    step="any"
                    value={inp.default ?? ''}
                    placeholder="No Default"
                    onChange={(e) => {
                      const newInputs = [...uiInputs];
                      newInputs[idx] = { ...inp, default: e.target.value === '' ? undefined : parseFloat(e.target.value) };
                      setUiInputs(newInputs);
                    }}
                    className="w-full bg-black/30 border border-white/10 rounded px-1.5 py-1 text-xs text-white focus:border-indigo-500/50 outline-none"
                  />
                ) : (
                  <input
                    type="text"
                    value={inp.default ?? ''}
                    placeholder="No Default"
                    onChange={(e) => {
                      const newInputs = [...uiInputs];
                      newInputs[idx] = { ...inp, default: e.target.value };
                      setUiInputs(newInputs);
                    }}
                    className="w-full bg-black/30 border border-white/10 rounded px-1.5 py-1 text-xs text-white focus:border-indigo-500/50 outline-none"
                  />
                )}
              </div>

              {/* Key Display */}
              <div className="col-span-3 text-[9px] text-white/30 font-mono truncate" title={inp.key}>
                {inp.key}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };



  // ─── Render: Progress ──────────────────────────────────────────────────────
  // ─── Render: Progress ──────────────────────────────────────────────────────
  const renderProgress = () => {
    return (
      <div className="mb-6 bg-[#0c0c0c] border border-white/10 rounded-xl overflow-hidden font-mono text-xs shadow-2xl relative group">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/5">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
          </div>
          <div className="text-white/30 text-[10px] tracking-widest uppercase">
            {engine === 'forge' ? 'FORGE_NEO_EXEC' : 'COMFY_NODE_EXEC'}
          </div>
        </div>

        {/* Terminal Body */}
        <div className="p-4 space-y-3 relative">
          {/* Matrix rain effect overlay could go here */}
          <div className="flex justify-between items-end text-indigo-400">
            <span>{'>'} {progressText || (engine === 'forge' ? 'Forge is thinking...' : 'Executing workflow...')}</span>
            <span className="animate-pulse">{progress}%</span>
          </div>

          {/* Progress Bar */}
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-300 ease-out relative"
              style={{ width: `${Math.max(5, progress)}%` }}
            >
              <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/50 animate-pulse" />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-white/5 text-white/40 text-[10px] uppercase tracking-wider">
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="text-white/70">{engine === 'forge' ? (forgeState?.state?.job || 'Running') : 'Processing'}</span>
            </div>
            <div className="flex justify-between">
              <span>ETA:</span>
              <span className="text-emerald-400 font-bold">{eta ? `${eta.toFixed(1)}s` : '--'}</span>
            </div>
            <div className="flex justify-between">
              <span>VRAM:</span>
              <span className={(memoryStats?.vram_used || 0) > (memoryStats?.vram_total || 1) * 0.9 ? 'text-rose-400' : 'text-white/70'}>
                {memoryStats ? (memoryStats.vram_used / 1024 / 1024 / 1024).toFixed(1) + ' GB' : '--'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Engine:</span>
              <span className="text-indigo-400">{engine}</span>
            </div>
          </div>
        </div>

        {/* Force Sync Button (Hidden unless hovered/long wait) */}
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => promptIdRef.current && checkForResult(promptIdRef.current)}
            className="px-2 py-1 bg-white/10 hover:bg-white/20 text-[9px] text-white/50 rounded uppercase tracking-wider backdrop-blur-md"
          >
            Sync
          </button>
        </div>
      </div>
    );
  };

  const renderResult = () => {
    if (!resultUrl) return null;
    return (
      <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
        <p className="text-xs text-white/40 uppercase mb-3 tracking-wider">✨ Result Manifested</p>
        {resultIsVideo ? (
          <video
            src={resultUrl}
            autoPlay
            loop
            muted
            playsInline
            className="rounded-lg max-h-80 mx-auto object-contain shadow-xl"
          />
        ) : (
          <img
            src={resultUrl}
            alt="Generated result"
            className="rounded-lg max-h-80 mx-auto object-contain shadow-xl"
          />
        )}
        <div className="flex justify-center gap-3 mt-4">
          <a
            href={resultUrl}
            download
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 bg-indigo-500/20 text-indigo-200 text-xs rounded-lg hover:bg-indigo-500/30 transition-colors border border-indigo-500/30"
          >
            ⬇ Download
          </a>
          <button
            onClick={() => { setResultUrl(null); setResultIsVideo(false); }}
            className="px-4 py-2 bg-white/10 text-white/80 text-xs rounded-lg hover:bg-white/20 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  };

  // ─── Render: Recent Gallery ────────────────────────────────────────────────
  const renderGallery = () => {
    if (recentResults.length === 0) return null;
    return (
      <div className="mt-6">
        <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
          Recent Generations (click to expand, arrow keys to navigate)
        </p>
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {recentResults.map((r, i) => (
            <div
              key={i}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-genai-image', r.url);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border cursor-grab active:cursor-grabbing transition-colors group ${
                selectedGalleryIndex === i
                  ? 'ring-2 ring-indigo-500 border-indigo-500'
                  : 'border-white/10 hover:border-indigo-500/50'
              }`}
              onClick={() => {
                setSelectedGalleryIndex(i);
                setResultUrl(r.url);
                setResultIsVideo(r.isVideo);
              }}
            >
              {r.isVideo ? (
                <video src={r.url} className="w-full h-full object-cover" muted />
              ) : (
                <img
                  src={r.url}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─── Main Render ───────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>🧠</span> GenAI Workshop
        </h2>
        {/* Engine Indicator & Memory */}
        <div className="flex items-center gap-3 bg-white/5 p-1.5 rounded-full border border-white/10 px-3">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] uppercase font-bold tracking-wider ${engine === 'comfy' ? 'text-indigo-300' : 'text-purple-300'}`}>
              {engine === 'comfy' ? 'ComfyUI' : 'Forge'}
            </span>
            <div className={`w-1.5 h-1.5 rounded-full ${engine === 'comfy'
              ? (isConnected ? 'bg-indigo-500 animate-pulse' : 'bg-rose-500')
              : (isForgeConnected ? 'bg-purple-500 animate-pulse' : 'bg-rose-500')}`}
            />
          </div>

          {/* Divider */}
          <div className="w-px h-3 bg-white/10" />

          {/* VRAM Badge */}
          <div className="flex items-center gap-2 group relative cursor-help">
            <span className="text-[10px] text-white/50 uppercase tracking-wider">VRAM</span>
            <span className={`text-[10px] font-bold ${(memoryStats?.vram_used || 0) > (memoryStats?.vram_total || 1) * 0.9 ? 'text-rose-400' : 'text-emerald-300'
              }`}>
              {memoryStats ? (memoryStats.vram_used / 1024 / 1024 / 1024).toFixed(1) : '0'} / {memoryStats ? (memoryStats.vram_total / 1024 / 1024 / 1024).toFixed(0) : '0'} GB
            </span>

            {/* Unload Tooltip/Button */}
            <div className="absolute top-full right-0 mt-2 w-48 bg-black/90 border border-white/10 rounded-xl p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-50">
              <p className="text-[10px] text-white/50 mb-2">
                {memoryStats?.loaded_models?.length ? `Loaded: ${memoryStats.loaded_models.join(', ')}` : 'No models explicit'}
              </p>
              <button
                onClick={async () => {
                  await unloadModels();
                  const stats = await getMemoryStats();
                  setMemoryStats(stats);
                }}
                className="w-full py-1 bg-white/10 hover:bg-rose-500/20 text-white/60 hover:text-rose-300 text-[10px] uppercase font-bold tracking-wider rounded border border-white/5 hover:border-rose-500/30 transition-all"
              >
                Unload Models
              </button>
            </div>
          </div>
        </div>
      </div>


      {/* Workflow Tabs */}
      {renderWorkflowTabs()}

      {/* Main Content */}
      {
        selectedWfDef && workflowContent && (
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
            <div className="premium-card p-6 relative overflow-hidden rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

              <div className="relative z-10">
                {/* Workflow Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{selectedWfDef.name}</h3>
                    <p className="text-xs text-white/50 mt-1">{selectedWfDef.description || 'Generate with AI.'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-[10px] uppercase tracking-wider rounded-lg border border-indigo-500/30">
                      {selectedWfDef.icon || '📋'} Workflow
                    </div>
                    <button
                      onClick={() => setIsEditMode(!isEditMode)}
                      className={`px-2 py-1 text-[10px] uppercase tracking-wider rounded-lg border transition-all ${isEditMode
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                        : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'}`}
                    >
                      {isEditMode ? 'Done Editing' : 'Edit Layout'}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingJson(!isEditingJson);
                        setRawJsonText(JSON.stringify(workflowContent, null, 2));
                      }}
                      className={`px-2 py-1 text-[10px] uppercase tracking-wider rounded-lg border transition-all ${isEditingJson
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'}`}
                    >
                      {isEditingJson ? 'Close Editor' : 'Edit JSON'}
                    </button>
                  </div>
                </div>

                {/* JSON Editor */}
                {isEditingJson && (
                  <div className="mb-6 space-y-3 animate-in fade-in zoom-in duration-300">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-white/40 uppercase tracking-widest">Raw Workflow JSON</label>
                      <div className="flex gap-2">
                        <button
                          onClick={handleUpdateJson}
                          className="px-3 py-1 bg-white/5 text-white/60 border border-white/10 rounded-md text-[10px] font-bold uppercase tracking-wider hover:bg-white/10 transition-all"
                        >
                          Apply (Session)
                        </button>
                        <button
                          onClick={handleSaveToFile}
                          className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-md text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-500/30 transition-all"
                        >
                          Save to File
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={rawJsonText}
                      onChange={(e) => setRawJsonText(e.target.value)}
                      className="w-full h-96 bg-black/40 border border-white/10 rounded-xl p-4 text-[11px] font-mono text-indigo-200 focus:border-indigo-500/50 focus:outline-none custom-scrollbar"
                      placeholder="{ ... }"
                    />
                  </div>
                )}

                {/* Mode Selector */}
                {renderModes()}

                {/* Feature Toggles */}
                {renderFeatures()}

                {/* Edit Configuration UI */}
                {renderEditConfig()}

                {/* LoRA Selector */}
                <GenAILoraSelector
                  availableLoras={modelsCache.loras || []}
                  activeLoras={activeLoras}
                  onChange={setActiveLoras}
                />

                {/* Dynamic Inputs */}
                {renderInputs()}

                {/* Run Button */}
                <div className="mt-6 flex items-center gap-3">
                  <button
                    onClick={handleRun}
                    disabled={isRunning || (engine === 'comfy' && !isConnected) || (engine === 'forge' && !isForgeConnected)}
                    className={`flex-1 py-3 px-6 rounded-xl font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${isRunning || (engine === 'comfy' && !isConnected) || (engine === 'forge' && !isForgeConnected)
                      ? 'bg-white/10 text-white/30 cursor-not-allowed'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] active:scale-[0.98]'
                      }`}
                  >
                    {isRunning ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>✨ Run Workflow</>
                    )}
                  </button>
                </div>

                {/* Error */}
                {error && (
                  <div className="mt-4 p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-200 text-xs flex items-start gap-2">
                    <span className="text-base">⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                {/* Progress */}
                {isRunning && renderProgress()}

                {/* Result */}
                {renderResult()}

                {/* Gallery */}
                {renderGallery()}
              </div>
            </div>

            {/* Import Area */}
            <div
              className={`mt-6 rounded-xl border-2 border-dashed p-6 text-center transition-all cursor-pointer ${importDragOver
                ? 'border-indigo-500/70 bg-indigo-500/10'
                : 'border-white/20 hover:border-indigo-500/40 hover:bg-white/5'
                }`}
              onDragOver={(e) => { e.preventDefault(); setImportDragOver(true); }}
              onDragLeave={() => setImportDragOver(false)}
              onDrop={handleDrop}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = (e: any) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      try {
                        const content = JSON.parse(ev.target?.result as string);
                        handleImportWorkflow(content, file.name);
                      } catch {
                        setError('Invalid JSON file');
                      }
                    };
                    reader.readAsText(file);
                  }
                };
                input.click();
              }}
            >
              <p className="text-white/50 text-sm mb-1">📥 Import Custom Workflow</p>
              <p className="text-white/30 text-xs">Drag a ComfyUI API JSON or click to browse</p>
            </div>
          </div>
        )
      }

      {/* Empty state */}
      {
        !workflowContent && !error && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-4">🎨</div>
              <p className="text-white/40 text-sm">Loading workflows...</p>
            </div>
          </div>
        )
      }
    </div >
  );
}

export default GenAICell;
