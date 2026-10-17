import Link from "next/link";
import { messages } from "@/lib/sample";

export const metadata = { title: "iMessage" };

export default function IMessagePreviewPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-wrap items-start justify-center gap-8 px-4 py-10">
      <div className="max-w-sm space-y-3">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">What the client sees</p>
        <h1 className="text-2xl font-semibold">Harbor & Pine × Website</h1>
        <p className="text-sm text-muted-foreground">
          An ordinary iMessage group. Private owner notes, pricing notes, and internal tasks never appear here.
        </p>
        <Link href="/app/projects/harbor-pine/conversation" className="text-sm text-primary">
          Open dashboard evidence view
        </Link>
      </div>
      <div className="flex h-[640px] w-full max-w-sm flex-col overflow-hidden rounded-[2rem] border-8 border-foreground bg-white text-black">
        <div className="border-b px-4 py-3 text-center">
          <p className="text-sm font-semibold">Harbor & Pine × Website</p>
          <p className="text-xs text-neutral-500">Maya, Amogh, Bridgify</p>
        </div>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3 text-sm">
          {messages.map((message) =>
            "day" in message ? (
              <p key={message.day} className="text-center text-[11px] text-neutral-500">
                {message.day}
              </p>
            ) : (
              <div key={`${message.time}-${message.text}`}>
                <p className={`mb-1 text-[11px] ${message.bot ? "text-[#0B6873]" : "text-neutral-500"}`}>
                  {message.bot ? "Bridgify" : message.who}
                </p>
                <p
                  className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                    message.bot
                      ? "border border-[#0B6873] bg-[#E9E9EB]"
                      : "bg-[#E9E9EB]"
                  }`}
                >
                  {message.text}
                </p>
              </div>
            ),
          )}
        </div>
        <div className="border-t px-3 py-2 text-xs text-neutral-400">iMessage</div>
      </div>
    </main>
  );
}
