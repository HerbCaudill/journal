import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/vitest-setup.ts"],
    exclude: ["node_modules", "e2e"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    // Clear env variables for tests to ensure consistent test behavior
    "import.meta.env.VITE_CLAUDE_API_KEY": JSON.stringify(""),
    "import.meta.env.VITE_OPENAI_API_KEY": JSON.stringify(""),
    "import.meta.env.VITE_GOOGLE_CLIENT_ID": JSON.stringify(""),
  },
})
