"use client";

import { usePathname } from "next/navigation";
import { ALL_NAV } from "./nav";

export function DashboardTitle() {
  const pathname = usePathname();
  const item =
    [...ALL_NAV].sort((a, b) => b.href.length - a.href.length).find((n) => pathname.startsWith(n.href)) ??
    ALL_NAV[0];
  return <span className="truncate text-sm font-medium">{item?.title}</span>;
}
