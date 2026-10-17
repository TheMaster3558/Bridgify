import Link from "next/link";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { tasks } from "@/lib/sample";

export function TaskTable({
  rows = tasks,
  showProject = true,
}: {
  rows?: typeof tasks;
  showProject?: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Task</TableHead>
          {showProject ? <TableHead>Project</TableHead> : null}
          <TableHead>Status</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Assignee</TableHead>
          <TableHead>Agreed date</TableHead>
          <TableHead>Accepted via</TableHead>
          <TableHead>Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((task) => (
          <TableRow key={task.id}>
            <TableCell className="whitespace-normal">
              <Link href={`/app/tasks/${task.id}`} className="font-medium hover:underline">
                <span className="mr-2 font-mono text-xs text-muted-foreground">{task.id}</span>
                {task.title}
              </Link>
              {"blocked" in task && task.blocked ? (
                <p className="mt-1 text-xs text-muted-foreground">Blocked: {task.blocked}</p>
              ) : null}
            </TableCell>
            {showProject ? <TableCell>{task.project}</TableCell> : null}
            <TableCell>
              <StatusPill tone={task.tone}>{task.status}</StatusPill>
            </TableCell>
            <TableCell>{task.priority}</TableCell>
            <TableCell>{task.assignee}</TableCell>
            <TableCell>{task.date ?? "No date agreed"}</TableCell>
            <TableCell>{task.origin}</TableCell>
            <TableCell className="text-muted-foreground">{task.updated}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
