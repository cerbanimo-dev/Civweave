import fs from 'node:fs';

const html = fs.readFileSync('public/app/index.html', 'utf8');
const manifest = JSON.parse(fs.readFileSync('public/app/manifest.webmanifest', 'utf8'));

const required = [
  'id="campus-install-progress"',
  'id="offline-campus-progress-track"',
  'id="offline-campus-progress-fill"',
  'id="offline-campus-progress-percent"',
  "install.textContent = 'Launch Civweave'",
  "window.open(target.href, 'civweave-pwa-relaunch')",
  "window.close()",
  'location.replace(target.href)'
];

for (const token of required) {
  if (!html.includes(token)) throw new Error(`Missing installer progress contract: ${token}`);
}

const progressPosition = html.indexOf('id="campus-install-progress"');
const installPosition = html.indexOf('id="install-app"');
if (progressPosition < 0 || installPosition < 0 || progressPosition > installPosition) {
  throw new Error('Offline campus progress must appear above the install button.');
}

if ((html.match(/id="offline-package-state"/g) || []).length !== 1) {
  throw new Error('Offline campus state must have exactly one DOM owner.');
}
if ((html.match(/id="offline-package-assets"/g) || []).length !== 1) {
  throw new Error('Offline campus asset count must have exactly one DOM owner.');
}
if ((html.match(/id="download-offline-package"/g) || []).length !== 1) {
  throw new Error('Offline campus resumable trigger must have exactly one DOM owner.');
}

if (manifest?.launch_handler?.client_mode !== 'navigate-new') {
  throw new Error('Installed Civweave launches must request a fresh PWA client.');
}

console.log('Installer campus progress + fresh launch contract verified.');
