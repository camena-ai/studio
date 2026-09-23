import { Button } from "@studio/ui/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@studio/ui/components/ui/dropdown-menu"
import { Check, Monitor, Moon, Sun } from "lucide-react"

/** What the user asked for. `system` follows `prefers-color-scheme`. */
export type ThemePreference = "light" | "dark" | "system"

export type ThemeToggleProps = {
  readonly theme: ThemePreference
  readonly onThemeChange: (theme: ThemePreference) => void
}

const options: ReadonlyArray<{
  readonly value: ThemePreference
  readonly label: string
  readonly icon: React.ComponentType<{ className?: string }>
}> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
]

export function ThemeToggle({ theme, onThemeChange }: ThemeToggleProps) {
  const Current = options.find((option) => option.value === theme)?.icon ?? Monitor
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="Theme">
          <Current className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem key={value} onSelect={() => onThemeChange(value)}>
            <Icon className="size-4" />
            {label}
            {value === theme ? <Check className="ml-auto size-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
