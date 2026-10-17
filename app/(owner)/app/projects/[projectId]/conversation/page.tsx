import Link from "next/link";
import { authenticatedUserId } from "@/lib/auth/user";
import { IntakeError } from "@/lib/assistant/intake-error";
import { getConversationHistory } from "@/lib/db/conversation-history";
import { getDatabase } from "@/lib/db/postgres";

export default async function Page({ params, searchParams }: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { projectId } = await params;
  const { cursor } = await searchParams;
  let history;
  try {
    const userId = await authenticatedUserId();
    if (userId) history = await getConversationHistory(getDatabase(), { userId, projectId, cursor });
  } catch (error) {
    return <main className="space-y-3 p-6"><h1 className="text-xl font-semibold">Conversation unavailable</h1>
      <p>{error instanceof IntakeError && error.status === 404 ? "This project is unavailable or you do not have access." : "History could not be loaded. Check database and authentication configuration, then retry."}</p>
      <Link className="underline" href={`/app/projects/${encodeURIComponent(projectId)}/conversation`}>Retry</Link></main>;
  }
  if (!history) return <main className="p-6"><h1 className="text-xl font-semibold">Sign in to view conversation history</h1><Link className="underline" href="/login">Sign in</Link></main>;
  return <main className="mx-auto max-w-4xl space-y-5 p-6">
    <div><h1 className="font-display text-2xl font-semibold">Conversation</h1>
      <p className="text-muted-foreground">{history.projectName} · Client group history · Times in UTC</p></div>
    <p className="text-sm text-muted-foreground">Read-only source evidence. A received message does not mean work was accepted. Newest messages appear first.</p>
    {!history.messages.length ? <p className="rounded-lg border p-6">No messages received for the linked client group yet.</p> : null}
    <ol className="space-y-4">{history.messages.map(message => <li key={message.id} id={`message-${message.id}`} className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap justify-between gap-2 text-sm"><strong>{message.senderRole} · {message.senderId ?? "Unidentified sender"}</strong><time dateTime={message.receivedAt}>{message.receivedAt}</time></div>
      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">Provider message: {message.providerMessageGuid}</p>
      {message.revisions.map(revision => <section key={revision.id} id={`source-${revision.id}`} className="mt-4 space-y-2 border-t pt-3">
        <div className="flex flex-wrap gap-2 text-xs"><span>Revision {revision.revision} · {revision.kind}</span><span className="rounded bg-muted px-2">{revision.processingState.replaceAll("_", " ")}</span></div>
        <p className="whitespace-pre-wrap break-words">{revision.deleted ? "Message deleted by provider; earlier source revisions are preserved below or above." : revision.text ?? "Unsupported or non-text content; not interpreted."}</p>
        <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Source reference and timestamps</summary>
          <p className="break-all">Source revision: {revision.id}</p><p>Sender: {revision.senderRole} · {revision.senderId ?? "Not supplied"}</p><p>Provider time: {revision.providerOccurredAt ?? "Not supplied"}</p><p>Received: {revision.receivedAt}</p>
        </details>
      </section>)}
    </li>)}</ol>
    {history.nextCursor ? <Link className="inline-block rounded-md border px-4 py-2" href={`?cursor=${encodeURIComponent(history.nextCursor)}`}>Older messages</Link> : null}
  </main>;
}
