const path = require('path');

/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // Emit a self-contained server bundle (.next/standalone) for a lean Docker image.
  output: 'standalone',
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  // Tree-shake barrel imports so each route bundles only the icons/charts it uses
  // (recharts especially — ~150KB — otherwise ships whole from a single import).
  experimental: {
    optimizePackageImports: ['recharts', 'lucide-react'],
    // `shared/i18n/` lives above this app's root so the two Expo apps can import
    // the same catalogue. Next refuses files outside the project root without
    // this flag.
    externalDir: true,
  },

  /**
   * Pin the tracing root to the REPO ROOT, and do not let Next infer it.
   *
   * `output: 'standalone'` emits its files at their path relative to this root.
   * Left unset, Next guesses the root from where lockfiles sit, so the layout
   * of `.next/standalone` depends on what the importing code happens to reach
   * outside this directory — which changed the day `@shared/i18n` was imported
   * here, and would change again silently.
   *
   * Pinned, the layout is a fact the Dockerfile can rely on:
   *
   *   .next/standalone/web-admin/server.js    <- the entrypoint
   *   .next/standalone/shared/...             <- the catalogue, traced in
   *   .next/standalone/web-admin/node_modules/...
   *
   * The runtime stage of web-admin/Dockerfile copies and starts exactly that.
   * Change one and you must change the other.
   */
  outputFileTracingRoot: path.join(__dirname, '..'),
};
