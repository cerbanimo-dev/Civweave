const isRender = process.env.RENDER === 'true';
const runtime = isRender ? 'gateway' : 'local campus';
const entry = isRender ? '../server-gateway-v131.mjs' : '../server-local-v131.mjs';

console.log(`[Commonweave] Starting ${runtime} runtime.`);
await import(new URL(entry, import.meta.url).href);
