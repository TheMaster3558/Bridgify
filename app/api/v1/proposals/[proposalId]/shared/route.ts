import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({error:{code:"IMESSAGE_ONLY",message:"Clients interact with the project through iMessage. Client website proposal access are no longer supported."}},{status:410});
}
