/** Offline packet entry point. No environment credentials or dispatch option. */
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { validateMonacoEvidencePack } from './pocket-monaco-measurement.ts';
const args=process.argv.slice(2);
if(args.length!==4||args[0]!=='--pack'||args[2]!=='--reviews')throw Error('Usage: node scripts/verify-monaco-scanner-evidence.mjs --pack /private/pack.json --reviews /independently-reviewed/records.json');
const packFile=await realpath(resolve(args[1])),root=dirname(packFile);
const packet=JSON.parse(await readFile(packFile,'utf8'));
const reviews=JSON.parse(await readFile(resolve(args[3]),'utf8'));
if(!packet||!Array.isArray(packet.artifacts)||packet.artifacts.length>60||!Array.isArray(reviews))throw Error('Invalid packet/review list');
const files=new Map();
for(const artifact of packet.artifacts){
 if(!artifact||!/^[a-f0-9]{64}$/.test(artifact.sha256)||typeof artifact.path!=='string'||isAbsolute(artifact.path)||files.has(artifact.sha256))throw Error('Invalid or duplicate artifact');
 const path=await realpath(resolve(root,artifact.path)),rel=relative(root,path);
 if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('Artifact must remain inside the packet directory');
 const info=await stat(path);if(!info.isFile()||info.size>40_000_000)throw Error('Artifact exceeds the offline size bound');
 files.set(artifact.sha256,await readFile(path));
}
const result=await validateMonacoEvidencePack(packet.cases,files,reviews);
// No chart bytes, private document contents or credentials are emitted.
process.stdout.write(JSON.stringify(result,null,2)+'\n');
if(result.status!=='PACK_CONTRACT_PASS')process.exitCode=1;
