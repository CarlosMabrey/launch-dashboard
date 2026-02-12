
# 🚀 JellyLaunch Cockpit

A high-performance developer dashboard for managing local services (NPM, Electron, Vite) with a premium Apple-aesthetic interface.

## 🛠 Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-username/jellylaunch.git
cd jellylaunch

# 2. Install dependencies
npm install

# 3. Start the cockpit
npm run dev
```

## 🏗 Integrating Your Apps

JellyLaunch is designed to be the "Front Door" for your local development environment.

### Adding a Custom App (NPM/Electron)
1. Click the **"New Build"** (+) card in the dashboard.
2. **Identity**: Enter your project name (e.g., "Main App").
3. **Directory**: Enter the full path to your project (e.g., `D:\AI Programs\comfyui_app`).
4. **Environment**: Enter your local port (e.g., `3000`).
5. **Command Binding**: Set your launch command:
   - For React/Vite: `npm run dev`
   - For Electron: `npm start`
   - For Node APIs: `node server.js`
6. **Aesthetic**: Use the **"Synthesize Image"** button to generate a custom 4K icon using Gemini 3 Pro.

### Technical Architecture
- **State Model**: Reactive persistence in local storage.
- **Image Engine**: Nano Banana Pro (Gemini-3-pro-image-preview).
- **Styling**: Tailwind CSS + Custom Jelly Easing.

## 📡 Deployment
To build a production bundle of the dashboard:
```bash
npm run build
```
The `/dist` folder will contain the minified glassmorphic dashboard.

## 🗺️ Roadmap Feature

The **Roadmap** page provides a unified, visual execution order for all tasks across the main dashboard and your project folders.

### How it works
- **Aggregation**: The dashboard scans `D:\Pi\tools\dashboard\todo.md` (main) and all `D:\Pi\projects\*\todo.md` files.
- **Parsing**: Tasks are parsed using the same logic as the Todo Board, extracting title, status, priority, assignee, estimates, and dependencies.
- **Real-time updates**: When any todo.md file changes, the server notifies connected clients via Server-Sent Events (SSE). If SSE is unavailable, the client falls back to polling every 30 seconds.

### Views
1. **List** – Sortable table with columns: Priority, Title, Project, Status (click to cycle), Estimate, Dependencies.
2. **Kanban** – Drag-and-drop columns (Backlog, In Progress, Blocked, Done) to update status.
3. **Project Map** – Dependency graph for selected project, displaying nodes and arrows between dependent tasks.

### Keyboard shortcuts
- `→` / `←` – Change task status (List view: row click also cycles)
- `E` – Open file in VS Code (requires `path` configured)
- `A` – Assign to self (Pi)
- `D` – Add dependency (future)

### Refreshing
- Click the refresh button in the header to manually reload.
- Auto-refresh is enabled via SSE; you should see updates within seconds of editing any todo.md file.

### Access
Open the sidebar and click **Roadmap** (🗺️) under the Agents section (or navigate to `/roadmap`).
