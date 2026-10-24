import subprocess,os
from pathlib import Path
out=Path('/workspace/scratch/35c5363ca2aa/build-auth-evidence')
with (out/'BUILD.txt').open('w') as f:
 r=subprocess.run(['node','node_modules/next/dist/bin/next','build','--webpack'],env={'PATH':os.environ['PATH'],'NODE_OPTIONS':'--require='+str(out/'no-network.cjs'),'NEXT_FONT_GOOGLE_MOCKED_RESPONSES':str(Path.cwd()/'scripts/offline-geist-fonts.cjs'),'NEXT_TELEMETRY_DISABLED':'1','NEXT_PUBLIC_SUPABASE_URL':'http://127.0.0.1:43211','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY':'sb_publishable_offline_fixture','POCKET_FIRST_FREE_ENABLED':'false','POCKET_BENCHMARK_PILOT_ENABLED':'false','POCKET_REAL_BENCHMARK_DISPATCH':'false','POCKET_BENCHMARK_RUNTIME_METADATA_ENABLED':'false'},stdout=f,stderr=subprocess.STDOUT)
 print('BUILD_EXIT',r.returncode)
 raise SystemExit(r.returncode)
