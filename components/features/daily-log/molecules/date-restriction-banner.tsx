import { AlertCircle } from "lucide-react"

interface DateRestrictionBannerProps {
  title: string
}

export function DateRestrictionBanner({ title }: DateRestrictionBannerProps) {
  return (
    <div
      className="flex items-center justify-center gap-2 rounded-lg border border-blue-500/50 bg-blue-500/10 px-4 py-2"
      title={title}
    >
      <AlertCircle className="h-4 w-4 shrink-0 text-blue-500" />
      <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Past dates allowed, future dates blocked</p>
    </div>
  )
}
