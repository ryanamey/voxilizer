import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-muted/40 px-4 py-12">
      <Link href="/" aria-label="Voxilizer home" className="rounded-md">
        <Logo />
      </Link>
      <main className="w-full max-w-sm">{children}</main>
      <p className="max-w-sm text-center text-xs text-muted-foreground">
        Voxilizer is a training tool, not medical advice. If hoarseness or pain lasts more than two weeks, see
        a laryngologist.
      </p>
    </div>
  );
}
