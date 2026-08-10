const isRender = process.env.RENDER === 'true';
const runtime = isRender ? 'gateway' : 'local campus';
const entry = isRender ? '../server/gateway.mjs' : '../server/local.mjs';

console.log(`[Civweave] Starting ${runtime} runtime.`);
await import(new URL(entry, import.meta.url).href);