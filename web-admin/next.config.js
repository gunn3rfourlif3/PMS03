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
  },
};
