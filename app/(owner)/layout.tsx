import { AppShell } from "@/components/dashboard/app-shell";
import { DashboardProvider } from "@/components/dashboard/dashboard-context";

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardProvider>
      <AppShell>{children}</AppShell>
    </DashboardProvider>
  );
}
