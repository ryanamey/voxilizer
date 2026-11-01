import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRightIcon, MusicIcon } from "lucide-react";
import { NAV_MAIN } from "@/components/dashboard/nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/dal";
import { listSongs } from "@/lib/songs";

export const metadata: Metadata = { title: "Overview" };

async function Greeting() {
  const user = await requireUser();
  const first = user.name.split(/\s+/)[0] || "there";
  return <h1 className="text-2xl font-bold tracking-tight">Welcome back, {first}</h1>;
}

const dateFmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });

async function RecentSongs() {
  const user = await requireUser();
  const songs = await listSongs(user.id, 5).catch(() => null);
  if (songs === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Your songs couldn&apos;t be loaded right now. Refresh to try again.
      </p>
    );
  }
  if (songs.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">
          No saved songs yet. Write a melody in Melody Studio and save it to see it here.
        </p>
        <Button asChild size="sm">
          <Link href="/dashboard/melody-studio">Open Melody Studio</Link>
        </Button>
      </div>
    );
  }
  return (
    <ul className="divide-y">
      {songs.map((s) => (
        <li key={s.id}>
          <Link
            href={`/dashboard/melody-studio?song=${s.id}`}
            className="flex items-center gap-3 rounded-md px-2 py-3 hover:bg-muted/50"
          >
            <MusicIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-medium">{s.title}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {s.noteCount} notes · {dateFmt.format(s.updatedAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function OverviewPage() {
  const sections = NAV_MAIN.filter((n) => n.href !== "/dashboard");
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Suspense fallback={<Skeleton className="h-8 w-64" />}>
          <Greeting />
        </Suspense>
        <p className="mt-1 text-muted-foreground">
          Design a tone, write a line, and hear it before you sing it.
        </p>
      </div>

      <section aria-labelledby="sections-heading" className="flex flex-col gap-4">
        <h2 id="sections-heading" className="sr-only">
          Sections
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group flex flex-col gap-3 rounded-xl border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <s.icon className="size-5" />
                </span>
                {s.soon ? (
                  <Badge variant="secondary">Soon</Badge>
                ) : (
                  <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                )}
              </div>
              <div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="recent-heading" className="rounded-xl border bg-card p-5">
        <h2 id="recent-heading" className="mb-3 font-semibold">
          Recent songs
        </h2>
        <Suspense
          fallback={
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          }
        >
          <RecentSongs />
        </Suspense>
      </section>
    </div>
  );
}
