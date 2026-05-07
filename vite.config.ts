import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// When building for Vercel (VERCEL=1, set by `npm run build:vercel`),
// we swap the default Cloudflare/Lovable preset for Nitro's Vercel preset
// so output goes to `.vercel/output` in the format Vercel expects.
// In all other cases (Lovable preview, dist-check, local dev), we keep the
// default config which outputs to `dist/`.
const isVercel = process.env.VERCEL === "1" || process.env.VERCEL === "true";

export default isVercel
  ? defineConfig({
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      plugins: [require("nitro/vite").default({ preset: "vercel" })],
    })
  : defineConfig({});
