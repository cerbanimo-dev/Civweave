let adapterPromise=null;
const adapter=()=>adapterPromise||=(import('/app/models/all-minilm-l6-v2/adapter.js'));
export async function localModelStatus(){return (await adapter()).status()}
export async function semanticMatch(text,options={}){return (await adapter()).match(text,options)}
export async function prewarmLocalModel(){return (await adapter()).prewarm()}
