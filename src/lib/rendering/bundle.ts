import path from "node:path";

import { bundle } from "@remotion/bundler";

/**
 * Bundles the Remotion entry (src/remotion/index.ts) once per process and
 * caches the location. Bundling runs webpack and takes tens of seconds — it
 * must never happen per render request.
 *
 * Render inputs are staged INTO the bundle's public dir at render time
 * (public assets are served from disk per request), so the cached bundle
 * stays valid across renders.
 */

let bundlePromise: Promise<string> | null = null;

export function getRemotionBundle(): Promise<string> {
  bundlePromise ??= bundle({
    entryPoint: path.join(process.cwd(), "src", "remotion", "index.ts"),
    publicDir: path.join(process.cwd(), "public"),
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...(config.resolve?.alias ?? {}),
          // Mirror the tsconfig "@/*" path alias for the Remotion bundle.
          "@": path.join(process.cwd(), "src"),
        },
      },
    }),
  });
  return bundlePromise;
}
