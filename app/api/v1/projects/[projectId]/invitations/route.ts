import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({error:{code:"IMESSAGE_ONLY",message:"Clients interact with the project through iMessage. Website invitations are no longer supported."}},{status:410});
}
