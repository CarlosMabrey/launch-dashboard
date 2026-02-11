
import { AppItem } from './types';

// Initial apps - empty because the server's grimoire scanner + registry
// is the single source of truth. Apps are auto-discovered from D:\Pi\tools
// and D:\Pi\projects, and manually-added apps persist in grimoire-registry.json.
export const INITIAL_APPS: AppItem[] = [];
