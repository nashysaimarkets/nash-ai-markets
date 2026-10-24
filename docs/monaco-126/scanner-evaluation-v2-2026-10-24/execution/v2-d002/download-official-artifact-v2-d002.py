import hashlib
import io
import json
import os
import stat
import sys
import urllib.request
import zipfile
from pathlib import Path

config = json.loads(Path(sys.argv[1]).read_text())
artifact = config['artifact']
assert artifact['expired'] is False
assert artifact['workflow_run']['id'] == 40105387615
assert artifact['workflow_run']['head_sha'] == 'b7f2927f2c9438b18a9ce042904259a4acd11323'
assert artifact['name'].startswith(('monaco-input-handoff-40105387615-20783ed5e8eb', 'monaco-encrypted-40105387615-20783ed5e8eb-d002-'))
expected_hash = artifact['digest'].removeprefix('sha256:')
assert len(expected_hash) == 64 and all(c in '0123456789abcdef' for c in expected_hash)
assert config['downloadUrl'].startswith('https://')
with urllib.request.urlopen(config['downloadUrl'], timeout=45) as response:
    archive = response.read(10 * 1024 * 1024 + 1)
assert len(archive) <= 10 * 1024 * 1024
archive_hash = hashlib.sha256(archive).hexdigest()
assert archive_hash == expected_hash, 'Official archive digest mismatch'
with zipfile.ZipFile(io.BytesIO(archive)) as z:
    entries = z.infolist()
    assert len(entries) == 1 and entries[0].filename == config['expectedEntry']
    item = entries[0]
    assert not item.is_dir() and not stat.S_ISLNK(item.external_attr >> 16)
    assert item.file_size <= 10 * 1024 * 1024
    payload = z.read(item)
out = Path(config['outputDirectory'])
out.mkdir(parents=True, exist_ok=True, mode=0o700)
archive_path = out / (str(artifact['id']) + '.zip')
payload_path = out / (str(artifact['id']) + '.' + config['expectedEntry'])
for path, data in [(archive_path, archive), (payload_path, payload)]:
    if path.exists():
        assert path.read_bytes() == data, 'Refusing to replace different retained bytes'
    else:
        with path.open('xb') as file:
            file.write(data)
        os.chmod(path, 0o600)
receipt = {'artifactId':artifact['id'], 'name':artifact['name'], 'archivePath':str(archive_path), 'archiveSha256':archive_hash, 'archiveBytes':len(archive), 'entry':config['expectedEntry'], 'payloadPath':str(payload_path), 'payloadSha256':hashlib.sha256(payload).hexdigest(), 'payloadBytes':len(payload)}
receipt_path = out / (str(artifact['id']) + '.DOWNLOAD-RECEIPT.json')
receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
os.chmod(receipt_path, 0o600)
print(json.dumps(receipt))
