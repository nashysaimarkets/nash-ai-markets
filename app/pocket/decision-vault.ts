import {normalizeLockedDecision,normalizeLockedDecisions,type CompatibleLockedDecision} from './decision-compatibility.ts';
// Same database/version as the established customer view: no isolated redesign history.
function openVault():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open('bullseye-decision-vault',2);
  request.onupgradeneeded=()=>{
   if(!request.result.objectStoreNames.contains('decisions'))request.result.createObjectStore('decisions',{keyPath:'id'});
   if(!request.result.objectStoreNames.contains('analyses'))request.result.createObjectStore('analyses',{keyPath:'key'});
  };
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  request.onblocked=()=>reject(new Error('Close another Pocket tab before opening history.'));
 });
}
export async function listPocketDecisions():Promise<CompatibleLockedDecision[]>{
 const db=await openVault();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction('decisions','readonly');const request=tx.objectStore('decisions').getAll();
  tx.oncomplete=()=>resolve(normalizeLockedDecisions(request.result).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));
  tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
 });}finally{db.close();}
}
export async function savePocketDecision(value:unknown):Promise<CompatibleLockedDecision>{
 const decision=normalizeLockedDecision(value);if(!decision)throw new Error('This decision cannot be saved safely.');
 const db=await openVault();
 try{await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction('decisions','readwrite');tx.objectStore('decisions').put(decision);
  tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
 });return decision;}finally{db.close();}
}
export async function deletePocketDecision(id:string):Promise<void>{
 const db=await openVault();
 try{await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction('decisions','readwrite');tx.objectStore('decisions').delete(id);
  tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
 });}finally{db.close();}
}
