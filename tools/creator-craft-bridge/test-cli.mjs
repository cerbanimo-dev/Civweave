import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const [action,input,output]=process.argv.slice(2);
if(action==='--version'){console.log('wordcraft-cli test fixture v1');process.exit(0);}
if(action==='inspect'){console.log(JSON.stringify({paragraphs:2,source:'test'}));process.exit(0);}
if(action==='text'){console.log('Fixture document content');process.exit(0);}
if(action==='info'){console.log('CADCraft drawing fixture: 3 entities');process.exit(0);}
if(action==='convert'){
 if(!input||!output)process.exit(2);
 await writeFile(output,output.endsWith('.svg')?'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>':'%PDF-1.4\n% fixture only\n');
 process.exit(0);
}
process.exit(3);
