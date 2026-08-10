import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const version=(await readFile('VERSION','utf8')).trim();
const files=['server/dev.mjs','server/local.mjs','server/gateway.mjs','server/gateway-base.mjs','server/federated.mjs',...['server.mjs','server-v130.mjs','server-local-v131.mjs','server-gateway-v131-base.mjs','server-gateway-v131.mjs','server-federated-v152.mjs'].map(name=>path.posix.join('releases',version,'server',name))];
for(const file of files){const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1)}
console.log(JSON.stringify({ok:true,version,files},null,2));
