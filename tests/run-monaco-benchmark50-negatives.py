#!/usr/bin/env python3
"""Offline regression/tamper tests against an actual private benchmark packet.

No source data is embedded here. Packet reads are overlaid in memory; only the
requested receipt and temporary preflight selections are written. This checks
engineering guards, not human references, scanner quality or financial admission.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.util
import json
import re
import socket
import sys
import tempfile
from collections import Counter
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def encoded(value):
    # Permissive serialization is intentional for invalid-number tamper probes.
    return (json.dumps(value, indent=2, ensure_ascii=False) + '\n').encode()


class PacketView:
    """A coherent six-case view of a real 50-case packet, without copying data."""

    def __init__(self, root, base, selection, subset=True):
        self.root = root
        self.manifest = copy.deepcopy(base)
        self.overlays = {}
        self.subset = subset
        if subset:
            self.manifest['cases'] = [c for c in self.manifest['cases'] if c['split'] == 'development']
            self.manifest['categoryCounts'] = dict(Counter(c['category'] for c in self.manifest['cases']))
            self.manifest['splitCounts'] = {'development': 6}
            hashes = {c['rasterSha256'] for c in self.manifest['cases']}
            selected = copy.deepcopy(selection)
            selected['cases'] = [c for c in selected['cases'] if c['split'] == 'development']
            selection_bytes = encoded(selected)
            self.overlays[(root / 'SELECTION.private.json').resolve()] = selection_bytes
            self.manifest['sourceSelectionSha256'] = sha(selection_bytes)
            coordinator = json.loads((root / 'reviews/private-coordinator/MAP.json').read_text())
            aliases = {}
            for role in ['primary', 'independent']:
                path = root / 'reviews' / role / 'WORKSHEETS.json'
                sheets = [s for s in json.loads(path.read_text()) if s['imageSha256'] in hashes]
                self.put(path, sheets)
                aliases.update({role + ':' + s['reviewId']: coordinator['aliases'][role + ':' + s['reviewId']] for s in sheets})
            coordinator['aliases'] = aliases
            self.put(root / 'reviews/private-coordinator/MAP.json', coordinator)

    def case(self, case_id):
        return next(c for c in self.manifest['cases'] if c['caseId'] == case_id)

    def put(self, path, value):
        self.overlays[path.resolve()] = encoded(value)

    def read_json(self, path):
        return json.loads(self.overlays.get(path.resolve(), path.read_bytes()))

    def artifact(self, case_id, path_key, hash_key, mutate, overflow=False):
        case = self.case(case_id)
        path = self.root / case[path_key]
        value = self.read_json(path)
        mutate(value)
        raw = encoded(value)
        if overflow:
            raw = raw.replace(b'"OVERFLOW_LITERAL"', b'1e999')
        self.overlays[path.resolve()] = raw
        case[hash_key] = sha(raw)
        if path_key == 'inputPath':
            self.artifact(case_id, 'labelPath', 'labelSha256', lambda x: x.update(inputSha256=case[hash_key]))

    def worksheet(self, mutate):
        path = self.root / 'reviews/independent/WORKSHEETS.json'
        value = self.read_json(path)
        mutate(value[0])
        self.put(path, value)

    @contextmanager
    def active(self):
        self.put(self.root / 'BENCHMARK50.json', self.manifest)
        subset_path = self.root / 'SIX-CASE-REPLACEMENTS-v2.json'
        if subset_path.resolve() not in self.overlays:
            # Keep paired manifests coherent so artifact probes reach their target
            # guard rather than being rejected early for an unrelated subset hash.
            subset = copy.deepcopy(self.manifest)
            subset['cases'] = [c for c in subset['cases'] if c['split'] == 'development']
            subset['categoryCounts'] = dict(Counter(c['category'] for c in subset['cases']))
            subset['splitCounts'] = {'development': 6}
            subset['status'] = 'VERSIONED_SIX_REPLACEMENT_CANDIDATES_NOT_ACCEPTED'
            self.put(subset_path, subset)
        original_bytes, original_text = Path.read_bytes, Path.read_text

        def read_bytes(path):
            key = path.resolve()
            return self.overlays[key] if key in self.overlays else original_bytes(path)

        def read_text(path, *args, **kwargs):
            key = path.resolve()
            if key in self.overlays:
                return self.overlays[key].decode(kwargs.get('encoding') or 'utf-8')
            return original_text(path, *args, **kwargs)

        with patch.object(Path, 'read_bytes', read_bytes), patch.object(Path, 'read_text', read_text):
            yield


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--packet', type=Path, required=True)
    parser.add_argument('--receipt', type=Path, required=True)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--only', help='Comma-separated named probes; omits the completed full baseline.')
    mode.add_argument('--baseline-only', action='store_true', help='Validate a newly generated packet once without repeating completed tamper probes.')
    args = parser.parse_args()
    root = args.packet.resolve()
    repo = Path(__file__).resolve().parents[1]
    builder = repo / 'scripts/prepare-monaco-benchmark50.py'
    original_source = builder.read_bytes()
    spec = importlib.util.spec_from_file_location('monaco_benchmark50_under_test', builder)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    base_bytes = (root / 'BENCHMARK50.json').read_bytes()
    base = json.loads(base_bytes)
    selection = json.loads((root / 'SELECTION.private.json').read_text())
    results = []
    selected_names = set() if args.baseline_only else (set(args.only.split(',')) if args.only else None)

    # Reuse exact-byte source parsing and exact-argument rendering between probes.
    # Any changed ZIP bytes miss the cache and exercise the real source-pin gate.
    source_cache, render_cache = {}, {}
    source_load, render = module.load_source, module.render

    def cached_source(symbol, path):
        key = (symbol, sha(path.read_bytes()))
        if key not in source_cache:
            source_cache[key] = source_load(symbol, path)
        return source_cache[key]

    def cached_render(rows, info, timeframe, appearance):
        key = (tuple(rows), json.dumps(info, sort_keys=True), timeframe, appearance)
        if key not in render_cache:
            render_cache[key] = render(rows, info, timeframe, appearance)
        return render_cache[key]

    module.load_source, module.render = cached_source, cached_render

    def probe(name, action, reject=True, reason=None):
        if selected_names is not None and name not in selected_names:
            return
        try:
            action()
        except ValueError as error:
            message = str(error)
            ok = reject and (reason is None or re.search(reason, message, re.I) is not None)
            results.append(dict(name=name, status='PASS_REJECTED' if ok else 'FAIL_WRONG_REJECTION', reason=message))
        except Exception as error:
            results.append(dict(name=name, status='FAIL_UNEXPECTED_ERROR', errorType=type(error).__name__, reason=str(error)))
        else:
            results.append(dict(name=name, status='FAIL_ACCEPTED' if reject else 'PASS'))

    def verify_tamper(mutate):
        view = PacketView(root, base, selection)
        mutate(view)
        with view.active():
            return module.verify(root, False)

    def manifest_tamper(mutate):
        value = copy.deepcopy(base)
        mutate(value)
        return module.validate_manifest(value, True)

    def selection_preflight(mutate):
        value = copy.deepcopy(selection)
        mutate(value)
        with tempfile.TemporaryDirectory(prefix='monaco50-preflight-') as folder:
            tmp = Path(folder)
            plan = tmp / 'selection.json'
            plan.write_bytes(encoded(value))
            output = tmp / 'packet'
            error = None
            with patch.object(module, 'load_source', side_effect=AssertionError('preflight read a source before rejection')):
                try:
                    module.build(tmp / 'absent-source', plan, tmp / 'absent-legacy', output)
                except ValueError as caught:
                    error = caught
            if output.exists():
                raise AssertionError('invalid selection created output before rejection')
            if error:
                raise error

    def source(symbol):
        return cached_source(symbol, root / 'sources' / (symbol + '.zip'))

    baseline = None
    with patch.object(socket, 'socket', side_effect=AssertionError('network forbidden in offline regression')):
        if args.baseline_only or selected_names is None:
            baseline = module.verify(root, True)
            assert baseline['casesChecked'] == 50 and baseline['providerCalls'] == 0 and baseline['semanticAccepted'] == 0
        probe('six_subset_control', lambda: verify_tamper(lambda view: None), reject=False)
        probe('nested_chart_label_leak', lambda: verify_tamper(lambda v: v.artifact('d001', 'inputPath', 'inputSha256', lambda x: x['chartConfirmation'].update(expectedPattern='RECTANGLE / RANGE'))))
        probe('missing_ohlc_geometry', lambda: verify_tamper(lambda v: v.artifact('d006', 'calibrationPath', 'calibrationSha256', lambda x: [g.update(points={}) for g in x['candles']])))
        probe('nonfinite_tick', lambda: verify_tamper(lambda v: v.artifact('d001', 'calibrationPath', 'calibrationSha256', lambda x: x['ticks'][0].update(price='NaN', y=float('nan')))))
        probe('overflow_numeric_literal', lambda: verify_tamper(lambda v: v.artifact('d006', 'calibrationPath', 'calibrationSha256', lambda x: x.update(pixelQuantizationBound='OVERFLOW_LITERAL'), overflow=True)))
        probe('false_source_summary', lambda: verify_tamper(lambda v: next(x for x in v.manifest['sourceReports'] if x['symbol'] == 'BTC').update(zeroVolumeRows=0, crossTimeframe=[])))
        probe('false_case_source_pin', lambda: verify_tamper(lambda v: v.case('d001').update(sourceZipSha256='0' * 64)))
        probe('unsafe_case_id_prewrite', lambda: selection_preflight(lambda p: p['cases'][0].update(caseId='../../escape')), reason='selection identity')
        probe('timeframe_mismatch_prewrite', lambda: selection_preflight(lambda p: p['cases'][0].update(minutes=5)), reason='timeframe')
        probe('unsafe_source_filename_prewrite', lambda: selection_preflight(lambda p: p['sourceFiles'].update(ES='../FRD-ES.zip')), reason='filename')
        probe('manifest_timeframe_mismatch', lambda: verify_tamper(lambda v: v.case('d001').update(timeframeMinutes=5)), reason='timeframe')
        probe('duplicate_underlying_window', lambda: manifest_tamper(lambda m: m['cases'][7].update(barsSha256=m['cases'][6]['barsSha256'])), reason='duplicate')

        def family_overlap(manifest):
            a = next(c for c in manifest['cases'] if c['caseId'] == 'e005')
            b = next(c for c in manifest['cases'] if c['caseId'] == 'e006')
            b.update(firstBar=a['firstBar'], lastBar=a['lastBar'], sourceCutoff=a['sourceCutoff'])

        probe('correlated_family_overlap', lambda: manifest_tamper(family_overlap), reason='overlap')

        def embargo(manifest):
            a = next(c for c in manifest['cases'] if c['caseId'] == 'e005')
            b = next(c for c in manifest['cases'] if c['caseId'] == 'e006')
            b['firstBar'] = (datetime.fromisoformat(a['sourceCutoff']) + timedelta(minutes=25)).isoformat()

        probe('correlated_family_embargo', lambda: manifest_tamper(embargo), reason='embargo')
        probe('forged_source_family', lambda: manifest_tamper(lambda m: m['cases'][6].update(sourceFamily='UNRELATED')), reason='source metadata')
        probe('cross_split_group', lambda: manifest_tamper(lambda m: m['cases'][6].update(groupId=m['cases'][0]['groupId'])), reason='group split')

        def cross_dates(manifest):
            c = next(c for c in manifest['cases'] if c['caseId'] == 'e001')
            delta = timedelta(days=5)
            for key in ['firstBar', 'lastBar', 'sourceCutoff']:
                c[key] = (datetime.fromisoformat(c[key]) + delta).isoformat()

        probe('cross_split_episode_dates', lambda: manifest_tamper(cross_dates), reason='episode leakage')
        probe('wrong_source_timezone', lambda: verify_tamper(lambda v: next(x for x in v.manifest['sourceReports'] if x['symbol'] == 'SPY').update(zone='UTC')), reason='source report')

        def bad_zip(view):
            path = root / 'sources' / 'BTC.zip'
            raw = path.read_bytes()
            view.overlays[path.resolve()] = raw[:-1] + bytes([raw[-1] ^ 1])

        probe('source_zip_bytes_pin', lambda: verify_tamper(bad_zip), reason='ZIP pin')

        def partial_last_bar():
            rows, _ = source('BTC')
            c = next(c for c in base['cases'] if c['caseId'] == 'd002')
            truncated = [r for r in rows if r.timestamp < datetime.fromisoformat(c['sourceCutoff']) - timedelta(minutes=1)]
            module.window(truncated, c['timeframeMinutes'], c['firstBar'], c['lastBar'])

        probe('unclosed_final_source_bar', partial_last_bar, reason='not closed')
        probe('future_cutoff', lambda: verify_tamper(lambda v: v.case('d001').update(sourceCutoff=(datetime.fromisoformat(v.case('d001')['sourceCutoff']) + timedelta(minutes=30)).isoformat())), reason='cutoff')
        probe('blind_answer_field', lambda: verify_tamper(lambda v: v.worksheet(lambda x: x.update(expectedPattern='BEAR FLAG'))), reason='blind answer')
        probe('blind_prefilled_target', lambda: verify_tamper(lambda v: v.worksheet(lambda x: x['tools']['pattern_watch'].update(state='PRESENT'))), reason='target answers')
        probe('blind_metadata_answer_hint', lambda: verify_tamper(lambda v: v.worksheet(lambda x: x.update(instrument=x['instrument'] + '; expected BEAR FLAG'))))
        probe('wrong_current_price', lambda: verify_tamper(lambda v: v.artifact('d001', 'inputPath', 'inputSha256', lambda x: x['chartConfirmation'].update(currentPrice='1'))), reason='price')

        def future_price(view):
            c = view.case('d001')
            rows, _ = source(c['symbol'])
            cutoff = datetime.fromisoformat(c['sourceCutoff'])
            current = view.read_json(root / c['inputPath'])['chartConfirmation']['currentPrice']
            observed_future = next(r.close for r in rows if r.timestamp >= cutoff and str(r.close) != current)
            view.artifact('d001', 'inputPath', 'inputSha256', lambda x: x['chartConfirmation'].update(currentPrice=str(observed_future)))

        probe('future_observation_in_current_price', lambda: verify_tamper(future_price), reason='price')

        def quarantine():
            rows, report = source('BTC')
            q = report['crossTimeframe'][0]['quarantinedIntervals'][0]
            start = datetime.fromisoformat(q['start']) - timedelta(minutes=20)
            end = start + timedelta(minutes=55)
            chosen = module.window(rows, 5, start.isoformat(), end.isoformat())
            module.check_quarantine(chosen, 5, report)

        probe('actual_quarantined_source_window', quarantine, reason='aggregation discrepancy')
        probe('category_quota_incomplete', lambda: manifest_tamper(lambda m: m['cases'][6].update(category='structure')), reason='allocation')
        probe('category_summary_false', lambda: manifest_tamper(lambda m: m.update(categoryCounts={'clear_pattern': 50})))
        probe('split_summary_false', lambda: manifest_tamper(lambda m: m.update(splitCounts={'development': 50})))

        def subset_summary(view):
            path = root / 'SIX-CASE-REPLACEMENTS-v2.json'
            subset = json.loads(path.read_text())
            subset['categoryCounts'] = copy.deepcopy(base['categoryCounts'])
            subset['splitCounts'] = copy.deepcopy(base['splitCounts'])
            view.put(path, subset)

        probe('six_subset_summary_false', lambda: verify_tamper(subset_summary), reason='summary counts')
        probe('false_case_human_acceptance', lambda: verify_tamper(lambda v: v.case('d003').update(canonicalCaseAccepted=True, humanReferenceStatus='ACCEPTED')))
        probe('false_heldout_dispatch_permission', lambda: verify_tamper(lambda v: v.manifest.update(heldoutInferencePermitted=True)))
        probe('per_case_rights_binding', lambda: verify_tamper(lambda v: v.case('d001').update(rightsEvidenceSha256='0' * 64)), reason='rights binding')

        def licence_file(view):
            path = root / view.case('d001')['licencePath']
            view.overlays[path.resolve()] = path.read_bytes() + b'\nchanged-for-offline-tamper-probe\n'

        probe('licence_file_bytes', lambda: verify_tamper(licence_file), reason='rights|licen')

        def forged_legacy(view):
            view.case('d001')['legacyHashes'] = {}
            view.artifact('d001', 'inputPath', 'inputSha256', lambda x: x['chartConfirmation'].update(instrument='SPY ETF (FirstRate Data)'))

        probe('forged_legacy_exemption', lambda: verify_tamper(forged_legacy))

    if selected_names:
        missing = selected_names - {r['name'] for r in results}
        if missing:
            raise SystemExit('Unknown probe names: ' + ','.join(sorted(missing)))
    if builder.read_bytes() != original_source:
        results.append(dict(name='source_stable_during_run', status='FAIL_SOURCE_CHANGED'))
    if (root / 'BENCHMARK50.json').read_bytes() != base_bytes:
        results.append(dict(name='packet_stable_during_run', status='FAIL_PACKET_CHANGED'))
    failures = [r for r in results if not r['status'].startswith('PASS')]
    categories = dict(Counter(c['category'] for c in base['cases']))
    expected = {'clear_pattern': 15, 'structure': 15, 'near_miss': 10, 'phone': 10}
    run = dict(
        status='FAIL' if failures else ('PASS_BASELINE_ONLY_NOT_ACCEPTANCE' if args.baseline_only else ('PASS_FOCUSED_PROBES' if selected_names else 'PASS_OFFLINE_NOT_ACCEPTANCE')),
        observedAt=datetime.now(timezone.utc).isoformat(),
        builderSha256=sha(original_source),
        sharedSourceReaderSha256=sha((repo / 'scripts/prepare-monaco-source-candidates.py').read_bytes()),
        testScriptSha256=sha(Path(__file__).read_bytes()),
        packetManifestSha256=sha(base_bytes),
        subsetManifestSha256=sha((root / 'SIX-CASE-REPLACEMENTS-v2.json').read_bytes()),
        selectionSha256=sha((root / 'SELECTION.private.json').read_bytes()),
        baseline=None if baseline is None else {k: v for k, v in baseline.items() if k != 'checks'},
        focusedOnly=sorted(selected_names) if selected_names else None,
        baselineOnly=args.baseline_only,
        cases=results, tests=len(results), failures=len(failures),
        categoryQuotaCoverage={k: {'prepared': categories.get(k, 0), 'required': n, 'coverage': categories.get(k, 0) / n} for k, n in expected.items()},
        quotaMeaning='Prepared category allocation only; 100% coverage is not canonical qualification or independent human acceptance.',
        sourcePins={s['symbol']: s['sha256'] for s in base['sourceReports']},
        acceptedCases=base['acceptedCases'], humanReviewedCases=base['humanReviewedCases'],
        semanticAccepted=0, providerCalls=0, networkCalls=0, originalPacketWrites=0,
        limitations=['Automated advisory regression only', 'No genuine scanner measurement or legal/human acceptance', 'Mutations are isolated test failures, never replacement market evidence'],
    )
    receipt = {'status': run['status'], 'runs': []}
    if args.receipt.exists():
        receipt = json.loads(args.receipt.read_text())
    receipt['runs'].append(run)
    receipt['status'] = run['status']
    args.receipt.write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({k: run[k] for k in ['status', 'tests', 'failures', 'builderSha256', 'packetManifestSha256', 'providerCalls']}))
    for result in failures:
        print(json.dumps(result))
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
