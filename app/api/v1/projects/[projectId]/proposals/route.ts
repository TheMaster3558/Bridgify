import { z } from "zod";
import { api,checked,idempotency } from "@/lib/api";
import { readJson } from "@/lib/body";
import { proposalTermsSchema } from "@/lib/proposals/schema";
import { queryList,listInput } from "@/lib/dashboard/list-query";
export async function GET(request:Request,context:{params:Promise<{projectId:string}>}){return api(request,async client=>queryList(client,"proposals",listInput({...Object.fromEntries(new URL(request.url).searchParams),project:z.uuid().parse((await context.params).projectId)})));}
export async function POST(request:Request,context:{params:Promise<{projectId:string}>}){return api(request,async client=>checked(await client.rpc("owner_proposal_command",{p_project:z.uuid().parse((await context.params).projectId),p_proposal:null,p_revision:null,p_expected:null,p_action:"create",p_terms:proposalTermsSchema.parse(await readJson(request)),p_key:idempotency(request)})));}
