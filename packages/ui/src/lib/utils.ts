import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/** Joins class names and resolves Tailwind conflicts; the `cn` helper every shadcn item imports. */
export function cn(...inputs: ReadonlyArray<ClassValue>): string {
  return twMerge(clsx(inputs))
}
