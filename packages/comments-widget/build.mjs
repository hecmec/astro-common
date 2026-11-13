import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

const outfile = resolve(import.meta.dirname, '../../services/comments/public/widget.js');
mkdirSync(dirname(outfile), { recursive: true });

await build({
  entryPoints: [resolve(import.meta.dirname, 'src/index.ts')],
  outfile,
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2022', 'safari15', 'firefox115'],
  legalComments: 'none',
});

const size = gzipSync(readFileSync(outfile)).length;
console.log(`widget.js: ${(size / 1024).toFixed(1)} KB gzipped`);
if (size > 20 * 1024) {
  console.error('widget.js is over the 20 KB gzipped budget');
  process.exit(1);
}
