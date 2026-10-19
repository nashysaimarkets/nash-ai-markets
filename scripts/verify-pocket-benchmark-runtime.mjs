import {verifyPocketBenchmarkRuntime} from '../app/api/pocket/torture/runtime-metadata.mjs';
try {console.log(JSON.stringify(await verifyPocketBenchmarkRuntime()));}
catch(error){console.error(JSON.stringify({status:'BLOCKED',reason:error instanceof Error?error.message:'Metadata verification failed.',providerInferenceRequests:0}));process.exitCode=1;}
