"""Offline source-integrity regressions. Fabricated small rows test code only."""
import importlib.util
from pathlib import Path
import sys
import unittest
from datetime import timedelta

spec=importlib.util.spec_from_file_location('monaco_source',Path(__file__).resolve().parents[1]/'scripts/prepare-monaco-source-candidates.py')
m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)

def text(rows,header=True):
    return (('timestamp,open,high,low,close,volume\n' if header else '')+'\n'.join(rows)+'\n').encode()

def minutes(n=15):
    return m.parse_csv(text([f'2026-10-12 12:{i:02}:00,100.001,100.009,100,100.005,{i+1}' for i in range(n)]),1)

class SourceCases(unittest.TestCase):
    def test_selection_rejects_wrong_timeframe_duplicate_ids_and_unknown_scenarios(self):
        import json, copy
        plan=json.loads((Path(__file__).resolve().parents[1]/'docs/monaco-126/corpus/CANDIDATE-SELECTION.json').read_text())
        for kind in ['timeframe','duplicate','scenario','path','anchor']:
            bad=copy.deepcopy(plan)
            if kind=='timeframe':bad['cases'][0]['timeframe']='15m'
            if kind=='duplicate':bad['cases'][1]['caseId']=bad['cases'][0]['caseId']
            if kind=='scenario':bad['cases'][0]['scenario']='made-up-pattern'
            if kind=='path':bad['cases'][0]['caseId']='../escape'
            if kind=='anchor':bad['cases'][0]['anchors'][0]['timestamp']='2026-10-16 11:00:00'
            with self.assertRaises(ValueError,msg=kind):m.validate_plan(bad)
    def test_header_and_headerless_have_same_values(self):
        row='2026-10-12 12:00:00,100,101,99,100.5,2'
        self.assertEqual(m.parse_csv(text([row]),1),m.parse_csv(text([row],False),1))
    def test_decimal_aggregate_preserves_source_values(self):
        b=m.aggregate(minutes(),15)[0]
        self.assertEqual(str(b.high),'100.009');self.assertEqual(str(b.close),'100.005')
        self.assertEqual(b.volume,120);self.assertEqual(b.source_count,15)
    def test_rejects_duplicate_and_unordered_rows(self):
        a='2026-10-12 12:00:00,100,101,99,100,1';b=a.replace('12:00','12:01')
        for rows in [[a,a],[b,a]]:
            with self.assertRaisesRegex(ValueError,'duplicate/unordered'):m.parse_csv(text(rows),1)
    def test_rejects_bad_numeric_and_ohlcv(self):
        for values in ['100,99,98,100,1','100,101,99,102,1','NaN,101,99,100,1','1e2,101,99,100,1','100,101,99,100,0','100,101,99,100,1.5','-1,1,0,1,1']:
            with self.assertRaises(ValueError):m.parse_csv(text(['2026-10-12 12:00:00,'+values]),1)
    def test_rejects_wrong_shape_and_repeated_header(self):
        for rows in [['2026-10-12 12:00:00,100,101,99,100'],[','.join(m.FIELDS)]]:
            with self.assertRaises(ValueError):m.parse_csv(text(rows),1)
    def test_rejects_off_grid(self):
        with self.assertRaisesRegex(ValueError,'off-grid'):m.parse_csv(text(['2026-10-12 12:01:00,100,101,99,100,1']),5)
    def test_dst_ambiguity_or_nonexistent_not_guessed(self):
        for stamp in ['2026-11-01 01:30:00','2026-03-08 02:30:00']:
            with self.assertRaises(ValueError):m.local_time(stamp)
    def test_timezone_is_dst_aware(self):
        self.assertEqual(m.local_time('2026-10-12 12:00:00').utcoffset(),timedelta(hours=-4))
        self.assertEqual(m.local_time('2026-12-12 12:00:00').utcoffset(),timedelta(hours=-5))
    def test_missing_minutes_not_filled_and_window_held(self):
        rows=minutes();del rows[3];bars=m.aggregate(rows,15)
        self.assertEqual(bars[0].source_count,14)
        with self.assertRaisesRegex(ValueError,'incomplete'):m.select(bars,'2026-10-12 12:00:00','2026-10-12 12:00:00',15)
    def test_missing_whole_bar_is_not_interpolated(self):
        rows=minutes(30);rows=rows[:5]+rows[10:];bars=m.aggregate(rows,5)
        self.assertEqual(len(bars),5)
        with self.assertRaisesRegex(ValueError,'trading gap'):m.select(bars,'2026-10-12 12:00:00','2026-10-12 12:25:00',5)
    def test_no_overnight_join(self):
        rows=minutes(5)+m.parse_csv(text(['2026-10-13 12:00:00,100,101,99,100,1']),1)
        bars=m.aggregate(rows,5)
        self.assertEqual(len(bars),2);self.assertNotEqual(bars[0].timestamp.date(),bars[1].timestamp.date())
    def test_exact_source_mismatch_detected(self):
        a=m.aggregate(minutes(5),5);b=m.parse_csv(text(['2026-10-12 12:00:00,100.001,100.009,100,100.006,15']),5)
        self.assertFalse(m.equal_bars(a,b))
    def test_required_endpoint_missing(self):
        with self.assertRaisesRegex(ValueError,'endpoint'):m.select(m.aggregate(minutes(5),5),'2026-10-12 12:00:00','2026-10-12 12:05:00',5)

if __name__=='__main__':unittest.main()
