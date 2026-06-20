// DEMO dev-server launcher. Runs Vite programmatically with cwd + root + an
// explicit PostCSS config dir so Tailwind compiles correctly even when launched
// from a different working directory (via the space-free junction).
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);

const server = await createServer({
  root: __dirname,
  configFile: path.join(__dirname, 'vite.config.ts'),
  css: { postcss: __dirname }, // force-discover postcss.config.js (Tailwind + autoprefixer)
  server: { port: 3000, strictPort: true, host: true },
});
await server.listen();
server.printUrls();
