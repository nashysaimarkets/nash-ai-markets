#!/usr/bin/env python3
"""Protected Actions adapter. No TTY, secret files, inherited Node options or argv key."""
import os
from pathlib import Path
import shutil
import subprocess
import sys


def main():
    if sys.argv[1:] != ['--metadata-only']:
        return 2
    node = shutil.which('node')
    if not node:
        return 1
    verifier = Path(__file__).resolve().with_name('verify-pocket-temporary-key.mjs')
    child_env = {'PATH': os.environ.get('PATH', os.defpath)}
    preflight = subprocess.run([node, str(verifier), '--preflight'], env=child_env, check=False)
    if preflight.returncode:
        return preflight.returncode
    credential = os.environ.pop('MONACO_BENCHMARK_OPENAI_API_KEY', '')
    try:
        child_env['OPENAI_METADATA_VERIFICATION_KEY'] = credential
        return subprocess.run([node, str(verifier), '--metadata-only'], env=child_env, check=False).returncode
    finally:
        child_env.pop('OPENAI_METADATA_VERIFICATION_KEY', None)
        credential = ''


if __name__ == '__main__':
    raise SystemExit(main())
