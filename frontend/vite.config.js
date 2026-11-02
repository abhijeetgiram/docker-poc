import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Only the frontend runs in this container. The backend runs in another container, so we need to proxy the API calls to it.
      // Only for "npm run dev" on your laptop. In production, the frontend and backend run in the same container, so no proxy is needed.
      // In docker, nginx is used to serve the frontend and proxy the API calls to the backend.
      "/api": "http://localhost:5000",
    },
  },
});
