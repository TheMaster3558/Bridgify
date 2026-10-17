import Link from "next/link";
export default function NotFound() {
  return (
    <main className="grid gap-4 p-10">
      <h1 className="text-2xl font-semibold">Page unavailable</h1>
      <p>This page is missing or unavailable to your account.</p>
      <Link href="/login" className="underline">
        Sign in
      </Link>
    </main>
  );
}
