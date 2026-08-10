import fsp from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');

export async function launchArchived(relative,label){
  const sourcePath=path.join(root,relative);
  const runtimePath=path.join(root,`.civweave-${label}.entry.mjs`);
  const source=await fsp.readFile(sourcePath,'utf8');
  await fsp.writeFile(runtimePath,source,'utf8');
  try{return await import(`${pathToFileURL(runtimePath).href}?compat=${encodeURIComponent(label)}`)}
  finally{setTimeout(()=>fsp.unlink(runtimePath).catch(()=>{}),1000).unref?.()}
}
