/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    VITE_GEMINI_API_KEY: process.env.VITE_GEMINI_API_KEY,
  },
  // App Router: Configure experimental features for body size
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
