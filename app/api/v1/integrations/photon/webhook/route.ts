import { readBody } from "@/lib/body";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/db/admin";
import {
  gatewayEventSchema,
  verifyGateway,
  photon,
  membershipHash,
} from "@/lib/photon/connection";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!verifyGateway(request.headers))
    return new Response("Unauthorized", { status: 401 });
  if (Number(request.headers.get("content-length")) > 65536)
    return new Response("Too large", { status: 413 });
  try {
    const raw = new TextDecoder().decode(await readBody(request, 65536));
    if (raw.length > 65536) return new Response("Too large", { status: 413 });
    const event = gatewayEventSchema.parse(JSON.parse(raw));
    if (event.instanceId !== process.env.PHOTON_INSTANCE_ID)
      return new Response("Unknown instance", { status: 403 });
    const admin = adminDb();
    const { data: binding, error } = await admin
      .from("chat_bindings")
      .select("project_id")
      .eq("instance_id", event.instanceId)
      .eq("chat_guid", event.chatGuid)
      .maybeSingle();
    if (error) return new Response("Unavailable", { status: 503 });
    if (!binding) return NextResponse.json({ status: "unlinked" });
    const im = photon(event.instanceId);
    try {
      const chat = await im.chats.get(event.chatGuid);
      if (chat.guid !== event.chatGuid || !chat.isGroup)
        return new Response("Group unavailable", { status: 422 });
      const hash = membershipHash([
        ...chat.participants.map((p) => p.address),
        process.env.PHOTON_BOT_SENDER_ID!,
      ]);
      const { data, error } = await admin.rpc("receive_onboarding_event", {
        p_event: event,
        p_membership_hash: hash,
      });
      if (error)
        return new Response("Unable to persist event", { status: 503 });
      return NextResponse.json({ status: data });
    } finally {
      await im.close();
    }
  } catch {
    return new Response("Invalid event or provider unavailable", {
      status: 503,
    });
  }
}
