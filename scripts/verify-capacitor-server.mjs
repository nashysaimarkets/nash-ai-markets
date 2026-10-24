import {verifyPocketNativeManifest} from './pocket-native-manifest.mjs';
try {
  const result=await verifyPocketNativeManifest(process.env.CAPACITOR_SERVER_URL?.trim()??'',process.env.CAPACITOR_SERVER_REVISION?.trim()??'');
  console.log(`Verified Pocket web revision ${result.revision.slice(0,12)} at ${result.origin}; archive pin and deployment immutability require separate evidence.`);
} catch {
  console.error('Capacitor server verification failed: invalid/unavailable preview or mismatched build manifest.');
  process.exitCode=1;
}
