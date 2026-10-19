"""Three real two-session races; fixed disposable Docker PG17 target only."""
import json
import os
import re
import subprocess
import time

assert os.environ.get("POCKET_CHECKOUT_QA_DISPOSABLE_DATABASE") == "true", "Disposable QA acknowledgement required"
container = os.environ.get("QA_PG_CONTAINER", "")
assert re.fullmatch(r"[a-f0-9]{64}", container), "Exact GitHub disposable service container required"
command = ["docker", "exec", "-i", container, "psql", "-U", "postgres", "-d", "checkout_intent_qa", "-v", "ON_ERROR_STOP=1", "-At"]

def run(sql):
    result = subprocess.run(command, input=sql, text=True, capture_output=True, timeout=20)
    assert result.returncode == 0, result.stderr[-1200:]
    return result.stdout.strip()

assert run("select current_database()") == "checkout_intent_qa"

def race(sql_a, sql_b, marker):
    a = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    a.stdin.write(f"begin; {sql_a}; select pg_advisory_xact_lock({marker}); select pg_sleep(3); commit;")
    a.stdin.close()
    try:
        ready = False
        for _ in range(80):
            if run(f"select exists(select 1 from pg_locks where locktype='advisory' and objid={marker} and granted)") == "t":
                ready = True
                break
            if a.poll() is not None:
                break
            time.sleep(0.04)
        assert ready, "Session A never acquired the test marker"
        started = time.monotonic()
        b = run(sql_b)
        elapsed = time.monotonic() - started
        a.wait(timeout=12)
        assert a.returncode == 0, a.stderr.read()[-1200:]
        assert elapsed >= 0.5, "Sessions did not overlap a real locked transaction"
        return a.stdout.read(), b
    finally:
        if a.poll() is None:
            a.kill()
            a.wait()

def ready(user_id, customer, email, receipt):
    run(f"""insert into auth.users(id,email,email_confirmed_at) values('{user_id}','{email}',now());
    insert into private.pocket_web_identities values('{user_id}','{customer}');
    select public.qa_ready_checkout('{user_id}','{customer}','{email}',repeat('{receipt}',64));""")

u1 = "55555555-5555-4555-8555-555555555555"
ready(u1, "cus_RACE1", "race1@example.test", "5")
a, b = race(f"select public.qa_claim_checkout('{u1}')", f"select public.qa_claim_checkout('{u1}')", 782001)
assert '"kind": "DISPATCH"' in a and '"kind": "HOLD"' in b
assert '"dispatch_token"' not in b, "A previous dispatch token was reissued"
assert run(f"select count(*)||':'||sum(dispatch_count) from private.pocket_checkout_intents where app_user_id='{u1}'") == "1:1"

u2 = "66666666-6666-4666-8666-666666666666"
ready(u2, "cus_RACE2", "race2@example.test", "6")
_, b = race(f"insert into private.pocket_web_subscriptions values('sub_RACE2','{u2}','race2@example.test','cus_RACE2',true,now()+interval '1 hour')",
            f"select public.qa_claim_checkout('{u2}')", 782002)
assert "ACTIVE_SUBSCRIPTION" in b
assert run(f"select dispatch_count from private.pocket_checkout_intents where app_user_id='{u2}'") == "0"

u3 = "77777777-7777-4777-8777-777777777777"
ready(u3, "cus_RACE3", "race3@example.test", "7")
_, _ = race(f"select public.qa_claim_checkout('{u3}')",
            f"insert into private.pocket_web_subscriptions values('sub_RACE3','{u3}','race3@example.test','cus_RACE3',true,now()+interval '1 hour')", 782003)
# Claim-before-webhook cannot undo a remote dispatch; persisting its known result
# must retain the session but withhold a redirect. This is NOT global uniqueness.
result = run(f"""select public.record_pocket_checkout_session(app_user_id,intent_id,dispatch_token,parameters_sha256,
  jsonb_build_object('id','cs_test_RACE3','customer',stripe_customer_id,'mode','subscription','status','open','livemode',false,
    'client_reference_id',app_user_id,'expires_at',expires_at,'url','https://checkout.stripe.com/c/pay/cs_test_RACE3',
    'metadata',parameters_text::jsonb->'metadata')) from private.pocket_checkout_intents where app_user_id='{u3}';""")
assert json.loads(result)["kind"] == "HOLD"
assert run(f"select state||':'||dispatch_count from private.pocket_checkout_intents where app_user_id='{u3}'") == "READY:1"
print("PASS: 3 real two-session races; single dispatch, webhook-first block, claim-first result retention with redirect withheld")
