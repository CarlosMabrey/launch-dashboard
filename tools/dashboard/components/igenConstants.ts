
export interface Preset {
    id: string;
    name: string;
    prompt: string;
    icon: string;
}

export const PRESETS: Preset[] = [
    {
        id: 'glassmorphic',
        name: 'Glass',
        prompt: 'Apple style glassmorphic icon with soft translucent layers, vibrant background bleed, subtle inner glow, premium 3D depth, minimalist symbol.',
        icon: '✨'
    },
    {
        id: 'midnight',
        name: 'Midnight',
        prompt: 'Sleek professional dark mode icon, space gray metallic finish, chamfered edges, minimalist monochromatic symbol, subtle top-down lighting, premium matte texture.',
        icon: '🌙'
    },
    {
        id: 'skeuomorphic',
        name: 'Neo-Skeuo',
        prompt: 'Modern high-fidelity skeuomorphic icon, realistic textures like brushed metal and leather, soft realistic shadows, premium Apple aesthetic, tactile feel.',
        icon: '📦'
    },
    {
        id: 'vibrant',
        name: 'Vibrant Mesh',
        prompt: 'iOS 18 style mesh gradient background icon, smooth color transitions, minimalist white glyph in center, soft rounded corners, high contrast, clean aesthetic.',
        icon: '🌈'
    },
    {
        id: 'minimalist',
        name: 'Flat Pro',
        prompt: 'Ultra-minimalist flat vector icon, clean geometric shapes, Apple design language, bold iconography, professional aesthetic.',
        icon: '✂️'
    }
];

export const SYSTEM_PROMPT = "You are a professional Apple UI/UX designer. Your task is to generate icons and logos that strictly follow the Apple Human Interface Guidelines aesthetic: minimalism, high-quality textures, rounded corners, subtle depth, and premium finishes. ALWAYS center the icon. ALWAYS output on a solid #00FF00 neon green background (Chroma key) for clean transparency keying. NO shadows should bleed into the green background.";
