import { cn } from "@studio/ui/lib/utils"
import { useHatch } from "./hatch.tsx"
import { WindmillGlyph } from "./windmill.tsx"

/**
 * The new-chat illustration, engraving style: the knight on Rocinante charging a windmill across
 * the hatched hills of La Mancha, a second mill on the horizon and a low sun. Inked in
 * `currentColor`; decorative.
 */
export function LaManchaScene({ className, ...props }: React.ComponentProps<"svg">) {
  const hills = useHatch(0, 3.2, 0.45)
  const field = useHatch(-28, 2.4, 0.5)
  return (
    <svg
      viewBox="0 0 360 150"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn("w-full max-w-md", className)}
      {...props}
    >
      <defs>
        {hills.pattern}
        {field.pattern}
      </defs>

      {/* sun */}
      <circle cx="72" cy="34" r="9" strokeWidth="1" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6
        return (
          <path
            key={a}
            d={`M${72 + Math.cos(a) * 13} ${34 + Math.sin(a) * 13}L${72 + Math.cos(a) * 17} ${34 + Math.sin(a) * 17}`}
            strokeWidth="0.8"
          />
        )
      })}

      {/* distant hills and the far mill */}
      <path
        d="M0 112c40-12 90-14 140-6s110-10 220-2v46H0Z"
        fill={hills.fill}
        strokeWidth="0"
        opacity="0.5"
      />
      <path d="M0 112c40-12 90-14 140-6s110-10 220-2" strokeWidth="0.9" opacity="0.7" />
      <g transform="translate(14 64) scale(0.7)" opacity="0.65">
        <WindmillGlyph />
      </g>

      {/* the giant */}
      <g transform="translate(232 24) scale(1.55)">
        <WindmillGlyph />
      </g>

      {/* foreground field */}
      <path d="M0 130c70-8 150-6 220-2s100-6 140-4v26H0Z" fill={field.fill} strokeWidth="0" />
      <path d="M0 130c70-8 150-6 220-2s100-6 140-4" strokeWidth="1.2" />

      {/* Rocinante and the knight, charging right */}
      <g transform="translate(112 86)">
        {/* dust */}
        <path d="M-6 38c-4-1-7 0-9 2M-2 42c-5 0-8 1-10 3M-10 33c-3 0-5 1-6 2" strokeWidth="0.8" />
        {/* horse */}
        <path
          fill="currentColor"
          strokeWidth="0.6"
          d="M10 18c4-4 24-4 30-2 4-4 8-10 12-11l5 3-2 3h-5c-3 2-5 7-6 11-1 2 0 5 3 11l-2 1c-4-5-5-7-7-9-5 1-16 1-21 0-1 4-4 7-9 10l-1-2c3-3 4-6 4-9-3 0-6 3-9 2 3-2 5-6 8-8Z"
        />
        <path d="M44 23c3 3 6 6 7 11M17 25c-2 4-2 8 0 12" strokeWidth="1.3" />
        {/* knight: torso, shield arm, helmet */}
        <path fill="currentColor" strokeWidth="0.6" d="M27 15c1-5 3-9 6-11l3 1c-1 4-3 8-5 11Z" />
        <path d="M31 4.5c0-3 5-3.4 5-.2M29.5 4.6l8-.4" strokeWidth="1.1" />
        {/* the lance, levelled at the giant */}
        <path d="M24 12 96 -9" strokeWidth="1.3" />
        <path d="M90 -7.2 96 -9 91.5 -4.4" strokeWidth="0.9" />
      </g>
    </svg>
  )
}
