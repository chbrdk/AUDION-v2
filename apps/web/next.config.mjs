/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      enabled: true
    },
  },
  // Prevent static generation of error pages
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
};

export default nextConfig;

