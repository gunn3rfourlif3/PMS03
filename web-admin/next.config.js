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
    // this flag. NOT YET CONFIRMED AGAINST A BUILD: `output: 'standalone'` traces
    // its own file set, and whether it follows an externalDir import is the one
    // thing a typecheck cannot tell us. `npm run build` in web-admin is the test.
    externalDir: true,
  },
};
