import { RecentProjects } from "@/components/projects/recent-projects";

export default function Page() {
  return (
    <main className="mx-auto grid max-w-5xl gap-8 p-6 md:p-10">
      <div>
        <h1 className="font-display text-3xl font-semibold">Your workspace</h1>
        <p className="mt-3 text-muted-foreground">
          Confirm the agreement and client identities before connecting
          automation.
        </p>
      </div>
      <RecentProjects />
    </main>
  );
}
