
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
