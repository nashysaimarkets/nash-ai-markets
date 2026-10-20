# First-six blinded human-review handoff packaging

This offline packaging step extracts the existing first-six priority rows from each role's blank worksheets in the prepared `benchmark50-v2.3` packet. It does not select new charts, propose answers, assign reviewers, send invitations, approve references, or dispatch a scanner request.

The dedicated script is `scripts/package-monaco-first-six-review-handoffs.py`. Its source pins bind the original primary and independent worksheet files and the private coordinator map. The original row object bytes are preserved exactly; only the outer array separators are rebuilt. Each role receives its own six aliases in the coordinator's existing priority order and its matching original PNG files.

Each ZIP has exactly nine files: `WORKSHEETS.json`, six images, `INSTRUCTIONS.txt` and `INVENTORY.json`. Instructions cover human qualifications and independence, separate judgments for the four tools, formation versus confirmation, unreadability and uncertainty versus negatives, full-image coordinates and price evidence, and the limits of price-derived liquidity claims. They do not supply case-specific hints or amend the existing six-case scoring contract.

The inventory contains only the role's aliases, neutral image metadata and integrity hashes. Neither archive contains the coordinator map, dataset categories, proposal answers, the other role's work, scanner output, the full manifest, or raw/future source data. The private verification receipt stays outside both archives because it identifies both role packages.

Example, using local private paths:

```sh
python3 scripts/package-monaco-first-six-review-handoffs.py \
  --reviews-dir /path/to/benchmark50-v2.3/reviews \
  --output-dir /path/to/new-private-handoff-directory \
  --tamper-probes
```

The output directory must not already exist. Both archive plans and optional tamper checks are validated before it is created. The files use restrictive local permissions and deterministic ZIP metadata. The ZIPs are **not encrypted**; the coordinator must choose an authorized private delivery channel and send each reviewer only their assigned role archive. This script performs no upload, notification or outreach.

To check existing archives against the same pinned inputs without rewriting them:

```sh
python3 scripts/package-monaco-first-six-review-handoffs.py \
  --reviews-dir /path/to/benchmark50-v2.3/reviews \
  --output-dir /path/to/existing-private-handoff-directory \
  --verify-only
```

Verification checks the exact member allowlist, original image hashes, original blank row bytes, original alias order, PNG chunk integrity and absence of embedded metadata, plus archive metadata. Optional in-memory negative probes reject an extra file, prefilled annotation, changed image and the other role's archive. These are packaging tests only. Human review, reference acceptance, adjudication and provider measurements remain unperformed.

Reviewers return judgments to the coordinator separately. The coordinator remains responsible for reviewer assignment and qualifications, approved rubric and reference freeze, truthful independence records, any necessary adjudication, and authorized storage/delivery. Keep the handoff archives and receipt out of the public repository.
