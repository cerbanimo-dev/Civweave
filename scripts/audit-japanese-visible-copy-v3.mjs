import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const APP = fileURLToPath(new URL('../public/app/', import.meta.url));
const TRANSLATION_FILES = [
  new URL('../public/app/japanese-mode-v1.js', import.meta.url),
  new URL('../public/app/japanese-shell-copy-v1.js', import.meta.url),
];
const EXTRA_FILES = [
  fileURLToPath(new URL('../public/index.html', import.meta.url)),
  fileURLToPath(new URL('../public/install-v130.js', import.meta.url)),
];

const UI_KEYS = [
  'textContent','innerText','placeholder','title','ariaLabel','label','heading','eyebrow',
  'subtitle','description','message','hint','help','note','summary','emptyText','buttonText',
  'statusText','cta','copy','caption','legend','prompt','question','body','detail','reason'
];
const SINGLE_WORD_UI = new Set([
  'Add','Apply','Approve','Archive','Choose','Connect','Copy','Create','Decline','Disconnect',
  'Download','Enable','Disable','Filter','Finish','Install','Join','Leave','Login','Logout',
  'Pause','Refresh','Reject','Remove','Reset','Restore','Retry','Select','Submit','Sync','Update',
  'Upload','Verify','Vote','Name','Email','Account','Language','Status','Help','About','More','Less',
  'Expand','Collapse','Play','Resume','Skip','Confirm','Dismiss','Accept','Ignore','Invite','Members',
  'Member','Owner','Steward','History','Activity','Notifications','Privacy','Security','Recovery'
]);
const INJECTED_TERMS = new Set([
  'AI','API','BYOK','CPU','GPU','WebGPU','WASM','JSON','URL','HTTP','HTTPS','PWA','QR','NFC',
  'CORS','JWT','OAuth','SSE','SQL','WebSocket','GGUF','ONNX','PMTiles','MapLibre','MapTiler',
  'WebLLM','Transformers.js','llama.cpp','Termux','Antigravity','Git','npm','Node.js',
  'Civweave','Living School','Cerbanimo','FellowFare','Anarchadia','Commonweave','Weaveling',
  'Moss','Kamiya','Rook','Merlin','MiniLM','Qwen','SmolLM','Gemini','OpenAI','Ollama','Cloudflare',
  'Stripe','Spotify','GitHub','Google','WebAuthn','Chromium','Android','iOS','Windows','macOS','Linux',
  'Docker','Render','Neon','Postgres','SQLite','IndexedDB','Service Worker','Workers AI'
]);

function unescapeLiteral(value) {
  return value
    .replace(/\\n/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\([\\'"`])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function translationKeys(source) {
  const keys = new Set();
  for (const line of source.split(/\r?\n/)) {
    let match = line.match(/^\s*\[\s*'((?:\\.|[^'])*)'\s*,/);
    if (!match) match = line.match(/^\s*\[\s*"((?:\\.|[^"])*)"\s*,/);
    if (match) keys.add(unescapeLiteral(match[1]));
  }
  return keys;
}

function looksInjectedEnglish(text) {
  const stripped = text
    .replace(/[·•|/(),:+–—-]/g, ' ')
    .replace(/\b\d+(?:\.\d+)*\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) return true;
  if (INJECTED_TERMS.has(stripped)) return true;
  const words = stripped.split(' ');
  return words.every(word => INJECTED_TERMS.has(word) || /^[A-Z0-9]{2,8}$/.test(word));
}

function looksLikeCodeFragment(value) {
  if (/^[,;:.]\s/.test(value)) return true;
  if (/^[A-Za-z_$][\w$]*(?:[._/-][A-Za-z0-9_$-]+)+$/.test(value)) return true;
  if (/(?:^|[;,(])\s*(?:const|let|var|return|if|else|function|document|window)\b/.test(value)) return true;
  if (/(?:\)\.|\.replace(?:All)?\(|\.map\(|\.join\(|\.filter\(|\.find\(|\.querySelector\(|\.innerHTML\b)/.test(value)) return true;
  if (/===|!==|&&|\|\||\?\.|=>/.test(value)) return true;
  if (/(?:^|\s)(?:row|item|entry|state|data|result|body|panel)\.[A-Za-z_$][\w$]*/.test(value)) return true;
  if (/[`'"]/.test(value) && /[();={}\[\]]/.test(value)) return true;
  return false;
}

function candidate(text) {
  const value = unescapeLiteral(text);
  if (!/[A-Za-z]/.test(value)) return '';
  if (value.length < 2 || value.length > 220) return '';
  if (/https?:\/\//i.test(value) || /(?:^|\s)\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+/.test(value)) return '';
  if (/\.(?:js|mjs|json|css|html|png|jpg|jpeg|webp|svg|wasm|onnx|zip)\b/i.test(value)) return '';
  if (/[{}<>]=?|=>|\$\{|\\[dwsb]|--[a-z]/i.test(value)) return '';
  if (looksLikeCodeFragment(value)) return '';
  if (/^[a-z][A-Za-z0-9]*$/.test(value) && !SINGLE_WORD_UI.has(value)) return '';
  if (/^[A-Z0-9_.:-]+$/.test(value) && !SINGLE_WORD_UI.has(value)) return '';
  if (looksInjectedEnglish(value)) return '';
  const words = value.match(/[A-Za-z][A-Za-z'-]*/g) || [];
  if (words.length === 1 && !SINGLE_WORD_UI.has(value)) return '';
  return value;
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['node_modules','vendor','assets','logos','sprites'].includes(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (['.js','.mjs','.html'].includes(extname(entry.name))) out.push(full);
  }
  return out;
}

function add(found, text, file, line, context) {
  const value = candidate(text);
  if (!value) return;
  const key = `${file}:${line}:${value}`;
  if (!found.has(key)) found.set(key, { text: value, file, line, context });
}

function scanJs(source, file, found) {
  const lines = source.split(/\r?\n/);
  const keys = UI_KEYS.join('|');
  const single = new RegExp(`(?:${keys})\\s*[:=]\\s*'((?:\\\\.|[^'])*)'`, 'g');
  const double = new RegExp(`(?:${keys})\\s*[:=]\\s*"((?:\\\\.|[^"])*)"`, 'g');
  const template = new RegExp('(?:' + keys + ')\\s*[:=]\\s*`([^`$]*)`', 'g');
  const attrSingle = /setAttribute\(\s*['"](?:aria-label|title|placeholder|alt)['"]\s*,\s*'((?:\\.|[^'])*)'/g;
  const attrDouble = /setAttribute\(\s*['"](?:aria-label|title|placeholder|alt)['"]\s*,\s*"((?:\\.|[^"])*)"/g;
  const alertSingle = /(?:alert|confirm)\(\s*'((?:\\.|[^'])*)'\s*\)/g;
  const alertDouble = /(?:alert|confirm)\(\s*"((?:\\.|[^"])*)"\s*\)/g;
  lines.forEach((line, index) => {
    for (const re of [single,double,template,attrSingle,attrDouble,alertSingle,alertDouble]) {
      re.lastIndex = 0;
      let match;
      while ((match = re.exec(line))) add(found, match[1], file, index + 1, line.trim());
    }
    if (/[`'"]/.test(line) && /<[a-z][^>]*>/i.test(line)) {
      const textNode = />\s*([^<>{}$]*[A-Za-z][^<>{}$]*)\s*</g;
      let match;
      while ((match = textNode.exec(line))) add(found, match[1], file, index + 1, line.trim());
    }
  });
}

function scanHtml(source, file, found) {
  const without = source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const lines = without.split(/\r?\n/);
  lines.forEach((line, index) => {
    const textNode = />\s*([^<>]*[A-Za-z][^<>]*)\s*</g;
    const attrs = /\b(?:aria-label|title|placeholder|alt)\s*=\s*['"]([^'"]*[A-Za-z][^'"]*)['"]/gi;
    let match;
    while ((match = textNode.exec(line))) add(found, match[1], file, index + 1, line.trim());
    while ((match = attrs.exec(line))) add(found, match[1], file, index + 1, line.trim());
  });
}

const translated = new Set();
for (const url of TRANSLATION_FILES) {
  const source = await readFile(url, 'utf8');
  for (const key of translationKeys(source)) translated.add(key);
}

const files = [...await walk(APP), ...EXTRA_FILES];
const found = new Map();
for (const full of files) {
  const source = await readFile(full, 'utf8');
  const file = relative(ROOT, full).replaceAll('\\', '/');
  if (file.includes('japanese-mode-v1.js') || file.includes('japanese-shell-copy-v1.js')) continue;
  if (extname(full) === '.html') scanHtml(source, file, found);
  else scanJs(source, file, found);
}

const missing = [...found.values()]
  .filter(item => !translated.has(item.text))
  .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.text.localeCompare(b.text));

const byText = new Map();
for (const item of missing) {
  if (!byText.has(item.text)) byText.set(item.text, []);
  byText.get(item.text).push(item);
}

console.log(`Japanese visible-copy coverage audit: ${translated.size} translation keys; ${byText.size} untranslated candidate strings.`);
for (const [text, items] of byText) {
  const places = items.slice(0, 4).map(item => `${item.file}:${item.line}`).join(', ');
  console.log(`MISSING\t${JSON.stringify(text)}\t${places}`);
}

if (process.argv.includes('--strict') && byText.size) process.exitCode = 1;
