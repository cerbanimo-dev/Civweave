// Shared pure policy for the browser receiver and agent-facing tool catalog.
// This is a capability owner, not another guide chat or the developer MCP server.
const cut=(value,max)=>String(value??'').trim().slice(0,max);
const privateIpv4=host=>{
  const parts=host.split('.');if(parts.length!==4||parts.some(x=>!/^(0|[1-9]\d{0,2})$/.test(x)))return false;
  const [a,b,c,d]=parts.map(Number);
  if([a,b,c,d].some(x=>x>255))return true;
  return a===0||a===10||a===127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a>=224;
};
export function normalizeBrowserTarget(value){
  const source=cut(value,2500);
  if(!source||source.length>2048)return null;
  try{
    const url=new URL(source);
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return null;
    const host=url.hostname.replace(/^\[|\]$/g,'').toLowerCase();
    if(!host||['localhost','::','::1'].includes(host)||/(^|\.)(localhost|local|internal|invalid|lan|home)$/.test(host)||privateIpv4(host))return null;
    if(host.includes(':')&&(/^(f[cd]|fe[89ab]|ff|0:|::ffff:)/i.test(host)))return null;
    url.hash='';
    return url.href;
  }catch{return null}
}
export function extractBrowserShare(input={}){
  const text=cut(input.text,600),title=cut(input.title,180);
  const candidate=cut(input.url,2048)||text.match(/https?:\/\/[^\s<>"']+/i)?.[0]?.replace(/[.,;!?)]+$/,'')||'';
  return Object.freeze({title,text,url:normalizeBrowserTarget(candidate)||''});
}
const objectSchema=(properties,required)=>({type:'object',properties,required,additionalProperties:false});
const query={type:'string',minLength:1,maxLength:1200},url={type:'string',format:'uri',maxLength:2048};
export const BROWSER_MCP_TOOLS=Object.freeze([
  {name:'browser.archive_search',description:'Search downloaded on-device knowledge archives without network access.',inputSchema:objectSchema({query},['query'])},
  {name:'browser.search',description:'Search the live public web; needs explicit current-session permission.',inputSchema:objectSchema({query},['query'])},
  {name:'browser.open',description:'Read live webpage text from a verified public URL; needs network permission.',inputSchema:objectSchema({url},['url'])},
  {name:'browser.links',description:'Get links found on a public URL; needs network permission.',inputSchema:objectSchema({url},['url'])},
  {name:'browser.accessibility',description:'Read a public page accessibility tree; needs network permission.',inputSchema:objectSchema({url},['url'])}
].map(tool=>Object.freeze(tool)));
const NAMES=new Set(BROWSER_MCP_TOOLS.map(t=>t.name));
export function planBrowserCall(name,args={},options={}){
  if(!NAMES.has(name))return{ok:false,reason:'unknown-tool'};
  if(!args||typeof args!=='object'||Array.isArray(args))return{ok:false,reason:'invalid-arguments'};
  if(name.endsWith('search')){
    const value=cut(args.query,1200);
    if(!value)return{ok:false,reason:'query-required'};
    if(name==='browser.search'&&options.networkAllowed!==true)return{ok:false,reason:'network-permission-required'};
    return{ok:true,name,args:{query:value},network:name==='browser.search'};
  }
  const target=normalizeBrowserTarget(args.url);
  if(!target)return{ok:false,reason:'unsafe-url'};
  if(options.networkAllowed!==true)return{ok:false,reason:'network-permission-required'};
  return{ok:true,name,args:{url:target},network:true};
}
