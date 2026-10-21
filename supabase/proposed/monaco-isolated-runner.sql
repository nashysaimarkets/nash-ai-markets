-- PROPOSED ONLY. Install only in a separately authorised EMPTY nonproduction
-- project, after the unchanged 20261014113000_pocket_benchmark_pilot.sql.
-- No identity, approval, balance, credential or enabled ledger is seeded here.
-- Existing reservation/receipt/accounting/settlement functions remain intact.
do $$ begin
 if exists(select 1 from private.pocket_benchmark_pilot_ledgers)
    or exists(select 1 from private.pocket_benchmark_pilot_calls) then
   raise exception 'isolated setup requires an empty pilot schema; never retrofit a live ledger';
 end if;
end $$;

create table private.monaco_runner_binding (
 singleton boolean primary key default true check(singleton),
 ledger_key text not null unique,
 backend_ref text not null check(backend_ref ~ '^[a-z]{20}$'
   and backend_ref not in ('pxlqvaddvghjjhenqmdh','opmgzchnmcgnsfwpmysc')),
 environment_name text not null check(environment_name='monaco-first-six-inference'),
 runner_source_sha text not null check(runner_source_sha ~ '^[a-f0-9]{40}$'),
 project_ref text not null check(project_ref='proj_LTmAIE2Ve7gUAFJ9M74ZxIBI'),
 existing_key_tracking_id text not null check(existing_key_tracking_id='key_EjND5GXtuqF2K0hp'),
 key_fingerprint_sha256 text not null check(key_fingerprint_sha256 ~ '^[a-f0-9]{64}$'),
 paid_scope_ref text not null check(paid_scope_ref='issue126-6309459418'),
 plan_sha256 text not null check(plan_sha256='9490af55e554f84d63d7afc1fe2442298afd6cdbe8f356d6d8d0517504420ff0'),
 setup_approval_sha256 text not null check(setup_approval_sha256 ~ '^[a-f0-9]{64}$'),
 processor_acceptance_sha256 text not null check(processor_acceptance_sha256 ~ '^[a-f0-9]{64}$'),
 binding_evidence_sha256 text not null check(binding_evidence_sha256 ~ '^[a-f0-9]{64}$')
);

-- An administrator imports independently reconciled evidence ONCE. Missing or
-- unknown amounts cannot be represented as zero or reset by the runtime role.
create table private.monaco_prior_budget (
 singleton boolean primary key default true references private.monaco_runner_binding(singleton),
 spent_microusd bigint not null check(spent_microusd between 0 and 5000000),
 reserved_microusd bigint not null check(reserved_microusd between 0 and 5000000),
 unresolved_microusd bigint not null check(unresolved_microusd between 0 and 5000000),
 evidence_complete boolean not null check(evidence_complete),
 historical_two_dollars_separate boolean not null check(historical_two_dollars_separate),
 cash_allowance_accepted boolean not null check(cash_allowance_accepted),
 evidence_ref text not null check(length(evidence_ref) between 12 and 500),
 evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 verified_at timestamptz not null,
 check(spent_microusd+reserved_microusd+unresolved_microusd<=5000000)
);

-- Only non-secret hashes copied from the existing frozen eighteen-slot plan.
create table private.monaco_request_pins (
 case_id text not null check(case_id in ('d001','d002','d003','d004','d005','d006')),
 slot text not null check(slot in ('main','primary_precision','rescue_precision')),
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 primary key(case_id,slot)
);

alter table private.monaco_runner_binding enable row level security;
alter table private.monaco_prior_budget enable row level security;
alter table private.monaco_request_pins enable row level security;
revoke all on private.monaco_runner_binding,private.monaco_prior_budget,private.monaco_request_pins
 from public,anon,authenticated,service_role;
create trigger monaco_binding_immutable before update or delete on private.monaco_runner_binding
 for each row execute function private.block_pocket_benchmark_budget_change();
create trigger monaco_binding_no_reset before truncate on private.monaco_runner_binding
 for each statement execute function private.block_pocket_benchmark_budget_change();
create trigger monaco_prior_immutable before update or delete on private.monaco_prior_budget
 for each row execute function private.block_pocket_benchmark_budget_change();
create trigger monaco_prior_no_reset before truncate on private.monaco_prior_budget
 for each statement execute function private.block_pocket_benchmark_budget_change();
create trigger monaco_pins_immutable before update or delete on private.monaco_request_pins
 for each row execute function private.block_pocket_benchmark_budget_change();
create trigger monaco_pins_no_reset before truncate on private.monaco_request_pins
 for each statement execute function private.block_pocket_benchmark_budget_change();

-- Relocate only this proposed empty copy. The original source SQL and live DB
-- remain unchanged. Replace the legacy shared-live pin with an exact binding.
alter table private.pocket_benchmark_budget_configs
 drop constraint pocket_benchmark_budget_configs_staging_ref_check;
alter table private.pocket_benchmark_budget_configs add constraint monaco_isolated_backend
 check(staging_ref ~ '^[a-z]{20}$' and staging_ref not in ('pxlqvaddvghjjhenqmdh','opmgzchnmcgnsfwpmysc'));

create function private.guard_monaco_config() returns trigger
language plpgsql security definer set search_path=pg_catalog,private as $$
declare b private.monaco_runner_binding%rowtype;
begin
 select * into b from private.monaco_runner_binding where singleton;
 if not found or row(NEW.ledger_key,NEW.staging_ref,NEW.project_ref,NEW.key_tracking_id,NEW.key_fingerprint_sha256)
  is distinct from row(b.ledger_key,b.backend_ref,b.project_ref,b.existing_key_tracking_id,b.key_fingerprint_sha256)
  or NEW.candidate_sha<>'f5e820b0bd7bf095153e31d692a10fb3640ba16e' then
  raise exception 'isolated config does not match frozen existing-credential binding';
 end if;
 return NEW;
end $$;
create trigger monaco_config_binding before insert on private.pocket_benchmark_budget_configs
 for each row execute function private.guard_monaco_config();

create function private.monaco_budget_state(p_key text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,private as $$
declare b private.monaco_runner_binding%rowtype; p private.monaco_prior_budget%rowtype;
 l private.pocket_benchmark_pilot_ledgers%rowtype; prior bigint; committed bigint;
begin
 select * into l from private.pocket_benchmark_pilot_ledgers where ledger_key=p_key for update;
 select * into b from private.monaco_runner_binding where singleton;
 if not found or b.ledger_key is distinct from p_key or l.ledger_key is null
  or l.owner_approval_ref is distinct from 'comment-6165012632'
  or l.project_ref is distinct from b.project_ref or l.cap_microusd is distinct from 5000000
  or l.candidate_sha is distinct from 'f5e820b0bd7bf095153e31d692a10fb3640ba16e'
  or l.allowed_case_ids is distinct from array['d001','d002','d003','d004','d005','d006']::text[] then
  raise exception 'canonical aggregate allowance and exact first-six binding required';
 end if;
 select * into p from private.monaco_prior_budget where singleton;
 if not found or p.verified_at>clock_timestamp() then raise exception 'authoritative prior exposure unresolved'; end if;
 if (select count(*) from private.monaco_request_pins)<>18 then raise exception 'complete frozen eighteen-slot inventory required'; end if;
 prior:=p.spent_microusd+p.reserved_microusd+p.unresolved_microusd;
 if prior+1917600>l.cap_microusd then raise exception 'insufficient aggregate first-six headroom'; end if;
 select coalesce(sum(greatest(estimated_microusd,coalesce(actual_microusd,estimated_microusd))),0)
  into committed from private.pocket_benchmark_pilot_calls where ledger_key=p_key and status in ('reserved','submitted','settled');
 if prior+committed>l.cap_microusd then raise exception 'aggregate budget exhausted'; end if;
 return jsonb_build_object('ledger_key',p_key,'prior_exposure_microusd',prior,
  'new_commitments_microusd',committed,'remaining_microusd',l.cap_microusd-prior-committed,
  'financially_settled',false,'real_dispatch_enabled',false);
end $$;

create function private.guard_monaco_case() returns trigger
language plpgsql security definer set search_path=pg_catalog,private as $$
begin
 perform private.monaco_budget_state(NEW.ledger_key);
 if NEW.case_id not in ('d001','d002','d003','d004','d005','d006') then raise exception 'held-out case prohibited'; end if;
 return NEW;
end $$;
create trigger monaco_case_guard before insert on private.pocket_benchmark_pilot_cases
 for each row execute function private.guard_monaco_case();

create function private.guard_monaco_call() returns trigger
language plpgsql security definer set search_path=pg_catalog,private as $$
declare s jsonb; expected text; previous bigint:=0; proposed bigint:=0;
begin
 s:=private.monaco_budget_state(NEW.ledger_key);
 select fingerprint into expected from private.monaco_request_pins where case_id=NEW.case_id and slot=NEW.slot;
 if not found or NEW.model<>'gpt-5-mini-2025-08-07' or NEW.service_tier<>'default'
  or NEW.estimated_microusd is distinct from private.pocket_benchmark_reserved_bound(NEW.slot) then
  raise exception 'call outside frozen first-six plan';
 end if;
 if TG_OP='INSERT' and NEW.estimated_microusd>(s->>'remaining_microusd')::bigint then
  raise exception 'carry-in exposure would exceed aggregate cap';
 end if;
 if TG_OP='UPDATE' then
  if OLD.status in ('reserved','submitted','settled') then previous:=greatest(OLD.estimated_microusd,coalesce(OLD.actual_microusd,OLD.estimated_microusd)); end if;
  if NEW.status in ('reserved','submitted','settled') then proposed:=greatest(NEW.estimated_microusd,coalesce(NEW.actual_microusd,NEW.estimated_microusd)); end if;
  if proposed-previous>(s->>'remaining_microusd')::bigint then raise exception 'updated cost exceeds combined prior and new allowance'; end if;
 end if;
 if NEW.status='submitted' and NEW.envelope_sha256 is distinct from expected then
  raise exception 'submitted request fingerprint differs from frozen plan';
 end if;
 return NEW;
end $$;
create trigger monaco_call_guard before insert or update on private.pocket_benchmark_pilot_calls
 for each row execute function private.guard_monaco_call();

-- Verify local protected-runner identity against independently accepted binding
-- evidence, without performing or fabricating a fresh model-metadata request.
create function private.inspect_monaco_isolated_runner(p_key text,p_identity jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,private as $$
declare b private.monaco_runner_binding%rowtype; s jsonb;
begin
 s:=private.monaco_budget_state(p_key);
 perform private.assert_pocket_benchmark_budget_config(p_key);
 select * into b from private.monaco_runner_binding where singleton;
 if p_identity is null or row(p_identity->>'environment',p_identity->>'sourceSha',p_identity->>'backendRef',
    p_identity->>'projectRef',p_identity->>'keyTrackingId',p_identity->>'keyFingerprintSha256',p_identity->>'planSha256')
   is distinct from row(b.environment_name,b.runner_source_sha,b.backend_ref,b.project_ref,b.existing_key_tracking_id,b.key_fingerprint_sha256,b.plan_sha256) then
  raise exception 'protected runner identity mismatch';
 end if;
 return s || jsonb_build_object('binding_matches',true,'setup_only',true);
end $$;

create function public.inspect_monaco_isolated_runner(p_key text,p_identity jsonb) returns jsonb
language sql security invoker set search_path=pg_catalog as $$
 select private.inspect_monaco_isolated_runner(p_key,p_identity)
$$;

revoke all on function private.guard_monaco_config(),private.monaco_budget_state(text),
 private.guard_monaco_case(),private.guard_monaco_call(),private.inspect_monaco_isolated_runner(text,jsonb),public.inspect_monaco_isolated_runner(text,jsonb)
 from public,anon,authenticated,service_role;
grant execute on function private.inspect_monaco_isolated_runner(text,jsonb),public.inspect_monaco_isolated_runner(text,jsonb) to service_role;
-- Missing binding/baseline/config prevents all claims. Nothing is enabled here.
