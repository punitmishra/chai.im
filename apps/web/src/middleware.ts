import { NextRequest, NextResponse } from 'next/server';
import scriptHashes from './generated/csp-hashes.json';

/**
 * Hash-based (plus nonce) strict Content Security Policy.
 *
 * Goal: a production `script-src` with NO `'unsafe-inline'`, while keeping the
 * landing/auth pages statically prerendered (no `force-dynamic`). This is the
 * real XSS mitigation protecting the localStorage session token.
 *
 * How the two script categories are trusted in production:
 *   - External chunks (`/_next/static/chunks/*.js`): allowed by `'self'`.
 *     NOTE: we deliberately do NOT use `'strict-dynamic'`, because it would
 *     disable `'self'`/host allow-listing and block those direct <script src>
 *     tags on statically prerendered pages.
 *   - Inline scripts on STATIC pages (Turbopack bootstrap, `__next_f` flight
 *     data): allowed by their SHA-256 hashes, extracted from the built HTML at
 *     build time by `scripts/generate-csp-hashes.mjs` into
 *     `src/generated/csp-hashes.json` (imported above).
 *   - Inline scripts on the DYNAMICALLY rendered route
 *     (`/chat/[conversationId]`): generated per request, so they cannot be
 *     pre-hashed. They are covered by a per-request `'nonce-...'` that Next.js
 *     applies automatically when it sees the nonce in the request CSP header
 *     (we also forward it via `x-nonce`).
 *
 * In development we keep `'unsafe-inline'`/`'unsafe-eval'` because the Next dev
 * server + React dev build + HMR rely on them.
 *
 * The non-CSP security headers (HSTS, COOP, COEP require-corp, X-Frame-Options,
 * Referrer-Policy, Permissions-Policy, X-DNS-Prefetch-Control,
 * X-Content-Type-Options) remain in next.config.js `headers()`.
 */
export function middleware(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== 'production';

  // Per-request base64 nonce (covers the dynamically rendered route's inline
  // scripts; harmless on static pages, whose inline scripts use hashes).
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  // In development the backend is served over http/ws (localhost), so allow it
  // and don't force-upgrade requests; production stays https/wss only.
  const connectSrc = isDev
    ? "connect-src 'self' https: wss: http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:*"
    : "connect-src 'self' https: wss:";

  let scriptSrc: string;
  if (isDev) {
    // Next dev + React dev build + HMR need 'unsafe-inline' and 'unsafe-eval'.
    scriptSrc = "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' 'unsafe-eval'";
  } else {
    // Production: no 'unsafe-inline', no 'unsafe-eval', no 'strict-dynamic'.
    // 'self' covers external chunks; build-time hashes cover static inline
    // scripts; the per-request nonce covers the dynamic route's inline scripts.
    const hashSources = (scriptHashes as string[]).map((h) => `'${h}'`).join(' ');
    scriptSrc =
      `script-src 'self' 'wasm-unsafe-eval' 'nonce-${nonce}'` +
      (hashSources ? ` ${hashSources}` : '');
  }

  const csp = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    connectSrc,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');

  // Forward the nonce + CSP on the request so Next.js can read the nonce and
  // apply it to the scripts it renders on dynamically rendered routes.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // And set it on the response so the browser enforces it.
  response.headers.set('Content-Security-Policy', csp);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * Also skip Next.js prefetch requests, which don't need the CSP header.
     * See: https://nextjs.org/docs/app/guides/content-security-policy
     */
    {
      source:
        '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
