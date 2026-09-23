import { cn } from "@studio/ui/lib/utils"

/**
 * The Studio mark: an original placeholder built from three overlapping shapes in token colours.
 * Decorative only; swap the paths for final artwork without touching call sites.
 */
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
        fill="var(--chart-1)"
      />
      <circle cx="60" cy="34" r="17" fill="var(--chart-4)" />
      <rect x="18" y="62" width="22" height="16" rx="5" fill="var(--chart-5)" />
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
