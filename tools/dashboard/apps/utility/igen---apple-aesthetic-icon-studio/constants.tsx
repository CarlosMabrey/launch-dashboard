
import { Preset } from './types';

export const PRESETS: Preset[] = [
  {
    id: 'glassmorphic',
    name: 'Glassmorphic',
    prompt: 'Apple style glassmorphic icon with soft translucent layers, vibrant background bleed, subtle inner glow, premium 3D depth, minimalist symbol, on a clean white background.',
    icon: '✨'
  },
  {
    id: 'midnight',
    name: 'Midnight Pro',
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
  }
];

export const SYSTEM_PROMPT = "You are a professional Apple UI/UX designer. Your task is to generate or edit icons and logos that strictly follow the Apple Human Interface Guidelines aesthetic: minimalism, high-quality textures, rounded corners (squircle), subtle depth, and premium finishes. When requested for transparency, ensure the icon is centered and cleanly separated from its background.";
