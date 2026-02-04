
export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
}

export type AppState = 'idle' | 'generating' | 'editing' | 'error';

export interface Preset {
  id: string;
  name: string;
  prompt: string;
  icon: string;
}
