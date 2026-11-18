#!/usr/bin/env node
/**
 * Rebuild public/standalone.html from index.html + css + js.
 * Keep the single-file version in sync with the modular sources.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');

const index = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(publicDir, 'css/style.css'), 'utf8');
const tutorial = fs.readFileSync(path.join(publicDir, 'js/tutorial.js'), 'utf8');
let game = fs.readFileSync(path.join(publicDir, 'js/game.js'), 'utf8');

const portraitDir = path.join(publicDir, 'assets/portraits');
for (const file of fs.readdirSync(portraitDir)) {
  if (!/\.(jpe?g|png|gif|webp)$/i.test(file)) continue;
  const buf = fs.readFileSync(path.join(portraitDir, file));
  const ext = path.extname(file).slice(1).toLowerCase().replace('jpg', 'jpeg');
  const dataUri = `data:image/${ext};base64,${buf.toString('base64')}`;
  const rel = `assets/portraits/${file}`;
  game = game.split(JSON.stringify(rel)).join(JSON.stringify(dataUri));
  game = game.split(`"${rel}"`).join(`"${dataUri}"`);
  game = game.split(`'${rel}'`).join(`'${dataUri}'`);
}

let html = index;
const styleTag = `<style>\n${css.trim()}\n  </style>`;
if (!html.includes('href="css/style.css"')) {
  throw new Error('index.html is missing the css/style.css link');
}
html = html.replace(/\s*<link rel="stylesheet" href="css\/style\.css" \/>\s*/, `\n  ${styleTag}\n`);

const scriptNeedle = '<script src="js/tutorial.js"></script>\n  <script src="js/game.js"></script>';
if (!html.includes(scriptNeedle)) {
  throw new Error('index.html is missing tutorial.js / game.js script tags');
}
html = html.replace(
  scriptNeedle,
  `<script>\n${tutorial.trim()}\n  </script>\n  <script>\n${game.trim()}\n  </script>`
);

if (html.includes('css/style.css') || html.includes('src="js/')) {
  throw new Error('standalone still references external css/js');
}

const out = path.join(publicDir, 'standalone.html');
fs.writeFileSync(out, html);
const bytes = fs.statSync(out).size;
console.log(`Wrote public/standalone.html (${bytes} bytes)`);
