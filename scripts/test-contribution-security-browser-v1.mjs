import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('browser security wraps the raw mesh instead of trusting raw balances or transfer finality', async () => {
  const source = await read('public/app/shared/civweave-contribution-security-v1.js');
  assert.match(source, /const raw=globalThis\.CivweaveContributionMeshV1/);
  assert.match(source, /balance:secureBalance/);
  assert.match(source, /availableBalance:secureAvailableBalance/);
  assert.match(source, /createPendingTransfer,witnessTransfer,finalizeTransfer,transferStatus/);
  assert.match(source, /MintSecurityCertified/);
  assert.match(source, /TransferSecurityCertified/);
  assert.match(source, /validMintCertificate/);
  assert.match(source, /validTransferCertificate/);
  assert.match(source, /committee-finality/);
});

test('secure wallet is independent of the transport key and has threshold recovery', async () => {
  const source = await read('public/app/shared/civweave-contribution-security-v1.js');
  assert.match(source, /generateKey\(\{name:'ECDSA',namedCurve:'P-256'\},true/);
  assert.match(source, /importEcdsaPrivate\(privateJwk,false\)/);
  assert.match(source, /configureRecovery/);
  assert.match(source, /guardians\.length<3/);
  assert.match(source, /threshold<2\|\|threshold>guardians\.length/);
  assert.match(source, /splitSecret/);
  assert.match(source, /combineSecret/);
  assert.match(source, /confirmRecoveryDistribution/);
  assert.match(source, /installRecoveredWallet/);
});

test('validator finality is anchored, root-diverse, deterministic and fail-closed', async () => {
  const source = await read('public/app/shared/civweave-contribution-security-v1.js');
  assert.match(source, /POLICY_PROTOCOL='civweave\.security-policy-anchor\.v1'/);
  assert.match(source, /roots\.length<3/);
  assert.match(source, /Math\.floor\(roots\.length\*2\/3\)\+1/);
  assert.match(source, /ValidatorRegistered/);
  assert.match(source, /ValidatorAttested/);
  assert.match(source, /objectiveEquivocators/);
  assert.match(source, /epochSeed:snapshot\.anchor\?\.epochSeed/);
  assert.match(source, /committee\.length>=snapshot\.policy\.minValidatorRoots/);
  assert.match(source, /new Set\(anchor\.genesisValidators\.map/);
});

test('shipping limits block high offline value, unrecovered wallets and unbounded mesh input', async () => {
  const source = await read('public/app/shared/civweave-contribution-security-v1.js');
  assert.match(source, /recoveryRequiredAbove:\{BUTTON:5,ACORN:1\}/);
  assert.match(source, /maxOfflineAmount:\{BUTTON:25,ACORN:5\}/);
  assert.match(source, /maxTransferAmount:\{BUTTON:500,ACORN:100\}/);
  assert.match(source, /maxEnvelopeBytes:128\*1024/);
  assert.match(source, /maxBundleEnvelopes:500/);
  assert.match(source, /maxPendingTransfersPerHour:20/);
  assert.match(source, /maxWitnessesPerHour:120/);
  assert.match(source, /externalOfframpsEnabled:false/);
  assert.match(source, /emergencyHalt:false/);
  assert.match(source, /policy-anchor-required/);
  assert.match(source, /insufficient-validator-roots/);
  assert.match(source, /recovery-required/);
  assert.match(source, /offline-value-limit/);
});

test('ship guard adds committee-certified wallet containment and contribution-state quarantine', async () => {
  const source = await read('public/app/shared/civweave-contribution-ship-guard-v1.js');
  assert.match(source, /WalletFreezeRequested/);
  assert.match(source, /WalletFreezeWitnessed/);
  assert.match(source, /WalletSecurityFrozen/);
  assert.match(source, /freezeCommittee/);
  assert.match(source, /evidence\.witnesses\.length<evidence\.committee\.quorum/);
  assert.match(source, /wallet is committee-frozen and cannot create transfers/);
  assert.match(source, /wallet is committee-frozen and cannot gain transfer witnesses/);
  assert.match(source, /wallet is committee-frozen and cannot gain finality/);
  assert.match(source, /quarantineOversizedContributionState/);
  assert.match(source, /ship-guard: oversized contribution envelope/);
  assert.match(source, /ship-guard: future-dated contribution envelope/);
  assert.match(source, /local-wallet-frozen/);
});

test('installed and offline packages carry security and containment before phone ledger boot', async () => {
  const html = await read('public/app/installed-entry-v146.html');
  const mesh = html.indexOf('/app/shared/civweave-contribution-mesh-v1.js');
  const security = html.indexOf('/app/shared/civweave-contribution-security-v1.js');
  const guard = html.indexOf('/app/shared/civweave-contribution-ship-guard-v1.js');
  const phone = html.indexOf('/app/phone-ledger-bootstrap-v1.js');
  assert.ok(mesh >= 0 && security > mesh && guard > security && phone > guard);

  const installerState = await read('public/service-worker-installer-state-v280.js');
  assert.match(installerState, /civweave-contribution-security-v1\.js/);
  assert.match(installerState, /civweave-contribution-ship-guard-v1\.js/);
  assert.match(installerState, /contributionSecurityRequired:\s*true/);
  assert.match(installerState, /walletContainmentRequired:\s*true/);

  const manifest = JSON.parse(await read('public/app/offline-package-v208.json'));
  assert.equal(manifest.phoneLedgerRevision, 'phone-ledger-r3-ship-security');
  assert.ok(manifest.assets.includes('/app/shared/civweave-contribution-security-v1.js'));
  assert.ok(manifest.assets.includes('/app/shared/civweave-contribution-ship-guard-v1.js'));
});
