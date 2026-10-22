"""Disposable localhost PostgreSQL only. No provider, cloud DB or credentials.
The explicit CI flag and fixed host/database prohibit accidental hosted use.
"""
import hashlib
import json
import os
from pathlib import Path
import selectors
import subprocess
import time
import unittest

DB = 'monaco_google_ownership_qa'
A = '11111111-1111-4111-8111-111111111111'
B = '22222222-2222-4222-8222-222222222222'
PACKAGE = 'com.nashaimarkets.pocketbullseye'
ROOT = Path(__file__).resolve().parents[1]

def token(label):
    return hashlib.sha256(('synthetic-' + label).encode()).hexdigest()

def quote(value):
    return 'NULL' if value is None else "'" + str(value).replace("'", "''") + "'"

def env(app='monaco_google_qa'):
    return {'PATH': os.environ.get('PATH', '/usr/bin:/bin'), 'LANG': 'C.UTF-8',
            'PGAPPNAME': app, 'PGCONNECT_TIMEOUT': '5',
            'PGOPTIONS': '-c statement_timeout=8000 -c lock_timeout=5000'}

def command(db=DB):
    return ['psql', '--no-psqlrc', '--no-password', '-qAt', '-h', '127.0.0.1',
            '-p', '5432', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1']

def sql(statement, db=DB, check=True):
    p = subprocess.run(command(db), input=statement, text=True, capture_output=True,
                       timeout=15, env=env())
    if check and p.returncode:
        raise AssertionError('Disposable SQL failed: ' + p.stderr)
    return p.stdout.strip() if check else p

def claim_query(label, account=A, parent=None, environment='production', package=PACKAGE):
    values = [account, package, environment, token(label), token(parent) if parent else None]
    return 'SELECT pocket_google_ownership.claim_token(' + ','.join(map(quote, values)) + ')'

def claim(label, **kwargs):
    return json.loads(sql(claim_query(label, **kwargs) + ';'))

def held_claim(label, account=A, parent=None):
    p = subprocess.Popen(command(), stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE, text=True, bufsize=1, env=env('monaco_google_holder'))
    q = claim_query(label, account, parent)
    p.stdin.write("BEGIN;\n" + q.replace("SELECT ", "SELECT (", 1) + ")::text || '|HELD';\n")
    p.stdin.flush()
    with selectors.DefaultSelector() as selector:
        selector.register(p.stdout, selectors.EVENT_READ)
        if not selector.select(timeout=5):
            p.kill(); p.communicate(); raise AssertionError('No transaction hold receipt')
        line = p.stdout.readline().strip()
    if not line.endswith('|HELD'):
        p.kill(); _, err = p.communicate(); raise AssertionError('Hold failed: ' + err)
    return p, json.loads(line[:-5])

def end_process(p):
    if p.poll() is None:
        p.kill()
    p.communicate(timeout=5)

def overlap(first_label, second_label, first_account=A, second_account=A, parent=None):
    holder, first = held_claim(first_label, first_account, parent)
    contender = None
    try:
        contender = subprocess.Popen(command(), stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, text=True, env=env('monaco_google_contender'))
        contender.stdin.write(claim_query(second_label, second_account, parent) + ';\n')
        contender.stdin.close(); contender.stdin = None
        blocked = False
        for _ in range(20):
            if sql("SELECT count(*) FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name='monaco_google_contender' AND l.locktype='advisory' AND NOT l.granted;") == '1':
                blocked = True; break
            time.sleep(0.05)
        if not blocked:
            raise AssertionError('Sessions did not overlap on the token lock')
        holder.stdin.write('COMMIT;\n\\q\n'); holder.stdin.flush()
        _, err = holder.communicate(timeout=5)
        if holder.returncode:
            raise AssertionError(err)
        out, err = contender.communicate(timeout=8)
        if contender.returncode:
            raise AssertionError(err)
        return first, json.loads(out.strip())
    finally:
        if holder.poll() is None:
            end_process(holder)
        if contender is not None and contender.poll() is None:
            end_process(contender)

class OwnershipTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if os.environ.get('MONACO_QA_DISPOSABLE_POSTGRES') != 'true' or os.environ.get('GITHUB_ACTIONS') != 'true':
            raise RuntimeError('Explicit disposable CI mode required; never use hosted databases')
        sql('CREATE DATABASE ' + DB + ';', db='postgres')
        sql((ROOT / 'database/google/20261022-proposed-token-ownership.sql').read_text())
        sql("CREATE ROLE monaco_google_qa_executor NOLOGIN; CREATE ROLE monaco_google_qa_guest NOLOGIN;"
            "GRANT USAGE ON SCHEMA pocket_google_ownership TO monaco_google_qa_executor;"
            "GRANT EXECUTE ON FUNCTION pocket_google_ownership.claim_token(uuid,text,text,text,text) TO monaco_google_qa_executor;")

    def test_01_new_claim_and_idempotent_receipt(self):
        a, b = claim('new'), claim('new')
        self.assertTrue(a['created']); self.assertFalse(b['created']); self.assertFalse(b['entitled'])
        self.assertEqual(a['status'], 'RECORDED')

    def test_02_other_account_cannot_claim_same_token(self):
        claim('owner')
        self.assertEqual(claim('owner', account=B)['reason'], 'ACCOUNT_OWNERSHIP_CONFLICT')

    def test_03_environment_and_package_cannot_relabel_existing_token(self):
        claim('scope')
        self.assertEqual(claim('scope', environment='sandbox')['reason'], 'TOKEN_SCOPE_CONFLICT')
        self.assertEqual(claim('scope', package='com.other.app')['reason'], 'TOKEN_SCOPE_CONFLICT')

    def test_04_replacement_retires_old_and_keeps_idempotence(self):
        claim('parent'); self.assertEqual(claim('child', parent='parent')['status'], 'RECORDED')
        self.assertEqual(claim('parent')['reason'], 'TOKEN_REPLACED')
        self.assertFalse(claim('child', parent='parent')['created'])
        self.assertEqual(sql('SELECT replaced_by_token_sha256 FROM pocket_google_ownership.tokens WHERE token_sha256=' + quote(token('parent'))), token('child'))

    def test_05_missing_and_other_owner_parent_refuse_without_new_row(self):
        self.assertEqual(claim('missing-child', parent='missing')['reason'], 'LINKED_OWNERSHIP_REVIEW_REQUIRED')
        claim('foreign-parent', account=B)
        self.assertEqual(claim('foreign-child', parent='foreign-parent')['reason'], 'ACCOUNT_OWNERSHIP_CONFLICT')
        self.assertEqual(sql('SELECT count(*) FROM pocket_google_ownership.tokens WHERE token_sha256 IN (' + quote(token('missing-child')) + ',' + quote(token('foreign-child')) + ')'), '0')

    def test_06_revoked_current_and_parent_are_denied(self):
        claim('revoked')
        sql('UPDATE pocket_google_ownership.tokens SET revoked=true WHERE token_sha256=' + quote(token('revoked')))
        self.assertEqual(claim('revoked')['reason'], 'TOKEN_REVOKED')
        self.assertEqual(claim('revoked-child', parent='revoked')['reason'], 'TOKEN_REVOKED')

    def test_07_reparent_and_cycle_are_denied(self):
        claim('fixed-parent'); claim('other-parent'); claim('fixed-child', parent='fixed-parent')
        self.assertEqual(claim('fixed-child', parent='other-parent')['reason'], 'LINKED_OWNERSHIP_CHANGED')
        self.assertEqual(claim('self', parent='self')['reason'], 'LINKED_TOKEN_CYCLE')

    def test_08_simultaneous_same_token_same_owner_has_one_insert(self):
        a, b = overlap('race-same', 'race-same')
        self.assertTrue(a['created']); self.assertFalse(b['created'])

    def test_09_simultaneous_same_token_different_owner_cannot_double_claim(self):
        a, b = overlap('race-owner', 'race-owner', second_account=B)
        self.assertEqual(a['status'], 'RECORDED'); self.assertEqual(b['reason'], 'ACCOUNT_OWNERSHIP_CONFLICT')

    def test_10_simultaneous_replacements_have_only_one_successor(self):
        claim('race-parent')
        a, b = overlap('race-child-a', 'race-child-b', parent='race-parent')
        self.assertEqual(a['status'], 'RECORDED'); self.assertEqual(b['reason'], 'TOKEN_REPLACED')
        self.assertEqual(sql('SELECT count(*) FROM pocket_google_ownership.tokens WHERE token_sha256=' + quote(token('race-child-b'))), '0')

    def test_11_connection_loss_rolls_back_uncommitted_claim(self):
        p, r = held_claim('rollback')
        self.assertEqual(r['status'], 'RECORDED'); end_process(p)
        self.assertTrue(claim('rollback', account=B)['created'])

    def test_12_retirement_failure_rolls_back_new_token(self):
        claim('atomic-parent')
        sql("CREATE FUNCTION pocket_google_ownership.qa_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic retirement failure'; END $$;"
            "CREATE TRIGGER qa_fail_retire BEFORE UPDATE ON pocket_google_ownership.tokens FOR EACH ROW WHEN (OLD.token_sha256=" + quote(token('atomic-parent')) + ") EXECUTE FUNCTION pocket_google_ownership.qa_fail();")
        try:
            self.assertNotEqual(sql(claim_query('atomic-child', parent='atomic-parent'), check=False).returncode, 0)
            self.assertEqual(sql('SELECT count(*) FROM pocket_google_ownership.tokens WHERE token_sha256=' + quote(token('atomic-child'))), '0')
            self.assertEqual(sql('SELECT replaced_by_token_sha256 IS NULL FROM pocket_google_ownership.tokens WHERE token_sha256=' + quote(token('atomic-parent'))), 't')
        finally:
            sql('DROP TRIGGER qa_fail_retire ON pocket_google_ownership.tokens;')

    def test_13_limited_executor_has_function_only_and_guests_have_none(self):
        for statement in ['SELECT * FROM pocket_google_ownership.tokens', 'DELETE FROM pocket_google_ownership.tokens',
                          'UPDATE pocket_google_ownership.tokens SET revoked=false']:
            self.assertNotEqual(sql('SET ROLE monaco_google_qa_executor; ' + statement, check=False).returncode, 0)
        self.assertNotEqual(sql('SET ROLE monaco_google_qa_guest; ' + claim_query('guest'), check=False).returncode, 0)
        self.assertEqual(json.loads(sql('SET ROLE monaco_google_qa_executor; ' + claim_query('executor')))['status'], 'RECORDED')

    def test_14_ownership_revocation_and_retirement_history_cannot_be_reset(self):
        for statement in ['DELETE FROM pocket_google_ownership.tokens', 'TRUNCATE pocket_google_ownership.tokens',
                          "UPDATE pocket_google_ownership.tokens SET account_id='" + B + "' WHERE token_sha256=" + quote(token('new')),
                          'UPDATE pocket_google_ownership.tokens SET revoked=false WHERE token_sha256=' + quote(token('revoked')),
                          'UPDATE pocket_google_ownership.tokens SET replaced_by_token_sha256=NULL WHERE token_sha256=' + quote(token('parent'))]:
            self.assertNotEqual(sql(statement, check=False).returncode, 0)

    def test_15_malformed_inputs_and_cross_scope_parent_are_refused(self):
        self.assertEqual(json.loads(sql("SELECT pocket_google_ownership.claim_token(NULL,'com.test.app','production','bad',NULL)"))['reason'], 'INVALID_OWNERSHIP_INPUT')
        claim('sandbox-parent', environment='sandbox')
        self.assertEqual(claim('production-child', parent='sandbox-parent')['reason'], 'TOKEN_SCOPE_CONFLICT')

if __name__ == '__main__':
    unittest.main(verbosity=2)
