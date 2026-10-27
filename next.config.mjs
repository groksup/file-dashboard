/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    localPatterns: [{ pathname: "/api/files/raw" }],
  },
  experimental: {
    agentFeedback: true,
    proxyClientMaxBodySize: "22mb",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
