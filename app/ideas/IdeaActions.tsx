"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
export function IdeaActions({ id, voted, monthlyVoted, shortlisted }: { id:string; voted:boolean; monthlyVoted:boolean; shortlisted:boolean }) {
  const router = useRouter(); const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
  async function act(action:string, body?:string) {
    setBusy(true); setMessage("");
    const response=await fetch(`/api/ideas/${id}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,body})});
    const result=await response.json().catch(()=>({message:"Action unavailable."}));
    setBusy(false); if(!response.ok){setMessage(result.message);return;} router.refresh();
  }
  return <div className="ideaActions">
    <button disabled={busy} onClick={()=>act(voted?"unvote":"vote")} aria-pressed={voted}>{voted?"Remove vote":"Vote for this idea"}</button>
    {shortlisted ? <button className="goldAction" disabled={busy} onClick={()=>act(monthlyVoted?"monthly-unvote":"monthly-vote")} aria-pressed={monthlyVoted}>{monthlyVoted?"Remove monthly vote":"Choose for this month"}</button>:null}
    <form action={(data)=>act("comment",String(data.get("comment")||""))}><label htmlFor="idea-comment">Add to the discussion</label><textarea id="idea-comment" name="comment" minLength={2} maxLength={1000} required rows={4}/><button disabled={busy}>Post comment</button></form>
    <p role="status">{message}</p>
  </div>;
}
