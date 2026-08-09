import { issueAiWalletSession } from './ai-wallet-auth-v1.mjs';
function clean(value, label) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${label} is required.`); return text; }
export async function registerWalletDeviceAndIssueSession({ walletService, userId, deviceId, publicKey = null, label = null, metadata = {}, roles = ['wallet:user'], ttlSeconds = 900 }, { authSecret }) {
  if (!walletService?.registerDevice || !walletService?.ensureWallet) throw Object.assign(new Error('Node AI storage does not support registered devices.'), { status: 501 });
  const owner = clean(userId, 'userId'); const device = clean(deviceId, 'deviceId'); await walletService.ensureWallet({ userId: owner }); await walletService.registerDevice({ userId: owner, deviceId: device, publicKey, label, metadata });
  return issueAiWalletSession({ userId: owner, deviceId: device, roles, ttlSeconds }, { secret: authSecret });
}
export async function assertActiveWalletDevice(walletService, { userId, deviceId }) {
  if (!walletService?.requireRegisteredDevices) return true; if (!walletService?.isDeviceActive) throw new Error('Node AI storage cannot verify registered devices.');
  const active = await walletService.isDeviceActive({ userId: clean(userId, 'userId'), deviceId: clean(deviceId, 'deviceId') }); if (!active) throw new Error('Node AI device is not registered or has been revoked.'); return true;
}
export async function revokeWalletDevice(walletService, { userId, deviceId }) { if (!walletService?.revokeDevice) throw Object.assign(new Error('Node AI storage does not support device revocation.'), { status: 501 }); return walletService.revokeDevice({ userId: clean(userId, 'userId'), deviceId: clean(deviceId, 'deviceId') }); }
