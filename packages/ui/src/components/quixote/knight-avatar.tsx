import { cn } from "@studio/ui/lib/utils"
import { useId } from "react"
import { useHatch } from "./hatch.tsx"

/**
 * The assistant's avatar: the knight of La Mancha in profile, engraving style. He wears the
 * barber's basin he took for Mambrino's helmet (the *yelmo*, notch and all), a lean face, a
 * pointed beard, and his lance and pennant at his back. Inked in `currentColor` on `--card`.
 */
export function KnightAvatar({ className, ...props }: React.ComponentProps<"svg">) {
  const helmet = useHatch(-30, 1.6, 0.45)
  const armour = useHatch(30, 1.8, 0.45)
  const beard = useHatch(80, 1.2, 0.4)
  const clip = `knight-frame-${useId().replace(/:/g, "")}`
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn("size-8 shrink-0", className)}
      {...props}
    >
      <defs>
        {helmet.pattern}
        {armour.pattern}
        {beard.pattern}
        <clipPath id={clip}>
          <circle cx="24" cy="24" r="22.4" />
        </clipPath>
      </defs>
      <circle cx="24" cy="24" r="23" fill="var(--card)" strokeWidth="1" />
      <g clipPath={`url(#${clip})`}>
        {/* lance and pennant */}
        <path d="M37.5 49 41 3.5" strokeWidth="1.1" />
        <path d="M40.7 7.5 46.5 9.6 40.4 11.6" strokeWidth="0.8" fill="var(--card)" />
        {/* gorget and shoulders */}
        <path
          d="M10 49c1.5-8.5 7-12.6 13.6-12.6 6.8 0 12 4 13.6 12.6Z"
          strokeWidth="1.1"
          fill={armour.fill}
        />
        <path d="M17.5 40.2c4.4 1.8 9.2 1.8 13 0" strokeWidth="0.8" />
        {/* neck */}
        <path d="M22.4 30.6v5.6M27.2 31.8v4.4" strokeWidth="0.9" />
        {/* face in profile, looking right */}
        <path
          d="M21.4 19.2c-.6 4.2 0 8 2.6 11.4l4.6 4.2 1-4.6c.8-1.2 1-2.4.8-3.4l.8-1c1.2-.2 2.2-.8 1.8-1.6l-2.2-3.2c-.2-1.2-.6-2-1.2-2.6"
          strokeWidth="1.2"
          fill="var(--card)"
        />
        {/* pointed beard and moustache */}
        <path
          d="M25.4 30.2l3.2 4.6.9-4.2c-1.6.3-2.9.2-4.1-.4Z"
          fill={beard.fill}
          strokeWidth="0.6"
        />
        <path d="M31.2 26.1c-1.4.6-2.6.3-3.4-.7" strokeWidth="0.8" />
        {/* eye, brow, ear */}
        <path d="M28.4 21.6h1.6" strokeWidth="1" />
        <path d="M27.6 20.2c.9-.5 2-.6 3-.2" strokeWidth="0.7" />
        <path d="M23.6 22.4c-1.2.2-1.6 1.6-.6 2.4" strokeWidth="0.8" />
        {/* Mambrino's helmet: the barber's basin, rim notch to the front */}
        <path d="M19.6 18.6c0-7.4 11.8-8 11.8-.8" strokeWidth="1.2" fill={helmet.fill} />
        <path d="M17 19.2 26.4 18.4m3.6-.3 4.4-.4" strokeWidth="1.3" />
        <path d="M26.4 18.4a1.8 1.8 0 0 0 3.6-.3" strokeWidth="0.9" />
      </g>
    </svg>
  )
}
