import importlib.util
import json
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    'staged_release', Path(__file__).resolve().parents[1] / 'submit-staged-iphone.py'
)
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)

CANDIDATE = {'marketingVersion': '1.2.11', 'predecessorVersion': '1.2.10',
             'buildNumber': '34', 'appleBuildId': 'verified-build-34'}


def version(name='1.2.10', state='READY_FOR_DISTRIBUTION'):
    return {'id': name, 'type': 'appStoreVersions', 'attributes': {
        'platform': 'IOS', 'versionString': name, 'appVersionState': state}}


def review(state):
    return {'id': 'review', 'type': 'reviewSubmissions', 'attributes': {'state': state}}


class ReviewPreservationTests(unittest.TestCase):
    def test_active_review_and_pending_release_are_preserved(self):
        for state in release.PROTECTED:
            with self.subTest(state=state):
                self.assertEqual(release.gate([version(state=state)], [], CANDIDATE)[0], 'deferred')

    def test_rejections_and_unknown_states_never_submit(self):
        for state in ['REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY', 'UNKNOWN', 'PREPARE_FOR_SUBMISSION']:
            with self.subTest(state=state), self.assertRaises(RuntimeError):
                release.gate([version(state=state)], [], CANDIDATE)

    def test_only_completed_predecessor_and_reviews_allow_submission(self):
        self.assertEqual(release.gate([version()], [review('COMPLETE')], CANDIDATE)[0], 'ready')
        for state in ['WAITING_FOR_REVIEW', 'IN_REVIEW', 'COMPLETING', 'CANCELING']:
            with self.subTest(state=state):
                self.assertEqual(release.gate([version()], [review(state)], CANDIDATE)[0], 'deferred')
        for state in ['READY_FOR_REVIEW', 'UNRESOLVED_ISSUES', 'UNKNOWN']:
            with self.subTest(state=state), self.assertRaises(RuntimeError):
                release.gate([version()], [review(state)], CANDIDATE)

    def test_repeated_run_does_not_resubmit_existing_candidate(self):
        for state in release.PROTECTED | release.RELEASED:
            with self.subTest(state=state):
                self.assertEqual(release.gate([version(), version('1.2.11', state)], [], CANDIDATE)[0], 'already-submitted')

    def test_another_draft_or_newer_release_blocks_old_candidate(self):
        for extra in [version('1.2.12'), version('1.2.9', 'PREPARE_FOR_SUBMISSION')]:
            with self.assertRaises(RuntimeError):
                release.gate([version(), extra], [], CANDIDATE)

    def test_missing_or_duplicate_predecessor_is_not_assumed_released(self):
        for versions in [[], [version(), version()]]:
            with self.assertRaises(RuntimeError):
                release.gate(versions, [], CANDIDATE)

    def test_legacy_released_state_is_supported(self):
        v = version()
        v['attributes'].pop('appVersionState')
        v['attributes']['appStoreState'] = 'READY_FOR_SALE'
        self.assertEqual(release.gate([v], [], CANDIDATE)[0], 'ready')

    def test_candidate_must_match_exact_processed_unexpired_build(self):
        build = {'type': 'builds', 'id': 'verified-build-34', 'attributes': {
            'version': '34', 'processingState': 'VALID', 'expired': False}}
        self.assertEqual(release.verify_build([build], CANDIDATE), 'verified-build-34')
        for change in [{'version': '33'}, {'processingState': 'PROCESSING'},
                       {'processingState': 'INVALID'}, {'expired': True}]:
            bad = {**build, 'attributes': {**build['attributes'], **change}}
            with self.assertRaises(RuntimeError):
                release.verify_build([bad], CANDIDATE)
        for builds in [[], [build, build], [{**build, 'id': 'other-build'}]]:
            with self.assertRaises(RuntimeError):
                release.verify_build(builds, CANDIDATE)

    def test_cli_progress_does_not_corrupt_resource_json(self):
        expected = [version()]
        self.assertEqual(release.parse_cli_json('\x1b[34mFound 1 version\x1b[0m\n' + json.dumps(expected)), expected)
        self.assertEqual(release.parse_cli_json('Found 0 builds\n[]\n'), [])
        for bad in ['Apple request failed', '{"error": "not authorized"}', '[incomplete']:
            with self.assertRaises(RuntimeError):
                release.parse_cli_json(bad)


if __name__ == '__main__':
    unittest.main()
