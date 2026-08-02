import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CURRENT_VERSION = '1.0.25';
const CURRENT_BUILD = '1.0.25-freeze-recovery';
const targets = [
  {
    path: path.join(root, 'public', 'app', 'index.html'),
    replacements: [
      ['1.0.21-ai-uplift', CURRENT_BUILD],
      ['rc22.3.20-ai-checkpoint', CURRENT_VERSION],
      ['HOST v1.0.21', `HOST v${CURRENT_VERSION}`]
    ]
  },
  {
    path: path.join(root, 'public', 'app', 'seed.json'),
    replacements: [
      ['rc22.3.20-ai-uplift-v1.0.21', CURRENT_BUILD]
    ]
  },
  {
    path: path.join(root, 'public', 'index.html'),
    replacements: [
      ['AI UPLIFT · HOST v1.0.21', `RECOVERY · HOST v${CURRENT_VERSION}`],
      ['HOST v1.0.21', `HOST v${CURRENT_VERSION}`]
    ]
  }
];

for (const target of targets) {
  let text = await fsp.readFile(target.path, 'utf8');
  const before = text;
  for (const [from, to] of target.replacements) text = text.replaceAll(from, to);
  if (text !== before) await fsp.writeFile(target.path, text, 'utf8');
}

console.log(`Applied Commonweave ${CURRENT_VERSION} embedded version markers.`);
