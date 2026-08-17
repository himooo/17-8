#!/usr/bin/env node
// Cross-platform production build (Windows/Linux/macOS):
//   1. ensure data/ exists
//   2. prisma db push (schema sync; DATABASE_URL comes from .env)
//   3. next build --webpack (standalone output)
//   4. assemble .next/standalone (static assets + public)
//
// next build is spawned asynchronously: on Windows/Node a known native
// exit-crash (0xC0000409) can occur AFTER all artifacts are written. When the
// exit code is non-zero we verify BUILD_ID + standalone/server.js are fresh
// from THIS run and continue instead of failing the whole build.
const { spawn, execSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const prismaCli = require.resolve('prisma/build/index.js');
const nextCli = require.resolve('next/dist/bin/next');

function run(cmd) {
  execSync(cmd, { stdio: 'inherit', cwd: root });
}

function runNextBuild() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [nextCli, 'build', '--webpack'], {
      stdio: 'inherit',
      cwd: root,
    });
    child.on('error', (err) => {
      console.error('[build] failed to spawn next build:', err.message);
      resolve(false);
    });
    child.on('exit', (code) => resolve(code === 0));
  });
}

(async () => {
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });

  console.log('[build] syncing prisma schema -> data/custom.db');
  run(`node "${prismaCli}" db push --accept-data-loss`);

  const buildStart = Date.now();
  console.log('[build] running next build --webpack');
  const ok = await runNextBuild();
  if (!ok) {
    const buildId = path.join(root, '.next', 'BUILD_ID');
    const serverJs = path.join(root, '.next', 'standalone', 'server.js');
    const fresh =
      fs.existsSync(buildId) && fs.existsSync(serverJs) &&
      fs.statSync(buildId).mtimeMs > buildStart &&
      fs.statSync(serverJs).mtimeMs > buildStart;
    if (!fresh) {
      console.error('[build] next build failed without fresh artifacts — aborting.');
      process.exit(1);
    }
    console.warn('[build] next exited with a crash code but produced fresh artifacts — continuing.');
  }

  const staticSrc = path.join(root, '.next', 'static');
  const staticDst = path.join(root, '.next', 'standalone', '.next', 'static');
  const publicSrc = path.join(root, 'public');
  const publicDst = path.join(root, '.next', 'standalone', 'public');

  // fs.cpSync crashes natively on some Node/Windows combos for large trees —
  // use robocopy on Windows (exit codes < 8 are success) and cp -r elsewhere.
  function copyTree(src, dst) {
    if (process.platform === 'win32') {
      const code = spawnSync('robocopy', [src, dst, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP'], { stdio: 'ignore' }).status ?? 8;
      if (code >= 8) throw new Error(`robocopy failed (${code}) copying ${src}`);
    } else {
      execSync(`cp -r "${src}" "${dst}"`, { stdio: 'inherit' });
    }
  }
  copyTree(staticSrc, staticDst);
  copyTree(publicSrc, publicDst);
  console.log('[build] standalone assembled at .next/standalone');
})().catch((err) => {
  console.error('[build] failed:', err);
  process.exit(1);
});
