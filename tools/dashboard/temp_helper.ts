
// Helper to parse ComfyUI history into a flat list of media
const parseHistory = (history: any) => {
    const results: Array<{ id: string, url: string, isVideo: boolean, time: number }> = [];
    if (!history) return results;

    Object.entries(history).forEach(([id, data]: [string, any]) => {
        if (!data?.outputs) return;

        // Try to get timestamp from prompt array [timeline, user_id, {nodes}]
        // If prompt[0] is a large number, it's likely a timestamp.
        // Note: ComfyUI history keys are usually UUIDs, but prompt[0] is often 0. 
        // Fallback: use a random recent time if 0, or just date.now() on first load? 
        // Actually, let's just use Date.now() for "fresh" history if we can't find better, 
        // but better to rely on order.
        // Let's rely on the fact that Object.entries might not be sorted, but usually are chronologically in JS for non-integer keys? No.
        // We should trust the prompt ID order or prompt[0] if available.

        let time = Date.now();
        // Experimental: check Prompt metadata
        // data.prompt is [number, string, object]
        // If data.prompt[0] > 1000000000, use it.
        /* 
        if (data.prompt && Array.isArray(data.prompt) && typeof data.prompt[0] === 'number' && data.prompt[0] > 1700000000000) {
           // Comfy sometimes uses microtime or just an index. 
           // For now, let's treat them as "recent" based on sorting keys.
        }
        */

        // Iterate outputs
        for (const nodeOutput of Object.values(data.outputs)) {
            const no = nodeOutput as any;
            const outs = [...(no?.images || []), ...(no?.gifs || [])];
            for (const out of outs) {
                const isVid = out.filename?.match(/\.(mp4|webm|mov|gif)$/i);
                const url = getGenAIOutputUrl(out.filename, out.type, out.subfolder);
                // We use the ID as a tie-breaker for time if we lack real time
                results.push({
                    id: `${id}-${out.filename}`,
                    url,
                    isVideo: !!isVid,
                    time: 0 // We'll sort by ID later or assume fetch order?
                });
            }
        }
    });

    return results;
};
