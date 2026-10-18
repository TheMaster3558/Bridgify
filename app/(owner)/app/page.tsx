import Link from "next/link";
import { RecentProjects } from "@/components/projects/recent-projects";
import { requireOwner } from "@/lib/auth/session";
import { workSummary } from "@/lib/dashboard/summary";
import { checked } from "@/lib/api";
export default async function Page() {
 const {client}=await requireOwner();const s=await workSummary(client);
 const issues=checked(await client.from("projects").select("id,name,status").in("status",["paused"]).order("updated_at",{ascending:false}).limit(5))??[];
 const cards=[{label:"Actionable tasks",value:s.ready+s.inProgress+s.blocked,href:"/app/tasks"},{label:"Needs your decision",value:s.decisions,href:"/app/decisions"},{label:"Awaiting client response",value:s.proposals,href:"/app/proposals?status=awaiting_client"},{label:"Delivery / processing issues",value:s.unknown+s.failed,href:"/app/decisions"}];
 return <main className="mx-auto grid max-w-5xl gap-8 p-6 md:p-10"><h1 className="font-display text-3xl font-semibold">Your workspace</h1><section className="grid gap-4 sm:grid-cols-2">{cards.map(c=><Link className="rounded-xl border bg-card p-5" href={c.href} key={c.label}><h2>{c.label}</h2><p className="text-3xl font-semibold">{c.value}</p></Link>)}</section><p>{s.ready} ready · {s.inProgress} in progress · {s.blocked} blocked · {s.queued} replies queued</p>{issues.length>0&&<section><h2 className="font-semibold">Paused projects</h2><ul>{issues.map(p=><li key={p.id}><Link className="underline" href={`/app/projects/${p.id}/automation`}>{p.name}</Link></li>)}</ul></section>}<RecentProjects/></main>;
}
