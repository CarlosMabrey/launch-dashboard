const FORGE_URL = 'http://127.0.0.1:7860';

async function probe(path) {
    console.log(`Probing ${path}...`);
    try {
        const res = await fetch(`${FORGE_URL}${path}`);
        console.log(`  Status: ${res.status}`);
        if (res.ok) {
            const data = await res.json();
            console.log(`  Found: ${Array.isArray(data) ? data.length + ' items' : 'Object'}`);
            if (Array.isArray(data) && data.length > 0) {
                const sample = typeof data[0] === 'string' ? data[0] : (data[0].title || data[0].name || data[0].model_name || 'unknown');
                console.log(`  Sample: ${sample}`);
            } else if (data && typeof data === 'object') {
                console.log(`  Sample (obj): ${Object.keys(data).slice(0, 3)}`);
            }
            return true;
        } else {
            console.log(`  Failed: ${res.status}`);
        }
    } catch (e) {
        console.log(`  Error: ${e.message}`);
    }
    return false;
}

async function deepProbe(path) {
    console.log(`Deep probing ${path}...`);
    try {
        const res = await fetch(`${FORGE_URL}${path}`);
        if (res.ok) {
            const data = await res.json();
            const keys = Object.keys(data).filter(k => k.includes('dir') || k.includes('path') || k.includes('model') || k.includes('lora') || k.includes('vae'));
            console.log(`  Relevant keys: ${keys.slice(0, 10)}`);
            keys.slice(0, 5).forEach(k => console.log(`    ${k}: ${JSON.stringify(data[k]).slice(0, 200)}`));
        }
    } catch (e) {
        console.log(`  Error: ${e.message}`);
    }
}

async function run() {
    await probe('/sdapi/v1/sd-models');
    await deepProbe('/config');
    await deepProbe('/sdapi/v1/options');
    await probe('/sdapi/v1/cmd-flags');
}

run();
