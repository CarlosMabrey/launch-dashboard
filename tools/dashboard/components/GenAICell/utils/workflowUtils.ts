import { MemoryStats, GenAIWorkflowDefinition, GenAIConfig } from '../../services/genaiService';
import { convertGraphToApi, parameterizeWorkflow } from '../../utils/comfyConverter';

export const API_BASE = 'http://localhost:3005/api/pi';

export interface UiInputConfig {
  key: string;
  type: string;
  label: string;
  target?: string;
  options?: string[];
  default?: any;
  visible?: boolean;
  min?: number;
  max?: number;
  step?: number;
}

/**
 * Extract UI-configurable inputs from a workflow JSON
 */
export function getWorkflowUiInputs(workflowContent: any): UiInputConfig[] {
  if (!workflowContent) return [];

  // Check for explicit __ui.inputs metadata
  if (workflowContent?.__ui?.inputs && Array.isArray(workflowContent.__ui.inputs)) {
    let inputs = workflowContent.__ui.inputs
      .filter((i: any) => i && (i.key || i.target))
      .map((i: any) => ({
        key: String(i.key || i.target || ''),
        type: String(i.type || 'TEXT'),
        label: String(i.label || i.key || i.target || ''),
        target: i.target,
        options: i.options,
        default: i.default,
        visible: i.visible !== false,
        min: i.min,
        max: i.max,
        step: i.step
      }));

    // Ensure LORA selector input exists (add if missing)
    const hasLoraInput = inputs.some(inp => inp.key === '__LORA_SELECTOR__');
    if (!hasLoraInput) {
      inputs.push({
        key: '__LORA_SELECTOR__',
        type: 'LORA',
        label: 'LoRA Enhancements',
        visible: true,
        default: []
      });
    }

    return inputs;
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

  // Also ensure LORA selector in fallback case
  const hasLoraInput = found.some(inp => inp.key === '__LORA_SELECTOR__');
  if (!hasLoraInput) {
    found.push({
      key: '__LORA_SELECTOR__',
      type: 'LORA',
      label: 'LoRA Enhancements',
      visible: true,
      default: []
    });
  }

  return found;
}

/**
 * Apply template values to a workflow (replace {{KEY}} tokens and apply targeted inputs)
 */
export function applyTemplate(workflow: any, params: Record<string, any>, uiInputs: any[]): any {
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

/**
 * Process workflow features (bypass nodes / set parameters)
 */
export function processWorkflowFeatures(
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

/**
 * Inject LoRA loader nodes into the workflow chain.
 */
export function injectLoras(workflow: any, loras: LoraConfig[]) {
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
  for (const [id, node] of Object.entries(cloned) as [string, any][]) {
    if (id === modelNodeId || id === clipNodeId) continue;

    if (node.inputs) {
      for (const key in node.inputs) {
        const val = node.inputs[key];
        if (Array.isArray(val) && val.length === 2) {
          // Check Model Connection
          if (val[0] === modelNodeId && val[1] === modelOutputSlot) {
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
}

// ─── Inpainting Helpers ───────────────────────────────────────────────────────

/**
 * Generate a simple rectangular mask as base64 PNG
 */
export function generateSimpleMask(width: number, height: number, segment: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'white';
  let x = 0, y = 0, w = width, h = height;

  switch (segment) {
    case 'Upper-clothes':
      y = Math.floor(height * 0.25);
      h = Math.floor(height * 0.35);
      x = Math.floor(width * 0.15);
      w = Math.floor(width * 0.7);
      break;
    case 'Lower-clothes':
      y = Math.floor(height * 0.55);
      h = Math.floor(height * 0.4);
      x = Math.floor(width * 0.2);
      w = Math.floor(width * 0.6);
      break;
    case 'Dress':
      y = Math.floor(height * 0.15);
      h = Math.floor(height * 0.7);
      x = Math.floor(width * 0.1);
      w = Math.floor(width * 0.8);
      break;
    case 'Hat':
      y = Math.floor(height * 0.05);
      h = Math.floor(height * 0.2);
      x = Math.floor(width * 0.25);
      w = Math.floor(width * 0.5);
      break;
    case 'Shoes':
      y = Math.floor(height * 0.8);
      h = Math.floor(height * 0.15);
      x = Math.floor(width * 0.2);
      w = Math.floor(width * 0.6);
      break;
    default:
      x = Math.floor(width * 0.3);
      y = Math.floor(height * 0.3);
      w = Math.floor(width * 0.4);
      h = Math.floor(height * 0.4);
  }

  ctx.fillRect(x, y, w, h);
  return canvas.toDataURL('image/png').split(',')[1];
}

/**
 * Upload a base64 image and return the server filename
 */
export async function uploadBase64Image(base64: string, filename: string): Promise<{ name: string }> {
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
