import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { NavItem } from "./nav";
import { PageHeader } from "./page-header";

/** Placeholder for dashboard sections that are planned but not built yet. */
export function ComingSoon({ item, plan }: { item: NavItem; plan: string[] }) {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={item.title} description={item.description} />
      <div className="flex flex-col items-start gap-4 rounded-xl border border-dashed bg-muted/30 p-8">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <item.icon className="size-5" />
        </span>
        <div>
          <h2 className="font-semibold">Coming soon</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This section is on the roadmap. Here is what it will do:
          </p>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {plan.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <Button asChild variant="outline">
          <Link href="/dashboard/grit-lab">Open Grit Lab meanwhile</Link>
        </Button>
      </div>
    </div>
  );
}
