import {Capacitor,registerPlugin} from '@capacitor/core';
import {createPlayClient} from './play-billing-client';
export const isGoogleNativeApp=()=>Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='android';
const bridge=registerPlugin<{getBackendIdentity():Promise<{url:string;revision:string}>;getStatus(o:{productId:string}):Promise<{purchaseToken?:unknown}>;restore(o:{productId:string}):Promise<{purchaseToken?:unknown}>}>('PocketPlayBilling');
const productId='pocket_bullseye_monthly';
const client=createPlayClient({identity:()=>bridge.getBackendIdentity(),status:restore=>restore?bridge.restore({productId}):bridge.getStatus({productId}),fetch:(...args)=>fetch(...args),origin:()=>location.origin});
export const playAuthenticatedFetch=(input:string,init:RequestInit={})=>client.request(input,init);
export const restorePlaySubscription=(signal?:AbortSignal)=>client.restore(signal);
