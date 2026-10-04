import { useId } from "react"

/**
 * Engraving hatches for the Quixote illustrations: parallel ink lines at an angle, drawn in
 * `currentColor`, so every illustration inks itself in the surrounding text colour and follows
 * the theme. Each instance gets its own pattern id.
 */
export function useHatch(angle = 35, gap = 3, weight = 0.55) {
  const id = `hatch-${useId().replace(/:/g, "")}`
  const pattern = (
    <pattern
      id={id}
      patternUnits="userSpaceOnUse"
      width={gap}
      height={gap}
      patternTransform={`rotate(${angle})`}
    >
      <line x1="0" y1="0" x2="0" y2={gap} stroke="currentColor" strokeWidth={weight} />
    </pattern>
  )
  return { id, fill: `url(#${id})`, pattern }
}
