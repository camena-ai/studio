import { cn } from "@studio/ui/lib/utils"

/**
 * The Studio mark: an original placeholder built from three overlapping shapes. Its colours are
 * fixed brand values rather than theme tokens so the mark reads the same in light and dark; the
 * face details use `--background` so they cut through in both. Decorative only; swap the paths
 * for final artwork without touching call sites.
 */
const brand = {
  body: "oklch(0.62 0.2 300)",
  cap: "oklch(0.86 0.17 92)",
  base: "oklch(0.68 0.2 25)",
} as const
export function StudioMark({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 96 96"
      aria-hidden="true"
      focusable="false"
      className={cn("size-16", className)}
      {...props}
    >
      <title>Studio</title>
      <rect
        x="22"
        y="30"
        width="44"
        height="44"
        rx="12"
        transform="rotate(-8 44 52)"
        fill={brand.body}
      />
      <circle cx="60" cy="34" r="17" fill={brand.cap} />
      <rect x="18" y="62" width="22" height="16" rx="5" fill={brand.base} />
      <circle cx="36" cy="50" r="3" fill="var(--background)" />
      <circle cx="52" cy="48" r="3" fill="var(--background)" />
      <path
        d="M38 60c4 4 10 4 14 0"
        stroke="var(--background)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
