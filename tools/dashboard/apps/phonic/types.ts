
export interface MusicDemo {
  id: string;
  name: string;
  description: string;
  tags: string[];
  coverUrl: string;
  mp3Url: string;
  lyrics: string;
  duration: string;
  hash: string;
  createdAt: number;
}

export type ViewMode = 'GRID' | 'DETAILS';
