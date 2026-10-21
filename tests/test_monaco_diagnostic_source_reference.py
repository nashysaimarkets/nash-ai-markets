"""Narrow source-oracle regressions; synthetic unit data are never scanner evidence."""

import copy
from datetime import datetime, timedelta
from fractions import Fraction
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
import zipfile


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/monaco-diagnostic-source-reference.py"
SPEC = importlib.util.spec_from_file_location("monaco_diagnostic_source", SCRIPT)
oracle = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(oracle)


def unit_rows():
    start = datetime.fromisoformat("2026-10-12T12:00:00-04:00")
    values = [
        (0, "100.10", "100.60", "99.90", "100.30", "7"),
        (1, "100.30", "100.80", "100.00", "100.40", "0"),
        (3, "100.40", "100.80", "99.90", "100.20", "11"),
    ]
    return start, [
        {"time": start + timedelta(minutes=offset), **dict(zip(oracle.NUMERIC, map(Fraction, numbers)))}
        for offset, *numbers in values
    ]


class SourceReferenceTests(unittest.TestCase):
    def test_zero_volume_observation_contributes_and_missing_minute_is_not_interpolated(self):
        start, rows = unit_rows()
        values, witnesses, missing = oracle.reduce_interval(rows, start, 5)
        self.assertEqual(values, dict(zip(oracle.NUMERIC, map(Fraction, ["100.10", "100.80", "99.90", "100.20", "18"]))))
        self.assertEqual(witnesses["high"], [rows[1]["time"].isoformat(), rows[2]["time"].isoformat()])
        self.assertEqual(witnesses["low"], [rows[0]["time"].isoformat(), rows[2]["time"].isoformat()])
        self.assertEqual(witnesses["close"], [rows[2]["time"].isoformat()])
        self.assertEqual(missing, [(start + timedelta(minutes=n)).isoformat() for n in (2, 4)])

    def test_exclusive_cutoff_rejects_future_observation(self):
        start, rows = unit_rows()
        rows.append({**rows[-1], "time": start + timedelta(minutes=5)})
        with self.assertRaisesRegex(ValueError, "crosses"):
            oracle.reduce_interval(rows, start, 5)

    def test_duplicate_and_unordered_minutes_rejected(self):
        start, rows = unit_rows()
        for invalid in (rows + [rows[-1]], list(reversed(rows))):
            with self.assertRaisesRegex(ValueError, "Duplicate or unordered"):
                oracle.reduce_interval(invalid, start, 5)

    def test_source_zip_timezone_and_window_exclusion(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("SPY_1min_sample.csv", "timestamp,open,high,low,close,volume\n2026-10-12 11:59:00,90,90,90,90,1\n2026-10-12 12:00:00,100,102,99,101,0\n2026-10-12 12:05:00,900,900,900,900,1\n")
        start = datetime.fromisoformat("2026-10-12T16:00:00+00:00")
        rows, evidence = oracle.minute_observations(buffer.getvalue(), "SPY", [(start, start + timedelta(minutes=5))])
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["time"].isoformat(), "2026-10-12T12:00:00-04:00")
        self.assertEqual(rows[0]["high"], Fraction(102))
        self.assertEqual(rows[0]["volume"], 0)
        self.assertEqual(evidence["timezone"], "America/New_York")

    def test_nonfinite_and_duplicate_json_rejected(self):
        for text in ('{"a":NaN}', '{"a":Infinity}', '{"a":[1e999]}', '{"a":1,"a":2}'):
            with self.assertRaises(ValueError):
                oracle.strict_json(text)
        for value in ("NaN", "Infinity", "1e999", float("inf"), True):
            with self.assertRaises(ValueError):
                oracle.number(value)

    def test_source_price_padding_and_axis_inversion(self):
        bars = [{"ohlcv": {"low": "100", "high": "120"}}]
        calibration = {"kind": "linear", "width": 1000, "height": 800, "plot": {"left": 100, "right": 900, "top": 100, "bottom": 680}, "priceMin": "98.4", "priceMax": "121.6", "pixelQuantizationBound": 0.5}
        scale = oracle.scale_for(calibration, bars, 1000, 800)
        self.assertEqual(scale["pricePerPixelExact"], {"numerator": "1", "denominator": "25"})
        self.assertEqual(scale["priceAtYZeroExact"], {"numerator": "628", "denominator": "5"})
        self.assertEqual(scale["xSpacingPixels"], 800)
        bad = copy.deepcopy(calibration)
        bad["priceMin"] = "98.3"
        with self.assertRaisesRegex(ValueError, "source extrema"):
            oracle.scale_for(bad, bars, 1000, 800)

    def test_heldout_case_and_reordered_scope_rejected_before_io(self):
        for cases in ([{"caseId": "e001"}], [{"caseId": f"d{n:03d}"} for n in reversed(range(1, 7))]):
            with self.assertRaisesRegex(ValueError, "Only original ordered"):
                oracle.validate_scope(cases)

    def test_packet_path_escape_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            packet = root / "packet"
            packet.mkdir()
            outside = root / "outside.txt"
            outside.write_bytes(b"fixture")
            with self.assertRaisesRegex(ValueError, "escapes"):
                oracle.checked_read(packet, "../outside.txt", oracle.sha(b"fixture"))

    def test_weak_4h_pattern_and_semantic_labels_remain_unscored(self):
        self.assertEqual(oracle.assessability("d003")["pattern"]["status"], "UNSCORED")
        self.assertEqual(oracle.assessability("d003")["pattern"]["reasonCode"], "UNSCORED_WEAK_4H")
        self.assertTrue(all(item["status"] == "OBJECTIVE_ONLY" for item in oracle.assessability("d001").values()))


if __name__ == "__main__":
    unittest.main()
