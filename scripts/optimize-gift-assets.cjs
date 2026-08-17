const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const inputDir = path.join(process.cwd(), 'public', 'gifts');
const outputDir = inputDir;

async function main() {
  const files = fs.readdirSync(inputDir).filter((name) => name.endsWith('.png'));
  for (const name of files) {
    const input = path.join(inputDir, name);
    const output = path.join(outputDir, name.replace(/\.png$/i, '.webp'));
    await sharp(input).webp({ quality: 82, effort: 4, alphaQuality: 90 }).toFile(output);
  }
  console.log(`Optimized ${files.length} gift PNG files to WebP.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
