
// Todo/Status Tracking Types
export interface TodoTask {
  id?: string;
  text: string;
  status: 'todo' | 'in-progress' | 'done' | 'blocked';
  assignee?: 'agent' | 'human';
  estimate?: string;
  tags?: string[];
  completedAt?: string;
  notes?: string;
}

export interface TodoMetadata {
  project?: string;
  version?: string;
  status: 'active' | 'on-hold' | 'completed' | 'blocked';
  priority: 'critical' | 'high' | 'medium' | 'low';
  health: number;
  lastUpdated?: string;
  agentSession?: string;
}

export interface TodoData {
  metadata: TodoMetadata;
  inProgress: TodoTask[];
  blocked: TodoTask[];
  completed: TodoTask[];
  backlog: TodoTask[];
  totalTasks: number;
  completedCount: number;
  progressPercent: number;
}

export interface AppItem {
  id: string;
  name: string;
  icon: string;
  badge: string;
  status: 'active' | 'idle' | 'init';
  colorClass: string;
  url: string;
  command?: string; // e.g., "npm run dev"
  directory?: string; // e.g., "D:\AI Programs\comfyui_app"
  isOnline?: boolean;
  isEmbedded?: boolean; // Whether to open inside launcher iframe
  embeddedUrl?: string; // URL for embedded iframe view
  appType?: 'web' | 'electron' | 'terminal' | 'url'; // Type of application - 'url' is for external websites
  batPath?: string; // Location of the .bat file
  port?: string; // Port to run the embedding on
  // Todo integration
  todoData?: TodoData;
  hasTodo?: boolean;
}


export type Status = 'active' | 'idle' | 'init';
