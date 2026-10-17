"use client";

import { useState } from "react";
import Link from "next/link";
import { Field } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const modes = [
  { id: "owner", label: "Owner sign-in" },
  { id: "client", label: "Client invite" },
  { id: "expired", label: "Expired invite" },
] as const;

export function LoginScreen() {
  const [mode, setMode] = useState<(typeof modes)[number]["id"]>("owner");

  return (
    <main className="flex min-h-screen items-start justify-center px-4 py-16">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <div className="mx-auto flex rounded-md border p-0.5 text-sm">
          {modes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={cn("rounded px-3 py-1.5", mode === item.id && "bg-foreground text-background")}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-7">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
              B
            </span>
            <span className="font-display text-xl font-semibold">Bridgify</span>
          </div>
          {mode === "expired" ? (
            <>
              <h1 className="text-xl font-semibold">This link has expired</h1>
              <p className="text-sm text-muted-foreground">
                Ask the person who sent it for a new link. For your security this page doesn’t show which project it was for.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold">
                {mode === "client" ? "Sign in to review a proposal" : "Sign in"}
              </h1>
              {mode === "client" ? (
                <p className="text-sm text-muted-foreground">
                  After signing in you’ll go straight to the proposal you were invited to review.
                </p>
              ) : null}
              <Field label="Email">
                <Input
                  type="email"
                  defaultValue={mode === "client" ? "maya@harborandpine.example" : "amogh@northlight.example"}
                />
              </Field>
              <Field label="Password">
                <Input type="password" defaultValue="password" />
              </Field>
              <Button asChild>
                <Link href={mode === "client" ? "/proposals/P-001?revision=2" : "/app"}>Sign in</Link>
              </Button>
              <p className="text-xs text-muted-foreground">
                Wrong email or password shows here. Invalid invites stay neutral and don’t reveal other customers.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
