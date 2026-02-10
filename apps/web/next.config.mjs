/** @type {import('next').NextConfig} */
// Base path für Audion - ermöglicht parallelen Betrieb mit anderen Services
// Wird über Umgebungsvariable konfiguriert, Standard: leer (für Coolify/lokal)
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig = {
  reactStrictMode: true,
  // Ensure basePath is always a string, never undefined
  basePath: basePath || '',
  experimental: {
    serverActions: {
      enabled: true
    },
    // @msqdx/react excluded: optimizePackageImports can trigger TDZ with DS barrel
    optimizePackageImports: ['@mui/material', '@mui/icons-material', '@msqdx/tokens'],
  },
  // Prevent static generation of error pages
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
  // Disable static generation for error pages
  // output: 'standalone',
  // Optimize bundle size
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Configure webpack for development (HMR errors are suppressed client-side)
  // Note: Next.js 16 uses Turbopack by default, but we use --webpack flag for builds
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Configure watch options for file changes
      config.watchOptions = {
        ...config.watchOptions,
        poll: 1000, // Use polling instead of native file system events (helps with some network setups)
        aggregateTimeout: 300, // Delay before rebuilding once the first file changed
      };
    }
    return config;
  },
  // Add empty turbopack config to silence the warning when webpack config is present
  turbopack: {},

  // HMR is disabled to prevent WebSocket connection errors
  // Page will still reload on file changes, but without WebSocket connection
  devIndicators: {
    buildActivity: true,
    buildActivityPosition: 'bottom-right',
  },

  // SWC minification is enabled by default in Next.js 16

  // Proxy API requests to backend services to avoid CORS and Mixed Content issues
  async rewrites() {
    const personaBackend =
      process.env.NEXT_PERSONA_BACKEND_INTERNAL_URL?.trim() || 'http://api:8000';
    return [
      {
        source: '/api/chat/:path*',
        destination: process.env.NEXT_PUBLIC_CHAT_API_URL
          ? `${process.env.NEXT_PUBLIC_CHAT_API_URL}/chat/:path*`
          : 'http://chat-api:8001/chat/:path*',
      },
      {
        source: '/api/voice/:path*',
        destination: process.env.NEXT_PUBLIC_VOICE_API_URL
          ? `${process.env.NEXT_PUBLIC_VOICE_API_URL}/voice/:path*`
          : 'http://chat-api:8001/voice/:path*',
      },
      // Swagger UI (/api/docs) and OpenAPI spec - Swagger fetches /openapi.json from origin
      {
        source: '/api/docs',
        destination: `${personaBackend}/docs`,
      },
      {
        source: '/api/docs/:path*',
        destination: `${personaBackend}/docs/:path*`,
      },
      {
        source: '/openapi.json',
        destination: `${personaBackend}/openapi.json`,
      },
      // NOTE: persona backend routes are handled by Next.js app/api proxies
      // to inject auth headers and project scoping.
    ];
  },
};

// Bundle Analyzer ist optional - nur wenn ANALYZE=true und Paket installiert
// Für Production-Builds mit ANALYZE=true muss @next/bundle-analyzer installiert sein
// In Development-Modus wird es nicht benötigt
export default nextConfig;
