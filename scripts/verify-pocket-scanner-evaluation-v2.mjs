/** Free acceptance only. Requires nonempty passing TAP output from every suite.
 * PostgreSQL mode is restricted to the explicitly disposable localhost fixture.
 * Never loads credentials, invokes a provider, or activates a hosted runner. */
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {verifyAppSources} from './pocket-scanner-evaluation-v2-source.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);
if(args.length>1||(args.length===1&&args[0]!=='--postgres'))throw Error('Unknown verification mode');
const postgres=args[0]==='--postgres';
if(postgres&&process.env.MONACO_QA_DISPOSABLE_POSTGRES!=='true')throw Error('Disposable PostgreSQL is required');
for(const key of ['MONACO_FIRST_SIX_OPENAI_API_KEY','MONACO_FIRST_SIX_LEDGER_KEY','OPENAI_API_KEY']){
  if(process.env[key])throw Error('Credential-free verification required');
}
const selected=readdirSync(join(root,'tests')).filter(name=>/^pocket-scanner-evaluation-v2.*\.test\.mjs$/.test(name)
  &&name.endsWith('-postgres.test.mjs')===postgres).sort();
if(selected.length<1)throw Error('No evaluation verification suites found');
const output=resolve(root,process.env.POCKET_EVALUATION_QA_OUTPUT??'qa/scanner-evaluation-v2-ci');
mkdirSync(output,{recursive:true});
const sourceHashes=verifyAppSources();
const results=[];
for(const name of selected){
  const result=spawnSync(process.execPath,['--test-reporter=tap',join(root,'tests',name)],{
    cwd:root,env:process.env,encoding:'utf8',shell:false,timeout:postgres?300000:90000,maxBuffer:4*1024*1024});
  const stdout=result.stdout??'',stderr=result.stderr??'';
  writeFileSync(join(output,`${name}.tap`),stdout);
  writeFileSync(join(output,`${name}.stderr`),stderr);
  const counts=Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(key=>{
    const hits=[...stdout.matchAll(new RegExp(`^# ${key} (\\d+)$`,'gm'))];
    return [key,hits.length===1?Number(hits[0][1]):null];
  }));
  const passed=!result.error&&result.status===0&&result.signal===null&&counts.tests>0
    &&counts.pass===counts.tests&&['fail','cancelled','skipped','todo'].every(key=>counts[key]===0);
  results.push({file:`tests/${name}`,sha256:createHash('sha256').update(readFileSync(join(root,'tests',name))).digest('hex'),
    status:passed?'PASS':'FAIL',exitCode:result.status,signal:result.signal,
    processErrorCode:result.error?.code??null,...counts});
  process.stdout.write(`${passed?'PASS':'FAIL'} tests/${name}: ${counts.pass??0}/${counts.tests??0}\n`);
}
verifyAppSources();
const report={kind:'POCKET_SCANNER_EVALUATION_V2_FREE_ACCEPTANCE',status:results.every(r=>r.status==='PASS')?'PASS':'FAIL',
  mode:postgres?'DISPOSABLE_LOCALHOST_POSTGRESQL_17':'OFFLINE_SYNTHETIC_BOUNDARIES',node:process.version,
  sourceSha:process.env.GIT_COMMIT_SHA??null,sourceHashes,suites:results.length,
  tests:results.reduce((n,r)=>n+(r.tests??0),0),passed:results.reduce((n,r)=>n+(r.pass??0),0),results,
  providerCalls:0,hostedDatabaseCalls:0,paidExecutionAuthorised:false,
  limitation:'Free synthetic checks establish control behavior, not live scanner accuracy or billing settlement'};
writeFileSync(join(output,postgres?'POSTGRES-ACCEPTANCE.json':'OFFLINE-ACCEPTANCE.json'),JSON.stringify(report,null,2)+'\n');
process.stdout.write(JSON.stringify({status:report.status,mode:report.mode,suites:report.suites,tests:report.tests,passed:report.passed})+'\n');
if(report.status!=='PASS')process.exitCode=1;
