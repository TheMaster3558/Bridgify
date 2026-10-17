import Link from "next/link";
import { PageBody, Panel } from "@/components/dashboard/panel";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { projects } from "@/lib/sample";

export const metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <PageBody>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <div className="flex flex-wrap gap-2">
          <Input className="w-52" placeholder="Search by name" aria-label="Search by name" />
          <select className="h-9 rounded-md border bg-background px-3 text-sm" aria-label="Filter by state">
            <option>All states</option>
            <option>Active</option>
            <option>Draft</option>
            <option>Completed</option>
          </select>
          <Button asChild>
            <Link href="/app/projects/new">New project</Link>
          </Button>
        </div>
      </div>
      <Panel bodyClassName="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Automation</TableHead>
              <TableHead>Pending decisions</TableHead>
              <TableHead>Next agreed date</TableHead>
              <TableHead className="text-right">Approved value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.id}>
                <TableCell>
                  <Link href={`/app/projects/${project.id}`} className="font-medium hover:underline">
                    {project.name}
                  </Link>
                </TableCell>
                <TableCell>{project.client}</TableCell>
                <TableCell>
                  <StatusPill tone={project.state === "Active" ? "ok" : "neutral"}>
                    {project.state}
                  </StatusPill>
                </TableCell>
                <TableCell>{project.automation}</TableCell>
                <TableCell>{project.decisions}</TableCell>
                <TableCell>{project.nextDate}</TableCell>
                <TableCell className="text-right">{project.value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </PageBody>
  );
}
