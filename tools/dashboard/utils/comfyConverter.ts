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

    // ─── ReActor ─────────────────────────────────────────────────────────────
    "ReActorFaceSwap": ["enabled", "swap_model", "face_restore_model", "restore_visibility", "codeformer_weight", "detect_gender_input", "detect_gender_source", "input_faces_index", "source_faces_index", "console_log_level"],

    // ─── Ultimate SD Upscale ─────────────────────────────────────────────────
    "UltimateSDUpscale": ["upscale_by", "seed", "control_after_generate", "steps", "cfg", "sampler_name", "scheduler", "denoise", "mode", "tile_width", "tile_height", "masking", "seeding", "radius", "blur_sigma", "denoise_mask", "polishing", "polishing_strength", "polishing_factor"],
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
export function parameterizeWorkflow(apiWorkflow: any): any {
    const parameterized = JSON.parse(JSON.stringify(apiWorkflow));

    for (const nodeId in parameterized) {
        const node = parameterized[nodeId];
        const type = node.class_type;

        if (type === 'CLIPTextEncode') {
            if (node.inputs.text && String(node.inputs.text).length > 3 && !String(node.inputs.text).includes('{{')) {
                node.inputs.text = '{{PROMPT}}';
            }
        } else if (type === 'LoadImage') {
            if (node.inputs.image && !String(node.inputs.image).includes('{{')) {
                node.inputs.image = '{{IMAGE}}';
            }
        } else if (type === 'EmptyLatentImage') {
            if (node.inputs.width && !String(node.inputs.width).includes('{{')) node.inputs.width = '{{WIDTH|NUMBER}}';
            if (node.inputs.height && !String(node.inputs.height).includes('{{')) node.inputs.height = '{{HEIGHT|NUMBER}}';
        } else if (type === 'KSampler') {
            if (node.inputs.seed !== undefined) node.inputs.seed = '{{SEED|NUMBER}}';
        }
    }

    return parameterized;
}
