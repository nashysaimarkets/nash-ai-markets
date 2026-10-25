import {verifyPocketNativeManifest} from './pocket-native-manifest.mjs';
try {
  const result=await verifyPocketNativeManifest(process.env.CAPACITOR_SERVER_URL?.trim()??'',process.env.CAPACITOR_SERVER_REVISION?.trim()??'',{requireReadiness:true});
  console.log(`Verified Pocket web revision ${result.revision.slice(0,12)} at ${result.origin}; archive pin and deployment immutability require separate evidence.`);
  console.log('Runtime dependencies configured. Apple API authentication, existing-owner restoration and signed-device acceptance still require separate live evidence.');
} catch {
  console.error('Capacitor server verification failed: mismatched source or missing native runtime dependencies. Do not upload.');
  process.exitCode=1;
}
