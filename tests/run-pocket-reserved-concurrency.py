"""Independent multi-session PG17 tests; disposable CI database only."""
import json,os,re,subprocess,time

assert os.environ.get('POCKET_QA_DISPOSABLE_DATABASE')=='true', 'Disposable QA database required'
command=json.loads(os.environ['POCKET_QA_PSQL_COMMAND'])
assert isinstance(command,list) and all(isinstance(v,str) for v in command)
def run(sql,check=True):
 r=subprocess.run(command,input=sql,text=True,capture_output=True,timeout=20)
 if check and r.returncode:raise AssertionError('QA SQL failed: '+r.stderr[-1000:])
 return r
def plan():
 return json.dumps([dict(slot=s,model='gpt-5-mini-2025-08-07',serviceTier='default',maxOutputTokens=7000 if s=='main' else 1400,
  maxInputTextChars=50000,maxSchemaBytes=50000,maxImages=2,maxImageBytes=4000000,maxImageWidth=4096,maxImageHeight=4096,
  maxImagePixels=16777216,maxCostMicroUsd=1000000,costBoundEvidenceRef='qa-pricing-evidence')
  for s in ['main','primary_precision','rescue_precision']])
def ledger(key,approval):
 assert re.fullmatch(r'qa-[a-z-]+',key) and re.fullmatch(r'qa-[a-z-]+',approval)
 return f"""insert into private.pocket_benchmark_pilot_ledgers(ledger_key,cap_microusd,project_ref,owner_approval_ref,candidate_sha,
 rate_tier,pricing_evidence_ref,allowed_case_ids,config_verified_at,enabled)
 values('{key}',5000000,'proj_qa','{approval}',repeat('b',40),'default','qa-pricing-evidence',array['case-01','case-02'],now(),true);"""
def config(key):return f"""insert into private.pocket_benchmark_budget_configs(ledger_key,project_ref,candidate_sha,staging_ref,key_tracking_id,
 key_fingerprint_sha256,model,service_tier,pricing_evidence_ref,runtime_evidence_sha256,reviewer_ref,valid_until)
 values('{key}','proj_qa',repeat('b',40),'pxlqvaddvghjjhenqmdh','key_qa_only',repeat('d',64),'gpt-5-mini-2025-08-07',
 'default','qa-pricing-evidence',repeat('c',64),'qa-concurrency-review',now()+interval '1 hour');"""
def claim(key,case):return f"select public.claim_pocket_benchmark_case('{key}','{case}','proj_qa','{key}-approval',repeat('b',40),'{plan()}'::jsonb)"
def locked_race(sql_a,sql_b,marker,expect_failure=False):
 a=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 a.stdin.write(f"begin; {sql_a}; select pg_advisory_xact_lock({marker}); select pg_sleep(5); commit;")
 a.stdin.close()
 try:
  ready=False
  for _ in range(40):
   if run(f"select exists(select 1 from pg_locks where locktype='advisory' and objid={marker} and granted)").stdout.strip()=='t':ready=True;break
   if a.poll() is not None:break
   time.sleep(.05)
  assert ready,'Session A never acquired its test lock'
  started=time.monotonic();b=run(sql_b,check=not expect_failure);elapsed=time.monotonic()-started
  a.wait(timeout=12);error=a.stderr.read()
  assert a.returncode==0,error[-1000:]
  assert elapsed>=.5,'Session B did not overlap the locked transaction'
  if expect_failure:assert b.returncode!=0 and 'duplicate key' in b.stderr,'Approval uniqueness failed'
  return b.stdout
 finally:
  if a.poll() is None:a.kill();a.wait()

key='qa-race-pending';run(ledger(key,key+'-approval')+config(key))
out=locked_race(claim(key,'case-01'),claim(key,'case-02')+';',781001)
assert 'previous_case_unresolved' in out,out
assert run(f"select count(*)||':'||sum(estimated_microusd) from private.pocket_benchmark_pilot_calls where ledger_key='{key}'").stdout.strip()=='3:3000000'

key='qa-race-cap';run(ledger(key,key+'-approval')+config(key)+claim(key,'case-01')+';'+f"""
do $$ declare s text; begin foreach s in array array['main','primary_precision','rescue_precision'] loop
 perform public.submit_pocket_benchmark_call('{key}','case-01',s,repeat('a',64));
 perform public.record_pocket_benchmark_receipt('{key}','case-01',s,'qa-req-'||s,'qa-response-'||s,'gpt-5-mini-2025-08-07','default',
 '{{"input_tokens":10,"output_tokens":5,"total_tokens":15}}',repeat('a',64));end loop;end;$$;""")
out=locked_race(f"select public.account_pocket_benchmark_reserved_case('{key}','case-01')",claim(key,'case-02')+';',781002)
assert 'pilot_cap_exceeded' in out,out
assert run(f"select sum(greatest(estimated_microusd,coalesce(actual_microusd,estimated_microusd))) from private.pocket_benchmark_pilot_calls where ledger_key='{key}'").stdout.strip()=='3000000'

locked_race(ledger('qa-race-approval-a','qa-race-shared-approval'),ledger('qa-race-approval-b','qa-race-shared-approval'),781003,True)
assert run("select count(*) from private.pocket_benchmark_pilot_ledgers where owner_approval_ref='qa-race-shared-approval'").stdout.strip()=='1'
print('PASS: three real two-session races; unresolved calls, cumulative cap and unique approval preserved')
