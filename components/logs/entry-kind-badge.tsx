"use client"

import {
  FileText,
  Phone,
  Calendar,
  Clipboard,
  CheckCircle,
  AlertCircle,
  Star,
  Target,
  Activity,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getEntryKindLabel, getEntryKindColor, getEntryKindIcon, getEntryKindDescription } from "@/lib/entry-kinds"
import { cn } from "@/lib/utils"
import type { ScopeEntryKind } from "@/hooks/use-entry-kinds"

// Icon mapping from string names to Lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  FileText,
  Phone,
  Calendar,
  Clipboard,
  CheckCircle,
  AlertCircle,
  Star,
  Target,
  Activity,
}

interface EntryKindBadgeProps {
  config?: ScopeEntryKind | null
  entryKind?: string | null
  className?: string
}

export function EntryKindBadge({ config, entryKind, className }: EntryKindBadgeProps) {
  if (!entryKind) return null

  const label = getEntryKindLabel(entryKind, config)
  const color = getEntryKindColor(entryKind, config)
  const iconName = getEntryKindIcon(entryKind, config)
  const description = getEntryKindDescription(entryKind, config)
  const IconComponent = ICON_MAP[iconName] || FileText

  // Convert hex color to RGB for border styling
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? {
          r: Number.parseInt(result[1], 16),
          g: Number.parseInt(result[2], 16),
          b: Number.parseInt(result[3], 16),
        }
      : { r: 107, g: 114, b: 128 } // default gray
  }

  const rgb = hexToRgb(color)
  const borderColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`
  const textColor = color

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 border-2", className)}
      style={{
        borderColor,
        color: textColor,
      }}
      aria-label={`${label}: ${description}`}
      title={description}
    >
      <IconComponent className="hidden h-3 w-3 sm:block" aria-hidden="true" />
      <span className="max-w-[10rem] truncate text-xs sm:max-w-none sm:text-sm">{label}</span>
    </Badge>
  )
}
