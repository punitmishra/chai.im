#!/usr/bin/env node
/**
 * Post-build step for the hash-based Content Security Policy.
 *
 * Next.js emits a handful of INLINE <script> tags on every statically
 * prerendered page (the Turbopack runtime bootstrap, `self.__next_f.push([0])`,
 * and the RSC flight-data payload). A strict production CSP without
 * 'unsafe-inline' must whitelist those scripts by their SHA-256 hash.
 *
 * This script scans the prerendered HTML produced by `next build`, computes the
 * SHA-256 of each inline script's contents, and writes the sorted, de-duped set
 * to `src/generated/csp-hashes.json`. `src/middleware.ts` imports that file and
 * folds the hashes into the `script-src` directive.
 *
 * Because the inline scripts embed the Next build id, the hashes are only stable
 * when the build id is fixed (see `generateBuildId` in next.config.js). The
 * package `build` script therefore runs: next build -> this script -> next build,
 * so the second build bundles middleware with hashes that match the (byte-for-byte
 * identical) HTML it regenerates.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const OUT_FILE = path.join(webRoot, 'src', 'generated', 'csp-hashes.json');

// Prerendered HTML lives under .next/server/app (App Router) and
// .next/server/pages (the built-in 404/500 pages).
const SCAN_DIRS = [
  path.join(webRoot, '.next', 'server', 'app'),
  path.join(webRoot, '.next', 'server', 'pages'),
];

/** Recursively collect every *.html file under `dir`. */
function collectHtml(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectHtml(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

// Match <script> tags that do NOT carry a `src=` attribute (i.e. inline ones).
const INLINE_SCRIPT_RE = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g;

const hashes = new Set();
let scanned = 0;

for (const dir of SCAN_DIRS) {
  for (const file of collectHtml(dir)) {
    scanned += 1;
    const html = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = INLINE_SCRIPT_RE.exec(html)) !== null) {
      const body = m[1];
      if (body.trim() === '') continue; // skip empty / JSON-LD-less tags
      const digest = crypto.createHash('sha256').update(body, 'utf8').digest('base64');
      hashes.add(`sha256-${digest}`);
    }
  }
}

const sorted = [...hashes].sort();

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(sorted, null, 2) + '\n', 'utf8');

console.log(
  `[csp-hashes] scanned ${scanned} HTML file(s); wrote ${sorted.length} inline script hash(es) to ${path.relative(webRoot, OUT_FILE)}`
);

if (scanned === 0) {
  console.warn(
    '[csp-hashes] WARNING: no prerendered HTML found. Run `next build` before this script.'
  );
}
