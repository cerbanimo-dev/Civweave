(()=>{
'use strict';
const enc=new TextEncoder(),dec=new TextDecoder();
const b64=bytes=>btoa(String.fromCharCode(...bytes));
const unb64=value=>Uint8Array.from(atob(value),char=>char.charCodeAt(0));
async function generateKey(){return crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt'])}
async function exportKey(key){return b64(new Uint8Array(await crypto.subtle.exportKey('raw',key)))}
async function importKey(value){return crypto.subtle.importKey('raw',unb64(value),{name:'AES-GCM'},true,['encrypt','decrypt'])}
async function encryptPacket(packet,key){const iv=crypto.getRandomValues(new Uint8Array(12)),plaintext=enc.encode(JSON.stringify(packet)),ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plaintext);return{schema:'civweave.creation-packet-encrypted.v1',algorithm:'AES-GCM-256',iv:b64(iv),ciphertext:b64(new Uint8Array(ciphertext)),packetHash:packet.packetHash||'',encryptedAt:new Date().toISOString()}}
async function decryptPacket(envelope,key){const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(envelope.iv)},key,unb64(envelope.ciphertext));return JSON.parse(dec.decode(plaintext))}
globalThis.CivweaveCreatorPacketCryptoV1=Object.freeze({generateKey,exportKey,importKey,encryptPacket,decryptPacket});
})();
