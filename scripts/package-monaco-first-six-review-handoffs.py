#!/usr/bin/env python3
"""Package only the pinned first-six blank human-review handoffs; never dispatch."""

import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import stat
import struct
import zipfile
import zlib


ROLES = ("primary", "independent")
SOURCE_PINS = {
    "private-coordinator/MAP.json": "bb671fb0bfb5fb78021d26d7a91512d7ded9a42613b4da8492bc93dd0bd7d7cc",
    "primary/WORKSHEETS.json": "1fb98cd44ab35d5945fed09af2be72886d3b99665820feff710c9d2e2a4c92cc",
    "independent/WORKSHEETS.json": "d3f90385bbddc66c461a15e17a3696f37c74914e7a71d39f4776ca2dcb4a3f39",
}
TOOLS = ("pattern_watch", "support_resistance", "liquidity_pools", "liquidity_events")
ROW_KEYS = {
    "reviewId", "image", "imageSha256", "instrument", "timeframe", "readable",
    "reviewerName", "qualifications", "reviewedAt", "independenceAttestation",
    "tools", "notes",
}
NULL_KEYS = (
    "readable", "reviewerName", "qualifications", "reviewedAt",
    "independenceAttestation", "notes",
)
INSTRUCTIONS = """MONACO — PRIVATE HUMAN CHART REVIEW
Role: {role}

This packet contains six blank worksheet rows and their original chart images.
It collects reference judgments. No label, reviewer qualification, independence
claim or scanner acceptance has been approved by this packaging operation.

1. Qualifications and independence
The coordinator must assign a human with relevant technical-chart annotation
experience. Record your name, relevant experience with these markets/timeframes,
any limits to your expertise, and the review date/time with timezone in every row.
Work alone before any adjudication. Do not consult another reviewer's judgments,
selection proposals, scanner/model answers, an AI annotation service, or later
market prices. Do not send this packet to another service or person without the
coordinator's authorization. If you helped select/prepare these cases or have seen
their proposed answers, disclose that exposure; do not attest blind independence.
The independent role must be a different qualified person from the primary role.
Record the actual circumstances in independenceAttestation; do not copy a claim
that is untrue. Return only to the coordinator; reviewers should not exchange work.

2. Inspect only the supplied image
Check that each filename and image hash match INVENTORY.json. Open at its original
pixel size and judge only the visible candles and axes. Never infer a continuation
beyond the right edge or reconstruct missing prices from external data. The
inventory gives the original dimensions. Keep reviewId, image, imageSha256,
instrument and timeframe unchanged. Fill the existing review fields and tools;
retain the six rows in their supplied order. Keep a copy of your completed file.

3. Judge each tool separately
For each tool, use PRESENT, ABSENT, UNREADABLE or UNCERTAIN in state. PRESENT means
a qualifying visible feature can be justified. ABSENT requires a readable chart
reviewed under the agreed target definition with no qualifying feature. UNREADABLE
means the required visual evidence or price scale cannot be read. UNCERTAIN means
the visible evidence or the applicable definition is ambiguous. Neither of these
last two states is a negative. A blank field means unreviewed, never ABSENT.

pattern_watch: identify any justified named structure and its status. Distinguish
a forming structure from a confirmed one: confirmation needs the required event
to be visible already. Record the specific visible confirmation or invalidation
evidence. A plausible shape or a predicted future move does not prove confirmation.
support_resistance: identify justified visible levels or intervals and reaction
witnesses independently of whether a named pattern is present.
liquidity_pools: identify justified repeated highs/lows or other permitted visible
price references. These are price-based hypotheses, not proof of resting orders,
stops, order-book depth, hidden liquidity or institutional activity.
liquidity_events: require the relevant price reference plus a later visible event;
record the observed side and sequence. A pool alone does not establish an event.

No qualifying pattern does not mean no support/resistance, no pool or no event.
Annotate all four tools independently. Record the review rubric/version used in
notes. If a definition, witness rule, scope or threshold is not provided or cannot
be applied confidently, disclose that and use UNCERTAIN for the affected judgment.
Do not create a favorable negative by ignoring another visible feature.

4. Evidence and uncertainty
For each feature in the existing features array, describe its name/type, status,
side, visible witnesses, ordered anchor coordinates, prices or price intervals,
and uncertainty. Coordinates refer to the full original image: x increases right,
y increases down, with origin at the top-left. Include visible bar times if readable.
Do not report invented precision: use an interval or explain an unreadable value.
Record alternative interpretations, missing evidence, and any uncertainty in the
tool's uncertainty field and notes. Set readable to your actual overall judgment,
while preserving tool-specific unreadability or uncertainty where applicable.

5. Return and confidentiality
Return your completed WORKSHEETS.json to the coordinator with any separately
authorized annotation files. Do not alter the supplied images or identifiers.
Keep the packet and judgments private. It is not a redistribution or upload grant.
The coordinator must resolve disagreements and freeze references before scanner
output is exposed. Automated packaging and AI advice do not count as human review,
independent reference acceptance, or permission for a paid analysis. These review
states do not amend the existing six-case acceptance/scoring contract.
"""


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encode(value):
    return (json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n").encode()


def unique_object(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError("duplicate JSON key")
        value[key] = item
    return value


def fail_constant(value):
    raise ValueError("nonfinite JSON constant: " + value)


DECODER = json.JSONDecoder(object_pairs_hook=unique_object, parse_constant=fail_constant)


def read_regular(path):
    if path.is_symlink() or not path.is_file():
        raise ValueError("expected regular source file: " + str(path))
    return path.read_bytes()


def raw_rows(data):
    """Return decoded rows and their exact original UTF-8 object bytes."""
    text = data.decode("utf-8")
    pos = 0

    def skip(index):
        while index < len(text) and text[index] in " \t\r\n":
            index += 1
        return index

    pos = skip(pos)
    if pos >= len(text) or text[pos] != "[":
        raise ValueError("worksheet must be a JSON array")
    pos = skip(pos + 1)
    rows = []
    if pos < len(text) and text[pos] == "]":
        pos += 1
    else:
        while True:
            start = pos
            row, pos = DECODER.raw_decode(text, pos)
            if not isinstance(row, dict):
                raise ValueError("worksheet row must be an object")
            rows.append((row, text[start:pos].encode("utf-8")))
            pos = skip(pos)
            if pos >= len(text):
                raise ValueError("unterminated worksheet array")
            if text[pos] == "]":
                pos += 1
                break
            if text[pos] != ",":
                raise ValueError("invalid worksheet row separator")
            pos = skip(pos + 1)
    if skip(pos) != len(text):
        raise ValueError("trailing worksheet content")
    return rows


def validate_blank_row(row):
    if set(row) != ROW_KEYS or any(row[key] is not None for key in NULL_KEYS):
        raise ValueError("unexpected or prefilled reviewer fields")
    alias = row["reviewId"]
    if not isinstance(alias, str) or not re.fullmatch(r"review-\d{3}", alias):
        raise ValueError("unsafe reviewer alias")
    if row["image"] != alias + ".png":
        raise ValueError("image basename does not match alias")
    if not re.fullmatch(r"[a-f0-9]{64}", row["imageSha256"]):
        raise ValueError("invalid image hash")
    if not isinstance(row["instrument"], str) or not row["instrument"]:
        raise ValueError("missing neutral instrument")
    if row["timeframe"] not in ("5m", "15m", "30m", "1h", "4h"):
        raise ValueError("unexpected timeframe")
    if not isinstance(row["tools"], dict) or set(row["tools"]) != set(TOOLS):
        raise ValueError("unexpected tool coverage")
    if any(row["tools"][tool] != {"state": None, "features": [], "uncertainty": None}
           for tool in TOOLS):
        raise ValueError("prefilled or unexpected tool fields")


def png_dimensions(data):
    """Check raster structure/CRCs and exclude embedded text or other metadata."""
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("invalid PNG signature")
    offset = 8
    kinds = []
    size = None
    while offset < len(data):
        if offset + 12 > len(data):
            raise ValueError("truncated PNG chunk")
        length = struct.unpack(">I", data[offset:offset + 4])[0]
        end = offset + 12 + length
        if end > len(data):
            raise ValueError("truncated PNG data")
        kind = data[offset + 4:offset + 8]
        body = data[offset + 8:offset + 8 + length]
        crc = struct.unpack(">I", data[offset + 8 + length:end])[0]
        if zlib.crc32(kind + body) & 0xFFFFFFFF != crc:
            raise ValueError("PNG CRC mismatch")
        if kind not in (b"IHDR", b"IDAT", b"IEND"):
            raise ValueError("unexpected PNG metadata chunk")
        kinds.append(kind)
        if kind == b"IHDR":
            if len(kinds) != 1 or length != 13:
                raise ValueError("invalid PNG header")
            size = struct.unpack(">II", body[:8])
        offset = end
        if kind == b"IEND":
            if length or offset != len(data):
                raise ValueError("PNG trailing data")
            break
    if not size or min(size) <= 0 or kinds[:1] != [b"IHDR"] or kinds[-1:] != [b"IEND"] or b"IDAT" not in kinds:
        raise ValueError("incomplete PNG raster")
    return size


def prepare(reviews_dir):
    sources = {}
    for relative, expected in SOURCE_PINS.items():
        data = read_regular(reviews_dir / relative)
        if sha(data) != expected:
            raise ValueError("pinned source changed: " + relative)
        sources[relative] = data
    mapping = DECODER.decode(sources["private-coordinator/MAP.json"].decode())
    plans = {}
    for role in ROLES:
        priority = mapping["firstSixPriority"][role]
        if len(priority) != 6 or len(set(priority)) != 6:
            raise ValueError("expected six distinct first-priority aliases")
        rows = raw_rows(sources[role + "/WORKSHEETS.json"])
        indexed = {row["reviewId"]: (row, raw) for row, raw in rows}
        if len(indexed) != len(rows):
            raise ValueError("duplicate reviewer alias")
        selected = [indexed[alias] for alias in priority]
        members = {}
        inventory_rows = []
        for row, raw in selected:
            validate_blank_row(row)
            data = read_regular(reviews_dir / role / row["image"])
            if sha(data) != row["imageSha256"]:
                raise ValueError("review image hash mismatch")
            width, height = png_dimensions(data)
            members[row["image"]] = data
            inventory_rows.append({
                "reviewId": row["reviewId"], "image": row["image"],
                "imageSha256": sha(data), "width": width, "height": height,
                "worksheetRowSha256": sha(raw),
            })
        # Only inter-row separators are new. Each original object span is untouched.
        members["WORKSHEETS.json"] = b"[\n  " + b",\n  ".join(raw for _, raw in selected) + b"\n]\n"
        members["INSTRUCTIONS.txt"] = INSTRUCTIONS.format(role=role).encode("utf-8")
        members["INVENTORY.json"] = encode({
            "schemaVersion": 1, "role": role, "caseCount": 6,
            "status": "BLANK_HUMAN_REVIEW_HANDOFF_NOT_ACCEPTANCE",
            "worksheetSha256": sha(members["WORKSHEETS.json"]),
            "instructionsSha256": sha(members["INSTRUCTIONS.txt"]),
            "images": inventory_rows,
        })
        plans[role] = {"members": members, "inventory": inventory_rows}
    image_sets = [{row["imageSha256"] for row in plans[role]["inventory"]} for role in ROLES]
    if len(image_sets[0]) != 6 or image_sets[0] != image_sets[1]:
        raise ValueError("review roles must cover the same six distinct image hashes")
    return plans


def archive_bytes(members):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(members.items()):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = (stat.S_IFREG | 0o600) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data, compresslevel=9)
    return buffer.getvalue()


def verify_archive(data, members):
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        entries = archive.infolist()
        if archive.comment or len(entries) != 9 or len({item.filename for item in entries}) != 9:
            raise ValueError("unexpected ZIP entry count, duplicate or archive comment")
        if {item.filename for item in entries} != set(members):
            raise ValueError("archive member allowlist mismatch")
        for item in entries:
            if item.extra or item.comment or item.flag_bits & 1 or stat.S_IFMT(item.external_attr >> 16) != stat.S_IFREG:
                raise ValueError("unexpected ZIP metadata or nonregular member")
            if item.file_size != len(members[item.filename]):
                raise ValueError("archive member size mismatch")
            if archive.read(item) != members[item.filename]:
                raise ValueError("archive member differs from exact source-derived content")
        worksheet = archive.read("WORKSHEETS.json")
        selected = raw_rows(worksheet)
        if len(selected) != 6:
            raise ValueError("expected six packaged rows")
        for row, raw in selected:
            validate_blank_row(row)
            image = archive.read(row["image"])
            if sha(image) != row["imageSha256"]:
                raise ValueError("packaged image hash mismatch")
            png_dimensions(image)
    return True


def run_tamper_probes(plans):
    expected = plans["primary"]["members"]
    mutations = []
    extra = dict(expected)
    extra["UNEXPECTED.txt"] = b"Unpermitted additional material.\n"
    mutations.append(("extra_member_rejected", archive_bytes(extra)))
    filled = dict(expected)
    filled["WORKSHEETS.json"] = filled["WORKSHEETS.json"].replace(b'"state": null', b'"state": "PRESENT"', 1)
    mutations.append(("prefilled_annotation_rejected", archive_bytes(filled)))
    changed = dict(expected)
    image_name = plans["primary"]["inventory"][0]["image"]
    image = bytearray(changed[image_name])
    image[-20] ^= 1
    changed[image_name] = bytes(image)
    mutations.append(("changed_image_rejected", archive_bytes(changed)))
    mutations.append(("other_role_archive_rejected", archive_bytes(plans["independent"]["members"])))
    results = []
    for name, data in mutations:
        try:
            verify_archive(data, expected)
        except (ValueError, zipfile.BadZipFile) as exc:
            results.append({"name": name, "status": "PASS", "rejection": str(exc)})
        else:
            raise ValueError("tamper probe unexpectedly passed: " + name)
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reviews-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--verify-only", action="store_true")
    parser.add_argument("--tamper-probes", action="store_true")
    args = parser.parse_args()
    plans = prepare(args.reviews_dir)
    prepared = {role: archive_bytes(plans[role]["members"]) for role in ROLES}
    for role in ROLES:
        verify_archive(prepared[role], plans[role]["members"])
    probes = run_tamper_probes(plans) if args.tamper_probes else []
    if not args.verify_only:
        if args.output_dir.exists():
            raise ValueError("output directory already exists; use a new directory or --verify-only")
        args.output_dir.mkdir(parents=True, mode=0o700)
    receipts = []
    for role in ROLES:
        target = args.output_dir / ("monaco-first-six-" + role + "-review.zip")
        if not args.verify_only:
            with target.open("xb") as handle:
                os.chmod(target, 0o600)
                handle.write(prepared[role])
        data = read_regular(target)
        verify_archive(data, plans[role]["members"])
        if data != prepared[role]:
            raise ValueError("archive metadata differs from deterministic package")
        receipts.append({
            "role": role, "path": str(target.resolve()), "sha256": sha(data),
            "bytes": len(data), "memberCount": 9, "caseCount": 6,
            "cases": plans[role]["inventory"], "verification": "PASS",
        })
    receipt = {
        "schemaVersion": 1, "status": "AUTOMATED_PACKAGING_VERIFIED_NOT_HUMAN_ACCEPTANCE",
        "scriptSha256": sha(Path(__file__).read_bytes()),
        "sourcePins": SOURCE_PINS, "sourceReviewsDirectory": str(args.reviews_dir.resolve()),
        "rowPreservation": "Exact original UTF-8 object spans; array separators alone rebuilt",
        "checks": [
            "Source worksheet and coordinator-map byte hashes match fixed checkpoint",
            "Exactly six first-priority rows in each original role order",
            "Identical six-image hash coverage across separate aliases",
            "Original blank row object bytes preserved exactly",
            "Each image byte-identical to its original and worksheet SHA-256",
            "Only nine allowlisted members; no other role, map, proposal, manifest or source data",
            "PNG chunk CRCs valid; no embedded text/EXIF/other metadata chunks",
            "Archive entries regular files with no comments, extra metadata or encryption",
        ],
        "archives": receipts, "tamperProbes": probes,
        "humanReviewsPerformed": 0, "acceptedCases": 0, "providerCalls": 0,
        "outreachPerformed": False, "uploaded": False, "encrypted": False,
    }
    if not args.verify_only:
        receipt_path = args.output_dir / "PACKAGING-VERIFICATION.private.json"
        with receipt_path.open("xb") as handle:
            os.chmod(receipt_path, 0o600)
            handle.write(encode(receipt))
    print(json.dumps(receipt, indent=2))


if __name__ == "__main__":
    main()
