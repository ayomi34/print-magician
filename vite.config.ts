import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// On Vercel deployments (VERCEL=1 is set automatically by Vercel, and by our
// `npm run build:vercel` script), apply the Nitro Vercel preset so the output
// goes to `.vercel/output` in the format Vercel expects.
// Everywhere else (Lovable preview, dist-check, local dev) we use the default
// Lovable config which outputs to `dist/`.
const isVercel = process.env.VERCEL === "1" || process.env.VERCEL === "true";

export default isVercel
  ? (async () => {
      const nitroMod: { default: (opts: { preset: string }) => unknown } =
        await import("nitro/vite");
      return defineConfig({
        plugins: [nitroMod.default({ preset: "vercel" }) as never],
      });
    })()
  : defineConfig({});
