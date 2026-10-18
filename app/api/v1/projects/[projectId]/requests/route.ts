import { z } from "zod";
import { api } from "@/lib/api";
import { queryList,listInput } from "@/lib/dashboard/list-query";
export async function GET(request:Request,context:{params:Promise<{projectId:string}>}){return api(request,async client=>queryList(client,"requests",listInput({...Object.fromEntries(new URL(request.url).searchParams),project:z.uuid().parse((await context.params).projectId)})));}
