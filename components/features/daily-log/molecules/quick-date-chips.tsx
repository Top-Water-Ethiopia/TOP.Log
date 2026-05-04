import { Button } from "@/components/ui/button"

export type QuickDateOption = {
  key: string
  label: string
  date: string
}

interface QuickDateChipsProps {
  options: QuickDateOption[]
  selectedDate: string
  onSelectDate: (date: string) => void
}

export function QuickDateChips({ options, selectedDate, onSelectDate }: QuickDateChipsProps) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
      {options.map((opt) => (
        <Button
          key={opt.key}
          type="button"
          variant={opt.date === selectedDate ? "default" : "outline"}
          size="sm"
          className="rounded-full px-6"
          onClick={() => onSelectDate(opt.date)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  )
}
