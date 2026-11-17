import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const boundary = read('public/app/install-boundary-v146.js');
const declutter = read('public/app/working-campus-home-declutter-v1.js');
const onboarding = read('public/app/new-user-onboarding-v1.js');
const campus = read('public/app/working-campus-v440.html');

test('browser access boundary parses as executable JavaScript', () => {
  assert.doesNotThrow(() => new vm.Script(boundary, { filename: 'install-boundary-v146.js' }));
  assert.match(boundary, /function allowed\(\)\{return true\}/);
});

test('canonical v440 campus activates the existing simplified home owner', () => {
  assert.match(campus, /src="\/app\/working-campus-home-declutter-v1\.js/);
  const boot = path => {
    const ctx = {
      location: { pathname: path },
      document: { readyState: 'loading', addEventListener() {} },
      addEventListener() {},
    };
    ctx.globalThis = ctx;
    vm.runInNewContext(declutter, ctx, { filename: 'working-campus-home-declutter-v1.js' });
    return Boolean(ctx.CivweaveHomeDeclutterV1?.openMenu);
  };
  assert.equal(boot('/app/working-campus-v440.html'), true);
  assert.equal(boot('/app/working-campus-v156.html'), true);
  assert.equal(boot('/app/unknown.html'), false);
});

test('first launch stays usable without a blocking introduction or API key', () => {
  assert.match(onboarding, /data-cw-onboarding-replay/);
  assert.doesNotMatch(onboarding, /if\s*\(shouldAutoOpen\(\)\)\s*requestAnimationFrame/);
  assert.match(onboarding, /function bindReplay\(/);
});
