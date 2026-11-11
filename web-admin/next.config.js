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

    /**
     * Pin the tracing root to THIS directory, and do not let Next infer it.
     *
     * `output: 'standalone'` emits files at their path relative to this root,
     * so the root decides whether the entrypoint lands at
     * `.next/standalone/server.js` or nested under `.next/standalone/web-admin/`.
     * Unset, Next guesses from where lockfiles sit — which means the layout can
     * move because of a change somewhere else in the repo. It is pinned flat
     * here because that is what the runtime stage of web-admin/Dockerfile
     * copies and starts.
     *
     * NOTE THE LOCATION. On Next 14 this key is read from `experimental`; a
     * copy at the top level is silently ignored. It becomes top-level in Next
     * 15, so an upgrade must MOVE it rather than add it — leaving both means
     * the layout changes the day you upgrade.
     *
     * `shared/i18n` does not depend on this: webpack compiles it into the
     * server bundle, so it is never a traced file.
     */
    outputFileTracingRoot: __dirname,
  },
};
