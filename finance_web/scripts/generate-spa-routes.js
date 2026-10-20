import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');
const indexHtmlPath = path.join(distDir, 'index.html');

if (!fs.existsSync(indexHtmlPath)) {
  process.exit(1);
}

const indexContent = fs.readFileSync(indexHtmlPath, 'utf8');

const fallback404 = path.join(distDir, '404.html');
fs.writeFileSync(fallback404, indexContent);

const routes = [
  'login',
  'register',
  'dashboard',
  'transactions',
  'reports',
  'categories',
  'budgets',
  'streams',
  'recurring',
  'admin',
  'settings',
];

for (const route of routes) {
  const routeDir = path.join(distDir, route);
  fs.mkdirSync(routeDir, { recursive: true });
  fs.writeFileSync(path.join(routeDir, 'index.html'), indexContent);
}
