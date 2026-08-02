import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = [
  {
    path: path.join(root, 'public', 'app', 'index.html'),
    replacements: [
      ['1.0.21-ai-uplift', '1.0.25-freeze-recovery'],
      ['HOST v1.0.21', 'HOST v1.0.25']
    ]
  },
  {
    path: path.join(root, 'public', 'app', 'seed.json'),
    replacements: [
      ['rc22.3.20-ai-uplift-v1.0.21', '1.0.25-freeze-recovery']
    ]
  }
];

for (const target of targets) {
  let text = await fsp.readFile(target.path, 'utf8');
  const before = text;
  for (const [from, to] of target.replacements) text = text.replaceAll(from, to);
  if (text !== before) await fsp.writeFile(target.path, text, 'utf8');
}

console.log('Applied Commonweave v1.0.25 embedded version recovery markers.');
