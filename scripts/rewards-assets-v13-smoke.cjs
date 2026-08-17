const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const giftNames = [
  'rocket-star', 'rainbow-medal', 'magic-book', 'math-trophy', 'super-pencil',
  'idea-lamp', 'comet-sticker', 'golden-crown', 'team-badge', 'confetti-box',
  'planet-puzzle', 'heart-encouragement',
];
const soundSpecs = {
  'bisalasa-success-bright.wav': [0.55, 1.05],
  'bisalasa-success-perfect.wav': [0.9, 1.8],
  'bisalasa-gift-reveal.wav': [0.65, 1.35],
  'bisalasa-celebration-class.wav': [1.4, 2.8],
  'bisalasa-gentle-correction.wav': [0.35, 0.9],
  'bisalasa-level-up.wav': [1.0, 2.0],
  'bisalasa-fireworks-impact.wav': [1.0, 2.1],
  'bisalasa-session-finish.wav': [1.8, 3.2],
  'bisalasa-student-picker.wav': [0.6, 1.4],
};
let checks = 0;
function check(condition, name) {
  checks += 1;
  if (!condition) throw new Error(`FAIL ${name}`);
  console.log(`PASS ${name}`);
}

// Windows/Linux: python3 is not always on PATH (Windows ships `python`).
function runPython(args) {
  for (const bin of ['python3', 'python']) {
    const probe = spawnSync(bin, args, { encoding: 'utf8' });
    if (probe.error ? probe.error.code !== 'ENOENT' : true) return probe;
  }
  return null;
}

// Pure-Node WAV duration from the RIFF header — no ffprobe dependency.
function wavDurationSeconds(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return NaN;
  let offset = 12;
  let byteRate = 0;
  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString('ascii', offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    if (chunkId === 'fmt ') {
      byteRate = buf.readUInt32LE(offset + 16);
    } else if (chunkId === 'data') {
      if (!byteRate) return NaN;
      return chunkSize / byteRate;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  return NaN;
}

for (const name of giftNames) {
  const file = path.join(root, 'public', 'gifts', `${name}.png`);
  check(fs.existsSync(file), `gift file ${name}`);
  const probe = runPython(['-c', [
    'from PIL import Image',
    'import sys',
    'im=Image.open(sys.argv[1]).convert("RGBA")',
    'a=im.getchannel("A")',
    'assert a.getextrema()[0] == 0',
  ].join(';'), file]);
  check(probe && probe.status === 0, `gift alpha ${name}`);
}

for (const [name, [min, max]] of Object.entries(soundSpecs)) {
  const file = path.join(root, 'public', 'sounds', name);
  check(fs.existsSync(file), `sound file ${name}`);
  const duration = wavDurationSeconds(file);
  check(Number.isFinite(duration), `sound probe ${name}`);
  check(duration >= min && duration <= max, `sound duration ${name}`);
}

const shellUtils = fs.readFileSync(path.join(root, 'src/lib/shell-utils.ts'), 'utf8');
const dataStore = fs.readFileSync(path.join(root, 'src/lib/data-store.ts'), 'utf8');
for (const name of giftNames) check(dataStore.includes(`/gifts/${name}.png`), `gift mapping ${name}`);
for (const name of Object.keys(soundSpecs)) check(shellUtils.includes(`/sounds/${name}`), `sound mapping ${name}`);
check(shellUtils.includes('"success": "/sounds/bisalasa-success-bright.wav"'), 'success alias uses new sound');
check(shellUtils.includes('"celebrate-gift": "/sounds/bisalasa-gift-reveal.wav"'), 'gift alias uses new sound');

console.log(JSON.stringify({ ok: true, suite: 'rewards-assets-v13-smoke', checks }));
