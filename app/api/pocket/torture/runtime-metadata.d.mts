export type RuntimeBindingEvidence = {
 schemaVersion:number; projectId:string; backendProjectRef:string; candidateSha:string; model:string;
 organisationId:string; keyTrackingId:string; keyFingerprintSha256:string; keyTrackingVerification:string;
 requiredServiceTier:string; verifiedAt:string; verificationScope:string; financiallySettled:false;
 providerMetadataRequestId?:string;
};
export function checkRuntimeEnvironment(env:Record<string,string|undefined>):Record<string,string>;
export function validateRuntimeMetadata(env:Record<string,string|undefined>,project:unknown,keys:unknown,model:unknown,now?:number):RuntimeBindingEvidence;
export function verifyPocketBenchmarkRuntime():Promise<RuntimeBindingEvidence>;
