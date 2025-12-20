/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Base path für Audion - ermöglicht parallelen Betrieb mit anderen Services
  // Wird über Umgebungsvariable konfiguriert, Standard: /audion
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  experimental: {
    serverActions: {
      enabled: true
    },
  },
  // Prevent static generation of error pages
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
  // Optimize bundle size
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  // SWC minification is enabled by default in Next.js 16
};

// Bundle Analyzer ist optional - nur wenn ANALYZE=true und Paket installiert
// Für Production-Builds mit ANALYZE=true muss @next/bundle-analyzer installiert sein
// In Development-Modus wird es nicht benötigt
export default nextConfig;
