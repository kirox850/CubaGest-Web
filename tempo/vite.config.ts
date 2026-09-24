import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { tempoVitePlugin } from "tempo-sdk";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const tempoRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(tempoRoot, "..");

export default defineConfig({
  root: tempoRoot,
  resolve: {
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "tempo-sdk"],
  },
  plugins: [
    tailwindcss(),
    tempoVitePlugin({ sourceIdentityRoot: projectRoot }),
    react(),
    tsconfigPaths({
      projectDiscovery: "lazy",
    }),
  ],
  server: {
    fs: {
      allow: [".."],
    },
  },
  optimizeDeps: {
    // The tempo-host demand-registers canvases lazily (per-canvas
    // lazy(() => import(...)), only for canvases the user has opened) for fault
    // isolation, so Vite's dep optimizer never sees an unopened canvas's import
    // graph up front. Without this entries glob, the first open of a canvas
    // that pulls a dep-novel package triggers a mid-session re-optimize that
    // splits React in the already-loaded host frame (stale react.js?v=A vs a
    // re-optimized react-dom_client.js?v=B) -> "Cannot read properties of null
    // (reading 'useState')" at CanvasHost mount, with no watchdog to recover.
    // Two guards: (1) entries crawls every canvas page's static import graph in
    // the initial scan -- this replaces Vite's default html entry detection, so
    // "index.html" MUST stay listed; (2) include pins React core into the
    // initial pre-bundle so the split is structurally impossible even if a
    // later-created canvas re-optimizes.
    entries: ["index.html", "designs/**/index.canvas.tsx"],
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
});
