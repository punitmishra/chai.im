/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Use Turbopack (Next.js 16+)
  turbopack: {},

  // Exclude heavy ML packages from server bundling
  serverExternalPackages: ['@xenova/transformers', 'onnxruntime-node', 'onnxruntime-web', 'sharp'],

  // Enable WebAssembly
  webpack: (config, { isServer }) => {
    // Exclude @xenova/transformers from server bundle
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('@xenova/transformers');
      config.externals.push('onnxruntime-node');
    }
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Handle WASM files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    return config;
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Required for SharedArrayBuffer (WASM features)
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          // Security headers
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
