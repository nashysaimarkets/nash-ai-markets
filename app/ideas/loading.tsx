import { BrandLoader } from "../components/BrandLoader"; import { MemberShell } from "../components/MemberShell";
export default function Loading(){return <MemberShell active="ideas"><div className="ideasPage"><BrandLoader label="Loading member ideas"/><div className="ideaList" aria-hidden="true">{[1,2,3].map(i=><div className="ideaCard terminalSkeletonCard" key={i}/>)}</div></div></MemberShell>}
