import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server";
import { MemberShell } from "../components/MemberShell";
import { IdeaForm } from "./IdeaForm";
import { statusLabel } from "./lib";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Member Ideas",description:"Help shape the NASH AI Markets member experience.",robots:{index:false,follow:false}};
type Idea={id:string;title:string;description:string;category:string;status:string;is_shortlisted:boolean;author_name:string;founding_number:number|null;created_at:string};
export default async function IdeasPage({searchParams}:{searchParams:Promise<{status?:string;category?:string;sort?:string}>}) {
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect("/login");
  const filters=await searchParams;
  const [{data:ideas,error},{data:votes},{data:comments}]=await Promise.all([
    supabase.from("member_ideas").select("id,title,description,category,status,is_shortlisted,author_name,founding_number,created_at").order("created_at",{ascending:false}),
    supabase.from("member_idea_votes").select("idea_id"),
    supabase.from("member_idea_comments").select("idea_id"),
  ]);
  if(error) return <MemberShell active="ideas"><div className="ideasPage"><section className="ideasUnavailable" role="status"><Image src="/brand/logo-mark.svg" width={64} height={64} alt="" /><span>MEMBER IDEAS</span><h1>The Ideas Hub is being prepared.</h1><p>It will be available shortly. Your dashboard and membership access are unaffected.</p><Link href="/dashboard">Return to dashboard</Link></section></div></MemberShell>;
  const counts=(votes||[]).reduce<Record<string,number>>((a,v)=>(a[v.idea_id]=(a[v.idea_id]||0)+1,a),{});
  const commentCounts=(comments||[]).reduce<Record<string,number>>((a,v)=>(a[v.idea_id]=(a[v.idea_id]||0)+1,a),{});
  let rows=(ideas||[]) as Idea[];
  if(filters.status)rows=rows.filter(x=>x.status===filters.status); if(filters.category)rows=rows.filter(x=>x.category===filters.category);
  if(filters.sort==="votes")rows.sort((a,b)=>(counts[b.id]||0)-(counts[a.id]||0));
  const shortlisted=rows.filter(x=>x.is_shortlisted);
  return <MemberShell active="ideas"><div className="ideasPage">
    <header className="ideasHero"><div><span>MEMBER PRODUCT COUNCIL</span><h1>Help shape what NASH builds next.</h1><p>Suggest improvements, discuss member ideas and vote for the features that would make your trading workflow better.</p></div><Image src="/brand/badge-founding-100.svg" width={270} height={56} alt="Founding 100 member programme" /></header>
    {shortlisted.length?<section className="monthlyShortlist"><header><div><span>MONTHLY FEATURE VOTE</span><h2>Member shortlist</h2></div><p>Choose one shortlisted improvement for this calendar month.</p></header><div>{shortlisted.map(i=><IdeaCard key={i.id} idea={i} votes={counts[i.id]||0} comments={commentCounts[i.id]||0}/>)}</div></section>:null}
    <div className="ideasLayout"><IdeaForm/><section className="ideasBrowse" aria-labelledby="ideas-title"><header><div><span>COMMUNITY ROADMAP</span><h2 id="ideas-title">Member ideas</h2></div><form className="ideaFilters"><label>Status<select name="status" defaultValue={filters.status||""}><option value="">All statuses</option><option value="under_review">Under review</option><option value="planned">Planned</option><option value="in_development">In development</option><option value="released">Released</option><option value="declined">Declined</option></select></label><label>Sort<select name="sort" defaultValue={filters.sort||"newest"}><option value="newest">Newest</option><option value="votes">Most voted</option></select></label><button>Apply</button></form></header>
    <div className="ideaList">{rows.length?rows.map(i=><IdeaCard key={i.id} idea={i} votes={counts[i.id]||0} comments={commentCounts[i.id]||0}/>):<div className="ideasEmpty"><strong>No ideas match this view.</strong><p>Adjust the filters or submit the first idea in this category.</p></div>}</div></section></div>
  </div></MemberShell>;
}
function IdeaCard({idea,votes,comments}:{idea:Idea;votes:number;comments:number}){return <article className="ideaCard"><div className="ideaVoteCount"><strong>{votes}</strong><span>votes</span></div><div><header><span>{idea.category}</span><b data-status={idea.status}>{statusLabel(idea.status)}</b></header><h3><Link href={`/ideas/${idea.id}`}>{idea.title}</Link></h3><p>{idea.description}</p><footer><span>By {idea.author_name}{idea.founding_number?` · Founding Member #${idea.founding_number}`:""}</span><span>{comments} comments</span></footer></div></article>}
