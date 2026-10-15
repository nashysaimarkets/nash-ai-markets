import PocketNext from "./PocketNext";
import "./pocket-next.css";
import {createUnavailableMacroContext,getVerifiedMacroContext} from "../lib/verified-macro-context";

export default async function PocketNextPage() {
  const macroContext=await getVerifiedMacroContext({route:"/pocket-next"}).catch(()=>createUnavailableMacroContext());
  return <PocketNext macroContext={macroContext} />;
}
