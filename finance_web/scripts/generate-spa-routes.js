import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');
const indexHtmlPath = path.join(distDir, 'index.html');

if (!fs.existsSync(indexHtmlPath)) {
  console.error('[SPA Generator] dist/index.html not found! Aborting.');
  process.exit(1);
}

const indexContent = fs.readFileSync(indexHtmlPath, 'utf8');

const fallback404 = path.join(distDir, '404.html');
fs.writeFileSync(fallback404, indexContent);
console.log('✓ Generated dist/404.html (Automatic fallback for static hosting)');

const routes = [
  'login',
  'register',
  'dashboard',
  'transactions',
  'reports',
  'categories',
  'budgets',
  'streams',
  'admin',
  'settings',
];

for (const route of routes) {
  const routeDir = path.join(distDir, route);
  fs.mkdirSync(routeDir, { recursive: true });
  fs.writeFileSync(path.join(routeDir, 'index.html'), indexContent);
  console.log(`✓ Generated physical route: dist/${route}/index.html`);
}

console.log('[SPA Generator] All physical route entry points generated successfully.');
