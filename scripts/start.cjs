#!/usr/bin/env node
// Cross-platform production start: runs .next/standalone/server.js with the
// canonical DATABASE_URL (absolute, forward slashes) since the standalone
// server does not load .env files by itself.
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const server = path.join(root, '.next', 'standalone', 'server.js');
const dbPath = path.join(root, 'data', 'custom.db').replace(/\\/g, '/');

if (!require('node:fs').existsSync(server)) {
  console.error('[start] .next/standalone/server.js not found — run `npm run build` first.');
  process.exit(1);
}

const child = spawn(process.execPath, [server], {
  stdio: 'inherit',
  cwd: path.dirname(server),
  env: {
    ...process.env,
    NODE_ENV: 'production',
    DATABASE_URL: `file:${dbPath}`,
    PORT: process.env.PORT || '3000',
    HOSTNAME: process.env.HOSTNAME || '0.0.0.0',
  },
});

child.on('exit', (code) => process.exit(code ?? 0));
