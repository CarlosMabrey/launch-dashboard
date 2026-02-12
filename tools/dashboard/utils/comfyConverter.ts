/**
 * Converts a standard ComfyUI "Graph" JSON (with nodes and links) 
 * to the "API" format (Prompt format) used by the dashboard.
 */
const NODE_WIDGET_MAP: Record<string, string[]> = {
    // ─── Core Nodes ──────────────────────────────────────────────────────────
    "KSampler": ["seed", "control_after_generate", "steps", "cfg", "sampler_name", "scheduler", "denoise"],
    "KSamplerAdvanced": ["add_noise", "noise_seed", "control_after_generate", "steps", "start_at_step", "end_at_step", "return_with_leftover_noise"],
    "CheckpointLoaderSimple": ["ckpt_name"],
    "CheckpointLoader": ["config_name", "ckpt_name"],
    "VAELoader": ["vae_name"],
    "CLIPTextEncode": ["text"],
    "SaveImage": ["filename_prefix"],
    "LoadImage": ["image", "upload"],
    "EmptyLatentImage": ["width", "height", "batch_size"],
    "LoraLoader": ["lora_name", "strength_model", "strength_clip"],
    "CLIPSetLastLayer": ["stop_at_clip_layer"],
    "ConditioningCombine": [],
    "ConditioningSetArea": ["width", "height", "x", "y", "strength"],
    "ConditioningSetMask": ["strength", "set_cond_area"],
    "GrowMask": ["expand", "tapered_corners"],
    "ImageScale": ["upscale_method", "width", "height", "crop"],
    "ImageScaleBy": ["upscale_method", "scale_by"],
    "ImagePadForOutpaint": ["top", "left", "bottom", "right", "feathering"],
    "UpscaleModelLoader": ["model_name"],
    "VAEDecodeTiled": ["tile_size", "overlap"],
    "VAEEncodeTiled": ["tile_size", "overlap"],

    // ─── ComfyUI-GGUF ────────────────────────────────────────────────────────
    "UnetLoaderGGUF": ["unet_name"],
    "ClipLoaderGGUF": ["clip_name", "type", "device"],

    // ─── Efficiency Nodes ────────────────────────────────────────────────────
    "Efficient Loader": ["ckpt_name", "vae_name", "clip_skip", "lora_name", "lora_model_strength", "lora_clip_strength", "positive", "negative", "token_normalization", "weight_interpretation", "empty_latent_width", "empty_latent_height", "batch_size"],
    "KSampler (Efficient)": ["seed", "control_after_generate", "steps", "cfg", "sampler_name", "scheduler", "denoise", "preview_method", "vae_decode"],

    // ─── Impact Pack ─────────────────────────────────────────────────────────
    "FaceDetailer": ["guide_size", "guide_size_for", "max_size", "seed", "steps", "cfg", "sampler_name", "scheduler", "denoise", "feather", "noise_mask", "force_inpaint", "bbox_threshold", "segm_threshold", "mask_erode_dilate"],

    // ─── ControlNet ──────────────────────────────────────────────────────────
    "ControlNetLoader": ["control_net_name"],
    "ControlNetApply": ["strength"],
    "ControlNetApplyAdvanced": ["strength", "start_percent", "end_percent"],

    // ─── IPAdapter ───────────────────────────────────────────────────────────
    "IPAdapterApply": ["weight", "noise", "start_at", "end_at", "unfold_batch"],
    "IPAdapterModelLoader": ["ipadapter_file"],



    // ─── Ultimate SD Upscale ─────────────────────────────────────────────────
    "UltimateSDUpscale": ["upscale_by", "seed", "control_after_generate", "steps", "cfg", "sampler_name", "scheduler", "denoise", "mode", "tile_width", "tile_height", "masking", "seeding", "radius", "blur_sigma", "denoise_mask", "polishing", "polishing_strength", "polishing_factor"],

    // ─── Comfyroll ───────────────────────────────────────────────────────────
    "CR LoRA Stack": [
        "switch_1", "lora_name_1", "model_weight_1", "clip_weight_1",
        "switch_2", "lora_name_2", "model_weight_2", "clip_weight_2",
        "switch_3", "lora_name_3", "model_weight_3", "clip_weight_3"
    ],
    "CR Apply LoRA Stack": [], // Inputs are connections usually

    // ─── ReActor ─────────────────────────────────────────────────────────────
    "ReActorFaceSwap": ["enabled", "swap_model", "facedetection", "face_restore_model", "codeformer_weight", "detect_gender_source", "detect_gender_input", "source_faces_index", "input_faces_index", "console_log_level"],
    "ReActorFaceBoost": ["enabled", "boost_model", "interpolation", "visibility", "codeformer_weight", "restore_with_main_after"],
};

export function convertGraphToApi(graph: any): any {
    if (!graph || !graph.nodes || !Array.isArray(graph.nodes)) {
        // Already in API format or unknown
        return graph;
    }

    const apiFormat: any = {};
    const nodes = graph.nodes;
    const links = graph.links || [];

    // 1. Create a map of links for easy lookup: linkId -> [fromNodeId, fromSlotIndex]
    const linkIdMap = new Map<number, [number, number]>();
    for (const link of links) {
        if (Array.isArray(link) && link.length >= 3) {
            linkIdMap.set(link[0], [link[1], link[2]]);
        }
    }

    // 2. Process each node
    for (const node of nodes) {
        const nodeId = node.id;
        const nodeType = node.type;
        const apiNode: any = {
            inputs: {},
            class_type: nodeType
        };

        // Widgets (constant values set in the UI)
        // In Graph format, widgets_values is an array. We need to map them to keys.
        // This is the hardest part because the keys aren't explicitly in the Graph JSON.
        // However, for standard nodes, we can guess or leave them as is if they are already named.
        if (node.widgets_values && Array.isArray(node.widgets_values)) {
            // Note: mapping array to keys requires knowledge of the node's schema.
            // API format usually has them as named keys.
            // We'll try to use the node's own 'properties' or just store them as indexed keys
            // and hope the user/dashboard handles it.
            // BUT for common nodes, we can be smarter.
            const knownWidgets = NODE_WIDGET_MAP[nodeType];

            node.widgets_values.forEach((val: any, idx: number) => {
                // If we have a known name for this widget index, use it.
                if (knownWidgets && knownWidgets[idx]) {
                    apiNode.inputs[knownWidgets[idx]] = val;
                } else {
                    apiNode.inputs[`widget_${idx}`] = val;
                }
            });
        }

        // Connections (inputs from other nodes)
        if (node.inputs && Array.isArray(node.inputs)) {
            for (const input of node.inputs) {
                if (input.link !== null && linkIdMap.has(input.link)) {
                    const [fromNodeId, fromSlotIndex] = linkIdMap.get(input.link)!;
                    apiNode.inputs[input.name] = [String(fromNodeId), fromSlotIndex];
                } else if (input.value !== undefined) {
                    apiNode.inputs[input.name] = input.value;
                }
            }
        }

        apiFormat[nodeId] = apiNode;
    }

    return apiFormat;
}

/**
 * Automatically identifies and parameterizes common fields in a workflow.
 */
/**
 * Automatically identifies and parameterizes common fields in a workflow.
 * Returns the modified workflow with `__ui.inputs` metadata populated.
 */
export function parameterizeWorkflow(apiWorkflow: any): any {
    const workflow = JSON.parse(JSON.stringify(apiWorkflow));
    const uiInputs: any[] = [];
    const seenKeys = new Set<string>();

    const addInput = (key: string, type: string, label: string, defaultValue: any, visible: boolean = true) => {
        if (!seenKeys.has(key)) {
            uiInputs.push({ key, type, label, default: defaultValue, visible });
            seenKeys.add(key);
        }
        return `{{${key}}}`; // Return the template tag
    };

    // 1. First pass: Identify KSamplers to find connected prompts
    const samplerNodes: any[] = [];
    for (const id in workflow) {
        if (workflow[id].class_type === 'KSampler' || workflow[id].class_type === 'KSamplerAdvanced') {
            samplerNodes.push({ id, node: workflow[id] });
        }
    }

    // 2. Iterate nodes and parameterize
    for (const nodeId in workflow) {
        const node = workflow[nodeId];
        const type = node.class_type;

        if (type === 'KSampler' || type === 'KSamplerAdvanced') {
            if (node.inputs.seed !== undefined) {
                node.inputs.seed = addInput('SEED', 'NUMBER', 'Seed', typeof node.inputs.seed === 'number' ? node.inputs.seed : -1);
            }
            if (node.inputs.steps) {
                node.inputs.steps = addInput('STEPS', 'NUMBER', 'Steps', node.inputs.steps);
            }
            if (node.inputs.cfg) {
                node.inputs.cfg = addInput('CFG', 'NUMBER', 'CFG Scale', node.inputs.cfg);
            }
            if (node.inputs.sampler_name) {
                node.inputs.sampler_name = addInput('SAMPLER', 'SAMPLER', 'Sampler', node.inputs.sampler_name);
            }
            if (node.inputs.scheduler) {
                node.inputs.scheduler = addInput('SCHEDULER', 'SCHEDULER', 'Scheduler', node.inputs.scheduler);
            }
        }

        else if (type === 'EmptyLatentImage') {
            if (node.inputs.width) {
                node.inputs.width = addInput('WIDTH', 'NUMBER', 'Width', node.inputs.width);
            }
            if (node.inputs.height) {
                node.inputs.height = addInput('HEIGHT', 'NUMBER', 'Height', node.inputs.height);
            }
            if (node.inputs.batch_size) {
                // Usually keep batch size 1, maybe hidden
                node.inputs.batch_size = addInput('BATCH_SIZE', 'NUMBER', 'Batch Size', node.inputs.batch_size, false);
            }
        }

        else if (type === 'CheckpointLoaderSimple' || type === 'CheckpointLoader' || type === 'UnetLoaderGGUF') {
            const param = type === 'UnetLoaderGGUF' ? 'unet_name' : 'ckpt_name';
            if (node.inputs[param]) {
                node.inputs[param] = addInput('MODEL', 'MODEL', 'Checkpoint', node.inputs[param]);
            }
        }

        else if (type === 'VAELoader') {
            if (node.inputs.vae_name) {
                node.inputs.vae_name = addInput('VAE', 'VAE', 'VAE', node.inputs.vae_name);
            }
        }

        else if (type === 'CLIPTextEncode') {
            // Heuristic: Is this Positive or Negative?
            // Check if it connects to a KSampler's 'positive' or 'negative' input
            let isPositive = false;
            let isNegative = false;

            // Check all samplers to see if they reference this node
            for (const { node: sampler } of samplerNodes) {
                const posInput = sampler.inputs.positive;
                const negInput = sampler.inputs.negative;

                // Connection format: [nodeId, slotIndex]
                if (Array.isArray(posInput) && posInput[0] === nodeId) isPositive = true;
                if (Array.isArray(negInput) && negInput[0] === nodeId) isNegative = true;
            }

            const currentText = node.inputs.text;
            if (typeof currentText === 'string' && !currentText.includes('{{')) {
                if (isPositive) {
                    node.inputs.text = addInput('PROMPT', 'PROMPT', 'Positive Prompt', currentText);
                } else if (isNegative) {
                    node.inputs.text = addInput('NEGATIVE_PROMPT', 'PROMPT', 'Negative Prompt', currentText);
                } else {
                    // Unknown purpose, generic valid text
                    const key = `TEXT_${nodeId}`;
                    node.inputs.text = addInput(key, 'PROMPT', `Text (${nodeId})`, currentText);
                }
            }
        }

        else if (type === 'LoadImage') {
            if (node.inputs.image) {
                const key = `IMAGE_${nodeId}`;
                node.inputs.image = addInput(key, 'IMAGE', `Input Image (${nodeId})`, node.inputs.image);
            }
        }
    }

    // Attach metadata
    if (!workflow.__ui) workflow.__ui = {};
    workflow.__ui.inputs = uiInputs;

    return workflow;
}
