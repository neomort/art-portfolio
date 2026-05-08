import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const env = process.env.VITE_ENV || process.env.NODE_ENV || 'production';
const root = process.cwd();
const srcDemo = resolve(root, 'public', 'robots.demo.txt');
const srcProd = resolve(root, 'public', 'robots.prod.txt');
const dest = resolve(root, 'public', 'robots.txt');

const isDemo = /^demo$/i.test(env);
const src = isDemo ? srcDemo : srcProd;

if (!existsSync(src)) {
  console.error(`[select-robots] Source file missing: ${src}`);
  process.exit(1);
}

copyFileSync(src, dest);
console.log(`[select-robots] robots.txt -> ${isDemo ? 'robots.demo.txt' : 'robots.prod.txt'} (VITE_ENV=${env})`);
