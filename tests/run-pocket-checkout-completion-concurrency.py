"""Additional real overlapping PG17 transactions; fixed disposable CI container only."""
from pathlib import Path
import importlib.util
import json

spec = importlib.util.spec_from_file_location("existing_checkout_races", Path(__file__).with_name("run-pocket-checkout-concurrency.py"))
original = importlib.util.module_from_spec(spec)
spec.loader.exec_module(original)  # Retain the three existing dispatch/webhook races.
run, race = original.run, original.race
run(Path('supabase/proposed/pocket-checkout-completion.sql').read_text())

def scope(user):
    return {'userId': user, 'priceId': 'price_QA', 'stripeAccountId': 'acct_QA', 'livemode': False,
            'candidateSha': 'a' * 40, 'offer': 'pocket_founding_650'}

def sqljson(value):
    return "'" + json.dumps(value, separators=(',', ':')).replace("'", "''") + "'::jsonb"

def enrolled(user, letter):
    s = sqljson(scope(user))
    run(f"insert into auth.users(id,email,email_confirmed_at) values('{user}','race{letter}@example.test',now())")
    run(f"select private.register_pocket_checkout_fence({s},jsonb_build_object('old_writers_drained',true,'recovery_links_disabled',true,'other_obligations_reviewed',true,'approval_sha256',repeat('{letter}',64),'cutover_sha256',repeat('f',64),'fenced_at',clock_timestamp()-interval '1 second','valid_until',clock_timestamp()+interval '4 minutes'))")
    result = run(f"select private.enroll_pocket_customer_provision({s},repeat('{letter}',64),(select receipt_sha256 from private.pocket_checkout_fences where scope={s}))")
    return json.loads(result)['id'], s

u = '88888888-8888-4888-8888-888888888888'
provision, s = enrolled(u, '8')
a, b = race(f"set local role service_role; select public.claim_pocket_customer_provision('{provision}',{s})",
            f"set role service_role; select public.claim_pocket_customer_provision('{provision}',{s})", 782004)
assert '"kind": "DISPATCH"' in a and '"kind": "HOLD"' in b and '"token"' not in b
assert run(f"select state from private.pocket_customer_provisions where id='{provision}'") == 'DISPATCHED'

token = run(f"select token from private.pocket_customer_provisions where id='{provision}'")
customer = {'id': 'cus_COMPLETIONRACE', 'livemode': False, 'metadata': {'supabase_user_id': u, 'pocket_provision_id': provision, 'pocket_candidate_sha': 'a' * 40}}
a, b = race(f"set local role service_role; select public.record_pocket_customer_provision('{provision}','{token}',{s},{sqljson(customer)})",
            f"set role pocket_checkout_verifier; select public.recover_pocket_customer_provision('{provision}',{s},{sqljson(customer)})", 782005)
assert '"kind": "BOUND"' in a and '"kind": "BOUND"' in b
assert run(f"select count(*) from private.pocket_web_identities where app_user_id='{u}'") == '1'

u2 = '99999999-9999-4999-8999-999999999999'
p2, s2 = enrolled(u2, '9')
claim = json.loads(run(f"select private.claim_pocket_customer_provision('{p2}',{s2})"))
customer2 = {'id': 'cus_RACEWINNER', 'livemode': False, 'metadata': {'supabase_user_id': u2, 'pocket_provision_id': p2, 'pocket_candidate_sha': 'a' * 40}}
foreign = {**customer2, 'id': 'cus_RACELOSER'}
a, b = race(f"select private.record_pocket_customer_provision('{p2}','{claim['token']}',{s2},{sqljson(customer2)})",
            f"do $$ begin perform private.recover_pocket_customer_provision('{p2}',{s2},{sqljson(foreign)}); raise exception 'unexpected binding replacement'; exception when others then if sqlerrm<>'checkout_customer_result_invalid' then raise; end if; end $$", 782006)
assert '"kind": "BOUND"' in a
assert run(f"select stripe_customer_id from private.pocket_web_identities where app_user_id='{u2}'") == 'cus_RACEWINNER'
print('PASS: 3 additional real two-session provisioning/recovery races; one dispatch, idempotent bind/recover, conflicting customer denied. No provider traffic.')
