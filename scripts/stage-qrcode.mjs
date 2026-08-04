import { access, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const soft=process.argv.includes('--soft');
const candidates=[path.join(root,'node_modules','qrcode','build','qrcode.js'),path.join(root,'node_modules','qrcode','build','qrcode.min.js')];
async function main(){let source=null;for(const candidate of candidates){try{await access(candidate);source=candidate;break}catch{}}if(!source){if(soft)return console.warn('[Commonweave] Browser QR bundle is not installed yet.');throw new Error('The qrcode browser bundle was not found.')}const destination=path.join(root,'public','vendor','qrcode.js');await mkdir(path.dirname(destination),{recursive:true});await copyFile(source,destination);console.log('[Commonweave] Staged local QR encoder.');}
main().catch(error=>{if(soft)console.warn(error.message);else{console.error(error);process.exitCode=1}});
