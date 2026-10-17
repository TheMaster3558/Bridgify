import { AppShell } from "@/components/dashboard/app-shell";

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
