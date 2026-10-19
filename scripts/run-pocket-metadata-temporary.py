#!/usr/bin/env python3
"""Owner-run launcher: hidden terminal input, no secret files, no key in argv."""
import getpass
import os
from pathlib import Path
import shutil
import subprocess
import sys


def main():
    if sys.argv[1:] != ['--metadata-only']:
        print('Use --metadata-only; key creation and paid dispatch are not supported.', file=sys.stderr)
        return 2
    node = shutil.which('node')
    if not node:
        print('Node.js is unavailable in this existing runner.', file=sys.stderr)
        return 1
    verifier = Path(__file__).resolve().with_name('verify-pocket-temporary-key.mjs')
    # Explicit allowlist: do not inherit an old API key, admin key, NODE_OPTIONS,
    # custom API origin or other application configuration into the verifier.
    child_env = {'PATH': os.environ.get('PATH', os.defpath)}
    preflight = subprocess.run([node, str(verifier), '--preflight'], env=child_env, check=False)
    if preflight.returncode:
        return preflight.returncode
    if not sys.stdin.isatty():
        print('Owner-controlled interactive terminal required; no secret input was requested.', file=sys.stderr)
        return 1
    credential = ''
    try:
        credential = getpass.getpass('Temporary metadata key (hidden; never paste into chat): ')
        child_env['OPENAI_METADATA_VERIFICATION_KEY'] = credential
        return subprocess.run([node, str(verifier), '--metadata-only'], env=child_env, check=False).returncode
    except (EOFError, KeyboardInterrupt):
        print('\nCancelled; no credential was saved.', file=sys.stderr)
        return 1
    finally:
        child_env.pop('OPENAI_METADATA_VERIFICATION_KEY', None)
        credential = ''


if __name__ == '__main__':
    raise SystemExit(main())
