import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

// Build for Vercel. Disables Cloudflare and emits .vercel/output.
export default defineConfig({
  cloudflare: false,
  plugins: [nitro({ preset: "vercel" })],
});
