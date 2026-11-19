/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Deterministic build id. The hash-based CSP (see src/middleware.ts) depends
  // on the SHA-256 of Next's inline bootstrap scripts, which embed the build id.
  // A random per-build id (Next's default) makes those hashes change on every
  // build, which would break the two-pass "build -> extract hashes -> rebuild"
  // flow. Deriving the id from the git commit (or an explicit env override)
  // keeps it stable within a single build/deploy while still rotating across
  // deploys so client-side navigation data is correctly cache-busted.
  generateBuildId: async () => {
    if (process.env.NEXT_BUILD_ID) return process.env.NEXT_BUILD_ID;
    try {
      const { execFileSync } = require('child_process');
      return execFileSync('git', ['rev-parse', 'HEAD'], {
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim();
    } catch {
      // No git available (e.g. some CI/container builds): fall back to a stable
      // constant so the two build passes still agree.
      return 'chai-static-buildid';
    }
  },

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
  //
  // NOTE: The Content-Security-Policy is intentionally NOT set here. It is now
  // generated per-request (with a fresh nonce) in `src/middleware.ts` so that
  // production can use a nonce + 'strict-dynamic' script-src instead of
  // 'unsafe-inline'. All the non-CSP security headers remain below.
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
          // Force HTTPS for 2 years, including subdomains, and allow preload.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
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
