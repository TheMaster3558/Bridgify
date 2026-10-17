"use client";

import { useState } from "react";
import { PageBody, Panel } from "@/components/dashboard/panel";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requests } from "@/lib/sample";
import { cn } from "@/lib/utils";

const filters = ["All", "Accepted", "Clarifying", "Owner decision", "Pending approval"] as const;

export function RequestsView() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [selectedId, setSelectedId] = useState(requests[0].id);
  const rows = requests.filter((request) => filter === "All" || request.state === filter);
  const request = requests.find((item) => item.id === selectedId) ?? requests[0];

  return (
    <PageBody>
      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              filter === item ? "border-foreground bg-foreground text-background" : "text-muted-foreground",
            )}
          >
            {item}
          </button>
        ))}
      </div>
      <Panel bodyClassName="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Request</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Handling</TableHead>
              <TableHead>Linked</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item) => (
              <TableRow
                key={item.id}
                data-state={item.id === request.id ? "selected" : undefined}
                className="cursor-pointer"
                onClick={() => setSelectedId(item.id)}
              >
                <TableCell className="font-mono text-xs">{item.id}</TableCell>
                <TableCell className="whitespace-normal">{item.description}</TableCell>
                <TableCell>{item.time}</TableCell>
                <TableCell className="font-mono text-xs">{item.category}</TableCell>
                <TableCell>
                  <StatusPill tone={item.tone}>{item.state}</StatusPill>
                </TableCell>
                <TableCell>{item.linked}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
      <Panel title={request.description} description={request.id} action={<StatusPill tone={request.tone}>{request.state}</StatusPill>}>
        <div className="grid gap-4 md:grid-cols-2 text-sm">
          <blockquote className="border-l-4 border-info bg-muted px-3 py-2">
            {request.source}
            <cite className="mt-1 block text-xs text-muted-foreground not-italic">{request.time}</cite>
          </blockquote>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2">
            <dt className="text-muted-foreground">Applied rule</dt>
            <dd>{request.rule}</dd>
            <dt className="text-muted-foreground">Revision usage</dt>
            <dd>{request.usage}</dd>
            <dt className="text-muted-foreground">Linked record</dt>
            <dd>{request.linked}</dd>
          </dl>
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="button" variant="outline" size="sm">
            Correct classification
          </Button>
          <Button type="button" variant="outline" size="sm">
            Open in conversation
          </Button>
        </div>
      </Panel>
    </PageBody>
  );
}
