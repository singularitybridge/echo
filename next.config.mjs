/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disabled to prevent double-generation of AI images
  env: {
    VITE_GEMINI_API_KEY: process.env.VITE_GEMINI_API_KEY,
  },
  // App Router: Configure experimental features for body size
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // Exclude FFmpeg packages from webpack bundling (server-side only)
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('fluent-ffmpeg', '@ffmpeg-installer/ffmpeg');
    }
    return config;
  },
};

export default nextConfig;
