"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="grid max-w-xl gap-4 p-10">
      <h1 className="text-2xl font-semibold">Unable to load your workspace</h1>
      <p>
        Your session or database connection may be unavailable. Check Supabase
        configuration and migrations, then retry.
      </p>
      <button onClick={reset} className="w-fit rounded border px-4 py-2">
        Retry
      </button>
    </main>
  );
}
