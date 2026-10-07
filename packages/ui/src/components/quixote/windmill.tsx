import { cn } from "@studio/ui/lib/utils"
import { useHatch } from "./hatch.tsx"

export type WindmillProps = React.ComponentProps<"svg"> & {
  /** Turn the sails, e.g. while the model is running. Still under `prefers-reduced-motion`. */
  readonly spinning?: boolean
}

/** The windmill's drawing in a 64×64 box, for use inside a larger illustration. */
export function WindmillGlyph({ spinning = false }: { readonly spinning?: boolean }) {
  const shade = useHatch(40, 2.2, 0.5)
  const capShade = useHatch(-35, 1.8, 0.5)
  return (
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        {shade.pattern}
        {capShade.pattern}
      </defs>
      {/* ground */}
      <path d="M6 59.5c10-1.6 20-2 26-2s16 .4 26 2" strokeWidth="1.1" />
      {/* tower, with the shaded right flank */}
      <path d="M23.5 58.5 26.5 27h11l3 31.5Z" strokeWidth="1.4" fill="var(--background)" />
      <path d="M33.5 27h4l3 31.5h-5.6Z" fill={shade.fill} stroke="none" />
      {/* door and window */}
      <path d="M29.6 58.5v-6.2a2.4 2.4 0 0 1 4.8 0v6.2" strokeWidth="1.1" />
      <rect x="30.3" y="38" width="3.4" height="4.2" rx="0.6" strokeWidth="1" />
      {/* conical cap */}
      <path d="M24.5 27.4 32 18l7.5 9.4Z" strokeWidth="1.3" fill="var(--background)" />
      <path d="M32 18l7.5 9.4h-4.2Z" fill={capShade.fill} stroke="none" />
      {/* sails */}
      <g
        style={{ transformBox: "view-box", transformOrigin: "32px 23px" }}
        className={cn(spinning && "motion-safe:animate-[spin_6s_linear_infinite]")}
      >
        {[0, 90, 180, 270].map((angle) => (
          <g key={angle} transform={`rotate(${angle + 20} 32 23)`}>
            <path d="M32 23V4.5" strokeWidth="1.2" />
            <path d="M32.6 21.5h4.2V6h-4.2" strokeWidth="0.9" />
            <path d="M32.6 17.6h4.2M32.6 13.7h4.2M32.6 9.8h4.2" strokeWidth="0.6" />
          </g>
        ))}
        <circle cx="32" cy="23" r="1.7" fill="currentColor" stroke="none" />
      </g>
    </g>
  )
}

/**
 * A La Mancha windmill in engraving style: a whitewashed tower with hatched shade, a conical
 * cap and four lattice sails. Inked in `currentColor`. It is Yel's mark (`YelMark`) and the
 * status page's heartbeat (`spinning`).
 */
export function Windmill({ className, spinning = false, ...props }: WindmillProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      className={cn("size-16", className)}
      {...props}
    >
      <WindmillGlyph spinning={spinning} />
    </svg>
  )
}

/** Yel's mark: the windmill at rest. Decorative; the wordmark carries the name. */
export function YelMark(props: React.ComponentProps<"svg">) {
  return <Windmill {...props} />
}
