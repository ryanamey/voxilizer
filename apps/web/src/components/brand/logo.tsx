import { cn } from "@/lib/utils";

/**
 * Voxilizer mark: a clean waveform with a rough, distorted second half,
 * the "clean source + added grit" idea at the heart of the product.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M5 16c2-6 4-6 6 0s4 6 6 0"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        className="stroke-primary-foreground"
      />
      <path
        d="M17 16l1.6-5 1.3 9 1.5-7 1.2 5 1.4-6 1.3 7 1.2-3"
        fill="none"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-primary-foreground"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span className="text-lg">Voxilizer</span>
    </span>
  );
}
