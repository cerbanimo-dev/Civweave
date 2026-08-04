import { canonicalJson, createEnvelope, forwardEnvelope, validateEnvelope } from './protocol.js';
import { readState, updateState } from './store.js';

const IDENTITY_KEY = 'commonweave.mesh.identity.v1';
const INVITE_KEY = 'commonweave.mesh.invites.v1';
const channels = new Map();
const peers = new Map();
const seen = new Set();
let socket = null;
let nodeUrl = null;
let identityPromise = null;

const encode = value => btoa(unescape(encodeURIComponent(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const decode = value => decodeURIComponent(escape(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4))));
const bytes64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const from64 = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));

async function generateIdentity() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return {
    id: readState().profile.id,
    publicKey: await crypto.subtle.exportKey('jwk', pair.publicKey),
    privateKey: await crypto.subtle.exportKey('jwk', pair.privateKey)
  };
}

export async function identity() {
  if (identityPromise) return identityPromise;
  identityPromise = (async () => {
    const stored = JSON.parse(localStorage.getItem(IDENTITY_KEY) || 'null') || await generateIdentity();
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(stored));
    return stored;
  })();
  return identityPromise;
}

async function signEnvelope(envelope) {
  const own = await identity();
  const key = await crypto.subtle.importKey('jwk', own.privateKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(canonicalJson(envelope)));
  return { envelope, publicKey: own.publicKey, signature: bytes64(signature) };
}

async function verifyPacket(packet) {
  const result = validateEnvelope(packet?.envelope);
  if (!result.ok || !packet?.signature || !packet?.publicKey) return false;
  try {
    const key = await crypto.subtle.importKey('jwk', packet.publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, from64(packet.signature), new TextEncoder().encode(canonicalJson(packet.envelope)));
  } catch {
    return false;
  }
}

function wsUrl(value) {
  const url = new URL(value || location.origin, location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/mesh';
  url.search = '';
  return url.href;
}

function sendSocket(message) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function emitStatus() {
  window.dispatchEvent(new CustomEvent('commonweave:mesh-status', { detail: status() }));
}

export async function connect(value = readState().profile.nodeUrl || location.origin) {
  nodeUrl = value;
  if (socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(socket.readyState)) return;
  const own = await identity();
  socket = new WebSocket(wsUrl(value));
  socket.addEventListener('open', () => {
    sendSocket({ type: 'register', peerId: own.id, publicKey: own.publicKey });
    emitStatus();
  });
  socket.addEventListener('close', () => emitStatus());
  socket.addEventListener('error', () => emitStatus());
  socket.addEventListener('message', event => handleSocket(JSON.parse(event.data)));
}

async function handleSocket(message) {
  if (message.type === 'signal') return handleSignal(message.from, message.signal, message.publicKey);
  if (message.type === 'relay') return receivePacket(message.packet, 'node-relay');
  if (message.type === 'presence') {
    window.dispatchEvent(new CustomEvent('commonweave:presence', { detail: message.peers || [] }));
  }
}

function setupChannel(peerId, channel) {
  channels.set(peerId, channel);
  channel.addEventListener('open', () => emitStatus());
  channel.addEventListener('close', () => { channels.delete(peerId); emitStatus(); });
  channel.addEventListener('message', event => receivePacket(JSON.parse(event.data), peerId));
}

function createPeer(peerId, publicKey, initiator = false) {
  if (peers.has(peerId)) return peers.get(peerId);
  const connection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  peers.set(peerId, connection);
  connection.addEventListener('icecandidate', event => {
    if (event.candidate) sendSocket({ type: 'signal', target: peerId, signal: { candidate: event.candidate } });
  });
  connection.addEventListener('datachannel', event => setupChannel(peerId, event.channel));
  connection.addEventListener('connectionstatechange', () => {
    if (['failed','closed','disconnected'].includes(connection.connectionState)) {
      peers.delete(peerId);
      channels.delete(peerId);
      emitStatus();
    }
  });
  if (initiator) setupChannel(peerId, connection.createDataChannel('commonweave'));
  updateState(state => {
    const friend = state.friends.find(item => item.id === peerId);
    if (friend && publicKey) friend.publicKey = publicKey;
    return state;
  });
  return connection;
}

async function handleSignal(peerId, signal, publicKey) {
  const connection = createPeer(peerId, publicKey, false);
  if (signal.description) {
    await connection.setRemoteDescription(signal.description);
    if (signal.description.type === 'offer') {
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      sendSocket({ type: 'signal', target: peerId, signal: { description: connection.localDescription } });
    }
  }
  if (signal.candidate) await connection.addIceCandidate(signal.candidate).catch(() => {});
}

async function initiate(peerId, publicKey) {
  const connection = createPeer(peerId, publicKey, true);
  const offer = await connection.createOffer();
  await connection.setLocalDescription(offer);
  sendSocket({ type: 'signal', target: peerId, signal: { description: connection.localDescription } });
}

export async function createInvite() {
  const own = await identity();
  const token = crypto.randomUUID();
  const invites = JSON.parse(localStorage.getItem(INVITE_KEY) || '{}');
  invites[token] = { createdAt: Date.now(), used: false };
  localStorage.setItem(INVITE_KEY, JSON.stringify(invites));
  return encode(JSON.stringify({
    schema: 'commonweave.friend-invite.v1',
    peerId: own.id,
    publicKey: own.publicKey,
    nodeUrl: nodeUrl || readState().profile.nodeUrl || location.origin,
    token
  }));
}

export async function addFriend(code, name = '') {
  const invite = JSON.parse(decode(String(code || '').trim()));
  if (invite.schema !== 'commonweave.friend-invite.v1' || !invite.peerId || !invite.publicKey) throw new Error('That is not a Commonweave friend code.');
  const own = await identity();
  if (invite.peerId === own.id) throw new Error('This invite belongs to this device.');
  updateState(state => {
    const existing = state.friends.find(friend => friend.id === invite.peerId);
    const friend = { id: invite.peerId, name: name || existing?.name || `Friend ${invite.peerId.slice(0,6)}`, publicKey: invite.publicKey, nodeUrl: invite.nodeUrl, addedAt: existing?.addedAt || new Date().toISOString() };
    state.friends = [friend, ...state.friends.filter(item => item.id !== invite.peerId)];
    return state;
  });
  await connect(invite.nodeUrl);
  sendSocket({ type: 'friend-accept', target: invite.peerId, token: invite.token, peerId: own.id, publicKey: own.publicKey });
  await initiate(invite.peerId, invite.publicKey);
  return invite.peerId;
}

export async function publish(type, payload, options = {}) {
  const own = await identity();
  const packet = await signEnvelope(createEnvelope({ type, origin: own.id, payload, ttl: options.ttl || 4, target: options.target || null }));
  seen.add(packet.envelope.id);
  for (const channel of channels.values()) if (channel.readyState === 'open') channel.send(JSON.stringify(packet));
  sendSocket({ type: 'relay', packet });
  return packet.envelope;
}

async function receivePacket(packet, source) {
  if (!await verifyPacket(packet)) return;
  const envelope = packet.envelope;
  if (seen.has(envelope.id)) return;
  seen.add(envelope.id);
  window.dispatchEvent(new CustomEvent('commonweave:mesh', { detail: { envelope, source, packet } }));
  const forwarded = forwardEnvelope(envelope);
  if (!forwarded) return;
  const nextPacket = { ...packet, envelope: forwarded };
  for (const [peerId, channel] of channels) if (peerId !== source && channel.readyState === 'open') channel.send(JSON.stringify(nextPacket));
}

export async function drawInvite(canvas, code) {
  if (!globalThis.QRCode?.toCanvas) throw new Error('The local QR encoder has not been staged. Run npm install.');
  await globalThis.QRCode.toCanvas(canvas, code, { width: 260, margin: 2, errorCorrectionLevel: 'M' });
}

export async function scanInvite(video) {
  if (!('BarcodeDetector' in globalThis)) throw new Error('This browser does not provide QR scanning. Paste the friend code instead.');
  const detector = new BarcodeDetector({ formats: ['qr_code'] });
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  video.srcObject = stream;
  await video.play();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('No QR code was detected.')), 30000);
    const finish = result => {
      clearTimeout(timer);
      stream.getTracks().forEach(track => track.stop());
      result instanceof Error ? reject(result) : resolve(result);
    };
    const tick = async () => {
      try {
        const codes = await detector.detect(video);
        if (codes[0]?.rawValue) return finish(codes[0].rawValue);
        requestAnimationFrame(tick);
      } catch (error) { finish(error); }
    };
    tick();
  });
}

export function status() {
  return {
    nodeUrl,
    relayConnected: socket?.readyState === WebSocket.OPEN,
    directPeers: [...channels.values()].filter(channel => channel.readyState === 'open').length,
    knownFriends: readState().friends.length
  };
}
