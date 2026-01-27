/** @type {import('next').NextConfig} */
// Base path für Audion - ermöglicht parallelen Betrieb mit anderen Services
// Wird über Umgebungsvariable konfiguriert, Standard: leer (für Coolify)
const basePath = '';

const nextConfig = {
  reactStrictMode: true,
  // Ensure basePath is always a string, never undefined
  basePath: basePath || '',
  experimental: {
    serverActions: {
      enabled: true
    },
    optimizePackageImports: ['@mui/material', '@mui/icons-material'],
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
      {
        source: '/api/personas/:path*',
        destination: process.env.NEXT_PERSONA_BACKEND_INTERNAL_URL || 'http://api:8000/:path*',
      },
      {
        source: '/api/journeys/:path*',
        destination: process.env.NEXT_PERSONA_BACKEND_INTERNAL_URL
          ? `${process.env.NEXT_PERSONA_BACKEND_INTERNAL_URL}/journeys/:path*`
          : 'http://api:8000/journeys/:path*',
      }
    ];
  },
};

// Bundle Analyzer ist optional - nur wenn ANALYZE=true und Paket installiert
// Für Production-Builds mit ANALYZE=true muss @next/bundle-analyzer installiert sein
// In Development-Modus wird es nicht benötigt
export default nextConfig;
