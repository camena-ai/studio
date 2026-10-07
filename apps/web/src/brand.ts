/**
 * Yel's name and the few lines of Cervantes the app quotes. The quotations are from John
 * Ormsby's 1885 translation of Don Quixote, which is in the public domain.
 */
export const APP_NAME = "Yel"

export interface Quote {
  readonly text: string
  readonly by: string
}

export const QUOTES: ReadonlyArray<Quote> = [
  {
    text: "Look, your worship, what we see there are not giants but windmills.",
    by: "Sancho Panza",
  },
  { text: "Where one door shuts another opens.", by: "Don Quixote" },
  { text: "Diligence is the mother of good fortune.", by: "Don Quixote" },
  { text: "Every one is as God made him, and oftentimes a great deal worse.", by: "Sancho Panza" },
]

/** One quote per day, so the hint changes without flickering between renders. */
export const quoteOfTheDay = (now: Date = new Date()): Quote => {
  const day = Math.floor(now.getTime() / 86_400_000)
  return QUOTES[day % QUOTES.length] as Quote
}
