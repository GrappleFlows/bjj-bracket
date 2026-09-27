// Builds dist/ with esbuild. Type declarations come from `tsc` (see package.json).
import { build } from 'esbuild';
import { rmSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const banner = `/*! bjj-bracket v${pkg.version} | MIT License | (c) Grapple Flows | https://grappleflows.com/brackets */`;

rmSync('dist', { recursive: true, force: true });

const common = {
  bundle: true,
  target: 'es2020',
  legalComments: 'inline',
  banner: { js: banner },
  logLevel: 'warning',
};

await Promise.all([
  // Pure library, Node-safe, tree-shakeable.
  build({ ...common, entryPoints: ['src/index.ts'], outfile: 'dist/index.js', format: 'esm', platform: 'neutral', sourcemap: true }),
  // Library + element, registers <bjj-bracket> on import.
  build({ ...common, entryPoints: ['src/bjj-bracket.ts'], outfile: 'dist/bjj-bracket.js', format: 'esm', platform: 'browser', sourcemap: true }),
  // Script-tag build for jsDelivr / unpkg. Exposes window.BjjBracket.
  build({
    ...common,
    entryPoints: ['src/bjj-bracket.ts'],
    outfile: 'dist/bjj-bracket.min.js',
    format: 'iife',
    globalName: 'BjjBracket',
    platform: 'browser',
    minify: true,
  }),
]);

for (const file of ['dist/index.js', 'dist/bjj-bracket.js', 'dist/bjj-bracket.min.js']) {
  const bytes = statSync(file).size;
  const gz = gzipSync(readFileSync(file)).length;
  console.log(`${file.padEnd(26)} ${(bytes / 1024).toFixed(1).padStart(6)} kB  (${(gz / 1024).toFixed(1)} kB gzip)`);
}
