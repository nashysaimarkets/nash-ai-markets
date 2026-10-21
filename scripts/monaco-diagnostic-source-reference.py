#!/usr/bin/env python3
"""Independent first-six source/coordinate oracle for internal diagnostics only.

Reads no proposals, reviewer annotations, held-out cases, existing renderer code,
provider output or network. Rational interval reduction is independent of the
existing bucket-based renderer/validator implementation. Never alters the packet.
"""

import argparse
import base64
from bisect import bisect_left
from collections import Counter
import csv
from datetime import datetime, timedelta, timezone
from fractions import Fraction
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import zipfile
from zoneinfo import ZoneInfo

from PIL import Image


CASE_IDS = tuple(f"d{i:03}" for i in range(1, 7))
SUBSET_FILE = "SIX-CASE-REPLACEMENTS-v2.json"
SUBSET_SHA256 = "b79b35b6b69546ac3c9164d91228062a58a4e271e09c25dd127d92d60ef17c31"
PACKET_MANIFEST_SHA256 = "df8b9e3eeaaaebff5197cbb13ddae45d362281cd3479ee398339953ab1293b21"
SOURCE_SPECS = {
    "ES": ("America/New_York", "359526b7043d72e476a2e8df9cbdc9a88891c00663f50e8176f76a4a0bd872d8"),
    "BTC": ("UTC", "6a887bc7417b896bbd578eb0fecf5c3693c391a285dfd9a6d3d31325056a119c"),
    "AAPL": ("America/New_York", "c88833e3d7b30c34110064d4c1647db3bcecedb486f259a2638e53d6c9dbc491"),
    "SPY": ("America/New_York", "f6031429ed0903be2a580be29529c37b6b017164d8b118c8d6267d2706148073"),
}
OHLC = ("open", "high", "low", "close")
NUMERIC = OHLC + ("volume",)
FRAME_MINUTES = {"5m": 5, "15m": 15, "30m": 30, "1h": 60, "4h": 240}
LIMITATIONS = [
    "Internal development diagnostics; no expert-reference or product acceptance.",
    "Source-derived prices and coordinates do not establish named patterns, support/resistance materiality, or actual liquidity/orders.",
    "All pattern/level/liquidity semantic judgments remain unscored; d003's weak 4h pattern remains explicitly unscored.",
    "Missing minute observations and zero-volume observations are retained and counted; no prices or trades are interpolated.",
    "Source high/low ties retain all witness minutes; price order within a one-minute candle is unknown.",
    "Display x spacing is by bar index, not elapsed wall time; session gaps remain gaps in timestamps.",
    "Raster bounds come from the preserved calibration and are independently checked against source OHLC and colored candle components; axis text is not independently OCR-verified.",
    "Declared 0.5-pixel quantization and measured raster residuals are separate; very short bodies may be expanded for visibility.",
    "All six current inputs have no precision crop; only their actual identity mapping is supported.",
    "Archive checksums cover the existing source files; only first-six source windows are reduced or exported. No held-out case files are opened.",
    "This calculation performs no scanner inference, licensing research, metadata verification, provider processing, outreach or financial settlement.",
]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encode(value):
    return (json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n").encode()


def strict_json(data):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, "Duplicate JSON key")
            result[key] = value
        return result

    def invalid(value):
        raise ValueError("Nonfinite JSON constant: " + value)

    value = json.loads(data, object_pairs_hook=unique, parse_constant=invalid)

    def finite(item):
        if isinstance(item, float):
            require(math.isfinite(item), "Nonfinite JSON number")
        elif isinstance(item, dict):
            for child in item.values():
                finite(child)
        elif isinstance(item, list):
            for child in item:
                finite(child)

    finite(value)
    return value


def number(value):
    require(not isinstance(value, bool) and isinstance(value, (str, int, float)), "Expected finite numeric value")
    text = str(value)
    require(re.fullmatch(r"-?\d+(?:\.\d+)?", text) is not None, "Expected finite plain decimal")
    return Fraction(text)


def decimal(value):
    """Exact finite decimal representation for source prices and their sums."""
    value = Fraction(value)
    denominator = value.denominator
    twos = fives = 0
    while denominator % 2 == 0:
        denominator //= 2
        twos += 1
    while denominator % 5 == 0:
        denominator //= 5
        fives += 1
    require(denominator == 1, "Expected terminating decimal")
    places = max(twos, fives)
    scaled = value.numerator * (10 ** places // value.denominator)
    sign = "-" if scaled < 0 else ""
    digits = str(abs(scaled)).zfill(places + 1)
    if places:
        text = sign + digits[:-places] + "." + digits[-places:]
        return text.rstrip("0").rstrip(".")
    return sign + digits


def ratio(value):
    value = Fraction(value)
    return {"numerator": str(value.numerator), "denominator": str(value.denominator)}


def timestamp(text):
    require(isinstance(text, str), "Timestamp must be text")
    value = datetime.fromisoformat(text)
    require(value.tzinfo is not None and value.second == 0 and value.microsecond == 0, "Minute-aligned aware timestamp required")
    return value


def checked_read(packet, relative, expected):
    require(isinstance(relative, str) and not Path(relative).is_absolute(), "Relative packet path required")
    path = (packet / relative).resolve(strict=True)
    require(path.is_relative_to(packet) and path.is_file(), "Packet path escapes source directory")
    data = path.read_bytes()
    require(sha(data) == expected, "Pinned artifact hash mismatch: " + relative)
    return data


def validate_scope(cases):
    require(isinstance(cases, list) and tuple(c.get("caseId") for c in cases) == CASE_IDS, "Only original ordered d001..d006 are permitted")
    for case in cases:
        require(case["split"] == "development", "Held-out cases are excluded")
        require(FRAME_MINUTES.get(case["timeframe"]) == case["timeframeMinutes"], "Timeframe mismatch")
        require(case["symbol"] in SOURCE_SPECS, "Unknown source symbol")
        require(case["sourceZipSha256"] == SOURCE_SPECS[case["symbol"]][1], "Source pin mismatch")
        start, last, end = map(timestamp, (case["firstBar"], case["lastBar"], case["sourceCutoff"]))
        require(start <= last and last + timedelta(minutes=case["timeframeMinutes"]) == end, "Partial last bar/cutoff mismatch")
        zone = ZoneInfo(SOURCE_SPECS[case["symbol"]][0])
        require(all(value.utcoffset() == value.astimezone(zone).utcoffset() for value in (start, last, end)), "Source timezone mismatch")


def minute_observations(archive_bytes, symbol, windows):
    """Read source CSV, retaining only observations in the explicitly allowed windows."""
    zone = ZoneInfo(SOURCE_SPECS[symbol][0])
    member = symbol + "_1min_sample.csv"
    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
        require(archive.namelist().count(member) == 1, "One exact source minute member required")
        data = archive.read(member)
    reader = csv.DictReader(io.StringIO(data.decode("utf-8-sig"), newline=""))
    require(reader.fieldnames == ["timestamp", *NUMERIC], "Unexpected minute CSV schema")
    rows = []
    last = None
    for cells in reader:
        require(cells.get("timestamp") is not None, "Missing source timestamp")
        naive = datetime.strptime(cells["timestamp"], "%Y-%m-%d %H:%M:%S")
        time = naive.replace(tzinfo=zone)
        if not any(start <= time < end for start, end in windows):
            continue
        require(time.second == 0 and (last is None or time > last), "Duplicate, unordered or nonminute source observation")
        require(set(cells) == {"timestamp", *NUMERIC}, "Unexpected selected CSV fields")
        values = {key: number(cells[key]) for key in NUMERIC}
        require(values["volume"] >= 0 and values["low"] <= min(values["open"], values["close"]) <= max(values["open"], values["close"]) <= values["high"], "Invalid source OHLCV")
        rows.append({"time": time, **values})
        last = time
    require(rows, "No source observations in first-six window")
    return rows, {"member": member, "memberSha256": sha(data), "timezone": str(zone)}


def reduce_interval(rows, start, minutes):
    """Independent interval query and rational OHLCV reduction; no bucket renderer."""
    end = start + timedelta(minutes=minutes)
    require(rows and all(start <= row["time"] < end for row in rows), "Source observation crosses bar interval/cutoff")
    require(all(rows[i]["time"] < rows[i + 1]["time"] for i in range(len(rows) - 1)), "Duplicate or unordered minute observations")
    values = {
        "open": rows[0]["open"], "high": max(row["high"] for row in rows),
        "low": min(row["low"] for row in rows), "close": rows[-1]["close"],
        "volume": sum((row["volume"] for row in rows), Fraction()),
    }
    witnesses = {
        "open": [rows[0]["time"].isoformat()], "close": [rows[-1]["time"].isoformat()],
        "high": [row["time"].isoformat() for row in rows if row["high"] == values["high"]],
        "low": [row["time"].isoformat() for row in rows if row["low"] == values["low"]],
    }
    missing = [
        (start + timedelta(minutes=i)).isoformat() for i in range(minutes)
        if start + timedelta(minutes=i) not in {row["time"] for row in rows}
    ]
    return values, witnesses, missing


def aggregate_case(case, saved_bars, source):
    minutes = case["timeframeMinutes"]
    start, cutoff = timestamp(case["firstBar"]), timestamp(case["sourceCutoff"])
    selected = [row for row in source if start <= row["time"] < cutoff]
    times = [row["time"] for row in selected]
    require(len(saved_bars) == case["bars"] and saved_bars, "Saved bar count mismatch")
    require(saved_bars[0]["timestamp"] == case["firstBar"] and saved_bars[-1]["timestamp"] == case["lastBar"], "Saved bar window mismatch")
    result, coverage, gaps = [], set(), []
    previous_end = None
    for index, bar in enumerate(saved_bars):
        time = timestamp(bar["timestamp"])
        require(time.astimezone(timezone.utc) == timestamp(bar["timestampUtc"]), "Saved UTC timestamp mismatch")
        require(time.utcoffset() == time.astimezone(ZoneInfo(SOURCE_SPECS[case["symbol"]][0])).utcoffset(), "Saved bar timezone mismatch")
        require((time.hour * 60 + time.minute) % minutes == 0, "Bar not aligned to source local clock")
        end = time + timedelta(minutes=minutes)
        require(start <= time < end <= cutoff, "Future or partial bar")
        if previous_end is not None:
            require(time >= previous_end, "Overlapping or unordered bars")
            if time > previous_end:
                gaps.append({"after": result[-1]["timestamp"], "before": time.isoformat()})
        first, stop = bisect_left(times, time), bisect_left(times, end)
        window = selected[first:stop]
        values, witnesses, missing = reduce_interval(window, time, minutes)
        require(all(number(bar[key]) == value for key, value in values.items()), "Source OHLCV mismatch: " + case["caseId"] + "/" + str(index))
        require(bar["sourceCount"] == len(window), "Source observation count mismatch")
        require(not coverage.intersection(range(first, stop)), "Source observation reused across bars")
        coverage.update(range(first, stop))
        result.append({
            "barIndex": index, "timestamp": time.isoformat(),
            "timestampUtc": time.astimezone(timezone.utc).isoformat(),
            "sourceCount": len(window), "missingMinuteSlots": len(missing),
            "missingMinuteTimestamps": missing,
            "zeroVolumeRows": sum(row["volume"] == 0 for row in window),
            "ohlcv": {key: decimal(value) for key, value in values.items()},
            "witnessMinuteTimestamps": witnesses,
        })
        previous_end = end
    require(len(coverage) == len(selected), "Source observations omitted from declared bar coverage")
    missing_count = sum(bar["missingMinuteSlots"] for bar in result)
    require(len(selected) == case["observedMinuteRows"] and missing_count == case["missingMinuteSlots"], "Window coverage mismatch")
    require(gaps == case["sessionGaps"], "Session-gap mismatch")
    canonical = [{"timestamp": row["time"].isoformat(), **{key: decimal(row[key]) for key in NUMERIC}} for row in selected]
    facts = {
        "barCount": len(result), "observedMinuteRows": len(selected),
        "missingMinuteSlots": missing_count,
        "zeroVolumeRows": sum(row["volume"] == 0 for row in selected),
        "exactOhlcvMatch": True, "sourceCountMatch": True, "cutoffExclusive": cutoff.isoformat(),
        "sessionGaps": gaps, "selectedObservationsSha256": sha(encode(canonical)),
        "selectedObservationHashFormat": "UTF-8 indented JSON; timestamp ISO offset then open/high/low/close/volume as normalized exact decimal strings; final LF",
        "independentMethod": "Per-saved-interval binary-search selection from original one-minute observations; rational first/max/min/last/sum; union coverage check",
    }
    return result, facts


def scale_for(calibration, bars, width, height):
    require(calibration["kind"] == "linear" and calibration["width"] == width and calibration["height"] == height, "Calibration raster mismatch")
    plot = calibration["plot"]
    require(set(plot) == {"left", "right", "top", "bottom"}, "Unknown plot shape")
    left, right, top, bottom = (number(plot[key]) for key in ("left", "right", "top", "bottom"))
    require(0 <= left < right < width and 0 <= top < bottom < height, "Plot outside raster")
    low = min(number(bar["ohlcv"]["low"]) for bar in bars)
    high = max(number(bar["ohlcv"]["high"]) for bar in bars)
    require(high > low, "Degenerate source price span")
    padding = (high - low) * Fraction(2, 25)
    price_min, price_max = low - padding, high + padding
    require(number(calibration["priceMin"]) == price_min and number(calibration["priceMax"]) == price_max, "Calibration price span does not equal source extrema plus preserved 8% padding")
    per_pixel = (price_max - price_min) / (bottom - top)
    step = (right - left) / len(bars)
    return {
        "width": width, "height": height, "plot": plot,
        "plotPercent": {"left": float(left / width * 100), "right": float(right / width * 100), "top": float(top / height * 100), "bottom": float(bottom / height * 100)},
        "priceMin": decimal(price_min), "priceMax": decimal(price_max),
        "pricePerPixel": float(per_pixel), "pricePerPixelExact": ratio(per_pixel),
        "priceAtYZeroExact": ratio(price_max + top * per_pixel),
        "coordinates": "ORIGINAL_IMAGE_PIXELS", "pixelQuantizationBound": calibration["pixelQuantizationBound"],
        "pixelQuantizationBoundUnits": "ORIGINAL_IMAGE_PIXELS_METADATA_DECLARATION",
        "xSpacingPixels": float(step), "xSpacingExact": ratio(step),
        "seriesSpacing": "EQUAL_BAR_INDEX_NOT_ELAPSED_TIME",
        "sourcePricePaddingFraction": "0.08",
        "priceAtYPixelFormula": "priceMax - (y - plot.top) * pricePerPixel",
        "yAtPriceFormula": "plot.top + (priceMax - price) / pricePerPixel",
        "xAtBarIndexFormula": "plot.left + (barIndex + 0.5) * xSpacingPixels",
        "percentCoordinateFormula": "xPercent=100*x/width; yPercent=100*y/height",
    }


def projected_points(bars, scale, calibration):
    require(number(scale["pixelQuantizationBound"]) == Fraction(1, 2), "Unexpected preserved quantization declaration")
    width, height = scale["width"], scale["height"]
    plot = scale["plot"]
    step = Fraction(int(scale["xSpacingExact"]["numerator"]), int(scale["xSpacingExact"]["denominator"]))
    per_pixel = Fraction(int(scale["pricePerPixelExact"]["numerator"]), int(scale["pricePerPixelExact"]["denominator"]))
    pmax = number(scale["priceMax"])
    saved = calibration["candles"]
    require(len(saved) == len(bars), "Calibration candle count mismatch")
    residuals = []
    for bar, candle in zip(bars, saved):
        index = bar["barIndex"]
        require(candle["barIndex"] == index and candle["timestamp"] == bar["timestamp"], "Calibration candle identity mismatch")
        x = number(plot["left"]) + (Fraction(index) + Fraction(1, 2)) * step
        points, percent_points = {}, {}
        for key in OHLC:
            price = number(bar["ohlcv"][key])
            y = number(plot["top"]) + (pmax - price) / per_pixel
            point = {"x": float(x), "y": float(y), "price": decimal(price)}
            require(number(candle["points"][key]["price"]) == price, "Calibration OHLC price mismatch")
            residuals.extend([abs(float(x) - candle["points"][key]["x"]), abs(float(y) - candle["points"][key]["y"])])
            points[key] = point
            percent_points[key] = {"x": float(x / width * 100), "y": float(y / height * 100), "price": decimal(price)}
        bar["points"], bar["percentPoints"] = points, percent_points
    tick_residuals = []
    require(len(calibration["ticks"]) == 7, "Expected original seven axis ticks")
    for tick in calibration["ticks"]:
        y = number(plot["top"]) + (pmax - number(tick["price"])) / per_pixel
        tick_residuals.append(abs(float(y) - tick["y"]))
    require(max(residuals + tick_residuals) <= 1e-9, "Saved calibration differs from independent source coordinate projection")
    return {"ohlcPointCount": len(bars) * 4, "tickCount": len(tick_residuals), "maxSavedCandleCoordinateDifferencePx": max(residuals), "maxSavedTickProjectionDifferencePx": max(tick_residuals)}


def raster_witnesses(image, bars, scale):
    """Observe the existing PNG's candle components, never render replacements."""
    plot = scale["plot"]
    left, right, top, bottom = (int(plot[key]) for key in ("left", "right", "top", "bottom"))
    require(all(number(plot[key]).denominator == 1 for key in plot), "Expected original integer plot rectangle")
    pixels = image.convert("RGB").load()
    counts = Counter(pixels[x, y] for y in range(top, bottom + 1) for x in range(left, right + 1))
    # These rasters use exactly two flat saturated candle colors. Infer them from
    # the image itself; no renderer palette or direction label is imported.
    palette = [color for color, count in counts.items() if max(color) - min(color) > 45 and count >= 100]
    require(len(palette) == 2, "Unrecognized saturated raster components")
    palette_set = set(palette)
    step = Fraction(right - left, len(bars))
    maxima = {"centerX": 0.0, "highY": 0.0, "lowY": 0.0, "bodyBoundaryY": 0.0}
    expanded = []
    for bar in bars:
        index = bar["barIndex"]
        x0 = math.ceil(Fraction(left) + index * step)
        x1 = math.ceil(Fraction(left) + (index + 1) * step)
        cells, rows = [], Counter()
        for y in range(top, bottom + 1):
            for x in range(x0, x1):
                if pixels[x, y] in palette_set:
                    cells.append((x, y))
                    rows[y] += 1
        require(cells, "Missing raster candle component")
        xs, ys = zip(*cells)
        body_rows = [y for y, count in rows.items() if count > 3]
        require(body_rows, "Missing raster candle body")
        observed = {"centerX": (min(xs) + max(xs)) / 2, "highY": min(ys), "lowY": max(ys), "bodyTopY": min(body_rows), "bodyBottomY": max(body_rows)}
        points = bar["points"]
        expected_body = sorted([points["open"]["y"], points["close"]["y"]])
        residual = {
            "centerX": abs(observed["centerX"] - points["high"]["x"]),
            "highY": abs(observed["highY"] - points["high"]["y"]),
            "lowY": abs(observed["lowY"] - points["low"]["y"]),
            "bodyBoundaryY": max(abs(observed["bodyTopY"] - expected_body[0]), abs(observed["bodyBottomY"] - expected_body[1])),
        }
        require(max(residual[key] for key in ("centerX", "highY", "lowY")) <= 0.5 + 1e-9, "Raster wick differs from source geometry beyond preserved 0.5px declaration")
        # Retain, rather than hide, actual body expansion. This is a measured
        # geometry fact, not a widened acceptance tolerance.
        if residual["bodyBoundaryY"] > 0.5 + 1e-9:
            expanded.append(index)
        for key, value in residual.items():
            maxima[key] = max(maxima[key], value)
        bar["rasterWitness"] = {"observed": observed, "absoluteResidualPx": residual, "bodyExceedsDeclaredHalfPixel": index in expanded}
    return {
        "method": "Independent saturated-color connected-in-bar-cell extents from original PNG; no image generation",
        "observedCandleCount": len(bars), "declaredQuantizationPx": 0.5,
        "maxAbsoluteResidualPx": maxima, "bodyExpansionBarIndices": expanded,
        "bodyBoundaryErrorIsNotAUniformQuantizationBound": bool(expanded),
    }


def assessability(case_id):
    shared = {
        "level": {"status": "OBJECTIVE_ONLY", "reasonCode": "PRICE_AND_SOURCE_WITNESS_ONLY", "reason": "Price/coordinate consistency and source OHLC witnesses are measurable; support/resistance materiality and semantic correctness are unscored."},
        "liquidity_pool": {"status": "OBJECTIVE_ONLY", "reasonCode": "PRICE_WITNESSES_NOT_ORDERS", "reason": "Source price witnesses and geometry are measurable; pool qualification and actual resting/hidden orders are unscored."},
        "liquidity_event": {"status": "OBJECTIVE_ONLY", "reasonCode": "BAR_ORDER_NOT_EVENT_ACCEPTANCE", "reason": "Visible source-bar order and price/coordinate consistency are measurable; event label, side and intraminute price order are unscored."},
    }
    shared["pattern"] = {
        "status": "UNSCORED" if case_id == "d003" else "OBJECTIVE_ONLY",
        "reasonCode": "UNSCORED_WEAK_4H" if case_id == "d003" else "GEOMETRY_ONLY_NO_PATTERN_LABEL_ACCEPTANCE",
        "reason": "Existing weak 4h pattern remains unscored; numerical OHLC oracle is available for separate price/calibration diagnostics." if case_id == "d003" else "Anchor price/coordinate consistency and source witnesses are measurable; pattern name, status and qualifying-rule interpretation are unscored.",
    }
    return {key: shared[key] for key in ("pattern", "level", "liquidity_pool", "liquidity_event")}


def build_reference(packet):
    packet = packet.resolve(strict=True)
    manifest_bytes = checked_read(packet, SUBSET_FILE, SUBSET_SHA256)
    manifest = strict_json(manifest_bytes)
    cases = manifest["cases"]
    validate_scope(cases)
    archives = {}
    for symbol in dict.fromkeys(case["symbol"] for case in cases):
        selected_cases = [case for case in cases if case["symbol"] == symbol]
        first = selected_cases[0]
        data = checked_read(packet, first["sourcePath"], SOURCE_SPECS[symbol][1])
        windows = [(timestamp(case["firstBar"]), timestamp(case["sourceCutoff"])) for case in selected_cases]
        archives[symbol] = minute_observations(data, symbol, windows)
    output_cases = []
    for case in cases:
        raw = {key: checked_read(packet, case[path_key], case[hash_key]) for key, path_key, hash_key in (
            ("bars", "barsPath", "barsSha256"), ("calibration", "calibrationPath", "calibrationSha256"),
            ("image", "imagePath", "rasterSha256"), ("input", "inputPath", "inputSha256"),
        )}
        saved_bars, calibration, input_record = (strict_json(raw[key]) for key in ("bars", "calibration", "input"))
        require(set(input_record) == {"image", "intention", "chartConfirmation"} and input_record["intention"] == "UNSURE", "Only preserved neutral no-crop input supported")
        expected_url = "data:image/png;base64," + base64.b64encode(raw["image"]).decode()
        require(input_record["image"] == expected_url, "Input image differs from original raster")
        image = Image.open(io.BytesIO(raw["image"]))
        image.load()
        require(image.size == (case["width"], case["height"]), "Raster dimensions differ from case")
        require(case["cropMapping"] == {"kind": "identity", "originalSize": [image.width, image.height], "precisionRect": None}, "Unexpected crop mapping")
        require(calibration["cropMapping"] == case["cropMapping"], "Calibration crop mapping mismatch")
        source, source_info = archives[case["symbol"]]
        bars, aggregation = aggregate_case(case, saved_bars, source)
        facts = input_record["chartConfirmation"]
        require(facts["timeframe"] == case["timeframe"] and facts["contextMatch"] == "NOT_PROVIDED", "Input timeframe/context mismatch")
        require(number(facts["currentPrice"]) == number(bars[-1]["ohlcv"]["close"]), "Input current price is not the last visible source close")
        scale = scale_for(calibration, bars, image.width, image.height)
        comparison = projected_points(bars, scale, calibration)
        raster = raster_witnesses(image, bars, scale)
        output_cases.append({
            "caseId": case["caseId"], "instrument": case["instrument"], "inputInstrument": facts["instrument"],
            "timeframe": case["timeframe"], "timeframeMinutes": case["timeframeMinutes"],
            "identities": {
                "packetManifestSha256": PACKET_MANIFEST_SHA256,
                "subsetManifestSha256": SUBSET_SHA256, "inputSha256": case["inputSha256"],
                "imageSha256": case["rasterSha256"], "sourceZipSha256": case["sourceZipSha256"],
                "sourceMemberSha256": source_info["memberSha256"], "barsSha256": case["barsSha256"],
                "calibrationSha256": case["calibrationSha256"],
            },
            "objective": {
                "sourceMember": source_info["member"], "sourceTimezone": source_info["timezone"],
                "aggregation": aggregation, "priceScale": scale, "calibrationComparison": comparison,
                "rasterComparison": raster, "candles": bars,
                "crops": [{"role": "input_image", "kind": "identity", "imageSha256": case["rasterSha256"], "originalSize": [image.width, image.height], "cropSize": [image.width, image.height], "rect": {"left": 0, "top": 0, "right": image.width, "bottom": image.height}, "xOffset": 0, "yOffset": 0, "xScale": 1, "yScale": 1}],
                "precisionCropPresent": False,
            },
            "perToolAssessability": assessability(case["caseId"]),
            "interpretation": {"status": "UNSCORED_PROVISIONAL", "semanticLabelsAccepted": False, "reason": "Source facts do not validate any stored proposal. No proposal or human-review file was read."},
        })
    return {
        "schemaVersion": 1, "kind": "MONACO_INTERNAL_SOURCE_REFERENCE", "scope": "FIRST_SIX_INTERNAL_DEVELOPMENT_DIAGNOSTICS",
        "caseIds": list(CASE_IDS), "sourceCalculatorSha256": sha(Path(__file__).read_bytes()),
        "packetManifestSha256": PACKET_MANIFEST_SHA256,
        "packetManifestHashEvidence": "Previously frozen packet identity; full manifest not re-opened in this first-six-only calculation",
        "subsetManifestSha256": SUBSET_SHA256, "cases": output_cases,
        "humanReferenceRequiredForThisArtifact": False, "expertAcceptanceStatus": "UNRESOLVED_SEPARATE_TRACK",
        "acceptedSemanticLabels": 0, "genuineScannerMeasurements": 0, "providerCalls": 0,
        "limitations": LIMITATIONS,
    }


def public_receipt(reference, private_sha):
    return {
        "schemaVersion": 1, "kind": "MONACO_INTERNAL_SOURCE_REFERENCE_PUBLIC_RECEIPT",
        "status": "OBJECTIVE_SOURCE_CHECKS_PASS_NOT_SCANNER_ACCEPTANCE",
        "sourceCalculatorSha256": reference["sourceCalculatorSha256"],
        "sourceReferenceSha256": private_sha, "packetManifestSha256": PACKET_MANIFEST_SHA256,
        "subsetManifestSha256": SUBSET_SHA256,
        "caseCount": 6, "heldoutCasesRead": 0,
        "sourceZipCount": len({case["identities"]["sourceZipSha256"] for case in reference["cases"]}),
        "barCount": sum(len(case["objective"]["candles"]) for case in reference["cases"]),
        "ohlcPointCount": sum(case["objective"]["calibrationComparison"]["ohlcPointCount"] for case in reference["cases"]),
        "observedMinuteRows": sum(case["objective"]["aggregation"]["observedMinuteRows"] for case in reference["cases"]),
        "missingMinuteSlots": sum(case["objective"]["aggregation"]["missingMinuteSlots"] for case in reference["cases"]),
        "zeroVolumeRows": sum(case["objective"]["aggregation"]["zeroVolumeRows"] for case in reference["cases"]),
        "cases": [{"caseId": case["caseId"], "hashes": case["identities"], "barCount": len(case["objective"]["candles"]), "observedMinuteRows": case["objective"]["aggregation"]["observedMinuteRows"], "missingMinuteSlots": case["objective"]["aggregation"]["missingMinuteSlots"], "zeroVolumeRows": case["objective"]["aggregation"]["zeroVolumeRows"], "rasterBodyExpansionCount": len(case["objective"]["rasterComparison"]["bodyExpansionBarIndices"])} for case in reference["cases"]],
        "acceptedSemanticLabels": 0, "genuineScannerMeasurements": 0, "providerCalls": 0,
        "limitations": LIMITATIONS,
    }


def save_new(path, data, private):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700 if private else 0o755)
    with path.open("xb") as handle:
        os.chmod(path, 0o600 if private else 0o644)
        handle.write(data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--packet", type=Path, required=True)
    parser.add_argument("--private-output", type=Path, required=True)
    parser.add_argument("--public-receipt", type=Path, required=True)
    args = parser.parse_args()
    repository = Path(__file__).resolve().parents[1]
    packet = args.packet.resolve(strict=True)
    private_path, public_path = args.private_output.resolve(), args.public_receipt.resolve()
    require(not private_path.is_relative_to(repository), "Private source reference must remain outside repository")
    require(not private_path.is_relative_to(packet) and not public_path.is_relative_to(packet), "Preserved packet is read-only")
    require(private_path != public_path and not private_path.exists() and not public_path.exists(), "Use distinct new output files; never overwrite evidence")
    reference = build_reference(packet)
    data = encode(reference)
    receipt = public_receipt(reference, sha(data))
    # All source and geometry checks finish before any output directory/file write.
    save_new(private_path, data, True)
    save_new(public_path, encode(receipt), False)
    print(json.dumps({"status": receipt["status"], "privateOutput": str(private_path), "sourceReferenceSha256": sha(data), "publicReceipt": str(public_path), "publicReceiptSha256": sha(encode(receipt)), "caseCount": 6, "barCount": receipt["barCount"], "observedMinuteRows": receipt["observedMinuteRows"], "providerCalls": 0}, indent=2))


if __name__ == "__main__":
    main()
