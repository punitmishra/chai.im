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

  // Security headers (host-agnostic — applied by Next.js regardless of deploy target)
  async headers() {
    // Content Security Policy. 'unsafe-inline'/'wasm-unsafe-eval' are required
    // for Next.js hydration bootstrap and the Signal-Protocol WASM module until
    // nonce-based CSP middleware is introduced (tracked as a follow-up).
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ].join('; ');

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
          // Force HTTPS for 2 years, including subdomains, and allow preload.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: csp,
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'off',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
