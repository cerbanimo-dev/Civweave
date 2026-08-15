import { connectToTarget } from './cdp-client.mjs';
import { registerBrowserActionTools } from './browser-action-tools.mjs';
import { registerBrowserReadTools } from './browser-read-tools.mjs';
import { registerRepoTools } from './repo-tool-registry.mjs';
import { errorResult } from './tool-utils.mjs';

export function createToolRegistry({ repoRoot = process.cwd(), cdpEndpoint = process.env.CIVWEAVE_CDP_ENDPOINT || 'http://127.0.0.1:9222', cdpFactory = connectToTarget, fetchImpl = fetch } = {}) {
  const config = { repoRoot, cdpEndpoint, cdpFactory, fetchImpl };
  const tools = new Map();
  const add = (definition, handler) => tools.set(definition.name, { definition, handler });

  registerBrowserReadTools(add, config);
  registerBrowserActionTools(add, config);
  registerRepoTools(add, config);

  return {
    list() { return [...tools.values()].map(({definition})=>definition); },
    async call(name,args={}) {
      const tool=tools.get(name);
      if(!tool) return errorResult(new Error(`Unknown tool: ${name}`));
      try { return await tool.handler(args ?? {}); }
      catch(error) { return errorResult(error); }
    }
  };
}
