// vite.config.ts
import path from "path";
import { defineConfig, loadEnv } from "file:///D:/Pi/tools/dashboard/node_modules/vite/dist/node/index.js";
import react from "file:///D:/Pi/tools/dashboard/node_modules/@vitejs/plugin-react/dist/index.js";
var __vite_injected_original_dirname = "D:\\Pi\\tools\\dashboard";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const isElectron = process.env.ELECTRON === "true";
  return {
    server: {
      port: 5173,
      // Changed to match Electron main.js expectation
      host: "0.0.0.0"
    },
    plugins: [react()],
    define: {
      "process.env.API_KEY": JSON.stringify(env.GEMINI_API_KEY),
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
      "process.env.ELECTRON": JSON.stringify(isElectron)
    },
    resolve: {
      alias: {
        "@": path.resolve(__vite_injected_original_dirname, ".")
      }
    },
    base: isElectron ? "./" : "/",
    // Use relative paths for Electron
    build: {
      outDir: "dist",
      assetsDir: "assets",
      rollupOptions: {
        input: {
          main: path.resolve(__vite_injected_original_dirname, "index.html")
        }
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxQaVxcXFx0b29sc1xcXFxkYXNoYm9hcmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXFBpXFxcXHRvb2xzXFxcXGRhc2hib2FyZFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovUGkvdG9vbHMvZGFzaGJvYXJkL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcsIGxvYWRFbnYgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcbiAgICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsICcuJywgJycpO1xuICAgIGNvbnN0IGlzRWxlY3Ryb24gPSBwcm9jZXNzLmVudi5FTEVDVFJPTiA9PT0gJ3RydWUnO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBzZXJ2ZXI6IHtcbiAgICAgICAgcG9ydDogNTE3MywgLy8gQ2hhbmdlZCB0byBtYXRjaCBFbGVjdHJvbiBtYWluLmpzIGV4cGVjdGF0aW9uXG4gICAgICAgIGhvc3Q6ICcwLjAuMC4wJyxcbiAgICAgIH0sXG4gICAgICBwbHVnaW5zOiBbcmVhY3QoKV0sXG4gICAgICBkZWZpbmU6IHtcbiAgICAgICAgJ3Byb2Nlc3MuZW52LkFQSV9LRVknOiBKU09OLnN0cmluZ2lmeShlbnYuR0VNSU5JX0FQSV9LRVkpLFxuICAgICAgICAncHJvY2Vzcy5lbnYuR0VNSU5JX0FQSV9LRVknOiBKU09OLnN0cmluZ2lmeShlbnYuR0VNSU5JX0FQSV9LRVkpLFxuICAgICAgICAncHJvY2Vzcy5lbnYuRUxFQ1RST04nOiBKU09OLnN0cmluZ2lmeShpc0VsZWN0cm9uKVxuICAgICAgfSxcbiAgICAgIHJlc29sdmU6IHtcbiAgICAgICAgYWxpYXM6IHtcbiAgICAgICAgICAnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuJyksXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBiYXNlOiBpc0VsZWN0cm9uID8gJy4vJyA6ICcvJywgLy8gVXNlIHJlbGF0aXZlIHBhdGhzIGZvciBFbGVjdHJvblxuICAgICAgYnVpbGQ6IHtcbiAgICAgICAgb3V0RGlyOiAnZGlzdCcsXG4gICAgICAgIGFzc2V0c0RpcjogJ2Fzc2V0cycsXG4gICAgICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgICAgICBpbnB1dDoge1xuICAgICAgICAgICAgbWFpbjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ2luZGV4Lmh0bWwnKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBeVAsT0FBTyxVQUFVO0FBQzFRLFNBQVMsY0FBYyxlQUFlO0FBQ3RDLE9BQU8sV0FBVztBQUZsQixJQUFNLG1DQUFtQztBQUl6QyxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssTUFBTTtBQUN0QyxRQUFNLE1BQU0sUUFBUSxNQUFNLEtBQUssRUFBRTtBQUNqQyxRQUFNLGFBQWEsUUFBUSxJQUFJLGFBQWE7QUFFNUMsU0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLE1BQ04sTUFBTTtBQUFBO0FBQUEsTUFDTixNQUFNO0FBQUEsSUFDUjtBQUFBLElBQ0EsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLElBQ2pCLFFBQVE7QUFBQSxNQUNOLHVCQUF1QixLQUFLLFVBQVUsSUFBSSxjQUFjO0FBQUEsTUFDeEQsOEJBQThCLEtBQUssVUFBVSxJQUFJLGNBQWM7QUFBQSxNQUMvRCx3QkFBd0IsS0FBSyxVQUFVLFVBQVU7QUFBQSxJQUNuRDtBQUFBLElBQ0EsU0FBUztBQUFBLE1BQ1AsT0FBTztBQUFBLFFBQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsR0FBRztBQUFBLE1BQ2xDO0FBQUEsSUFDRjtBQUFBLElBQ0EsTUFBTSxhQUFhLE9BQU87QUFBQTtBQUFBLElBQzFCLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxNQUNSLFdBQVc7QUFBQSxNQUNYLGVBQWU7QUFBQSxRQUNiLE9BQU87QUFBQSxVQUNMLE1BQU0sS0FBSyxRQUFRLGtDQUFXLFlBQVk7QUFBQSxRQUM1QztBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNKLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
