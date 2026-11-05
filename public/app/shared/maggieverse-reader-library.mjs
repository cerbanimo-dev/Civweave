// Device-only imported book shelf; no cloud API, remote sync, or media rights assumptions.
const DB_NAME='civweave.maggieverse-books.v1';
const STORE='books';
export const MAX_LOCAL_BOOK_TEXT=6_000_000;
const MAX_BOOKS=24;
let connection=null;
function db(){
  if(!globalThis.indexedDB)return Promise.reject(new Error('Local book storage is unavailable in this browser.'));
  if(connection)return connection;
  connection=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'bookId'});};
    request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();connection=null;};resolve(request.result);};
    request.onerror=()=>reject(request.error||new Error('Local book storage could not open.'));
    request.onblocked=()=>reject(new Error('Close other copies of the reader and retry.'));
  }).catch(error=>{connection=null;throw error;});
  return connection;
}
async function operate(mode,makeRequest){
  const handle=await db();
  return new Promise((resolve,reject)=>{
    const transaction=handle.transaction(STORE,mode),store=transaction.objectStore(STORE);
    let answer;
    transaction.oncomplete=()=>resolve(answer);
    transaction.onerror=()=>reject(transaction.error||new Error('Book storage failed.'));
    transaction.onabort=()=>reject(transaction.error||new Error('Book storage was interrupted.'));
    try{
      const req=makeRequest(store);
      if(req){req.onsuccess=()=>{answer=req.result};req.onerror=()=>{try{transaction.abort()}catch{}};}
    }catch(error){try{transaction.abort()}catch{}reject(error);}
  });
}
const validate=book=>{
  if(!book||typeof book!=='object'||! /^[A-Za-z0-9_-]{4,100}$/.test(String(book.bookId||'')))throw new Error('Book identity is invalid.');
  if(typeof book.text!=='string'||!book.text.trim()||book.text.length>MAX_LOCAL_BOOK_TEXT)throw new Error('Book exceeds local shelf size limits.');
  if(typeof book.title!=='string'||!book.title.trim()||book.title.length>180)throw new Error('Book title is invalid.');
};
export async function listBooks(){
  const rows=await operate('readonly',store=>store.getAll());
  return (Array.isArray(rows)?rows:[]).map(({bookId,title,createdAt,lastOpened})=>({bookId,title,createdAt,lastOpened})).sort((a,b)=>String(b.lastOpened||'').localeCompare(String(a.lastOpened||'')));
}
export async function saveBook(book){
  validate(book);
  const existing=await listBooks();
  if(existing.length>=MAX_BOOKS&&!existing.some(row=>row.bookId===book.bookId))throw new Error('The local shelf holds at most 24 books. Remove one first.');
  const previous=await operate('readonly',store=>store.get(book.bookId));
  const now=new Date().toISOString();
  await operate('readwrite',store=>store.put({bookId:book.bookId,title:book.title,text:book.text,createdAt:previous?.createdAt||now,lastOpened:now}));
  return book.bookId;
}
export async function loadBook(bookId){
  const id=String(bookId||'');
  if(! /^[A-Za-z0-9_-]{4,100}$/.test(id))return null;
  const row=await operate('readonly',store=>store.get(id));
  if(!row)return null;
  validate(row);
  return {bookId:row.bookId,title:row.title,text:row.text};
}
export async function deleteBook(bookId){
  const id=String(bookId||'');
  if(! /^[A-Za-z0-9_-]{4,100}$/.test(id))throw new Error('Invalid book identity.');
  await operate('readwrite',store=>store.delete(id));
  return true;
}
