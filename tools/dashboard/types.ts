
// Todo/Status Tracking Types (per-app)
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

// ============================================
// Dashboard Global Todo Board Types
// ============================================

export type DashboardTaskStatus = 'todo' | 'in-progress' | 'blocked' | 'done';
export type DashboardTaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface DashboardTask {
  id: string;
  title: string;
  priority: DashboardTaskPriority;
  tags: string[];
  estimate?: string; // e.g., "4h"
  status: DashboardTaskStatus;
  created: string; // ISO date
  started?: string;
  completed?: string;
  progress?: number; // 0-100
  assigned_to?: string; // agent name
  agent?: string; // alias
  description?: string;
  results?: string; // execution logs
  dependencies?: string[];
  section: string; // parent markdown heading (exact text)
  order: number; // order within section
}

export interface TodoSection {
  title: string; // markdown heading including ## markers
  tasks: DashboardTask[];
}

export interface TodoBoardData {
  sections: TodoSection[];
  // helper maps
  taskById: Map<string, DashboardTask>;
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
  isManaged?: boolean; // True if dashboard started this service
  isEmbedded?: boolean; // Whether to open inside launcher iframe
  embeddedUrl?: string; // URL for embedded iframe view
  appType?: 'web' | 'electron' | 'terminal' | 'url'; // Type of application - 'url' is for external websites
  batPath?: string; // Location of the .bat file
  port?: string; // Port to run the embedding on
  portOpen?: boolean; // Detect if port is already in use (indicates server running externally)
  // Todo integration
  todoData?: TodoData;
  hasTodo?: boolean;
  lastModified?: number; // Timestamp of last local modification
}


export type Status = 'active' | 'idle' | 'init';
