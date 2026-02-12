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
  getForgeProgress,
  GenAIWorkflowDefinition,
  GenAIConfig
} from '../services/genaiService';
import { convertGraphToApi, parameterizeWorkflow } from '../utils/comfyConverter';

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Extract UI-configurable inputs from a workflow JSON */
/** Extract UI-configurable inputs from a workflow JSON */
function getWorkflowUiInputs(workflowContent: any): Array<{ key: string; type: string; label: string; target?: string; options?: string[] }> {
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

// ─── Component ────────────────────────────────────────────────────────────────

export function GenAICell() {
  const [config, setConfig] = useState<GenAIConfig | null>(null);
  const [workflowsList, setWorkflowsList] = useState<GenAIWorkflowDefinition[]>([]);
  const [selectedWfDef, setSelectedWfDef] = useState<GenAIWorkflowDefinition | null>(null);
  const [workflowContent, setWorkflowContent] = useState<any>(null);
  const [uiInputs, setUiInputs] = useState<Array<{ key: string; type: string; label: string; target?: string; options?: string[] }>>([]);
  const [inputValues, setInputValues] = useState<Record<string, any>>({});
  const [uploadedImages, setUploadedImages] = useState<Record<string, File>>({});
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});
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
  const [engine, setEngine] = useState<'comfy' | 'forge'>('comfy');
  const [clientId] = useState(() => 'dashboard-' + Math.random().toString(36).substring(2));
  const [importDragOver, setImportDragOver] = useState(false);

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
            checkForResult(data.data.prompt_id || promptIdRef.current!);
          }
        }

        if (data.type === 'executed' && data.data?.output) {
          // Standard execution signal for a specific node
          checkForResult(data.data.prompt_id || promptIdRef.current!);
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
    setUploadedImages({});
    setImagePreviews({});

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
      setWorkflowContent(content);
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

  // ─── Run Workflow ──────────────────────────────────────────────────────────
  const handleRun = async () => {
    if (!workflowContent || !selectedWfDef) return;

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

        const payload: any = {
          prompt: findVal(['PROMPT', 'POSITIVE'], ""),
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
          const result = await queueForgeTxt2Img(payload);
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
        // Also auto-parameterize common inputs
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
          file: `user/${result.fileName || (name + '.json')}`,
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
        {uiInputs.map(inp => {
          if (!inp) return null;
          const key = inp.key;
          const type = inp.type;
          const value = inputValues[key] ?? '';

          if (type === 'PROMPT' || key === 'PROMPT') {
            return (
              <div key={key}>
                <label className="text-xs font-semibold text-white/70 uppercase mb-1.5 block tracking-wider">{inp.label}</label>
                <textarea
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-white/20 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all resize-none"
                  placeholder="Describe what you want to generate..."
                  value={value}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  rows={3}
                />
              </div>
            );
          }

          if (type === 'IMAGE') {
            const preview = imagePreviews[key];
            const file = uploadedImages[key];
            return (
              <div key={key}>
                <label className="text-xs font-semibold text-white/70 uppercase mb-1.5 block tracking-wider">{inp.label}</label>

                {/* Preview State */}
                {preview ? (
                  <div className="relative rounded-xl overflow-hidden border border-white/15 bg-black/30 group">
                    <img
                      src={preview}
                      alt="Uploaded preview"
                      className="w-full max-h-64 object-contain bg-[repeating-conic-gradient(#1a1a2e_0%_25%,#0f0f1e_0%_50%)] bg-[length:20px_20px]"
                    />
                    {/* Overlay controls */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end justify-between p-4">
                      <div className="flex flex-col">
                        <span className="text-white text-xs font-medium truncate max-w-[200px]">{file?.name || 'Image'}</span>
                        {file && <span className="text-white/40 text-[10px]">{(file.size / 1024).toFixed(0)} KB</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); document.getElementById(`file-${key}`)?.click(); }}
                          className="px-3 py-1.5 bg-white/15 backdrop-blur-sm text-white text-[10px] font-semibold uppercase tracking-wider rounded-lg hover:bg-white/25 transition-all border border-white/20"
                        >
                          Replace
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadedImages(prev => { const n = { ...prev }; delete n[key]; return n; });
                            setInputValues(prev => { const n = { ...prev }; delete n[key]; return n; });
                            setImagePreviews(prev => { const n = { ...prev }; delete n[key]; return n; });
                          }}
                          className="px-3 py-1.5 bg-rose-500/20 backdrop-blur-sm text-rose-200 text-[10px] font-semibold uppercase tracking-wider rounded-lg hover:bg-rose-500/40 transition-all border border-rose-500/30"
                        >
                          ✕ Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Drop Zone */
                  <div
                    className="relative border-2 border-dashed border-white/15 rounded-xl p-8 text-center transition-all cursor-pointer bg-white/[0.03] hover:bg-white/[0.06] hover:border-indigo-500/40 group"
                    onClick={() => document.getElementById(`file-${key}`)?.click()}
                    onDragOver={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      e.currentTarget.classList.add('!border-indigo-500/60', '!bg-indigo-500/10');
                      // Accept both files and custom image URLs
                      const types = e.dataTransfer.types;
                      const hasFile = types.contains('Files');
                      const hasGenAIImage = types.contains('application/x-genai-image');
                      if (hasFile || hasGenAIImage) {
                        e.dataTransfer.dropEffect = 'copy';
                      }
                    }}
                    onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('!border-indigo-500/60', '!bg-indigo-500/10'); }}
                    onDrop={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      e.currentTarget.classList.remove('!border-indigo-500/60', '!bg-indigo-500/10');

                      // Check for dragged URL from recent gallery
                      const draggedUrl = e.dataTransfer.getData('application/x-genai-image');
                      if (draggedUrl) {
                        // Set directly as a URL input (no upload needed)
                        handleInputChange(key, draggedUrl);
                        // Also set preview
                        setImagePreviews(prev => ({ ...prev, [key]: draggedUrl }));
                        return;
                      }

                      // Check for pasted/dropped file
                      const droppedFile = e.dataTransfer.files[0];
                      if (droppedFile && droppedFile.type.startsWith('image/')) {
                        handleImageSelect(key, droppedFile);
                      }
                    }}
                    onPaste={(e) => {
                      const items = e.clipboardData?.items;
                      if (items) {
                        for (const item of Array.from(items)) {
                          if (item.type.startsWith('image/')) {
                            const pastedFile = item.getAsFile();
                            if (pastedFile) handleImageSelect(key, pastedFile);
                            break;
                          }
                        }
                      }
                    }}
                    tabIndex={0}
                  >
                    {/* Animated icon */}
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border border-indigo-500/20 flex items-center justify-center group-hover:scale-110 group-hover:from-indigo-500/25 group-hover:to-purple-500/25 transition-all duration-300">
                      <span className="text-2xl group-hover:animate-bounce">🖼️</span>
                    </div>

                    {/* Instructions */}
                    <p className="text-sm text-white/60 font-medium mb-1.5">
                      Drop an image, <span className="text-indigo-400 underline underline-offset-2 decoration-indigo-400/40">browse files</span>, paste, or drag from recent below
                    </p>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">
                      PNG, JPG, WEBP supported • Ctrl+V to paste • Drag from gallery
                    </p>

                    {/* Decorative corner accents */}
                    <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-white/10 rounded-tl-md group-hover:border-indigo-500/40 transition-colors" />
                    <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-white/10 rounded-tr-md group-hover:border-indigo-500/40 transition-colors" />
                    <div className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-white/10 rounded-bl-md group-hover:border-indigo-500/40 transition-colors" />
                    <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-white/10 rounded-br-md group-hover:border-indigo-500/40 transition-colors" />
                  </div>
                )}
                <input
                  id={`file-${key}`}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageSelect(key, f);
                    e.target.value = ''; // allow re-selecting same file
                  }}
                />
              </div>
            );
          }

          if (['MODEL', 'VAE', 'LORA', 'CLIP', 'UNET', 'TEXT_ENCODER', 'CONTROLNET'].includes(type)) {
            const options = modelsCache[type] || modelsCache[type.toLowerCase()] || [];
            return (
              <div key={key}>
                <label className="text-xs font-semibold text-white/70 uppercase mb-1.5 block tracking-wider">{inp.label}</label>
                <select
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:border-indigo-500/50 focus:outline-none transition-all cursor-pointer"
                  value={value}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                >
                  {options.length === 0 && <option value="" className="bg-slate-900">No models found</option>}
                  {options.map((opt: string) => (
                    <option key={opt} value={opt} className="bg-slate-900">{opt}</option>
                  ))}
                </select>
              </div>
            );
          }

          if (type === 'SAMPLER') {
            const options = modelsCache[type] || modelsCache.samplers || [];
            return (
              <div key={key}>
                <label className="text-xs font-semibold text-white/70 uppercase mb-1.5 block tracking-wider">{inp.label}</label>
                <select
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:border-indigo-500/50 focus:outline-none transition-all appearance-none"
                  value={value}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                >
                  {options.map((s: string) => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
                </select>
              </div>
            );
          }

          if (type === 'SCHEDULER') {
            const options = modelsCache[type] || modelsCache.schedulers || [];
            return (
              <div key={key}>
                <label className="text-xs font-semibold text-white/70 uppercase mb-1.5 block tracking-wider">{inp.label}</label>
                <select
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:border-indigo-500/50 focus:outline-none transition-all appearance-none"
                  value={value}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                >
                  {options.map((s: string) => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
                </select>
              </div>
            );
          }

          if (type === 'NUMBER') {
            return (
              <div key={key}>
                <label className="text-xs font-semibold text-white/70 uppercase mb-1.5 block tracking-wider">
                  {inp.label}
                  {key.includes('SEED') && <span className="text-white/30 ml-2 normal-case font-normal">(-1 = random)</span>}
                </label>
                <input
                  type="number"
                  step="any"
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:border-indigo-500/50 focus:outline-none transition-all"
                  value={value}
                  onChange={(e) => handleInputChange(key, e.target.value === '' ? '' : parseFloat(e.target.value))}
                />
              </div>
            );
          }

          if (type === 'SELECT') {
            return (
              <div key={key}>
                <label className="text-xs font-semibold text-white/70 uppercase mb-1.5 block tracking-wider">{inp.label}</label>
                <select
                  value={value}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:border-indigo-500/50 focus:outline-none transition-all appearance-none"
                >
                  {inp.options?.map(opt => (
                    <option key={opt} value={opt} className="bg-slate-900">{opt}</option>
                  ))}
                </select>
              </div>
            );
          }

          return (
            <div key={key}>
              <label className="text-xs font-semibold text-white/70 uppercase mb-1.5 block tracking-wider">{inp.label}</label>
              <input
                type="text"
                className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-sm text-white placeholder-white/20 focus:border-indigo-500/50 focus:outline-none transition-all"
                value={value}
                onChange={(e) => handleInputChange(key, e.target.value)}
              />
            </div>
          );
        })}
      </div>
    );
  };

  // ─── Render: Result Area ───────────────────────────────────────────────────
  const renderResult = () => {
    if (isRunning) {
      return (
        <div className="mt-6 p-6 rounded-xl bg-white/5 border border-white/10 text-center">
          <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-indigo-200 text-sm mb-1">{progressText || 'Dreaming into the aether...'}</p>
          <p className="text-white/40 text-xs mb-3">{progress}%</p>
          <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden mb-4">
            <div
              className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* Manual Refresh if stuck */}
          <button
            onClick={() => promptIdRef.current && checkForResult(promptIdRef.current)}
            className="px-3 py-1.5 text-[10px] bg-white/5 hover:bg-white/10 rounded-lg text-white/50 border border-white/10 transition-colors uppercase tracking-widest font-bold"
          >
            Force Sync with ComfyUI
          </button>
        </div>
      );
    }

    if (resultUrl) {
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
    }
  };

  // ─── Render: Recent Gallery ────────────────────────────────────────────────
  const renderGallery = () => {
    if (recentResults.length === 0) return null;
    return (
      <div className="mt-6">
        <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Recent Generations (drag to input)</p>
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {recentResults.map((r, i) => (
            <div
              key={i}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-genai-image', r.url);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-white/10 cursor-grab active:cursor-grabbing hover:border-indigo-500/50 transition-colors group"
              onClick={() => { setResultUrl(r.url); setResultIsVideo(r.isVideo); }}
            >
              {r.isVideo ? (
                <video src={r.url} className="w-full h-full object-cover" muted />
              ) : (
                <img src={r.url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
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
        <div className="flex items-center gap-3">
          {/* Engine Switcher */}
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 mr-2">
            <button
              onClick={() => setEngine('comfy')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${engine === 'comfy'
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                : 'text-white/40 hover:text-white/60'
                }`}
            >
              ComfyUI
            </button>
            <button
              onClick={() => setEngine('forge')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${engine === 'forge'
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                : 'text-white/40 hover:text-white/60'
                }`}
            >
              Forge {isForgeConnected && <span className={`inline-block w-1.5 h-1.5 rounded-full ml-1 ${isForgeApiEnabled ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>}
            </button>
          </div>

          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wider border transition-all ${isConnected
            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
            : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            {isConnected ? 'Comfy Online' : 'Comfy Offline'}
          </div>

          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wider border transition-all ${isForgeConnected
            ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
            : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}>
            <div className={`w-2 h-2 rounded-full ${isForgeConnected ? 'bg-indigo-400 animate-pulse' : 'bg-rose-400'}`} />
            {isForgeConnected ? 'Forge Online' : 'Forge Offline'}
          </div>
        </div>
      </div>

      {/* Workflow Tabs */}
      {renderWorkflowTabs()}

      {/* Main Content */}
      {selectedWfDef && workflowContent && (
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
      )}

      {/* Empty state */}
      {!workflowContent && !error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4">🎨</div>
            <p className="text-white/40 text-sm">Loading workflows...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default GenAICell;
