/** Safe lightweight reader for the authored Books of Wonder Markdown.
 * Structured text nodes only: no HTML injection and no alternate chat renderer.
 */
function inline(parent,text){
 const pieces=String(text).split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g);
 const doc=parent.ownerDocument;
 for(const piece of pieces){
  if(!piece)continue;
  let tag='',value=piece;
  if(piece.startsWith('**')&&piece.endsWith('**')){tag='strong';value=piece.slice(2,-2)}
  else if(piece.startsWith('*')&&piece.endsWith('*')){tag='em';value=piece.slice(1,-1)}
  else if(piece.startsWith('`')&&piece.endsWith('`')){tag='code';value=piece.slice(1,-1)}
  if(tag){const element=doc.createElement(tag);element.textContent=value;parent.append(element)}
  else parent.append(doc.createTextNode(piece));
 }
}
export function renderHarmlessMarkdown(target,markdown,{maxChars=180000}={}){
 if(!target||typeof target.replaceChildren!=='function')throw new TypeError('A document reader is required.');
 const original=typeof markdown==='string'?markdown:'',cap=Math.max(1000,Math.min(300000,maxChars));
 const limited=original.length>cap,source=limited?original.slice(0,cap):original;
 const doc=target.ownerDocument,fragment=doc.createDocumentFragment();
 let current=null,kind='';
 const fresh=(tag,type)=>{const e=doc.createElement(tag);fragment.append(e);current=e;kind=type;return e};
 for(const raw of source.split(/\r?\n/)){
  const line=raw.trim();
  if(!line){current=null;kind='';continue}
  if(/^(-{3,}|\*{3,})$/.test(line)){fresh('hr','hr');current=null;kind='';continue}
  const heading=line.match(/^(#{1,4})\s+(.+)$/);
  if(heading){const e=fresh('h'+Math.min(6,heading[1].length+1),'heading');inline(e,heading[2]);current=null;kind='';continue}
  const quote=line.match(/^>\s?(.*)$/);
  const desired=quote?'quote':(/^\*?POST \d+/.test(line)?'post':'paragraph');
  const text=quote?quote[1]:line;
  if(!current||kind!==desired)fresh(quote?'blockquote':'p',desired);
  else current.append(doc.createTextNode(' '));
  inline(current,text);
 }
 if(limited){const note=doc.createElement('p');note.textContent='Reader truncated for performance. Export complete Markdown to read all posts.';fragment.append(note)}
 target.replaceChildren(fragment);
 return {truncated:limited,renderedCharacters:source.length};
}
